import {
  buildFcmMessage,
  isAuthorizedWebhook,
  isInvalidFcmTokenError,
  summarizeDispatchResults,
} from './push-message.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewRecord {
  id: string;
  status?: string;
  client_id?: string;
  driver_profile_id?: string | null;
  provider_profile_id?: string | null;
  pickup_address_id?: string | null;
  dropoff_address_id?: string | null;
  chat_room_id?: string | null;
  sender_id?: string | null;
  message?: string | null;
}

interface RequestPayload {
  table: 'trips' | 'service_requests' | 'trip_driver_candidates' | 'chat_messages';
  event: string;
  old_status?: string;
  new_record: NewRecord;
}

interface PushTarget {
  token: string;
  role: 'client' | 'driver' | 'provider';
  userId?: string;
  driverProfileId?: string;
}

interface NotificationSpec {
  targets: PushTarget[];
  title: string;
  body: string;
  dataType: string;
  persistent: boolean;
  tripId?: string;
  serviceRequestId?: string;
  chatRoomId?: string;
  senderName?: string;
  messagePreview?: string;
}

interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

class SupabaseRestClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
  ) {}

  from(table: string) {
    return new SupabaseTableQuery(this.baseUrl, this.serviceKey, table);
  }
}

class SupabaseTableQuery {
  private filters: Array<[string, string]> = [];
  private selectedColumns = '*';
  private updateValues: Record<string, unknown> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
    private readonly table: string,
  ) {}

  select(columns: string) {
    this.selectedColumns = columns;
    return this;
  }

  eq(column: string, value: string) {
    this.filters.push([column, `eq.${value}`]);
    return this;
  }

  async single<T = Record<string, unknown>>(): Promise<QueryResult<T>> {
    const url = new URL(`${this.baseUrl}/rest/v1/${this.table}`);
    url.searchParams.set('select', this.selectedColumns);
    for (const [key, value] of this.filters) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
      headers: this._headers(),
    });

    if (!res.ok) {
      return { data: null, error: await res.text() };
    }

    const rows = (await res.json()) as T[];
    return { data: rows[0] ?? null, error: null };
  }

  async list<T = Record<string, unknown>>(): Promise<QueryResult<T[]>> {
    const url = new URL(`${this.baseUrl}/rest/v1/${this.table}`);
    url.searchParams.set('select', this.selectedColumns);
    for (const [key, value] of this.filters) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
      headers: this._headers(),
    });

    if (!res.ok) {
      return { data: null, error: await res.text() };
    }

    const rows = (await res.json()) as T[];
    return { data: rows, error: null };
  }

  update(values: Record<string, unknown>) {
    this.updateValues = values;
    return this;
  }

  then<TResult1 = QueryResult<Record<string, unknown>>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<Record<string, unknown>>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._executeUpdate().then(onfulfilled, onrejected);
  }

  private async _executeUpdate(): Promise<QueryResult<Record<string, unknown>>> {
    if (!this.updateValues) {
      return { data: null, error: 'No update payload provided' };
    }

    const url = new URL(`${this.baseUrl}/rest/v1/${this.table}`);
    for (const [key, value] of this.filters) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this._headers(),
        Prefer: 'return=representation',
      },
      body: JSON.stringify(this.updateValues),
    });

    if (!res.ok) {
      return { data: null, error: await res.text() };
    }

    const rows = (await res.json()) as Record<string, unknown>[];
    return { data: rows[0] ?? null, error: null };
  }

  private _headers() {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
    };
  }
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
): Promise<{ ok: boolean; invalidToken?: boolean; error?: string }> {
  const message = buildFcmMessage({
    token,
    title,
    body,
    data: dataPayload,
    persistent: dataPayload.persistent === 'true',
  });

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
  if (isInvalidFcmTokenError(res.status, errBody)) {
    return { ok: false, invalidToken: true, error: 'token_invalid' };
  }
  return { ok: false, error: `fcm_error:${res.status}:${errBody.slice(0, 200)}` };
}

// ---------------------------------------------------------------------------
// Supabase data fetchers
// ---------------------------------------------------------------------------

async function getClientToken(
  supabase: SupabaseRestClient,
  clientId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('fcm_token')
    .eq('id', clientId)
    .single<{ fcm_token?: string }>();

  if (error || !data?.fcm_token) return null;
  return data.fcm_token;
}

async function getUserPushTarget(
  supabase: SupabaseRestClient,
  userId: string,
  role: PushTarget['role'],
): Promise<PushTarget | null> {
  const { data, error } = await supabase
    .from('users')
    .select('fcm_token')
    .eq('id', userId)
    .single<{ fcm_token?: string }>();

  if (error || !data?.fcm_token) return null;
  return { token: data.fcm_token, role, userId };
}

