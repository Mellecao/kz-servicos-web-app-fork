import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildFcmMessage,
  deduplicateTokens,
  isAuthorizedWebhook,
  isInvalidFcmTokenError,
  summarizeDispatchResults,
  tripRequestChannelId,
  tripRequestSound,
} from './push-message.ts';

Deno.test('builds visible high-priority Android trip request notification', () => {
  const message = buildFcmMessage({
    token: 'token-1',
    title: 'Nova corrida disponível!',
    body: 'Maria solicitou uma nova corrida.',
    data: { type: 'trip_request', trip_id: 'trip-1' },
    persistent: true,
  });

  assertEquals(message.notification, {
    title: 'Nova corrida disponível!',
    body: 'Maria solicitou uma nova corrida.',
  });
  assertEquals(message.android.priority, 'high');
  assertEquals(message.android.notification.channel_id, tripRequestChannelId);
  assertEquals(message.android.notification.sound, tripRequestSound);
  assertEquals(message.android.notification.sticky, true);
  assertEquals(message.android.direct_boot_ok, true);
  assertEquals(message.data, {
    type: 'trip_request',
    trip_id: 'trip-1',
  });
});

Deno.test('deduplicates non-empty device tokens', () => {
  assertEquals(deduplicateTokens(['token-1', '', 'token-1', 'token-2']), [
    'token-1',
    'token-2',
  ]);
});

Deno.test('recognizes unregistered FCM tokens', () => {
  assert(
    isInvalidFcmTokenError(
      404,
      '{"error":{"details":[{"errorCode":"UNREGISTERED"}]}}',
    ),
  );
  assert(!isInvalidFcmTokenError(500, 'internal'));
});

Deno.test('accepts only an exact non-empty webhook secret', () => {
  assert(isAuthorizedWebhook('secret', 'secret'));
  assert(!isAuthorizedWebhook('', ''));
  assert(!isAuthorizedWebhook('wrong', 'secret'));
});

Deno.test('summarizes sent, invalid and failed deliveries', () => {
  assertEquals(
    summarizeDispatchResults([
      { ok: true },
      { ok: false, invalidToken: true },
      { ok: false, error: 'fcm_error' },
    ]),
    { sent: 1, invalid: 1, errors: 1 },
  );
});
