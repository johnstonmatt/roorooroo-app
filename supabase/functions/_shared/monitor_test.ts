import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  checkPattern,
  findUnsafeRegexConstruct,
  getNotificationSpec,
  logMonitorCheck,
  MAX_BODY_BYTES,
  performMonitorCheck,
} from "./monitor.ts";

// --- regex safety screen -----------------------------------------------
// `(a+)+$` against 47 bytes wedges the isolate outright: the match is
// synchronous, so no timer or AbortController can interrupt it. These cases
// have to be caught before the pattern is ever compiled.

Deno.test("findUnsafeRegexConstruct rejects catastrophic backtracking", () => {
  const evil = [
    "(a+)+$",
    "(a*)*b",
    "(\\s+)+$",
    "^(\\w+\\s?)+$",
    "(a|a)*",
    "(\\d|\\w)+",
    "((ab)+)+",
  ];
  for (const pattern of evil) {
    assert(
      findUnsafeRegexConstruct(pattern) !== null,
      `expected ${pattern} to be rejected`,
    );
  }
});

Deno.test("findUnsafeRegexConstruct allows ordinary patterns", () => {
  const safe = [
    "hello\\s+world",
    "(cat|dog)+",
    "[a-z]+",
    "out of stock",
    "price: \\$\\d+\\.\\d{2}",
    "(?:sold out)",
    "^\\s*<title>.*</title>",
    "\\((\\d{3})\\) \\d{3}-\\d{4}",
  ];
  for (const pattern of safe) {
    assertEquals(
      findUnsafeRegexConstruct(pattern),
      null,
      `expected ${pattern} to be allowed`,
    );
  }
});

Deno.test("checkPattern refuses an unsafe regex instead of running it", () => {
  const started = Date.now();
  const result = checkPattern("a".repeat(60) + "!", "(a+)+$", "regex");
  assertEquals(result.found, false);
  assertStringIncludes(result.error ?? "", "backtrack catastrophically");
  // The point of the screen: it returns rather than hanging.
  assert(Date.now() - started < 1000, "screen must not evaluate the pattern");
});

// --- pattern matching --------------------------------------------------

Deno.test("checkPattern contains is case-insensitive and returns a snippet", () => {
  const result = checkPattern(
    "<p>Now In Stock today</p>",
    "in stock",
    "contains",
  );
  assertEquals(result.found, true);
  assertStringIncludes(result.snippet ?? "", "In Stock");
});

Deno.test("checkPattern not_contains inverts", () => {
  assertEquals(
    checkPattern("<p>sold out</p>", "in stock", "not_contains").found,
    true,
  );
  assertEquals(
    checkPattern("<p>in stock</p>", "in stock", "not_contains").found,
    false,
  );
});

Deno.test("checkPattern regex matches and reports a snippet", () => {
  const result = checkPattern(
    "<p>hello   world</p>",
    "hello\\s+world",
    "regex",
  );
  assertEquals(result.found, true);
  assertStringIncludes(result.snippet ?? "", "hello   world");
});

Deno.test("checkPattern reports an invalid regex rather than 'not found'", () => {
  // Previously this was swallowed and downgraded to found:false, making a
  // broken pattern indistinguishable from a page that simply changed.
  const result = checkPattern("anything", "(unclosed", "regex");
  assertEquals(result.found, false);
  assertStringIncludes(result.error ?? "", "Pattern matching failed");
});

Deno.test("checkPattern reports an unsupported pattern type", () => {
  const result = checkPattern("x", "x", "glob");
  assertStringIncludes(result.error ?? "", "Unsupported pattern type");
});

// --- fetch behaviour ---------------------------------------------------

Deno.test("performMonitorCheck aborts a stalled body read", async () => {
  // The abort used to be cleared as soon as headers arrived, leaving the body
  // read unbounded; this hung well past the advertised 30s ceiling.
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 0, signal: controller.signal, onListen: () => {} },
    () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode("<html>"));
            // Never closed.
          },
        }),
      ),
  );

  const original = setTimeout;
  // Collapse the 30s production timeout so the test stays quick, without
  // weakening what is being asserted: that the timer covers the body read.
  const patched =
    ((fn: () => void, ms?: number) =>
      original(fn, ms === 30_000 ? 300 : ms)) as typeof setTimeout;
  globalThis.setTimeout = patched;

  try {
    const result = await performMonitorCheck({
      url: `http://127.0.0.1:${server.addr.port}/`,
      pattern: "x",
      pattern_type: "contains",
    });
    assertEquals(result.status, "error");
    assertStringIncludes(result.errorMessage ?? "", "timeout");
  } finally {
    globalThis.setTimeout = original;
    controller.abort();
    await server.finished;
  }
});

Deno.test("performMonitorCheck reports a non-2xx status", async () => {
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 0, signal: controller.signal, onListen: () => {} },
    () =>
      new Response("nope", { status: 503, statusText: "Service Unavailable" }),
  );

  try {
    const result = await performMonitorCheck({
      url: `http://127.0.0.1:${server.addr.port}/`,
      pattern: "x",
      pattern_type: "contains",
    });
    assertEquals(result.status, "error");
    assertStringIncludes(result.errorMessage ?? "", "HTTP 503");
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("performMonitorCheck caps an oversized body", async () => {
  const controller = new AbortController();
  const chunk = new TextEncoder().encode("x".repeat(64 * 1024));
  const server = Deno.serve(
    { port: 0, signal: controller.signal, onListen: () => {} },
    () =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(chunk); // Endless.
          },
        }),
      ),
  );

  try {
    const result = await performMonitorCheck({
      url: `http://127.0.0.1:${server.addr.port}/`,
      // Absent from the body, so the whole (capped) response is scanned.
      pattern: "needle-not-present",
      pattern_type: "contains",
    });
    // Completes at all, rather than buffering without limit.
    assertEquals(result.status, "not_found");
    assert(MAX_BODY_BYTES > 0);
  } finally {
    controller.abort();
    await server.finished;
  }
});

// --- persistence -------------------------------------------------------

Deno.test("logMonitorCheck surfaces a database error instead of dropping it", async () => {
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => logged.push(args.join(" "));

  // supabase-js resolves with { error }; it does not reject. The try/catch
  // this replaced could never fire.
  const supabase = {
    from: () => ({
      insert: () =>
        Promise.resolve({ error: { message: "permission denied" } }),
    }),
    // deno-lint-ignore no-explicit-any
  } as any;

  try {
    await logMonitorCheck(supabase, "monitor-1", {
      status: "found",
      responseTime: 12,
    });
  } finally {
    console.error = originalError;
  }

  assert(
    logged.some((line) => line.includes("permission denied")),
    `expected the insert error to be logged, got: ${JSON.stringify(logged)}`,
  );
});

// --- notification decision ---------------------------------------------

Deno.test("getNotificationSpec covers initial, changed, quiet and forced", () => {
  assertEquals(getNotificationSpec("pending", "found"), {
    reason: "initial",
    type: "found",
  });
  assertEquals(getNotificationSpec("not_found", "found"), {
    reason: "changed",
    type: "found",
  });
  assertEquals(getNotificationSpec("found", "found"), null);
  assertEquals(getNotificationSpec("found", "found", true), {
    reason: "forced",
    type: "found",
  });
});
