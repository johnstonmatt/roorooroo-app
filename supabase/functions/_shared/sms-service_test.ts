import { assert, assertEquals } from "jsr:@std/assert@1";
import { SMSService } from "./sms-service.ts";

function twilioResponds(
  status: number,
  body: string,
  onCall: () => void,
): typeof fetch {
  return () => {
    onCall();
    return Promise.resolve(
      new Response(body, {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  };
}

const message = {
  to: "+15550002222",
  message: "hi",
  monitorId: "m1",
  userId: "u1",
};

Deno.test({
  name: "sendSMS retries a Twilio 20429 rate limit",
  // The retryable-code list named 20429, but the thrown error was a bare
  // Error with no `code`, so this gave up after a single attempt.
  fn: async () => {
    let calls = 0;
    const originalFetch = globalThis.fetch;
    const originalTimeout = setTimeout;
    // Collapse the 1s/4s backoff so the test is not dominated by sleeping.
    globalThis.setTimeout = ((fn: () => void, ms?: number) =>
      originalTimeout(fn, ms && ms >= 1000 ? 1 : ms)) as typeof setTimeout;
    globalThis.fetch = twilioResponds(
      429,
      JSON.stringify({ code: 20429, message: "Too Many Requests" }),
      () =>
        calls++,
    );

    try {
      const result = await new SMSService().sendSMS(message);
      assertEquals(calls, 3, "expected all three attempts to be used");
      assertEquals(result.success, false);
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.setTimeout = originalTimeout;
    }
  },
});

Deno.test("sendSMS does not retry a permanent Twilio rejection", async () => {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  // 21211 is an invalid destination number: retrying cannot help.
  globalThis.fetch = twilioResponds(
    400,
    JSON.stringify({ code: 21211, message: "Invalid 'To' number" }),
    () => calls++,
  );

  try {
    const result = await new SMSService().sendSMS(message);
    assertEquals(calls, 1);
    assertEquals(result.success, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("sendSMS survives a non-JSON error body", async () => {
  // An edge/proxy failure returns HTML; parsing it unguarded turned a clean
  // 503 into an opaque SyntaxError and lost the status with it.
  let calls = 0;
  const originalFetch = globalThis.fetch;
  const originalTimeout = setTimeout;
  globalThis.setTimeout =
    ((fn: () => void, ms?: number) =>
      originalTimeout(fn, ms && ms >= 1000 ? 1 : ms)) as typeof setTimeout;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    );
  };

  try {
    const result = await new SMSService().sendSMS(message);
    assertEquals(result.success, false);
    // 5xx is transient, so it is still retried.
    assertEquals(calls, 3);
    assert(!(result.error ?? "").includes("SyntaxError"));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalTimeout;
  }
});

Deno.test("sendSMS returns the message id on success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = twilioResponds(
    201,
    JSON.stringify({ sid: "SM123" }),
    () => {},
  );

  try {
    const result = await new SMSService().sendSMS(message);
    assertEquals(result.success, true);
    assertEquals(result.messageId, "SM123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("isRetryableError classifies transport failures", () => {
  const svc = new SMSService();
  assertEquals(svc.isRetryableError(new Error("ECONNRESET")), true);
  assertEquals(svc.isRetryableError(new Error("error sending request")), true);
  assertEquals(svc.isRetryableError(new Error("nonsense")), false);
});