async function getUserName(
  supabase: SupabaseRestClient,
  userId?: string | null,
): Promise<string> {
  if (!userId) return 'KZ';
  const { data } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', userId)
    .single<{ full_name?: string }>();

  return data?.full_name ?? 'KZ';
}

async function getDriverTargets(
  supabase: SupabaseRestClient,
  driverProfileId: string
): Promise<PushTarget[]> {
  const targetMap = new Map<string, PushTarget>();
  const upsert = (target: PushTarget) => {
    const existing = targetMap.get(target.token);
    if (!existing) {
      targetMap.set(target.token, target);
      return;
    }

    targetMap.set(target.token, {
      ...existing,
      userId: existing.userId ?? target.userId,
      driverProfileId: existing.driverProfileId ?? target.driverProfileId,
    });
  };

  const { data: dp } = await supabase
    .from('driver_profiles')
    .select('fcm_token, provider_profile_id')
    .eq('id', driverProfileId)
    .single<{ fcm_token?: string; provider_profile_id?: string | null }>();

  if (dp?.fcm_token) {
    upsert({
      token: dp.fcm_token,
      role: 'driver',
      driverProfileId,
    });
  }

  if (dp?.provider_profile_id) {
    const { data: pp } = await supabase
      .from('provider_profiles')
      .select('user_id')
      .eq('id', dp.provider_profile_id)
      .single<{ user_id?: string | null }>();

    if (pp?.user_id) {
      const { data: user } = await supabase
        .from('users')
        .select('fcm_token')
        .eq('id', pp.user_id)
        .single<{ fcm_token?: string }>();

      if (user?.fcm_token && user.fcm_token !== dp.fcm_token) {
        upsert({
          token: user.fcm_token,
          role: 'driver',
          userId: pp.user_id,
        });
      }
    }
  }

  return [...targetMap.values()];
}

async function getPendingCandidateTargets(
  supabase: SupabaseRestClient,
  tripId: string
): Promise<PushTarget[]> {
  // Get all driver candidates with status=pending for this trip
  const { data: candidates, error } = await supabase
    .from('trip_driver_candidates')
    .select('driver_profile_id')
    .eq('trip_id', tripId)
    .eq('status', 'pending')
    .list<{ driver_profile_id?: string | null }>();

  if (error || !candidates?.length) return [];

  const targets: PushTarget[] = [];

  for (const candidate of candidates) {
    const driverTargets = await getDriverTargets(
      supabase,
      candidate.driver_profile_id as string,
    );
    targets.push(...driverTargets);
  }

  const targetMap = new Map<string, PushTarget>();
  for (const target of targets) {
    const existing = targetMap.get(target.token);
    if (!existing) {
      targetMap.set(target.token, target);
      continue;
    }
    targetMap.set(target.token, {
      ...existing,
      userId: existing.userId ?? target.userId,
      driverProfileId: existing.driverProfileId ?? target.driverProfileId,
    });
  }

  return [...targetMap.values()];
}

async function getAddressText(
  supabase: SupabaseRestClient,
  addressId: string | null | undefined
): Promise<string> {
  if (!addressId) return 'endereço desconhecido';

  const { data, error } = await supabase
    .from('addresses')
    .select('formatted_address')
    .eq('id', addressId)
    .single<{ formatted_address?: string }>();

  if (error || !data?.formatted_address) return 'endereço desconhecido';
  return data.formatted_address;
}

async function getClientName(
  supabase: SupabaseRestClient,
  clientId: string
): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', clientId)
    .single<{ full_name?: string }>();

  return data?.full_name ?? 'Passageiro';
}

// ---------------------------------------------------------------------------
// Notification resolution
// ---------------------------------------------------------------------------

