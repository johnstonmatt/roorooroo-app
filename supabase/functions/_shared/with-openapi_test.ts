import { assertEquals } from "jsr:@std/assert@1";
import { pipeline } from "@supabase/middleware";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { withOpenAPI } from "./with-openapi.ts";
import api from "../api/index.ts";

const ORIGIN = "https://preview.vercel.app";

const document: OpenAPIObject = {
  openapi: "3.1.0",
  info: { title: "test", version: "0" },
  paths: { "/check-endpoint": { post: { responses: {} } } },
};

const handler = pipeline(
  [withOpenAPI({ document })],
  () => Promise.resolve(new Response("fell through")),
);

Deno.test("serves the document at the spec path", async () => {
  const res = await handler(
    new Request("https://x/functions/v1/api/openapi.json"),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/openapi+json");
  await res.body?.cancel();
});

Deno.test("collapses a doubled slash from a base URL ending in /", async () => {
  const res = await handler(
    new Request("https://x/functions/v1/api//openapi.json"),
  );
  assertEquals(res.status, 200);
  await res.body?.cancel();
});

Deno.test("404s a path the document does not declare", async () => {
  const res = await handler(new Request("https://x/functions/v1/api/nope"));
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

Deno.test("a declared path falls through to the next layer", async () => {
  const res = await handler(
    new Request("https://x/functions/v1/api/check-endpoint", {
      method: "POST",
    }),
  );
  assertEquals(await res.text(), "fell through");
});

// The real pipeline puts withOpenAPI *below* withSupabase, so the auth gate
// runs before the document is reachable and withSupabase's CORS covers the
// response on the way out. These pin both halves of that trade.
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

// The cost of serving the document below the gate, pinned so it is not
// mistaken for a bug later. A bearer that is not a valid user JWT is a
// `reject` inside tryMode('user'), which stops the chain -- `none` is never
// tried, and the public document answers 401. The legacy anon key is exactly
// such a token (no "kid" header, no "sub" claim), and api-client.ts sends it
// as a bearer whenever there is no session.
Deno.test("the document 401s for a caller sending a non-user bearer", async () => {
  const res = await api.fetch(
    new Request("https://x/functions/v1/api/openapi.json", {
      headers: { origin: ORIGIN, authorization: "Bearer not-a-user-jwt" },
    }),
  );
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

// `none` lets an anonymous request past the gate, so the handler is what
// keeps /check-endpoint non-public. Without this guard the request would
// reach the admin client with an attacker-chosen user_id.
Deno.test("an anonymous check-endpoint call is refused by the handler", async () => {
  const res = await api.fetch(
    new Request("https://x/functions/v1/api/check-endpoint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ monitor_id: "m1", user_id: "someone-else" }),
    }),
  );
  assertEquals(res.status, 401);
  await res.body?.cancel();
});
