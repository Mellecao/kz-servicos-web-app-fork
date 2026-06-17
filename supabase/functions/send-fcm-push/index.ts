import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewRecord {
  id: string;
  status: string;
  client_id: string;
  driver_profile_id?: string | null;
  provider_profile_id?: string | null;
  pickup_address_id?: string | null;
  dropoff_address_id?: string | null;
}

interface RequestPayload {
  table: 'trips' | 'service_requests' | 'trip_driver_candidates';
  event: string;
  old_status?: string;
  new_record: NewRecord;
}

interface PushTarget {
  token: string;
  role: 'client' | 'driver' | 'provider';
}

interface NotificationSpec {
  targets: PushTarget[];
  title: string;
  body: string;
  dataType: string;
  persistent: boolean;
  tripId?: string;
  serviceRequestId?: string;
}

// ---------------------------------------------------------------------------
// JWT / FCM helpers
// ---------------------------------------------------------------------------

async function pemToArrayBuffer(pem: string): Promise<ArrayBuffer> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createJWT(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyBuffer = await pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(signingInput));
  return `${signingInput}.${base64url(signature)}`;
}

async function getFCMAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const jwt = await createJWT(clientEmail, privateKeyPem);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Failed to obtain FCM access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ---------------------------------------------------------------------------
// FCM send
// ---------------------------------------------------------------------------

async function sendFCMMessage(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  dataPayload: Record<string, string>,
  persistent: boolean
): Promise<{ ok: boolean; error?: string }> {
  // deno-lint-ignore no-explicit-any
  const message: Record<string, any> = {
    token,
    data: dataPayload,
    android: {
      priority: 'high',
      notification: {
        channel_id: 'trip_notifications',
        priority: 'high',
      },
    },
  };

  if (!persistent) {
    // Non-persistent: include notification block so the OS shows it automatically
    message.notification = { title, body };
  } else {
    // Persistent (trip_request / recheck): data-only, app handles display
    // Remove android.notification to avoid OS auto-display
    message.android = { priority: 'high' };
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    }
  );

  if (res.ok) return { ok: true };

  const errBody = await res.text();
  // 404 / UNREGISTERED tokens are expected — treat as soft error
  if (res.status === 404 || errBody.includes('UNREGISTERED')) {
    return { ok: false, error: `token_invalid:${token.slice(0, 20)}` };
  }
  return { ok: false, error: `fcm_error:${res.status}:${errBody.slice(0, 200)}` };
}

// ---------------------------------------------------------------------------
// Supabase data fetchers
// ---------------------------------------------------------------------------

async function getClientToken(
  supabase: ReturnType<typeof createClient>,
  clientId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('fcm_token')
    .eq('id', clientId)
    .single();

  if (error || !data?.fcm_token) return null;
  return data.fcm_token;
}

async function getDriverTokens(
  supabase: ReturnType<typeof createClient>,
  driverProfileId: string
): Promise<string[]> {
  // driver_profiles has its own fcm_token, and also links to provider_profiles -> users
  const tokens: string[] = [];

  // 1. Direct fcm_token on driver_profiles
  const { data: dp } = await supabase
    .from('driver_profiles')
    .select('fcm_token, provider_profile_id')
    .eq('id', driverProfileId)
    .single();

  if (dp?.fcm_token) tokens.push(dp.fcm_token);

  // 2. fcm_token via provider_profiles -> users
  if (dp?.provider_profile_id) {
    const { data: pp } = await supabase
      .from('provider_profiles')
      .select('user_id')
      .eq('id', dp.provider_profile_id)
      .single();

    if (pp?.user_id) {
      const { data: user } = await supabase
        .from('users')
        .select('fcm_token')
        .eq('id', pp.user_id)
        .single();

      if (user?.fcm_token && user.fcm_token !== dp.fcm_token) {
        tokens.push(user.fcm_token);
      }
    }
  }

  return tokens.filter(Boolean);
}

