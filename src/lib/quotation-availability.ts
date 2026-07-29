export type QuotationAvailability = "available" | "unavailable";
export type QuotationOverride = "auto" | "force_enabled" | "force_disabled";

export function computeQuotationAvailability(params: {
  nowInSp: Date;
  adminOverride: QuotationOverride;
  startHour?: number;
  endHour?: number;
}): QuotationAvailability {
  const { nowInSp, adminOverride, startHour = 7, endHour = 20 } = params;
  if (adminOverride === "force_enabled") return "available";
  if (adminOverride === "force_disabled") return "unavailable";
  const h = nowInSp.getHours();
  return h >= startHour && h < endHour ? "available" : "unavailable";
}
