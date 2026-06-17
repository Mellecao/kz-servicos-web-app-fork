export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export function formatBrazilDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBrazilDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
  });
}
