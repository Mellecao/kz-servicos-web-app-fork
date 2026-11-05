import { supabase } from "@/lib/supabase";
import { logAdminAction } from "@/lib/api";
import type { ProviderForInvite } from "@/lib/service-requests";
import type { ProviderProfile, ServiceCandidate, User } from "@/types/database";

// Fluxo do admin sobre um serviço (service_requests):
//   under_review → aprovar (searching_provider) ou rejeitar (review_rejected, com motivo)
//   searching_provider → convidar prestadores → escolher um (RPC select_service_request_provider)
// O admin tem RLS de insert/update em service_request_provider_candidates (migration
// 20260814133242). Rejeitar usa a RPC reject_service_request (20261105140000).

const ENTITY = "service_request";

/** Inicia a análise (open → under_review); falha se outro admin já mexeu no serviço. */
export async function startServiceReview(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("service_requests")
    .update({ status: "under_review" })
    .eq("id", id)
    .eq("status", "open")
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("O serviço mudou de estado entretanto. Atualize a lista e tente novamente.");
  }
  logAdminAction("Análise do serviço iniciada", id, {}, ENTITY);
}

/** Aprova a análise. `.eq('status', 'under_review')` evita sobrepor uma mudança de outro admin. */
export async function approveServiceRequest(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("service_requests")
    .update({ status: "searching_provider" })
    .eq("id", id)
    .eq("status", "under_review")
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("O serviço mudou de estado entretanto. Atualize a lista e tente novamente.");
  }
  logAdminAction("Serviço aprovado na análise", id, {}, ENTITY);
}

export async function rejectServiceRequest(id: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  const { error } = await supabase.rpc("reject_service_request", {
    p_service_request_id: id,
    p_reason: trimmed,
  });
  if (error) throw error;
  logAdminAction("Serviço rejeitado na análise", id, { reason: trimmed }, ENTITY);
}

export type InvitableProvider = ProviderForInvite &
  Pick<ProviderProfile, "average_rating"> & { users?: Pick<User, "full_name" | "phone"> | null };

/** Prestadores com as categorias extra; o filtro de quem pode ser convidado é `eligibleProviders`. */
export async function fetchInvitableProviders(): Promise<InvitableProvider[]> {
  const { data, error } = await supabase
    .from("provider_profiles")
    .select(
      "id, status, service_category_id, average_rating, users(full_name, phone), provider_category_services(service_category_id)"
    )
    .eq("status", "approved");
  if (error) throw error;
  return (data ?? []) as unknown as InvitableProvider[];
}

export async function fetchServiceCandidates(requestId: string): Promise<ServiceCandidate[]> {
  const { data, error } = await supabase
    .from("service_request_provider_candidates")
    .select("*, provider_profiles(id, users(full_name, phone))")
    .eq("service_request_id", requestId)
    .order("invited_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ServiceCandidate[];
}

/** Motivo da última rejeição (gravado por reject_service_request no histórico); null se não houver. */
export async function fetchRejectionReason(requestId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("service_request_status_history")
    .select("observations")
    .eq("service_request_id", requestId)
    .eq("to_status", "review_rejected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.observations ?? null;
}

/** Convida vários prestadores. Quem já foi convidado é ignorado (UNIQUE request+prestador). */
export async function inviteProviders(requestId: string, providerIds: string[]): Promise<void> {
  if (providerIds.length === 0) return;
  const { error } = await supabase
    .from("service_request_provider_candidates")
    .upsert(
      providerIds.map((provider_profile_id) => ({
        service_request_id: requestId,
        provider_profile_id,
      })),
      { onConflict: "service_request_id,provider_profile_id", ignoreDuplicates: true }
    );
  if (error) throw error;
  logAdminAction("Prestadores convidados para o serviço", requestId, { providerIds }, ENTITY);
}

/** Escolhe o prestador: o serviço passa a `awaiting_client_confirmation` com este preço final. */
export async function selectServiceProvider(
  requestId: string,
  providerProfileId: string,
  price: number
): Promise<void> {
  const { error } = await supabase.rpc("select_service_request_provider", {
    p_service_request_id: requestId,
    p_provider_profile_id: providerProfileId,
    p_offered_price: price,
  });
  if (error) throw error;
  logAdminAction("Prestador escolhido para o serviço", requestId, { providerProfileId, price }, ENTITY);
}

/** URLs das fotos que o cliente anexou ao pedido (bucket público Service_Request_Photos). */
export async function fetchServiceRequestPhotos(requestId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("service_request_photos")
    .select("photo_url")
    .eq("service_request_id", requestId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => p.photo_url as string);
}

export interface ServiceStatusChange {
  id: string;
  from_status: string | null;
  to_status: string;
  observations: string | null;
  created_at: string;
}

/** Histórico de estados do pedido (gravado por trigger), do mais antigo para o mais recente. */
export async function fetchServiceStatusHistory(requestId: string): Promise<ServiceStatusChange[]> {
  const { data, error } = await supabase
    .from("service_request_status_history")
    .select("id, from_status, to_status, observations, created_at")
    .eq("service_request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ServiceStatusChange[];
}
