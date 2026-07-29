import { supabase } from "@/lib/supabase";
import type { QuotationOverride } from "@/lib/quotation-availability";

const KEY = "scheduled_quote_admin_override";

export async function getScheduledQuoteOverride(): Promise<QuotationOverride> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();

  if (error) throw error;
  if (!data) return "auto";

  const raw = data.value;
  if (raw === "auto" || raw === "force_enabled" || raw === "force_disabled") {
    return raw;
  }
  return "auto";
}

export async function setScheduledQuoteOverride(newValue: QuotationOverride): Promise<void> {
  const { error } = await supabase.rpc("set_scheduled_quote_override", {
    new_value: newValue,
  });
  if (error) throw error;
}
