import { assert, assertEquals } from "jsr:@std/assert@1";
import { defineMiddleware, pipeline } from "@supabase/middleware";
import { withCORS } from "./with-cors.ts";
import api from "../api/index.ts";

const ORIGIN = "https://preview.vercel.app";

/**
 * Stands in for a middleware that answers by itself -- withOpenAPI serving the
 * document, say. Its response never reaches anything below withCORS, so it is
 * the case that regressed before.
 */
const shortCircuit = defineMiddleware<
  "stub",
  Record<never, never>,
  Record<never, never>,
  never
>({
  key: "stub",
  run: () => () => Promise.resolve(new Response("early", { status: 418 })),
});

Deno.test("answers a preflight with a 204 the browser accepts", async () => {
  const handler = pipeline(
    [withCORS({})],
    () => Promise.resolve(new Response("unreachable")),
  );
  const res = await handler(
    new Request("https://x/functions/v1/api/openapi.json", {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "GET",
        "access-control-request-headers": "apikey,authorization",
      },
    }),
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  const allowed = res.headers.get("access-control-allow-headers") ?? "";
  for (const h of ["apikey", "authorization", "content-type"]) {
    assert(allowed.includes(h), `preflight must allow ${h}`);
  }
});

Deno.test("adds headers to a response from below", async () => {
  const handler = pipeline(
    [withCORS({})],
    () => Promise.resolve(new Response("ok")),
  );
  const res = await handler(new Request("https://x/functions/v1/api/thing"));
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertEquals(await res.text(), "ok");
});

Deno.test("adds headers to a middleware that short-circuits below it", async () => {
  const handler = pipeline(
    [withCORS({}), shortCircuit({})],
    () => Promise.resolve(new Response("unreachable")),
  );
  const res = await handler(new Request("https://x/functions/v1/api/thing"));
  assertEquals(res.status, 418);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.body?.cancel();
});

Deno.test("defers to a narrower origin already set below", async () => {
  const narrow = defineMiddleware<
    "narrow",
    Record<never, never>,
    Record<never, never>,
    never
  >({
    key: "narrow",
    run: () => () =>
      Promise.resolve(
        new Response("ok", {
          headers: { "access-control-allow-origin": "https://roorooroo.com" },
        }),
      ),
  });
  const handler = pipeline(
    [withCORS({}), narrow({})],
    () => Promise.resolve(new Response("unreachable")),
  );
  const res = await handler(new Request("https://x/functions/v1/api/thing"));
  // Backfill, never clobber: widening this to "*" would be a silent
  // relaxation of a deliberately narrow policy.
  assertEquals(
    res.headers.get("access-control-allow-origin"),
    "https://roorooroo.com",
  );
  await res.body?.cancel();
});

// The ordering in api/index.ts is the thing that actually has to hold: CORS
// only covers withOpenAPI's short-circuit while it sits above it.
Deno.test("the real pipeline serves the document with CORS headers", async () => {
  const res = await api.fetch(
    new Request("https://x/functions/v1/api/openapi.json", {
      headers: { origin: ORIGIN },
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.body?.cancel();
});

Deno.test("the real pipeline answers a preflight", async () => {
  const res = await api.fetch(
    new Request("https://x/functions/v1/api/openapi.json", {
      method: "OPTIONS",
      headers: { origin: ORIGIN, "access-control-request-method": "GET" },
    }),
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});
