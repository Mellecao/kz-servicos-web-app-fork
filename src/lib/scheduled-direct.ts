import { supabase } from "@/lib/supabase";

export async function cancelScheduledChooseDriverTrip(
  tripId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("cancel_scheduled_choose_driver_trip", {
    p_trip_id: tripId,
    p_reason: reason,
  });
  if (error) throw error;
}
