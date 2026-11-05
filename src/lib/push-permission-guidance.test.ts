import test from "node:test";
import assert from "node:assert/strict";
import {
  getMobilePushPlatform,
  getNotificationSettingsHref,
  isMobileUserAgent,
} from "./push-permission-guidance.ts";

test("detects mobile admin browsers", () => {
  assert.equal(
    isMobileUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    ),
    true,
  );
  assert.equal(
    isMobileUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    ),
    false,
  );
});

test("returns best effort notification settings links for mobile platforms", () => {
  assert.equal(
    getNotificationSettingsHref(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    ),
    "intent://settings#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;end",
  );
  assert.equal(
    getNotificationSettingsHref(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
    ),
    null,
  );
  assert.equal(
    getNotificationSettingsHref(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    ),
    null,
  );
});

test("identifies mobile push platform constraints", () => {
  assert.equal(
    getMobilePushPlatform(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
    ),
    "ios",
  );
  assert.equal(
    getMobilePushPlatform(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    ),
    "android",
  );
  assert.equal(
    getMobilePushPlatform(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    ),
    "other",
  );
});
