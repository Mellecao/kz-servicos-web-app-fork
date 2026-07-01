import type {
  ServiceRequestProviderCandidate,
  ServiceRequestStatus,
} from "@/types/database";

export function canAdminApproveServiceForClient(
  requestStatus: ServiceRequestStatus,
  candidate: Pick<
    ServiceRequestProviderCandidate,
    "status" | "admin_approved" | "offered_price"
  >,
): boolean {
  return (
    requestStatus === "searching_provider" &&
    candidate.status === "accepted" &&
    candidate.admin_approved &&
    candidate.offered_price != null
  );
}