async function resolveTripsNotification(
  supabase: SupabaseRestClient,
  record: NewRecord
): Promise<NotificationSpec | null> {
  const status = record.status;
  const tripId = record.id;
  const clientId = record.client_id;

  switch (status) {
    case 'searching_drivers': {
      if (!clientId) return null;
      const targets = await getPendingCandidateTargets(supabase, tripId);
      if (!targets.length) return null;

      const clientName = await getClientName(supabase, clientId);
      const pickup = await getAddressText(supabase, record.pickup_address_id);
      const dropoff = await getAddressText(supabase, record.dropoff_address_id);

      return {
        targets,
        title: 'Nova corrida disponível!',
        body: `${clientName} solicitou uma corrida de ${pickup} para ${dropoff}.`,
        dataType: 'trip_request',
        persistent: true,
        tripId,
      };
    }

    case 'awaiting_client_confirmation': {
      if (!clientId) return null;
      const token = await getClientToken(supabase, clientId);
      if (!token) return null;
      return {
        targets: [{ token, role: 'client', userId: clientId }],
        title: 'Motorista encontrado!',
        body: 'Um motorista aceitou sua viagem. Confirme agora no app.',
        dataType: 'awaiting_confirmation',
        persistent: false,
        tripId,
      };
    }

    case 'awaiting_driver_confirmation': {
      if (!record.driver_profile_id || !clientId) return null;
      const targets = await getDriverTargets(supabase, record.driver_profile_id);
      if (!targets.length) return null;

      const clientName = await getClientName(supabase, clientId);

      return {
        targets,
        title: 'Passageiro confirmou!',
        body: `${clientName} confirmou a corrida. Toque para confirmar sua participação.`,
        dataType: 'recheck',
        persistent: true,
        tripId,
      };
    }

    case 'scheduled': {
      const notifications: NotificationSpec[] = [];
      if (!clientId) return null;

      // Client
      const clientToken = await getClientToken(supabase, clientId);
      if (clientToken) {
        notifications.push({
          targets: [{ token: clientToken, role: 'client', userId: clientId }],
          title: 'Viagem confirmada!',
          body: 'Sua viagem está confirmada.',
          dataType: 'trip_scheduled',
          persistent: false,
          tripId,
        });
      }

      // Driver
      if (record.driver_profile_id) {
        const driverTargets = await getDriverTargets(supabase, record.driver_profile_id);
        if (driverTargets.length) {
          notifications.push({
            targets: driverTargets,
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
      if (!clientId) return null;
      const token = await getClientToken(supabase, clientId);
      if (!token) return null;
      return {
        targets: [{ token, role: 'client', userId: clientId }],
        title: 'Viagem iniciada!',
        body: 'Seu motorista iniciou a viagem.',
        dataType: 'trip_started',
        persistent: false,
        tripId,
      };
    }

    case 'finished': {
      const specs: NotificationSpec[] = [];

      const clientToken = clientId ? await getClientToken(supabase, clientId) : null;
      if (clientToken) {
        specs.push({
          targets: [{ token: clientToken, role: 'client', userId: clientId }],
          title: 'Viagem concluída!',
          body: 'Sua viagem foi concluída com sucesso. Avalie sua experiência!',
          dataType: 'trip_finished',
          persistent: false,
          tripId,
        });
      }

      if (record.driver_profile_id) {
        const driverTargets = await getDriverTargets(supabase, record.driver_profile_id);
        if (driverTargets.length) {
          specs.push({
            targets: driverTargets,
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

      const clientToken = clientId ? await getClientToken(supabase, clientId) : null;
      if (clientToken) {
        specs.push({
          targets: [{ token: clientToken, role: 'client', userId: clientId }],
          title: 'Viagem cancelada',
          body: 'Sua viagem foi cancelada.',
          dataType: 'trip_cancelled',
          persistent: false,
          tripId,
        });
      }

      if (record.driver_profile_id) {
        const driverTargets = await getDriverTargets(supabase, record.driver_profile_id);
        if (driverTargets.length) {
          specs.push({
            targets: driverTargets,
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
      if (!clientId) return null;
      const token = await getClientToken(supabase, clientId);
      if (!token) return null;
      return {
        targets: [{ token, role: 'client', userId: clientId }],
        title: 'Solicitação recusada',
        body: 'Sua solicitação de viagem foi recusada.',
        dataType: 'trip_rejected',
        persistent: false,
        tripId,
      };
    }

    case 'under_review': {
      if (!clientId) return null;
      const token = await getClientToken(supabase, clientId);
      if (!token) return null;
      return {
        targets: [{ token, role: 'client', userId: clientId }],
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
  supabase: SupabaseRestClient,
  record: NewRecord
): Promise<NotificationSpec | null> {
  if (!record.driver_profile_id || !record.client_id) return null;

  const targets = await getDriverTargets(supabase, record.driver_profile_id);
  if (!targets.length) return null;

  const clientName = await getClientName(supabase, record.client_id);
  const pickup = await getAddressText(supabase, record.pickup_address_id);
  const dropoff = await getAddressText(supabase, record.dropoff_address_id);

  return {
    targets,
    title: 'Nova corrida disponível!',
    body: `${clientName} solicitou uma corrida de ${pickup} para ${dropoff}.`,
    dataType: 'trip_request',
    persistent: true,
    tripId: record.id,
  };
}

async function resolveServiceRequestNotification(
  supabase: SupabaseRestClient,
  record: NewRecord
): Promise<NotificationSpec | null> {
  const status = record.status;
  const serviceRequestId = record.id;
  const clientId = record.client_id;
  if (!clientId) return null;

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

  const token = await getClientToken(supabase, clientId);
  if (!token) return null;

  return {
    targets: [{ token, role: 'client', userId: clientId }],
    title,
    body,
    dataType,
    persistent: false,
    serviceRequestId,
  };
}

async function resolveChatMessageNotification(
  supabase: SupabaseRestClient,
  record: NewRecord
): Promise<NotificationSpec | null> {
  if (!record.chat_room_id || !record.sender_id) return null;

  const { data: room } = await supabase
    .from('chat_rooms')
    .select('id, provider_id, client_id')
    .eq('id', record.chat_room_id)
    .single<{ id: string; provider_id?: string | null; client_id?: string | null }>();

  const providerId = room?.provider_id;
  if (!providerId || providerId === record.sender_id) return null;

  const target = await getUserPushTarget(supabase, providerId, 'provider');
  if (!target) return null;

  const senderName =
    record.sender_id === room?.client_id
      ? await getClientName(supabase, room.client_id)
      : await getUserName(supabase, record.sender_id);
  const cleanMessage = (record.message ?? '').replace(/\s+/g, ' ').trim();
  const preview = cleanMessage.length > 120
    ? `${cleanMessage.slice(0, 117)}...`
    : cleanMessage || 'Nova mensagem recebida.';

  return {
    targets: [target],
    title: `Nova mensagem de ${senderName}`,
    body: preview,
    dataType: 'chat_message',
    persistent: false,
    chatRoomId: record.chat_room_id,
    senderName,
    messagePreview: preview,
  };
}

// ---------------------------------------------------------------------------
// Dispatch helper
// ---------------------------------------------------------------------------

async function dispatchSpecs(
  specs: NotificationSpec[],
  accessToken: string,
  projectId: string,
  supabase: SupabaseRestClient
): Promise<{ sent: number; invalid: number; errors: number }> {
  let sent = 0;
  let invalid = 0;
  let errors = 0;
  const results: { ok: boolean; invalidToken?: boolean; error?: string }[] = [];

  for (const spec of specs) {
    const entityId = spec.tripId ?? spec.serviceRequestId ?? spec.chatRoomId ?? '';
    const entityKey = spec.tripId
      ? 'trip_id'
      : spec.serviceRequestId
      ? 'service_request_id'
      : 'room_id';

    const dataPayload: Record<string, string> = {
      type: spec.dataType,
      [entityKey]: entityId,
      persistent: spec.persistent ? 'true' : 'false',
    };
    if (spec.senderName) dataPayload.sender_name = spec.senderName;
    if (spec.messagePreview) dataPayload.message = spec.messagePreview;

    for (const target of spec.targets) {
      const result = await sendFCMMessage(
        accessToken,
        projectId,
        target.token,
        spec.title,
        spec.body,
        dataPayload,
      );

      if (result.ok) {
        sent++;
        results.push(result);
      } else if (result.invalidToken) {
        invalid++;
        results.push(result);
        if (target.driverProfileId) {
          await supabase
            .from('driver_profiles')
            .update({ fcm_token: null, fcm_token_updated_at: null })
            .eq('id', target.driverProfileId)
            .eq('fcm_token', target.token);
        }
        if (target.userId) {
          await supabase
            .from('users')
            .update({ fcm_token: null, fcm_token_updated_at: null })
            .eq('id', target.userId)
            .eq('fcm_token', target.token);
        }
      } else {
        console.error(`FCM send failed for token ${target.token.slice(0, 20)}: ${result.error}`);
        errors++;
        results.push(result);
      }
    }
  }

  const summary = summarizeDispatchResults(results);
  return {
    sent: summary.sent || sent,
    invalid: summary.invalid || invalid,
    errors: summary.errors || errors,
  };
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
  const expectedWebhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
  const providedWebhookSecret = req.headers.get('X-Push-Webhook-Secret') ?? '';

  if (!isAuthorizedWebhook(providedWebhookSecret, expectedWebhookSecret)) {
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

  if (!table || !new_record?.id) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (table !== 'chat_messages' && !new_record.status) {
    return new Response(JSON.stringify({ error: 'Missing status field' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Env vars
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';
  const firebaseClientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL') ?? '';
  const firebasePrivateKey = (Deno.env.get('FIREBASE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Supabase client (service role)
  const supabase = new SupabaseRestClient(supabaseUrl, serviceRoleKey);

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
    } else if (table === 'chat_messages') {
      resolved = await resolveChatMessageNotification(supabase, new_record);
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
  const { sent, invalid, errors } = await dispatchSpecs(
    specsToSend,
    accessToken,
    firebaseProjectId,
    supabase,
  );

  return new Response(JSON.stringify({ sent, invalid, errors }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
