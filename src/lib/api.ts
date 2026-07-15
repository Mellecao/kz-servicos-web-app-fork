import { supabase } from "@/lib/supabase";
import { isMissingPostgrestRelationError } from "@/lib/postgrest-errors";
import { buildDriverMetrics, getDriverMetricPeriodRange } from "@/lib/driver-metrics";
import { buildClientMetrics, getClientMetricPeriodRange } from "@/lib/client-metrics";
import { buildServiceCategorySlug } from "@/lib/service-category-utils";
import { isProviderWithoutDriverProfile } from "@/lib/provider-filters";
import { shouldResetTripAfterCandidateRemoval } from "@/lib/trip-candidate-actions";
import type { GooglePlaceAddress } from "@/lib/google-places";
import type {
  User,
  Trip,
  TripStatus,
  TripDriverCandidate,
  TripDriverCandidateStatus,
  TripCancellationRequest,
  TripStatusHistory,
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestProviderCandidate,
  ServiceRequestProviderCandidateStatus,
  DriverProfile,
  DriverRegion,
  ProviderProfile,
  Vehicle,
  Address,
  ServiceCategory,
  ServiceTypeEnum,
  ProviderStatus,
  Debito,
  PaymentMethod,
  AdminLog,
  Rating,
  DriverTripHistoryEntry,
  DriverMetricPeriod,
  DriverMetrics,
  ClientMetrics,
  ClientTripHistoryEntry,
  Notification,
  SupportConversation,
  SupportMessage,
  UserSavedAddress,
} from "@/types/database";

// ─── Admin Logs ────────────────────────────────────────────
function logAdminAction(
  action: string,
  entityId: string,
  details: Record<string, unknown>,
): void {
  supabase
    .from("admin_logs")
    .insert({ action, entity_id: entityId, details })
    .then();
}

export async function fetchAdminLogs(): Promise<AdminLog[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("admin_logs")
    .select("*, admin:users!admin_id(full_name, email)")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminLog[];
}

