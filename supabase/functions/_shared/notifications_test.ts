import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  buildEmail,
  buildSMS,
  type NotificationPayload,
  NotificationService,
  parseNotificationChannels,
} from "./notifications.ts";

const monitor = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Stock watcher",
  url: "https://example.com/item",
  pattern: "in stock",
  pattern_type: "contains",
  user_id: "22222222-2222-4222-8222-222222222222",
};

function payload(over: Partial<NotificationPayload> = {}): NotificationPayload {
  return { monitor, type: "found", reason: "changed", ...over };
}

// deno-lint-ignore no-explicit-any
const stubSupabase = (onInsert?: (row: unknown) => void): any => ({
  from: () => ({
    insert: (row: unknown) => {
      onInsert?.(row);
      return Promise.resolve({ error: null });
    },
  }),
});

// --- channel parsing ---------------------------------------------------

Deno.test("parseNotificationChannels drops malformed entries", () => {
  assertEquals(
    parseNotificationChannels([
      { type: "email", address: "a@b.c" },
      { type: "email" },
      { type: "carrier-pigeon", address: "x" },
      { type: "sms", address: "" },
      null,
      "nope",
      { type: "sms", address: "+15550001111" },
    ]),
    [
      { type: "email", address: "a@b.c" },
      { type: "sms", address: "+15550001111" },
    ],
  );
  assertEquals(parseNotificationChannels(null), []);
  assertEquals(parseNotificationChannels("{}"), []);
});

// --- email rendering ---------------------------------------------------

Deno.test("buildEmail emits real HTML, not newline-separated text", () => {
  // The body used to be plain text with \n handed to Resend's `html` field,
  // so every client rendered it as one unbroken paragraph.
  const { html, text } = buildEmail(payload());
  assert(html.includes("<p"), "html body must contain block elements");
  assert(!html.includes("\n"), "html body must not rely on newlines");
  assertStringIncludes(text, "\n");
});

Deno.test("buildEmail links the real apex domain", () => {
  // The fallback pointed at roorooroo.app, which is not the app.
  const { html, text } = buildEmail(payload());
  assertStringIncludes(text, "https://roorooroo.com/dashboard");
  assertStringIncludes(html, "https://roorooroo.com/dashboard");
});

Deno.test("buildEmail escapes page content", () => {
  // contentSnippet is a slice of a page we do not control, so it is markup.
  const { html } = buildEmail(
    payload({ contentSnippet: `<img src=x onerror="alert(1)">` }),
  );
  assert(
    !html.includes("<img"),
    "snippet markup must not survive into the body",
  );
  assertStringIncludes(html, "&lt;img");
});

Deno.test("buildEmail subject reflects the reason", () => {
  assertStringIncludes(
    buildEmail(payload({ reason: "initial" })).subject,
    "Setup:",
  );
  assertStringIncludes(
    buildEmail(payload({ reason: "forced" })).subject,
    "Test:",
  );
  assertStringIncludes(
    buildEmail(payload({ reason: "changed" })).subject,
    "Alert:",
  );
});

Deno.test("buildSMS stays within one segment", () => {
  const long = buildSMS(
    payload({ monitor: { ...monitor, name: "x".repeat(300) } }),
  );
  assert(long.length <= 160, `expected <=160 chars, got ${long.length}`);
});

// --- delivery reporting ------------------------------------------------

Deno.test("sendNotifications reports per-channel failure instead of throwing", async () => {
  // Total outage. The old caller treated "did not throw" as success and
  // reported didNotify: true in exactly this situation.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("network down"));

  try {
    const results = await new NotificationService(stubSupabase())
      .sendNotifications(payload(), [
        { type: "email", address: "a@b.c" },
        { type: "sms", address: "+15550002222" },
      ]);

    assertEquals(results.length, 2);
    assertEquals(results.map((r) => r.success), [false, false]);
    assertEquals(results.some((r) => r.success), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("sendNotifications attributes failures to the right channel", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("network down"));

  try {
    const results = await new NotificationService(stubSupabase())
      .sendNotifications(payload(), [
        { type: "sms", address: "+15550001111" },
        { type: "sms", address: "+15550002222" },
      ]);
    // Positional mapping: the previous indexOf-based lookup collapsed two
    // structurally identical rejections onto the same channel.
    assertEquals(results.map((r) => r.channel.address), [
      "+15550001111",
      "+15550002222",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("sendNotifications records every attempt, including failures", async () => {
  const rows: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("network down"));

  try {
    await new NotificationService(
      stubSupabase((row) => rows.push(row as Record<string, unknown>)),
    ).sendNotifications(payload(), [{ type: "email", address: "a@b.c" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assertEquals(rows.length, 1);
  assertEquals(rows[0].status, "failed");
  assertEquals(rows[0].channel, "email");
});
