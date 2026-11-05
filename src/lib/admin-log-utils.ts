export function isLogClickable(log: { entity_id: string | null }): boolean {
  return log.entity_id !== null && log.entity_id !== "";
}