async function getPendingCandidateTokens(
  supabase: ReturnType<typeof createClient>,
  tripId: string
): Promise<string[]> {
  // Get all driver candidates with status=pending for this trip
  const { data: candidates, error } = await supabase
    .from('trip_driver_candidates')
    .select('driver_profile_id')
    .eq('trip_id', tripId)
    .eq('status', 'pending');

  if (error || !candidates?.length) return [];

  const tokens: string[] = [];

  for (const candidate of candidates) {
    const driverTokens = await getDriverTokens(supabase, candidate.driver_profile_id);
    tokens.push(...driverTokens);
  }

  return [...new Set(tokens)]; // deduplicate
}

async function getAddressText(
  supabase: ReturnType<typeof createClient>,
  addressId: string | null | undefined
): Promise<string> {
  if (!addressId) return 'endereço desconhecido';

  const { data, error } = await supabase
    .from('addresses')
    .select('formatted_address')
    .eq('id', addressId)
    .single();

  if (error || !data?.formatted_address) return 'endereço desconhecido';
  return data.formatted_address;
}

async function getClientName(
  supabase: ReturnType<typeof createClient>,
  clientId: string
): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', clientId)
    .single();

  return data?.full_name ?? 'Passageiro';
}

// ---------------------------------------------------------------------------
// Notification resolution
// ---------------------------------------------------------------------------

