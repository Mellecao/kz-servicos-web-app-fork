export function formatTimeAgo(isoTimestamp: string, nowMs: number = Date.now()): string {
  const then = new Date(isoTimestamp).getTime();
  const diffMs = nowMs - then;
  if (diffMs < 60_000) return "agora";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `há ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  return `há ${diffHr}h`;
}
