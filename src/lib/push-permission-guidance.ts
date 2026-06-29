export function isMobileUserAgent(userAgent: string) {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
}

export function getNotificationSettingsHref(userAgent: string) {
  const normalized = userAgent.toLowerCase();

  if (normalized.includes("android")) {
    return "intent://settings#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;end";
  }

  if (/iphone|ipad|ipod/.test(normalized)) {
    return "app-settings:";
  }

  return null;
}
