export const tripRequestChannelId = 'trip_alerts_v3';
export const messageChannelId = 'driver_messages_v1';
export const tripRequestSound = 'trip_notification';

export interface FcmMessageInput {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
  persistent?: boolean;
}

export interface DeliveryResult {
  ok: boolean;
  invalidToken?: boolean;
  error?: string;
}

export function buildFcmMessage(input: FcmMessageInput) {
  return {
    token: input.token,
    notification: {
      title: input.title,
      body: input.body,
    },
    data: input.data,
    android: {
      priority: 'high' as const,
      notification: {
        channel_id: input.persistent ? tripRequestChannelId : messageChannelId,
        sound: input.persistent ? tripRequestSound : 'default',
        notification_priority: input.persistent ? 'PRIORITY_MAX' : 'PRIORITY_HIGH',
        default_vibrate_timings: true,
        sticky: input.persistent ?? false,
        event_time: new Date().toISOString(),
      },
      direct_boot_ok: true,
    },
    apns: {
      payload: {
        aps: {
          sound: tripRequestSound,
          interruptionLevel: input.persistent ? 'critical' : 'active',
        },
      },
    },
  };
}

export function deduplicateTokens(tokens: string[]): string[] {
  return [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];
}

export function isInvalidFcmTokenError(
  status: number,
  responseBody: string,
): boolean {
  return (
    status === 404 ||
    responseBody.includes('UNREGISTERED') ||
    responseBody.includes('registration-token-not-registered')
  );
}

export function isAuthorizedWebhook(
  providedSecret: string,
  expectedSecret: string,
): boolean {
  return (
    providedSecret.trim().length > 0 &&
    expectedSecret.trim().length > 0 &&
    providedSecret === expectedSecret
  );
}

export function summarizeDispatchResults(results: DeliveryResult[]) {
  return results.reduce(
    (summary, result) => {
      if (result.ok) summary.sent++;
      else if (result.invalidToken) summary.invalid++;
      else summary.errors++;
      return summary;
    },
    { sent: 0, invalid: 0, errors: 0 },
  );
}
