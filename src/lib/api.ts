import { supabase } from "@/lib/supabase";
import type {
  User,
  Trip,
  TripStatus,
  TripDriverCandidate,
  TripDriverCandidateStatus,
  TripStatusHistory,
  ServiceRequest,
  ServiceRequestStatus,
  DriverProfile,
  ProviderProfile,
  Vehicle,
  Address,
  ServiceCategory,
  ProviderStatus,
  Debito,
  PaymentMethod,
  AdminLog,
} from "@/types/database";

// ─── Admin Logs ────────────────────────────────────────────
function logAdminAction(
  action: string,
  entityId: string,
  details: Record<string, unknown>
): void {
  supabase.from("admin_logs").insert({ action, entity_id: entityId, details }).then();
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
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as User[];
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
  const { data, error } = await supabase
    .from("trips")
    .select(
      "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), service_categories(*), users!client_id(*)"
    )
    .order("scheduled_datetime", { ascending: false });
  if (error) throw error;
  return data as Trip[];
}

// ─── Service Requests ──────────────────────────────────────
export async function fetchServiceRequests(): Promise<ServiceRequest[]> {
  const { data, error } = await supabase
    .from("service_requests")
    .select(
      "*, service_categories(*), addresses(*), users!client_id(*)"
    )
    .order("service_date", { ascending: false });
  if (error) throw error;
  return data as ServiceRequest[];
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
  }
): Promise<void> {
  const { error } = await supabase.from("trips").update(payload).eq("id", id);
  if (error) throw error;
  logAdminAction("Financeiro atualizado", id, payload as Record<string, unknown>);
}

// ─── Update Service Request Financial ─────────────────────
export async function updateServiceRequestFinancial(
  id: string,
  payload: {
    is_paid?: boolean;
    is_provider_paied?: boolean;
    final_price?: number | null;
    payment_method?: PaymentMethod | null;
  }
): Promise<void> {
  const { error } = await supabase.from("service_requests").update(payload).eq("id", id);
  if (error) throw error;
}

// ─── Update Trip Status ────────────────────────────────────
export async function updateTripStatus(id: string, status: TripStatus): Promise<void> {
  const { error } = await supabase
    .from("trips")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
  logAdminAction("Status atualizado", id, { status });
}

// ─── Fetch Single Trip ─────────────────────────────────────
export async function fetchTripById(id: string): Promise<Trip> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "*, pickup_address:addresses!pickup_address_id(*), dropoff_address:addresses!dropoff_address_id(*), service_categories(*), users!client_id(*), driver_profiles(*, provider_profiles(*, users(*)))"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Trip;
}

// ─── Trip Status History ───────────────────────────────────
export async function fetchTripStatusHistory(tripId: string): Promise<TripStatusHistory[]> {
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

// ─── Trip Driver Candidates ────────────────────────────────
export async function fetchTripDriverCandidates(tripId: string): Promise<TripDriverCandidate[]> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .select("*, driver_profiles(*, provider_profiles(*, users(*)))")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TripDriverCandidate[];
}

export async function addTripDriverCandidate(
  tripId: string,
  driverProfileId: string
): Promise<TripDriverCandidate> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .insert({ trip_id: tripId, driver_profile_id: driverProfileId, status: "pending" })
    .select("*, driver_profiles(*, provider_profiles(*, users(*)))")
    .single();
  if (error) throw error;
  logAdminAction("Motorista adicionado como candidato", tripId, { driver_profile_id: driverProfileId });
  return data as TripDriverCandidate;
}

export async function removeTripDriverCandidate(
  tripId: string,
  driverProfileId: string
): Promise<void> {
  const { error } = await supabase
    .from("trip_driver_candidates")
    .delete()
    .eq("trip_id", tripId)
    .eq("driver_profile_id", driverProfileId);
  if (error) throw error;
  logAdminAction("Candidato removido", tripId, { driver_profile_id: driverProfileId });
}

export async function updateTripDriverCandidateStatus(
  tripId: string,
  driverProfileId: string,
  status: TripDriverCandidateStatus
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
  logAdminAction("Status do candidato atualizado", tripId, { driver_profile_id: driverProfileId, status });
  return data as TripDriverCandidate;
}

