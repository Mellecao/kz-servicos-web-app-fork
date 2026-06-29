type AdminNotificationNavigationInput = {
  link?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
};

export function buildAdminNotificationHref(
  notification: AdminNotificationNavigationInput,
) {
  if (
    notification.link === "/viagens" &&
    notification.reference_type === "trip" &&
    notification.reference_id
  ) {
    return `/viagens?highlightTrip=${encodeURIComponent(notification.reference_id)}`;
  }

  return notification.link ?? null;
}