async function resolveTripsNotification(
  supabase: ReturnType<typeof createClient>,
  record: NewRecord
): Promise<NotificationSpec | null> {
  const status = record.status;
  const tripId = record.id;

  switch (status) {
    case 'searching_drivers': {
      const tokens = await getPendingCandidateTokens(supabase, tripId);
      if (!tokens.length) return null;

      const clientName = await getClientName(supabase, record.client_id);
      const pickup = await getAddressText(supabase, record.pickup_address_id);
      const dropoff = await getAddressText(supabase, record.dropoff_address_id);

      return {
        targets: tokens.map((t) => ({ token: t, role: 'driver' })),
        title: 'Nova corrida disponível!',
        body: `${clientName} solicitou uma corrida de ${pickup} para ${dropoff}.`,
        dataType: 'trip_request',
        persistent: true,
        tripId,
      };
    }

    case 'awaiting_client_confirmation': {
      const token = await getClientToken(supabase, record.client_id);
      if (!token) return null;
      return {
        targets: [{ token, role: 'client' }],
        title: 'Motorista encontrado!',
        body: 'Um motorista aceitou sua viagem. Confirme agora no app.',
        dataType: 'awaiting_confirmation',
        persistent: false,
        tripId,
      };
    }

    case 'awaiting_driver_confirmation': {
      if (!record.driver_profile_id) return null;
      const tokens = await getDriverTokens(supabase, record.driver_profile_id);
      if (!tokens.length) return null;

      const clientName = await getClientName(supabase, record.client_id);

      return {
        targets: tokens.map((t) => ({ token: t, role: 'driver' })),
        title: 'Passageiro confirmou!',
        body: `${clientName} confirmou a corrida. Toque para confirmar sua participação.`,
        dataType: 'recheck',
        persistent: true,
        tripId,
      };
    }

    case 'scheduled': {
      const notifications: NotificationSpec[] = [];

      // Client
      const clientToken = await getClientToken(supabase, record.client_id);
      if (clientToken) {
        notifications.push({
          targets: [{ token: clientToken, role: 'client' }],
          title: 'Viagem confirmada!',
          body: 'Sua viagem está confirmada.',
          dataType: 'trip_scheduled',
          persistent: false,
          tripId,
        });
      }

      // Driver
      if (record.driver_profile_id) {
        const driverTokens = await getDriverTokens(supabase, record.driver_profile_id);
        if (driverTokens.length) {
          notifications.push({
            targets: driverTokens.map((t) => ({ token: t, role: 'driver' })),
            title: 'Viagem agendada!',
            body: 'A viagem foi confirmada e agendada.',
            dataType: 'trip_scheduled_driver',
            persistent: false,
            tripId,
          });
        }
      }

      // Return combined — caller handles array; we return first and second separately
      // We handle multiple specs by merging into one call with multiple targets per spec
      // Since specs differ by title/body, we need to handle this differently.
      // Return a special multi-spec response — handled below via direct dispatch.
      if (notifications.length === 0) return null;
      if (notifications.length === 1) return notifications[0];
      // Signal multi-spec: return an array embedded as a side-channel (handled in main)
      (notifications as unknown as { _multi: true })._multi = true;
      return notifications as unknown as NotificationSpec;
    }

    case 'started': {
      const token = await getClientToken(supabase, record.client_id);
      if (!token) return null;
      return {
        targets: [{ token, role: 'client' }],
        title: 'Viagem iniciada!',
        body: 'Seu motorista iniciou a viagem.',
        dataType: 'trip_started',
        persistent: false,
        tripId,
      };
    }

    case 'finished': {
      const specs: NotificationSpec[] = [];

      const clientToken = await getClientToken(supabase, record.client_id);
      if (clientToken) {
        specs.push({
          targets: [{ token: clientToken, role: 'client' }],
          title: 'Viagem concluída!',
          body: 'Sua viagem foi concluída com sucesso. Avalie sua experiência!',
          dataType: 'trip_finished',
          persistent: false,
          tripId,
        });
      }

      if (record.driver_profile_id) {
        const driverTokens = await getDriverTokens(supabase, record.driver_profile_id);
        if (driverTokens.length) {
          specs.push({
            targets: driverTokens.map((t) => ({ token: t, role: 'driver' })),
            title: 'Corrida concluída!',
            body: 'Corrida finalizada com sucesso.',
            dataType: 'trip_finished_driver',
            persistent: false,
            tripId,
          });
        }
      }

      if (specs.length === 0) return null;
      if (specs.length === 1) return specs[0];
      (specs as unknown as { _multi: true })._multi = true;
      return specs as unknown as NotificationSpec;
    }

    case 'cancelled': {
      const specs: NotificationSpec[] = [];

      const clientToken = await getClientToken(supabase, record.client_id);
      if (clientToken) {
        specs.push({
          targets: [{ token: clientToken, role: 'client' }],
          title: 'Viagem cancelada',
          body: 'Sua viagem foi cancelada.',
          dataType: 'trip_cancelled',
          persistent: false,
          tripId,
        });
      }

      if (record.driver_profile_id) {
        const driverTokens = await getDriverTokens(supabase, record.driver_profile_id);
        if (driverTokens.length) {
          specs.push({
            targets: driverTokens.map((t) => ({ token: t, role: 'driver' })),
            title: 'Corrida cancelada',
            body: 'A corrida foi cancelada.',
            dataType: 'trip_cancelled_driver',
            persistent: false,
            tripId,
          });
        }
      }

      if (specs.length === 0) return null;
      if (specs.length === 1) return specs[0];
      (specs as unknown as { _multi: true })._multi = true;
      return specs as unknown as NotificationSpec;
    }

    case 'review_rejected': {
      const token = await getClientToken(supabase, record.client_id);
      if (!token) return null;
      return {
        targets: [{ token, role: 'client' }],
        title: 'Solicitação recusada',
        body: 'Sua solicitação de viagem foi recusada.',
        dataType: 'trip_rejected',
        persistent: false,
        tripId,
      };
    }

    case 'under_review': {
      const token = await getClientToken(supabase, record.client_id);
      if (!token) return null;
      return {
        targets: [{ token, role: 'client' }],
        title: 'Solicitação recebida',
        body: 'Sua viagem está em análise pela equipe KZ.',
        dataType: 'trip_under_review',
        persistent: false,
        tripId,
      };
    }

    default:
      return null;
  }
}

async function resolveCandidateInsertNotification(
  supabase: ReturnType<typeof createClient>,
  record: NewRecord
): Promise<NotificationSpec | null> {
  if (!record.driver_profile_id) return null;

  const tokens = await getDriverTokens(supabase, record.driver_profile_id);
  if (!tokens.length) return null;

  const clientName = await getClientName(supabase, record.client_id);
  const pickup = await getAddressText(supabase, record.pickup_address_id);
  const dropoff = await getAddressText(supabase, record.dropoff_address_id);

  return {
    targets: tokens.map((t) => ({ token: t, role: 'driver' })),
    title: 'Nova corrida disponível!',
    body: `${clientName} solicitou uma corrida de ${pickup} para ${dropoff}.`,
    dataType: 'trip_request',
    persistent: true,
    tripId: record.id,
  };
}