export async function selectTripDriver(
  tripId: string,
  candidateId: string,
  driverProfileId: string,
  offeredPrice: number
): Promise<void> {
  const { error } = await supabase.rpc('select_trip_driver', {
    p_trip_id: tripId,
    p_candidate_id: candidateId,
    p_driver_profile_id: driverProfileId,
    p_offered_price: offeredPrice,
  });
  if (error) throw new Error(error.message);
  logAdminAction("Motorista selecionado", tripId, { driver_profile_id: driverProfileId, offered_price: offeredPrice });
}

export async function approveDriverCandidate(
  tripId: string,
  driverProfileId: string,
  approved: boolean
): Promise<TripDriverCandidate> {
  const { data, error } = await supabase
    .from("trip_driver_candidates")
    .update({ admin_approved: approved })
    .eq("trip_id", tripId)
    .eq("driver_profile_id", driverProfileId)
    .select("*, driver_profiles(*, provider_profiles(*, users(*)))")
    .single();
  if (error) throw error;
  logAdminAction(approved ? "Candidato aprovado para cliente" : "Aprovação do candidato removida", tripId, { driver_profile_id: driverProfileId });
  return data as TripDriverCandidate;
}

export async function resendDriverConfirmationNotification(tripId: string): Promise<void> {
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
    Array.isArray(value) ? value[0] : value ?? undefined;

  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, status, driver_profile_id, scheduled_datetime, pickup_address:addresses!pickup_address_id(formatted_address), dropoff_address:addresses!dropoff_address_id(formatted_address), driver_profiles(provider_profiles(user_id, users(full_name)))"
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
  status: ServiceRequestStatus
): Promise<void> {
  const { error } = await supabase
    .from("service_requests")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
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
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );
}

// ─── Driver Profiles ───────────────────────────────────────
export async function fetchDriverProfiles(): Promise<DriverProfile[]> {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("*, provider_profiles(*, users(*))");
  if (error) throw error;
  return data as DriverProfile[];
}

export async function fetchVehiclesByDriver(
  driverProfileId: string
): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("driver_profile_id", driverProfileId);
  if (error) throw error;
  return data as Vehicle[];
}

// ─── Provider Profiles ─────────────────────────────────────
export async function fetchProviderProfiles(): Promise<ProviderProfile[]> {
  const { data, error } = await supabase
    .from("provider_profiles")
    .select("*, users(*), service_categories(*)");
  if (error) throw error;
  return data as ProviderProfile[];
}

// ─── Dashboard Stats ───────────────────────────────────────
export async function fetchDashboardStats() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

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
      .select("id, status, final_price, estimated_price, is_paid, created_at, updated_at"),
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
        "id, status, scheduled_datetime, final_price, estimated_price, is_paid, payment_method, users!client_id(full_name), pickup_address:addresses!pickup_address_id(formatted_address), dropoff_address:addresses!dropoff_address_id(formatted_address)"
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("service_requests")
      .select(
        "id, status, service_date, description, final_price, estimated_price, is_paid, payment_method, users!client_id(full_name), service_categories(name)"
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
  const tripEffectiveDate = (t: { payment_date?: string | null; updated_at: string }) =>
    t.payment_date ?? t.updated_at;

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
      .filter((s) => s.updated_at >= startOfLastMonth && s.updated_at <= endOfLastMonth)
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
    (i) => (i.final_price ?? 0) > 0
  );
  const avgTicket =
    allPaid.length > 0
      ? allPaid.reduce((s, i) => s + (i.final_price ?? 0), 0) / allPaid.length
      : 0;

  // ── Operations ─────────────────────────────────────────
  const activeTripsStatuses = new Set([
    "started", "scheduled", "searching_drivers",
    "awaiting_client_confirmation", "awaiting_driver_confirmation",
  ]);
  const activeServiceStatuses = new Set(["in_progress", "assigned", "searching_provider"]);
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
          (recentAll.filter((i) => i.status === "finished").length / recentAll.length) * 100
        )
      : 0;

  const avgRating =
    ratings.length > 0
      ? Number(
          (ratings.reduce((s, r) => s + Number(r.rating), 0) / ratings.length).toFixed(1)
        )
      : 0;

  // ── Monthly chart (6 months) ───────────────────────────
  const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
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
    (t) => t.status === "awaiting_client_confirmation"
  ).length;
  const alertAwaitingDriver = trips.filter(
    (t) => t.status === "awaiting_driver_confirmation"
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
  }
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
    };
  }
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
}) {
  const { data, error } = await supabase
    .from("vehicles")
    .insert({ ...vehicle, vehicle_document_url: vehicle.vehicle_document_url ?? "", is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data as Vehicle;
}
