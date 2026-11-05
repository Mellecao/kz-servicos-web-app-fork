export function isMobileUserAgent(userAgent: string) {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
}

export function getMobilePushPlatform(userAgent: string) {
  const normalized = userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(normalized)) return "ios";
  if (normalized.includes("android")) return "android";
  return "other";
}

export function getNotificationSettingsHref(userAgent: string) {
  const normalized = userAgent.toLowerCase();

  if (normalized.includes("android")) {
    return "intent://settings#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;end";
  }

  return null;
}
