import type { TripDriverCandidate, TripStatus } from "@/types/database";

export function canAdminApproveForClient(
  tripStatus: TripStatus,
  candidate: Pick<
    TripDriverCandidate,
    "status" | "admin_approved" | "offered_price"
  >
): boolean {
  return (
    tripStatus === "searching_drivers" &&
    candidate.status === "accepted" &&
    candidate.admin_approved &&
    candidate.offered_price != null
  );
}

export function shouldResetTripAfterCandidateRemoval(input: {
  currentDriverProfileId: string | null | undefined;
  removedDriverProfileId: string;
}): boolean {
  return input.currentDriverProfileId === input.removedDriverProfileId;
}
