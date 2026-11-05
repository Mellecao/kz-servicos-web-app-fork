export type QuotationAvailability = "available" | "unavailable";
export type QuotationOverride = "auto" | "force_enabled" | "force_disabled";

export function computeQuotationAvailability(params: {
  nowLocal: Date;
  adminOverride: QuotationOverride;
  startHour?: number;
  endHour?: number;
}): QuotationAvailability {
  const { nowLocal, adminOverride, startHour = 7, endHour = 20 } = params;
  if (adminOverride === "force_enabled") return "available";
  if (adminOverride === "force_disabled") return "unavailable";
  const h = nowLocal.getHours();
  return h >= startHour && h < endHour ? "available" : "unavailable";
}