async function resolveServiceRequestNotification(
  supabase: ReturnType<typeof createClient>,
  record: NewRecord
): Promise<NotificationSpec | null> {
  const status = record.status;
  const serviceRequestId = record.id;

  let title: string;
  let body: string;
  let dataType: string;

  switch (status) {
    case 'assigned':
      title = 'Prestador encontrado!';
      body = 'Um prestador foi atribuído ao seu serviço.';
      dataType = 'service_assigned';
      break;
    case 'in_progress':
      title = 'Serviço iniciado!';
      body = 'Seu prestador iniciou o serviço.';
      dataType = 'service_started';
      break;
    case 'finished':
      title = 'Serviço concluído!';
      body = 'Seu serviço foi concluído com sucesso.';
      dataType = 'service_finished';
      break;
    case 'cancelled':
      title = 'Serviço cancelado';
      body = 'Seu serviço foi cancelado.';
      dataType = 'service_cancelled';
      break;
    default:
      return null;
  }

  const token = await getClientToken(supabase, record.client_id);
  if (!token) return null;

  return {
    targets: [{ token, role: 'client' }],
    title,
    body,
    dataType,
    persistent: false,
    serviceRequestId,
  };
}

// ---------------------------------------------------------------------------
// Dispatch helper
// ---------------------------------------------------------------------------

async function dispatchSpecs(
  specs: NotificationSpec[],
  accessToken: string,
  projectId: string
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  for (const spec of specs) {
    const entityId = spec.tripId ?? spec.serviceRequestId ?? '';
    const entityKey = spec.tripId ? 'trip_id' : 'service_request_id';

    const dataPayload: Record<string, string> = {
      type: spec.dataType,
      [entityKey]: entityId,
      persistent: spec.persistent ? 'true' : 'false',
    };

    for (const target of spec.targets) {
      const result = await sendFCMMessage(
        accessToken,
        projectId,
        target.token,
        spec.title,
        spec.body,
        dataPayload,
        spec.persistent
      );

      if (result.ok) {
        sent++;
      } else {
        console.error(`FCM send failed for token ${target.token.slice(0, 20)}: ${result.error}`);
        errors++;
      }
    }
  }

  return { sent, errors };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authorization check
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const expectedBearer = `Bearer ${serviceRoleKey}`;

  if (!serviceRoleKey || authHeader !== expectedBearer) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse body
  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { table, new_record } = payload;

  if (!table || !new_record?.id || !new_record?.status) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Env vars
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';
  const firebaseClientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL') ?? '';
  const firebasePrivateKey = (Deno.env.get('FIREBASE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');

  if (!supabaseUrl || !firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Supabase client (service role)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Resolve notification spec(s)
  let specsToSend: NotificationSpec[] = [];

  try {
    let resolved: NotificationSpec | null = null;

    if (table === 'trips') {
      resolved = await resolveTripsNotification(supabase, new_record);
    } else if (table === 'service_requests') {
      resolved = await resolveServiceRequestNotification(supabase, new_record);
    } else if (table === 'trip_driver_candidates') {
      resolved = await resolveCandidateInsertNotification(supabase, new_record);
    }

    if (!resolved) {
      return new Response(JSON.stringify({ sent: 0, errors: 0, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if multi-spec (array disguised as single spec)
    if (Array.isArray(resolved)) {
      specsToSend = resolved as unknown as NotificationSpec[];
    } else {
      specsToSend = [resolved];
    }
  } catch (err) {
    console.error('Error resolving notification spec:', err);
    return new Response(JSON.stringify({ error: 'Internal error resolving notification' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get FCM access token
  let accessToken: string;
  try {
    accessToken = await getFCMAccessToken(firebaseClientEmail, firebasePrivateKey);
  } catch (err) {
    console.error('Error obtaining FCM access token:', err);
    return new Response(JSON.stringify({ error: 'Failed to obtain FCM access token' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Dispatch
  const { sent, errors } = await dispatchSpecs(specsToSend, accessToken, firebaseProjectId);

  return new Response(JSON.stringify({ sent, errors }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