// ─── Notifications ────────────────────────────────────────
export async function fetchAdminNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAdminNotification(id: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(
    `/api/admin-notifications?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : undefined,
    },
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Erro ao excluir notificação");
  }
}

export async function deleteAllAdminNotifications(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/admin-notifications", {
    method: "DELETE",
    headers: data.session?.access_token
      ? { Authorization: `Bearer ${data.session.access_token}` }
      : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Erro ao limpar notificações");
  }
}

// ─── Auth ──────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// ─── Users ─────────────────────────────────────────────────
export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as User[];
}

// ─── Clients ───────────────────────────────────────────────
export async function fetchClients(): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*, user_saved_addresses(*, addresses(*))")
    .eq("role", "client")
    .order("created_at", { ascending: false });
  if (!error) return (data ?? []) as User[];

  // Casa/Trabalho is supplementary data. A missing migration or stale
  // PostgREST relationship must not hide the clients stored in public.users.
  const { data: clients, error: clientsError } = await supabase
    .from("users")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  if (clientsError) throw clientsError;

  console.warn(
    "Clientes carregados sem Casa/Trabalho porque o relacionamento falhou:",
    error.message,
  );
  return ((clients ?? []) as User[]).map((client) => ({
    ...client,
    user_saved_addresses: [],
  }));
}

export async function fetchUserById(id: string): Promise<User> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as User;
}

// ─── Trips ─────────────────────────────────────────────────
export async function fetchTrips(): Promise<Trip[]> {
  const query = supabase
    .from("trips")
    .select(
      "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), trip_stops(*, addresses(*)), service_categories(*), users!client_id(*), driver_profiles(*, provider_profiles(*, users(*)))",
    )
    .order("scheduled_datetime", { ascending: false });
  const { data, error } = await query;
  if (!error) return data as Trip[];
  if (!isMissingPostgrestRelationError(error)) throw error;

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("trips")
    .select(
      "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), service_categories(*), users!client_id(*), driver_profiles(*, provider_profiles(*, users(*)))",
    )
    .order("scheduled_datetime", { ascending: false });
  if (fallbackError) throw fallbackError;
  return fallbackData as Trip[];
}

// ─── Service Requests ──────────────────────────────────────
export async function fetchServiceRequests(): Promise<ServiceRequest[]> {
  const { data, error } = await supabase
    .from("service_requests")
    .select(
      "*, service_categories(*), addresses(*), users!client_id(*), provider_profiles(*, users(*)), service_request_photos(*), service_request_provider_candidates(*, provider_profiles(*, users(*)))",
    )
    .order("service_date", { ascending: false });
  if (error) throw error;
  return data as ServiceRequest[];
}

export async function fetchServiceRequestById(
  id: string,
): Promise<ServiceRequest> {
  const { data, error } = await supabase
    .from("service_requests")
    .select(
      "*, service_categories(*), addresses(*), users!client_id(*), provider_profiles(*, users(*)), service_request_photos(*), service_request_provider_candidates(*, provider_profiles(*, users(*)))",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as ServiceRequest;
}

// ─── Update Trip Financial ─────────────────────────────────
export async function updateTripFinancial(
  id: string,
  payload: {
    is_paid?: boolean;
    is_driver_paied?: boolean;
    final_price?: number | null;
    payment_method?: PaymentMethod | null;
    payment_date?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("trips").update(payload).eq("id", id);
  if (error) throw error;
  logAdminAction(
    "Financeiro atualizado",
    id,
    payload as Record<string, unknown>,
  );
}

// ─── Update Service Request Financial ─────────────────────
export async function updateServiceRequestFinancial(
  id: string,
  payload: {
    is_paid?: boolean;
    is_provider_paied?: boolean;
    final_price?: number | null;
    payment_method?: PaymentMethod | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("service_requests")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

// ─── Update Trip Status ────────────────────────────────────
export async function updateTripStatus(
  id: string,
  status: TripStatus,
): Promise<void> {
  const { error } = await supabase
    .from("trips")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
  logAdminAction("Status atualizado", id, { status });
}

// ─── Admin Update Trip Basics (address, datetime) ─────────
export async function adminUpdateTripBasics(
  tripId: string,
  updates: {
    pickup?: GooglePlaceAddress;
    dropoff?: GooglePlaceAddress;
    scheduled_datetime?: string;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (updates.pickup) {
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        formatted_address: updates.pickup.formatted_address,
        google_place_id: updates.pickup.google_place_id ?? null,
        latitude: updates.pickup.latitude ?? null,
        longitude: updates.pickup.longitude ?? null,
        street: updates.pickup.street ?? null,
        number: updates.pickup.number ?? null,
        neighborhood: updates.pickup.neighborhood ?? null,
        city: updates.pickup.city ?? null,
        state: updates.pickup.state ?? null,
        zip_code: updates.pickup.zip_code ?? null,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("pickup insert failed");
    payload.pickup_address_id = data.id;
  }

  if (updates.dropoff) {
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        formatted_address: updates.dropoff.formatted_address,
        google_place_id: updates.dropoff.google_place_id ?? null,
        latitude: updates.dropoff.latitude ?? null,
        longitude: updates.dropoff.longitude ?? null,
        street: updates.dropoff.street ?? null,
        number: updates.dropoff.number ?? null,
        neighborhood: updates.dropoff.neighborhood ?? null,
        city: updates.dropoff.city ?? null,
        state: updates.dropoff.state ?? null,
        zip_code: updates.dropoff.zip_code ?? null,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("dropoff insert failed");
    payload.dropoff_address_id = data.id;
  }

  if (updates.scheduled_datetime) {
    payload.scheduled_datetime = updates.scheduled_datetime;
  }

  if (Object.keys(payload).length === 0) return;

  const { error: updateError } = await supabase
    .from("trips")
    .update(payload)
    .eq("id", tripId);
  if (updateError) throw updateError;

  logAdminAction("Viagem editada", tripId, payload);
}

export async function deleteTrip(id: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/trips?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: data.session?.access_token
      ? { Authorization: `Bearer ${data.session.access_token}` }
      : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Erro ao excluir viagem");
  logAdminAction("Viagem excluída", id, {});
}

// ─── Fetch Single Trip ─────────────────────────────────────
export async function fetchTripById(id: string): Promise<Trip> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), trip_stops(*, addresses(*)), service_categories(*), users!client_id(*), driver_profiles(*, provider_profiles(*, users(*)))",
    )
    .eq("id", id)
    .single();
  if (!error) return data as Trip;
  if (!isMissingPostgrestRelationError(error)) throw error;

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("trips")
    .select(
      "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), service_categories(*), users!client_id(*), driver_profiles(*, provider_profiles(*, users(*)))",
    )
    .eq("id", id)
    .single();
  if (fallbackError) throw fallbackError;
  return fallbackData as Trip;
}

// ─── Trip Status History ───────────────────────────────────
export async function fetchTripStatusHistory(
  tripId: string,
): Promise<TripStatusHistory[]> {
  const { data, error } = await supabase
    .from("trip_status_history")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TripStatusHistory[];
}

// ─── Approve Trip (under_review → searching_drivers) ──────
export async function approveTrip(id: string): Promise<void> {
  const { error } = await supabase
    .from("trips")
    .update({ status: "searching_drivers" })
    .eq("id", id);
  if (error) throw error;
  logAdminAction("Viagem aprovada", id, {});
}

// ─── Reject Trip (under_review → open) ────────────────────
export async function rejectTrip(id: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  const { error } = await supabase.rpc("reject_trip", {
    p_trip_id: id,
    p_reason: trimmed.length > 0 ? trimmed : null,
  });
  if (error) throw error;
  logAdminAction("Viagem recusada", id, { reason: trimmed || null });
}

// ─── Cancel Trip (any → cancelled) ────────────────────────
export async function cancelTrip(id: string): Promise<void> {
  const { error } = await supabase
    .from("trips")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await supabase
    .from("trip_driver_candidates")
    .update({
      status: "rejected",
      responded_at: new Date().toISOString(),
      observations: "Corrida cancelada pela KZ",
    })
    .eq("trip_id", id)
    .in("status", ["pending", "accepted"]);
  logAdminAction("Viagem cancelada", id, {});
}

// ─── Trip Cancellation Requests ──────────────────────────
const tripCancellationRequestSelect =
  "*, requested_by_user:users!requested_by(id, full_name, email, phone), reviewed_by_user:users!reviewed_by(id, full_name, email)";

export async function fetchPendingCancellationRequest(
  tripId: string,
): Promise<TripCancellationRequest | null> {
  const { data, error } = await supabase
    .from("trip_cancellation_requests")
    .select(tripCancellationRequestSelect)
    .eq("trip_id", tripId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;
  return (data as TripCancellationRequest | null) ?? null;
}

export async function approveCancellationRequest(
  requestId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("trip_cancellation_requests")
    .update({ status: "approved" })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id, trip_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Solicitação já analisada");
  logAdminAction("Cancelamento aprovado", data.trip_id, {
    cancellation_request_id: data.id,
  });
}

export async function rejectCancellationRequest(
  requestId: string,
  reason: string,
): Promise<void> {
  const reviewReason = reason.trim();
  if (reviewReason.length < 3) {
    throw new Error("Informe o motivo da recusa");
  }

  const { data, error } = await supabase
    .from("trip_cancellation_requests")
    .update({ status: "rejected", review_reason: reviewReason })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id, trip_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Solicitação já analisada");
  logAdminAction("Cancelamento recusado", data.trip_id, {
    cancellation_request_id: data.id,
    reason: reviewReason,
  });
}

// ─── KZ Support Chat ─────────────────────────────────────
const supportConversationSelect =
  "*, provider:users!provider_user_id(id, full_name, email, phone, avatar_url, is_active)";
const supportMessageSelect =
  "*, sender:users!sender_id(id, full_name, avatar_url, role)";

export async function fetchSupportConversations(): Promise<
  SupportConversation[]
> {
  const { data, error } = await supabase
    .from("support_conversations")
    .select(supportConversationSelect)
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportConversation[];
}

export async function fetchSupportConversationByProvider(
  providerUserId: string,
): Promise<SupportConversation | null> {
  const { data, error } = await supabase
    .from("support_conversations")
    .select(supportConversationSelect)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();
  if (error) throw error;
  return (data as SupportConversation | null) ?? null;
}

export async function fetchSupportMessages(
  conversationId: string,
  options: { before?: string; limit?: number } = {},
): Promise<SupportMessage[]> {
  const limit = options.limit ?? 50;
  let query = supabase
    .from("support_messages")
    .select(supportMessageSelect)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as SupportMessage[]).reverse();
}

export async function sendSupportMessage(
  conversationId: string,
  senderId: string,
  message: string,
): Promise<void> {
  const cleanMessage = message.trim();
  if (!cleanMessage || cleanMessage.length > 4000) {
    throw new Error("A mensagem deve ter entre 1 e 4000 caracteres");
  }

  const { error } = await supabase.from("support_messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    message: cleanMessage,
  });
  if (error) throw error;
}

export async function markSupportMessagesRead(
  conversationId: string,
  readerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("support_messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", readerId)
    .eq("is_read", false);
  if (error) throw error;
}

// ─── Trip Driver Candidates ────────────────────────────────
const tripDriverCandidateSelect =
  "*, driver_profiles(*, provider_profiles(*, users(*)))";

export async function fetchTripDriverCandidates(
  tripId: string,
): Promise<TripDriverCandidate[]> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .select(tripDriverCandidateSelect)
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TripDriverCandidate[];
}

export async function fetchTripDriverCandidatesForTrips(
  tripIds: string[],
): Promise<TripDriverCandidate[]> {
  if (tripIds.length === 0) return [];

  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .select(tripDriverCandidateSelect)
    .in("trip_id", tripIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TripDriverCandidate[];
}

export async function addTripDriverCandidate(
  tripId: string,
  driverProfileId: string,
): Promise<TripDriverCandidate> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .insert({
      trip_id: tripId,
      driver_profile_id: driverProfileId,
      status: "pending",
    })
    .select(tripDriverCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction("Motorista adicionado como candidato", tripId, {
    driver_profile_id: driverProfileId,
  });
  return data as TripDriverCandidate;
}

export async function addAllApprovedTripCandidates(tripId: string): Promise<number> {
  const { data, error } = await supabase.rpc("add_all_approved_trip_candidates", {
    p_trip_id: tripId,
  });
  if (error) throw error;
  logAdminAction("Todos os motoristas aprovados adicionados", tripId, {
    added_count: data ?? 0,
  });
  return Number(data ?? 0);
}

export async function fetchNearbyTripDrivers(tripId: string) {
  const { data, error } = await supabase.rpc("nearby_trip_drivers", {
    p_trip_id: tripId,
    p_radius_meters: 10000,
  });
  if (error) throw error;
  return (data ?? []) as Array<{
    driver_profile_id: string;
    distance_meters: number;
    vehicle_category: "simple" | "popular" | "luxury" | null;
    regions: string[];
  }>;
}

export async function removeTripDriverCandidate(
  tripId: string,
  driverProfileId: string,
): Promise<void> {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("driver_profile_id")
    .eq("id", tripId)
    .single();
  if (tripError) throw tripError;

  const { error } = await supabase
    .from("trip_driver_candidates")
    .delete()
    .eq("trip_id", tripId)
    .eq("driver_profile_id", driverProfileId);
  if (error) throw error;

  if (
    shouldResetTripAfterCandidateRemoval({
      currentDriverProfileId: trip?.driver_profile_id,
      removedDriverProfileId: driverProfileId,
    })
  ) {
    const { error: resetError } = await supabase
      .from("trips")
      .update({
        driver_profile_id: null,
        final_price: null,
        status: "searching_drivers",
      })
      .eq("id", tripId);
    if (resetError) throw resetError;
  }

  logAdminAction("Candidato removido", tripId, {
    driver_profile_id: driverProfileId,
  });
}

export async function updateTripDriverCandidateStatus(
  tripId: string,
  driverProfileId: string,
  status: TripDriverCandidateStatus,
): Promise<TripDriverCandidate> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .update({
      status,
      responded_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("trip_id", tripId)
    .eq("driver_profile_id", driverProfileId)
    .select("*, driver_profiles(*, provider_profiles(*, users(*)))")
    .single();
  if (error) throw error;
  logAdminAction("Status do candidato atualizado", tripId, {
    driver_profile_id: driverProfileId,
    status,
  });
  return data as TripDriverCandidate;
}

export async function updateTripDriverCandidatePrice(
  tripId: string,
  driverProfileId: string,
  offeredPrice: number | null,
): Promise<TripDriverCandidate> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .update({
      offered_price: offeredPrice,
      price_rejection_reason: null,
      price_rejected_at: null,
      kz_proposed_price: null,
      kz_proposed_at: null,
      kz_proposal_locked: false,
    })
    .eq("trip_id", tripId)
    .eq("driver_profile_id", driverProfileId)
    .select(tripDriverCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction("Preço do candidato atualizado", tripId, {
    driver_profile_id: driverProfileId,
    offered_price: offeredPrice,
  });
  return data as TripDriverCandidate;
}

export async function rejectTripDriverCandidatePrice(
  tripId: string,
  driverProfileId: string,
): Promise<TripDriverCandidate> {
  const message = "Preço fora do padrão, favor fazer nova proposta";
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .update({
      status: "pending",
      offered_price: null,
      responded_at: null,
      price_rejection_reason: message,
      price_rejected_at: new Date().toISOString(),
      kz_proposed_price: null,
      kz_proposed_at: null,
      kz_proposal_locked: false,
    })
    .eq("trip_id", tripId)
    .eq("driver_profile_id", driverProfileId)
    .select(tripDriverCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction("Preço do candidato recusado", tripId, {
    driver_profile_id: driverProfileId,
  });
  return data as TripDriverCandidate;
}

export async function sendKzDriverProposal(
  tripId: string,
  driverProfileId: string,
  price: number,
): Promise<TripDriverCandidate> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .update({
      status: "pending",
      offered_price: price,
      responded_at: null,
      price_rejection_reason: null,
      price_rejected_at: null,
      kz_proposed_price: price,
      kz_proposed_at: new Date().toISOString(),
      kz_proposal_locked: true,
    })
    .eq("trip_id", tripId)
    .eq("driver_profile_id", driverProfileId)
    .select(tripDriverCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction("Proposta KZ enviada ao candidato", tripId, {
    driver_profile_id: driverProfileId,
    kz_proposed_price: price,
  });
  return data as TripDriverCandidate;
}

export async function selectTripDriver(
  tripId: string,
  candidateId: string,
  driverProfileId: string,
  offeredPrice: number,
): Promise<void> {
  const { error } = await supabase.rpc("select_trip_driver", {
    p_trip_id: tripId,
    p_candidate_id: candidateId,
    p_driver_profile_id: driverProfileId,
    p_offered_price: offeredPrice,
  });
  if (error) throw new Error(error.message);
  logAdminAction("Motorista selecionado", tripId, {
    driver_profile_id: driverProfileId,
    offered_price: offeredPrice,
  });
}

export async function approveDriverCandidate(
  tripId: string,
  driverProfileId: string,
  approved: boolean,
): Promise<TripDriverCandidate> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .update({ admin_approved: approved })
    .eq("trip_id", tripId)
    .eq("driver_profile_id", driverProfileId)
    .select(tripDriverCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction(
    approved
      ? "Candidato aprovado para cliente"
      : "Aprovação do candidato removida",
    tripId,
    { driver_profile_id: driverProfileId },
  );
  return data as TripDriverCandidate;
}

export async function resendDriverConfirmationNotification(
  tripId: string,
): Promise<void> {
  type Relation<T> = T | T[] | null | undefined;
  type ResendTripRow = {
    status: TripStatus;
    pickup_address?: Relation<{ formatted_address: string | null }>;
    dropoff_address?: Relation<{ formatted_address: string | null }>;
    driver_profiles?: Relation<{
      provider_profiles?: Relation<{ user_id: string | null }>;
    }>;
  };
  const firstRelation = <T>(value: Relation<T>): T | undefined =>
    Array.isArray(value) ? value[0] : (value ?? undefined);

  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, status, driver_profile_id, scheduled_datetime, pickup_address:addresses!pickup_address_id(formatted_address), dropoff_address:addresses!dropoff_address_id(formatted_address), driver_profiles(provider_profiles(user_id, users(full_name)))",
    )
    .eq("id", tripId)
    .single();

  if (error) throw error;

  const tripData = data as unknown as ResendTripRow;

  if (tripData.status !== "awaiting_driver_confirmation") {
    throw new Error("A viagem não está aguardando validação do motorista.");
  }

  const driverProfile = firstRelation(tripData.driver_profiles);
  const providerProfile = firstRelation(driverProfile?.provider_profiles);
  const driverUserId = providerProfile?.user_id;
  if (!driverUserId) {
    throw new Error("Não foi possível localizar o usuário do motorista.");
  }

  const route =
    `${firstRelation(tripData.pickup_address)?.formatted_address?.split(",")[0] ?? "origem"} → ` +
    `${firstRelation(tripData.dropoff_address)?.formatted_address?.split(",")[0] ?? "destino"}`;

  const { error: notificationError } = await supabase
    .from("notifications")
    .insert({
      user_id: driverUserId,
      title: "Confirme o agendamento",
      body: `O passageiro aceitou sua proposta para ${route}. Confirme ou recuse o agendamento.`,
      type: "trip_driver_confirmation",
      reference_type: "trip",
      reference_id: tripId,
      link: `/schedules/${tripId}`,
    });
  if (notificationError) throw notificationError;

  const { error: touchError } = await supabase
    .from("trips")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", tripId);
  if (touchError) throw touchError;

  logAdminAction("Reenvio de validação do motorista", tripId, {
    driver_user_id: driverUserId,
  });
}

// ─── Update Service Request Status ─────────────────────────
export async function updateServiceRequestStatus(
  id: string,
  status: ServiceRequestStatus,
): Promise<void> {
  const { error } = await supabase
    .from("service_requests")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
  logAdminAction("Status do serviço atualizado", id, { status });
}

export async function approveServiceRequest(id: string): Promise<void> {
  await updateServiceRequestStatus(id, "searching_provider");
}

export async function approveServiceRequestForClient(id: string): Promise<void> {
  await updateServiceRequestStatus(id, "awaiting_client_confirmation");
}

export async function approveServiceRequestForProvider(
  id: string,
): Promise<void> {
  await updateServiceRequestStatus(id, "awaiting_provider_confirmation");
}

// ─── Service Request Provider Candidates ───────────────────
const serviceRequestProviderCandidateSelect =
  "*, provider_profiles(*, users(*))";

export async function fetchServiceRequestProviderCandidates(
  serviceRequestId: string,
): Promise<ServiceRequestProviderCandidate[]> {
  const { data, error } = await supabase
    .from("service_request_provider_candidates")
    .select(serviceRequestProviderCandidateSelect)
    .eq("service_request_id", serviceRequestId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ServiceRequestProviderCandidate[];
}

export async function addServiceRequestProviderCandidate(
  serviceRequestId: string,
  providerProfileId: string,
): Promise<ServiceRequestProviderCandidate> {
  const { data, error } = await supabase
    .from("service_request_provider_candidates")
    .insert({
      service_request_id: serviceRequestId,
      provider_profile_id: providerProfileId,
      status: "pending",
    })
    .select(serviceRequestProviderCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction("Prestador adicionado como candidato", serviceRequestId, {
    provider_profile_id: providerProfileId,
  });
  return data as ServiceRequestProviderCandidate;
}

export async function removeServiceRequestProviderCandidate(
  serviceRequestId: string,
  providerProfileId: string,
): Promise<void> {
  const { error } = await supabase
    .from("service_request_provider_candidates")
    .delete()
    .eq("service_request_id", serviceRequestId)
    .eq("provider_profile_id", providerProfileId);
  if (error) throw error;
  logAdminAction("Candidato de serviço removido", serviceRequestId, {
    provider_profile_id: providerProfileId,
  });
}

export async function updateServiceRequestProviderCandidateStatus(
  serviceRequestId: string,
  providerProfileId: string,
  status: ServiceRequestProviderCandidateStatus,
): Promise<ServiceRequestProviderCandidate> {
  const { data, error } = await supabase
    .from("service_request_provider_candidates")
    .update({
      status,
      responded_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("service_request_id", serviceRequestId)
    .eq("provider_profile_id", providerProfileId)
    .select(serviceRequestProviderCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction("Status do candidato de serviço atualizado", serviceRequestId, {
    provider_profile_id: providerProfileId,
    status,
  });
  return data as ServiceRequestProviderCandidate;
}

export async function updateServiceRequestProviderCandidatePrice(
  serviceRequestId: string,
  providerProfileId: string,
  offeredPrice: number | null,
): Promise<ServiceRequestProviderCandidate> {
  const { data, error } = await supabase
    .from("service_request_provider_candidates")
    .update({
      offered_price: offeredPrice,
      price_rejection_reason: null,
      price_rejected_at: null,
      kz_proposed_price: null,
      kz_proposed_at: null,
      kz_proposal_locked: false,
    })
    .eq("service_request_id", serviceRequestId)
    .eq("provider_profile_id", providerProfileId)
    .select(serviceRequestProviderCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction("Preço do candidato de serviço atualizado", serviceRequestId, {
    provider_profile_id: providerProfileId,
    offered_price: offeredPrice,
  });
  return data as ServiceRequestProviderCandidate;
}

export async function rejectServiceRequestProviderCandidatePrice(
  serviceRequestId: string,
  providerProfileId: string,
): Promise<ServiceRequestProviderCandidate> {
  const message = "Preço fora do padrão, favor fazer nova proposta";
  const { data, error } = await supabase
    .from("service_request_provider_candidates")
    .update({
      status: "pending",
      offered_price: null,
      responded_at: null,
      price_rejection_reason: message,
      price_rejected_at: new Date().toISOString(),
      kz_proposed_price: null,
      kz_proposed_at: null,
      kz_proposal_locked: false,
    })
    .eq("service_request_id", serviceRequestId)
    .eq("provider_profile_id", providerProfileId)
    .select(serviceRequestProviderCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction("Preço do candidato de serviço recusado", serviceRequestId, {
    provider_profile_id: providerProfileId,
  });
  return data as ServiceRequestProviderCandidate;
}

export async function sendKzServiceRequestProposal(
  serviceRequestId: string,
  providerProfileId: string,
  price: number,
): Promise<ServiceRequestProviderCandidate> {
  const { data, error } = await supabase
    .from("service_request_provider_candidates")
    .update({
      status: "pending",
      offered_price: price,
      responded_at: null,
      price_rejection_reason: null,
      price_rejected_at: null,
      kz_proposed_price: price,
      kz_proposed_at: new Date().toISOString(),
      kz_proposal_locked: true,
    })
    .eq("service_request_id", serviceRequestId)
    .eq("provider_profile_id", providerProfileId)
    .select(serviceRequestProviderCandidateSelect)
    .single();
  if (error) throw error;
  logAdminAction("Proposta KZ enviada ao candidato de serviço", serviceRequestId, {
    provider_profile_id: providerProfileId,
    price,
  });
  return data as ServiceRequestProviderCandidate;
}

export async function approveServiceRequestProviderCandidate(
  serviceRequestId: string,
  providerProfileId: string,
  offeredPrice: number,
): Promise<void> {
  const { error } = await supabase.rpc("select_service_request_provider", {
    p_service_request_id: serviceRequestId,
    p_provider_profile_id: providerProfileId,
    p_offered_price: offeredPrice,
  });
  if (error) throw error;
  logAdminAction("Prestador aprovado para serviço", serviceRequestId, {
    provider_profile_id: providerProfileId,
    offered_price: offeredPrice,
  });
}

// ─── Driver Profiles ───────────────────────────────────────

// ─── Débitos (Financeiro) ──────────────────────────────────
export async function fetchDebitos(): Promise<Debito[]> {
  const [trips, serviceRequests] = await Promise.all([
    fetchTrips(),
    fetchServiceRequests(),
  ]);

  const tripDebitos: Debito[] = trips
    .filter((t) => t.status !== "cancelled")
    .map((t) => ({
      id: t.id,
      tipo: "viagem" as const,
      descricao: t.pickup_address?.formatted_address
        ? `${t.pickup_address.formatted_address.split(",")[0]} → ${t.dropoff_address?.formatted_address?.split(",")[0] ?? "—"}`
        : "Viagem",
      cliente: t.users?.full_name ?? "—",
      categoria: t.service_categories?.name ?? "Viagem",
      data: t.scheduled_datetime,
      valor_estimado: t.estimated_price,
      valor_final: t.final_price,
      pago: t.is_paid,
      metodo_pagamento: t.payment_method,
      motorista_pago: t.is_driver_paied,
      payment_date: t.payment_date,
    }));

  const serviceDebitos: Debito[] = serviceRequests
    .filter((r) => r.status !== "cancelled")
    .map((r) => ({
      id: r.id,
      tipo: "servico" as const,
      descricao:
        r.description.length > 60
          ? r.description.slice(0, 60) + "…"
          : r.description,
      cliente: r.users?.full_name ?? "—",
      categoria: r.service_categories?.name ?? "Serviço",
      data: r.service_date,
      valor_estimado: r.estimated_price,
      valor_final: r.final_price,
      pago: r.is_paid,
      metodo_pagamento: r.payment_method,
      prestador_pago: r.is_provider_paied,
    }));

  return [...tripDebitos, ...serviceDebitos].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
  );
}

// ─── Driver Profiles ───────────────────────────────────────
export async function fetchDriverProfiles(): Promise<DriverProfile[]> {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("*, provider_profiles(*, users(*)), driver_profile_photos(*), driver_profile_regions(*, driver_regions(*)), vehicles(*)");
  if (error) throw error;
  return data as DriverProfile[];
}

export async function fetchVehiclesByDriver(
  driverProfileId: string,
): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, vehicle_photos(*)")
    .eq("driver_profile_id", driverProfileId);
  if (error) throw error;
  return data as Vehicle[];
}

export async function fetchDriverRegions(): Promise<DriverRegion[]> {
  const { data, error } = await supabase
    .from("driver_regions")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as DriverRegion[];
}

export async function createDriverRegion(name: string): Promise<DriverRegion> {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2) throw new Error("Informe uma região com ao menos 2 caracteres");
  const { data, error } = await supabase
    .from("driver_regions")
    .insert({ name: cleanName })
    .select()
    .single();
  if (!error) return data as DriverRegion;

  const { data: existing, error: existingError } = await supabase
    .from("driver_regions")
    .select("*")
    .eq("normalized_name", cleanName.toLowerCase())
    .single();
  if (existingError) throw error;
  return existing as DriverRegion;
}

export async function replaceDriverProfileRegions(
  driverProfileId: string,
  regionIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("driver_profile_regions")
    .delete()
    .eq("driver_profile_id", driverProfileId);
  if (deleteError) throw deleteError;
  if (regionIds.length === 0) return;
  const { error: insertError } = await supabase
    .from("driver_profile_regions")
    .insert(regionIds.map((regionId) => ({
      driver_profile_id: driverProfileId,
      region_id: regionId,
    })));
  if (insertError) throw insertError;
}

export async function deleteDriverProfilePhoto(id: string): Promise<void> {
  const { error } = await supabase
    .from("driver_profile_photos")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function deleteVehiclePhoto(id: string): Promise<void> {
  const { error } = await supabase.from("vehicle_photos").delete().eq("id", id);
  if (error) throw error;
}

// ─── Ratings ───────────────────────────────────────────────
export async function fetchRatingsForUser(userId: string): Promise<Rating[]> {
  const { data, error } = await supabase
    .from("ratings")
    .select(
      "*, rater:users!rater_id(id, full_name, email), rated:users!rated_id(id, full_name, email)",
    )
    .eq("rated_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Rating[];
}

export async function fetchDriverTripHistory(
  driverProfileId: string,
): Promise<DriverTripHistoryEntry[]> {
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select(
      "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), users!client_id(*), driver_profiles(*, provider_profiles(*, users(*)))",
    )
    .eq("driver_profile_id", driverProfileId)
    .eq("status", "finished")
    .order("finished_at", { ascending: false });
  if (tripsError) throw tripsError;

  const tripRows = (trips ?? []) as Trip[];
  if (tripRows.length === 0) return [];

  const { data: ratings, error: ratingsError } = await supabase
    .from("ratings")
    .select(
      "*, rater:users!rater_id(id, full_name, email), rated:users!rated_id(id, full_name, email)",
    )
    .in(
      "trip_id",
      tripRows.map((trip) => trip.id),
    )
    .order("created_at", { ascending: false });
  if (ratingsError) throw ratingsError;

  const ratingsByTrip = new Map<string, Rating[]>();
  for (const rating of (ratings ?? []) as Rating[]) {
    if (!rating.trip_id) continue;
    ratingsByTrip.set(rating.trip_id, [
      ...(ratingsByTrip.get(rating.trip_id) ?? []),
      rating,
    ]);
  }

  return tripRows.map((trip) => ({
    trip,
    ratings: ratingsByTrip.get(trip.id) ?? [],
  }));
}

export async function fetchDriverPerformance(
  driverProfileId: string,
  driverUserId: string,
  period: DriverMetricPeriod,
): Promise<{ metrics: DriverMetrics; history: DriverTripHistoryEntry[] }> {
  const range = getDriverMetricPeriodRange(period);
  const rangeStart = range.start.toISOString();

  const [tripsResult, candidatesResult, ratingsResult] = await Promise.all([
    supabase
      .from("trips")
      .select(
        "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), users!client_id(*), driver_profiles(*, provider_profiles(*, users(*)))",
      )
      .eq("driver_profile_id", driverProfileId)
      .gte("updated_at", rangeStart)
      .order("updated_at", { ascending: false }),
    supabase
      .from("trip_driver_candidates")
      .select("id, trip_id, driver_profile_id, status, responded_at, created_at")
      .eq("driver_profile_id", driverProfileId)
      .gte("created_at", rangeStart),
    supabase
      .from("ratings")
      .select(
        "*, rater:users!rater_id(id, full_name, email), rated:users!rated_id(id, full_name, email)",
      )
      .eq("rated_id", driverUserId)
      .gte("created_at", rangeStart)
      .order("created_at", { ascending: false }),
  ]);

  if (tripsResult.error) throw tripsResult.error;
  if (candidatesResult.error) throw candidatesResult.error;
  if (ratingsResult.error) throw ratingsResult.error;

  const tripRows = (tripsResult.data ?? []) as Trip[];
  const ratings = (ratingsResult.data ?? []) as Rating[];
  const metrics = buildDriverMetrics({
    driverProfileId,
    driverUserId,
    range,
    trips: tripRows,
    candidates: (candidatesResult.data ?? []) as Array<{
      id: string;
      trip_id: string;
      driver_profile_id: string;
      status: string;
      responded_at: string | null;
      created_at: string;
    }>,
    ratings: ratings.map((rating) => ({
      id: rating.id,
      rated_id: rating.rated_id,
      rating: Number(rating.rating),
      created_at: rating.created_at,
    })),
  });

  const ratingsByTrip = new Map<string, Rating[]>();
  for (const rating of ratings) {
    if (!rating.trip_id) continue;
    ratingsByTrip.set(rating.trip_id, [
      ...(ratingsByTrip.get(rating.trip_id) ?? []),
      rating,
    ]);
  }

  return {
    metrics,
    history: tripRows.map((trip) => ({
      trip,
      ratings: ratingsByTrip.get(trip.id) ?? [],
    })),
  };
}

export function isPublicRating(rating: Pick<Rating, "rating">): boolean {
  return Number(rating.rating) >= 4;
}

// ─── Provider Profiles ─────────────────────────────────────
export async function fetchProviderProfiles(): Promise<ProviderProfile[]> {
  const { data, error } = await supabase
    .from("provider_profiles")
    .select("*, users(*), service_categories(*), driver_profiles(id)");
  if (error) throw error;
  return ((data ?? []) as (ProviderProfile & { driver_profiles?: unknown })[])
    .filter(isProviderWithoutDriverProfile)
    .map((provider) => {
      const cleanProvider = { ...provider };
      delete cleanProvider.driver_profiles;
      return cleanProvider;
    });
}

// ─── Dashboard Stats ───────────────────────────────────────
export async function fetchDashboardStats() {
  const now = new Date();
  const startOfThisMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const startOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1,
  ).toISOString();
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999,
  ).toISOString();
  const sixMonthsAgo = new Date(
    now.getFullYear(),
    now.getMonth() - 5,
    1,
  ).toISOString();
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    tripsResult,
    servicesResult,
    paidTripsResult,
    paidServicesResult,
    ratingsResult,
    driversAvailableResult,
    pendingProvidersResult,
    recentTripsResult,
    recentServicesResult,
  ] = await Promise.all([
    supabase
      .from("trips")
      .select("id, status, final_price, estimated_price, is_paid, created_at"),
    supabase
      .from("service_requests")
      .select(
        "id, status, final_price, estimated_price, is_paid, created_at, updated_at",
      ),
    supabase
      .from("trips")
      .select("final_price, payment_date, updated_at, payment_method")
      .eq("is_paid", true)
      .gte("updated_at", sixMonthsAgo),
    supabase
      .from("service_requests")
      .select("final_price, updated_at, payment_method")
      .eq("is_paid", true)
      .gte("updated_at", sixMonthsAgo),
    supabase.from("ratings").select("rating"),
    supabase
      .from("driver_profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_available", true),
    supabase
      .from("provider_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("trips")
      .select(
        "id, status, scheduled_datetime, final_price, estimated_price, is_paid, payment_method, users!client_id(full_name), pickup_address:addresses!pickup_address_id(formatted_address), dropoff_address:addresses!dropoff_address_id(formatted_address)",
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("service_requests")
      .select(
        "id, status, service_date, description, final_price, estimated_price, is_paid, payment_method, users!client_id(full_name), service_categories(name)",
      )
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const trips = tripsResult.data ?? [];
  const services = servicesResult.data ?? [];
  const paidTrips = paidTripsResult.data ?? [];
  const paidServices = paidServicesResult.data ?? [];
  const ratings = ratingsResult.data ?? [];

  // ── Revenue ────────────────────────────────────────────
  // Use payment_date when available, fall back to updated_at
  const tripEffectiveDate = (t: {
    payment_date?: string | null;
    updated_at: string;
  }) => t.payment_date ?? t.updated_at;

  const revenueThisMonth =
    paidTrips
      .filter((t) => tripEffectiveDate(t) >= startOfThisMonth)
      .reduce((s, t) => s + (t.final_price ?? 0), 0) +
    paidServices
      .filter((s) => s.updated_at >= startOfThisMonth)
      .reduce((s, t) => s + (t.final_price ?? 0), 0);

  const revenueLastMonth =
    paidTrips
      .filter((t) => {
        const d = tripEffectiveDate(t);
        return d >= startOfLastMonth && d <= endOfLastMonth;
      })
      .reduce((s, t) => s + (t.final_price ?? 0), 0) +
    paidServices
      .filter(
        (s) =>
          s.updated_at >= startOfLastMonth && s.updated_at <= endOfLastMonth,
      )
      .reduce((s, t) => s + (t.final_price ?? 0), 0);

  const revenueChange =
    revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : null;

  const pendingRevenue =
    trips
      .filter((t) => t.status === "finished" && !t.is_paid)
      .reduce((s, t) => s + (t.final_price ?? t.estimated_price ?? 0), 0) +
    services
      .filter((s) => s.status === "finished" && !s.is_paid)
      .reduce((s, t) => s + (t.final_price ?? t.estimated_price ?? 0), 0);

  const allPaid = [...paidTrips, ...paidServices].filter(
    (i) => (i.final_price ?? 0) > 0,
  );
  const avgTicket =
    allPaid.length > 0
      ? allPaid.reduce((s, i) => s + (i.final_price ?? 0), 0) / allPaid.length
      : 0;

  // ── Operations ─────────────────────────────────────────
  const activeTripsStatuses = new Set([
    "started",
    "scheduled",
    "searching_drivers",
    "awaiting_client_confirmation",
    "awaiting_driver_confirmation",
  ]);
  const activeServiceStatuses = new Set([
    "in_progress",
    "assigned",
    "searching_provider",
  ]);
  const activeOps =
    trips.filter((t) => activeTripsStatuses.has(t.status)).length +
    services.filter((s) => activeServiceStatuses.has(s.status)).length;

  const recentAll = [
    ...trips.filter((t) => t.created_at >= thirtyDaysAgo),
    ...services.filter((s) => s.created_at >= thirtyDaysAgo),
  ];
  const completionRate =
    recentAll.length > 0
      ? Math.round(
          (recentAll.filter((i) => i.status === "finished").length /
            recentAll.length) *
            100,
        )
      : 0;

  const avgRating =
    ratings.length > 0
      ? Number(
          (
            ratings.reduce((s, r) => s + Number(r.rating), 0) / ratings.length
          ).toFixed(1),
        )
      : 0;

  // ── Monthly chart (6 months) ───────────────────────────
  const MONTH_LABELS = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABELS[d.getMonth()],
      trips: 0,
      services: 0,
    };
  });

  paidTrips.forEach((t) => {
    if (!t.final_price) return;
    const d = new Date(t.payment_date ?? t.updated_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const slot = monthlyRevenue.find((m) => m.month === key);
    if (slot) slot.trips += t.final_price;
  });

  paidServices.forEach((s) => {
    if (!s.final_price) return;
    const d = new Date(s.updated_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const slot = monthlyRevenue.find((m) => m.month === key);
    if (slot) slot.services += s.final_price;
  });

  // ── Payment method distribution ────────────────────────
  const paymentMap: Record<string, number> = {};
  [...paidTrips, ...paidServices].forEach((item) => {
    const m = item.payment_method ?? "outro";
    paymentMap[m] = (paymentMap[m] ?? 0) + 1;
  });

  // ── Status distributions ───────────────────────────────
  const tripStatusMap: Record<string, number> = {};
  trips.forEach((t) => {
    tripStatusMap[t.status] = (tripStatusMap[t.status] ?? 0) + 1;
  });

  const serviceStatusMap: Record<string, number> = {};
  services.forEach((s) => {
    serviceStatusMap[s.status] = (serviceStatusMap[s.status] ?? 0) + 1;
  });

  // ── Alerts ─────────────────────────────────────────────
  const alertAwaitingClient = trips.filter(
    (t) => t.status === "awaiting_client_confirmation",
  ).length;
  const alertAwaitingDriver = trips.filter(
    (t) => t.status === "awaiting_driver_confirmation",
  ).length;
  const alertUnderReview =
    trips.filter((t) => t.status === "under_review").length +
    services.filter((s) => s.status === "under_review").length;
  const alertUnpaidFinished =
    trips.filter((t) => t.status === "finished" && !t.is_paid).length +
    services.filter((s) => s.status === "finished" && !s.is_paid).length;

  return {
    revenueThisMonth,
    revenueLastMonth,
    revenueChange,
    pendingRevenue,
    avgTicket,
    activeOps,
    completionRate,
    avgRating,
    driversAvailable: driversAvailableResult.count ?? 0,
    pendingProviders: pendingProvidersResult.count ?? 0,
    totalTrips: trips.length,
    totalServices: services.length,
    monthlyRevenue,
    paymentMap,
    tripStatusMap,
    serviceStatusMap,
    alertAwaitingClient,
    alertAwaitingDriver,
    alertUnderReview,
    alertUnpaidFinished,
    recentTrips: recentTripsResult.data ?? [],
    recentServices: recentServicesResult.data ?? [],
  };
}

// ─── Service Categories ────────────────────────────────────
export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data as ServiceCategory[];
}

export async function createServiceCategory(input: {
  name: string;
  description?: string | null;
  icon_url?: string | null;
  service_type?: ServiceTypeEnum;
}): Promise<ServiceCategory> {
  const name = input.name.trim();
  const { data, error } = await supabase
    .from("service_categories")
    .insert({
      name,
      slug: buildServiceCategorySlug(name),
      description: input.description ?? null,
      service_type: input.service_type ?? "other_service",
      is_active: true,
      icon_url: input.icon_url ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ServiceCategory;
}

// ─── Addresses ─────────────────────────────────────────────
export async function createAddress(address: {
  formatted_address: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}) {
  const { data, error } = await supabase
    .from("addresses")
    .insert(address)
    .select()
    .single();
  if (error) throw error;
  return data as Address;
}

// ─── User Saved Addresses ─────────────────────────────────
export async function fetchUserSavedAddresses(
  userId: string,
): Promise<UserSavedAddress[]> {
  const { data, error } = await supabase
    .from("user_saved_addresses")
    .select("*, addresses(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as UserSavedAddress[];
}

export async function saveUserSavedAddress(
  userId: string,
  label: "home" | "work",
  address: GooglePlaceAddress,
): Promise<void> {
  const { data: newAddress, error: addressError } = await supabase
    .from("addresses")
    .insert({
      formatted_address: address.formatted_address,
      google_place_id: address.google_place_id ?? null,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      street: address.street ?? null,
      number: address.number ?? null,
      neighborhood: address.neighborhood ?? null,
      city: address.city ?? null,
      state: address.state ?? null,
      zip_code: address.zip_code ?? null,
    })
    .select("id")
    .single();
  if (addressError || !newAddress) {
    throw addressError ?? new Error("addresses insert failed");
  }

  const { data: existing, error: existingError } = await supabase
    .from("user_saved_addresses")
    .select("id")
    .eq("user_id", userId)
    .eq("label", label)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error: updateError } = await supabase
      .from("user_saved_addresses")
      .update({
        address_id: newAddress.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from("user_saved_addresses")
      .insert({
        user_id: userId,
        address_id: newAddress.id,
        label,
      });
    if (insertError) throw insertError;
  }
}

export async function removeUserSavedAddress(
  userId: string,
  label: "home" | "work",
): Promise<void> {
  const { error } = await supabase
    .from("user_saved_addresses")
    .delete()
    .eq("user_id", userId)
    .eq("label", label);
  if (error) throw error;
}

export async function fetchClientAddressHistory(
  clientId: string,
  field: "pickup" | "dropoff",
  limit = 4,
): Promise<GooglePlaceAddress[]> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, created_at, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*)",
    )
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  const addresses: GooglePlaceAddress[] = [];
  const seen = new Set<string>();

  for (const row of data ?? []) {
    const rawUnknown =
      field === "pickup" ? row.pickup_address : row.dropoff_address;
    const raw = (
      Array.isArray(rawUnknown) ? rawUnknown[0] : rawUnknown
    ) as Address | null | undefined;
    if (!raw) continue;
    const key = raw.google_place_id ?? raw.formatted_address;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    addresses.push({
      formatted_address: raw.formatted_address,
      google_place_id: raw.google_place_id,
      latitude: raw.latitude,
      longitude: raw.longitude,
      street: raw.street,
      number: raw.number,
      neighborhood: raw.neighborhood,
      city: raw.city,
      state: raw.state,
      zip_code: raw.zip_code,
    });
    if (addresses.length >= limit) break;
  }

  return addresses;
}

export async function fetchClientPerformance(
  clientId: string,
  period: DriverMetricPeriod,
): Promise<{ metrics: ClientMetrics; history: ClientTripHistoryEntry[] }> {
  const range = getClientMetricPeriodRange(period);
  const rangeStart = range.start.toISOString();

  const [tripsResult, ratingsResult] = await Promise.all([
    supabase
      .from("trips")
      .select(
        "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), users!client_id(*), driver_profiles(*, provider_profiles(*, users(*)))",
      )
      .eq("client_id", clientId)
      .gte("updated_at", rangeStart)
      .order("updated_at", { ascending: false }),
    supabase
      .from("ratings")
      .select(
        "*, rater:users!rater_id(id, full_name, email), rated:users!rated_id(id, full_name, email)",
      )
      .eq("rated_id", clientId)
      .gte("created_at", rangeStart)
      .order("created_at", { ascending: false }),
  ]);

  if (tripsResult.error) throw tripsResult.error;
  if (ratingsResult.error) throw ratingsResult.error;

  const tripRows = (tripsResult.data ?? []) as Trip[];
  const ratings = (ratingsResult.data ?? []) as Rating[];

  const metrics = buildClientMetrics({
    clientId,
    range,
    trips: tripRows.map((trip) => ({
      id: trip.id,
      status: trip.status,
      client_id: trip.client_id,
      final_price: trip.final_price,
      estimated_price: trip.estimated_price,
      finished_at: trip.finished_at,
      cancelled_at: trip.cancelled_at,
      updated_at: trip.updated_at,
      scheduled_datetime: trip.scheduled_datetime,
    })),
    ratings: ratings.map((rating) => ({
      id: rating.id,
      rated_id: rating.rated_id,
      rating: Number(rating.rating),
      created_at: rating.created_at,
    })),
  });

  const ratingsByTrip = new Map<string, Rating[]>();
  for (const rating of ratings) {
    if (!rating.trip_id) continue;
    ratingsByTrip.set(rating.trip_id, [
      ...(ratingsByTrip.get(rating.trip_id) ?? []),
      rating,
    ]);
  }

  return {
    metrics,
    history: tripRows.map((trip) => ({
      trip,
      ratings: ratingsByTrip.get(trip.id) ?? [],
    })),
  };
}

// ─── Admin Create Trip (via server route, bypasses RLS) ───
export async function adminCreateTrip(trip: {
  client_id: string;
  service_category_id: string;
  pickup_address:
    | string
    | {
        formatted_address: string;
        google_place_id?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        street?: string | null;
        number?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
        zip_code?: string | null;
      };
  dropoff_address:
    | string
    | {
        formatted_address: string;
        google_place_id?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        street?: string | null;
        number?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
        zip_code?: string | null;
      };
  stops?: Array<
    | string
    | {
        formatted_address: string;
        google_place_id?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        street?: string | null;
        number?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
        zip_code?: string | null;
      }
  >;
  scheduled_datetime: string;
  is_round_trip: boolean;
  return_datetime?: string | null;
  passenger_count: number;
  children_count?: number;
  luggage_count?: number;
  observations?: string | null;
  payment_method?: string | null;
}) {
  const res = await fetch("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trip),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao criar viagem");
  return data as Trip;
}

// ─── Create Trip ───────────────────────────────────────────
export async function createTrip(trip: {
  client_id: string;
  service_category_id: string;
  pickup_address_id: string;
  dropoff_address_id: string;
  scheduled_datetime: string;
  is_round_trip: boolean;
  return_datetime?: string | null;
  passenger_count: number;
  children_count?: number;
  luggage_count?: number;
  observations?: string | null;
  payment_method?: string | null;
}) {
  const { data, error } = await supabase
    .from("trips")
    .insert({ ...trip, status: "open" })
    .select()
    .single();
  if (error) throw error;
  return data as Trip;
}

// ─── Create Service Request ────────────────────────────────
export async function createServiceRequest(req: {
  client_id: string;
  service_category_id: string;
  service_date: string;
  description: string;
  address_id?: string | null;
  estimated_price?: number | null;
  observations?: string | null;
}) {
  const { data, error } = await supabase
    .from("service_requests")
    .insert({ ...req, status: "open" })
    .select()
    .single();
  if (error) throw error;
  return data as ServiceRequest;
}

export async function addServiceRequestPhoto(photo: {
  service_request_id: string;
  photo_url: string;
  sort_order: number;
}) {
  const { data, error } = await supabase
    .from("service_request_photos")
    .insert(photo)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Create User ───────────────────────────────────────────
export async function createUser(user: {
  full_name: string;
  email: string;
  password?: string;
  phone?: string | null;
  cpf?: string | null;
  role: string;
  date_of_birth?: string | null;
}) {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao criar usuário");
  return data as User;
}

// ─── Delete User ───────────────────────────────────────────
export async function deleteUserById(id: string): Promise<void> {
  const res = await fetch(`/api/users/${id}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao excluir usuário");
}

// ─── Update User ───────────────────────────────────────────
export async function updateUserById(
  id: string,
  user: {
    full_name: string;
    email: string;
    phone?: string | null;
    cpf?: string | null;
    date_of_birth?: string | null;
    is_active?: boolean;
  },
): Promise<User> {
  const res = await fetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao atualizar usuário");
  return data as User;
}

// ─── Update Driver ─────────────────────────────────────────
export async function updateDriverById(
  id: string,
  driver: {
    user_id: string;
    provider_profile_id: string;
    vehicle_id?: string | null;
    full_name: string;
    email: string;
    phone?: string | null;
    cpf?: string | null;
    provider_status: ProviderStatus;
    cnh_number?: string | null;
    cnh_category?: string | null;
    cnh_expiration_date?: string | null;
    is_available: boolean;
    vehicle?: {
      brand?: string | null;
      model?: string | null;
      year?: number | string | null;
      color?: string | null;
      license_plate?: string | null;
      passenger_capacity?: number | string | null;
      category?: "simple" | "popular" | "luxury" | null;
    };
  },
): Promise<DriverProfile> {
  const res = await fetch(`/api/drivers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(driver),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao atualizar motorista");
  return data as DriverProfile;
}

// ─── Create Provider Profile ───────────────────────────────
export async function createProviderProfile(profile: {
  user_id: string;
  service_category_id: string;
  status?: ProviderStatus;
  bio?: string | null;
  has_card_machine?: boolean;
  issues_invoice?: boolean;
}) {
  const { data, error } = await supabase
    .from("provider_profiles")
    .insert({ ...profile, status: profile.status ?? "pending" })
    .select()
    .single();
  if (error) throw error;
  return data as ProviderProfile;
}

// ─── Create Driver Profile ─────────────────────────────────
export async function createDriverProfile(profile: {
  provider_profile_id: string;
  cnh_number?: string | null;
  cnh_category?: string | null;
  cnh_expiration_date?: string | null;
  is_available?: boolean;
}) {
  const { data, error } = await supabase
    .from("driver_profiles")
    .insert({ ...profile, is_available: profile.is_available ?? false })
    .select()
    .single();
  if (error) throw error;
  return data as DriverProfile;
}

// ─── Create Vehicle ────────────────────────────────────────
export async function createVehicle(vehicle: {
  driver_profile_id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  vehicle_document_url?: string;
  passenger_capacity: number;
  category?: "simple" | "popular" | "luxury" | null;
}) {
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      ...vehicle,
      vehicle_document_url: vehicle.vehicle_document_url ?? "",
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Vehicle;
}
