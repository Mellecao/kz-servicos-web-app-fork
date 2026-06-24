export function isMissingPostgrestRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "PGRST200" || code === "PGRST205";
}
