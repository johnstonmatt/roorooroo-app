// What survives here is only what is true of *this* pipeline. Route matching,
// path normalization and schema validation are @croutonian/with-openapi's, and
// tested there; the tests that used to cover them went with the hand-rolled
// middleware they belonged to. What is left is the wiring no package can pin
// for us: that basePath matches where the gateway mounts us, that the document
// is served above the gate rather than below it, that CORS has exactly one
// owner now that it has moved between layers, and that dropping the `none`
// auth mode left /check-endpoint refused rather than open.
import { assertEquals } from "jsr:@std/assert@1";
import api from "./index.ts";

const ORIGIN = "https://preview.vercel.app";
// The path the *worker* receives, which is not the URL a caller types. The
// platform routes on https://<ref>.supabase.co/functions/v1/api/<path>, strips
// /functions/v1, and hands the function /api/<path>. Testing against the
// public form instead is how a basePath of "/functions/v1/api" passed every
// test here and 404'd every request in production, preflights included.
const BASE = "https://x/api";
// A syntactically valid uuid, because the document says format: uuid and
// withOpenApi enforces it. Nothing looks it up -- every test here is answered
// before the database is reached.
const MONITOR_ID = "11111111-1111-4111-8111-111111111111";

Deno.test("the document is served at /openapi.json", async () => {
  const res = await api.fetch(new Request(`${BASE}/openapi.json`));
  assertEquals(res.status, 200);
  const doc = await res.json();
  assertEquals(doc.info.title, "RooRooRoo API");
});

Deno.test("the Scalar reference page is served at /reference", async () => {
  const res = await api.fetch(new Request(`${BASE}/reference`));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  await res.body?.cancel();
});

// The reason withOpenApi sits above the gate. Under the old order this was a
// 401: a bearer that is not a valid user JWT is a `reject` inside the gate's
// `user` mode, which stops the chain before an anonymous mode is tried, so the
// public document answered 401 to the one caller most likely to ask for it --
// api-client.ts sends the legacy anon key (no `kid` header, no `sub` claim) as
// a bearer whenever there is no session, which is exactly the state the
// dashboard status badge polls in.
Deno.test("the document ignores a bearer the gate would reject", async () => {
  const res = await api.fetch(
    new Request(`${BASE}/openapi.json`, {
      headers: { origin: ORIGIN, authorization: "Bearer not-a-user-jwt" },
    }),
  );
  assertEquals(res.status, 200);
  await res.body?.cancel();
});

// basePath has to agree with where the gateway mounts the function. Get it
// wrong and every route 404s -- so this pins the negative half, and the tests
// above and below pin the positive half.
Deno.test("a path the document does not declare 404s", async () => {
  const res = await api.fetch(new Request(`${BASE}/nope`));
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

// A method the path does not declare is a 405 with an Allow header, not the
// 404 a route table alone would give -- the document knows what /check-endpoint
// accepts, so the refusal can say so.
Deno.test("an undeclared method is a 405 naming what is allowed", async () => {
  const res = await api.fetch(new Request(`${BASE}/check-endpoint`));
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("allow"), "POST");
  await res.body?.cancel();
});

// CORS moved from withSupabase to withOpenApi when withOpenApi moved above it:
// nothing below the outermost layer sees a request that layer answers itself,
// so the document and the refusals above would otherwise reach a browser with
// no headers at all.
Deno.test("responses withOpenApi answers itself carry CORS headers", async () => {
  for (const path of ["/openapi.json", "/reference", "/nope"]) {
    const res = await api.fetch(
      new Request(`${BASE}${path}`, { headers: { origin: ORIGIN } }),
    );
    assertEquals(res.headers.get("access-control-allow-origin"), "*", path);
    await res.body?.cancel();
  }
});

Deno.test("a response from below the gate carries them too", async () => {
  const res = await api.fetch(
    new Request(`${BASE}/check-endpoint`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ monitor_id: MONITOR_ID }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.body?.cancel();
});

// Derived from the document, which is the point of moving CORS here: the path
// declares one operation, so one verb is advertised. withSupabase's set was
// the blanket GET, POST, PUT, PATCH, DELETE, OPTIONS on every route.
Deno.test("a preflight advertises only the verbs the path declares", async () => {
  const res = await api.fetch(
    new Request(`${BASE}/check-endpoint`, {
      method: "OPTIONS",
      headers: { origin: ORIGIN, "access-control-request-method": "POST" },
    }),
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertEquals(res.headers.get("access-control-allow-methods"), "POST");
});

// The document's own operation declares `security: []`, so neither credential
// header is derived for it -- but api-client.ts sends both on every request.
// That is what PLATFORM_CORS_HEADERS is for, and without it the status badge
// is blocked by the browser before the request is made.
Deno.test("a preflight allows the headers the gateway makes us send", async () => {
  const res = await api.fetch(
    new Request(`${BASE}/openapi.json`, {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization, apikey, content-type",
      },
    }),
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-methods"), "GET");
  const allowed = (res.headers.get("access-control-allow-headers") ?? "")
    .split(",").map((h) => h.trim().toLowerCase());
  for (const header of ["authorization", "apikey", "content-type"]) {
    assertEquals(allowed.includes(header), true, header);
  }
});

// `none` is gone from the auth config, so this is the gate's refusal, not a
// guard clause in the handler. Nothing anonymous reaches the admin client with
// an attacker-chosen user_id because nothing anonymous reaches the handler.
Deno.test("an anonymous check-endpoint call is refused by the gate", async () => {
  const res = await api.fetch(
    new Request(`${BASE}/check-endpoint`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        monitor_id: MONITOR_ID,
        user_id: "22222222-2222-4222-8222-222222222222",
      }),
    }),
  );
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

// The cost of the order, pinned so it is not mistaken for a bug: validation is
// above the gate now, so a caller with no credentials learns their body is
// wrong before they learn they are unauthenticated. The document states that
// schema publicly, so there is nothing here they could not already read.
Deno.test("a body the document refuses is answered before the gate", async () => {
  const res = await api.fetch(
    new Request(`${BASE}/check-endpoint`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: "not-a-uuid" }),
    }),
  );
  assertEquals(res.status, 400);
  const { error, violations } = await res.json();
  assertEquals(error, "validation_failed");
  // Both halves reported, not just the first: the missing monitor_id and the
  // user_id that is not a uuid.
  assertEquals(violations.length, 2);
});

// withSupabase's CORS handling used to append this to Expose-Headers itself;
// turning that off in favour of withOpenApi's meant carrying it across, or a
// browser could see the 401 but not the reason the gate gave for it.
Deno.test("the gate's error code stays readable cross-origin", async () => {
  const res = await api.fetch(
    new Request(`${BASE}/check-endpoint`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ monitor_id: MONITOR_ID }),
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(
    res.headers.get("x-supabase-server-error"),
    "MISSING_CREDENTIALS",
  );
  const exposed = (res.headers.get("access-control-expose-headers") ?? "")
    .split(",").map((h) => h.trim().toLowerCase());
  assertEquals(exposed.includes("x-supabase-server-error"), true);
  await res.body?.cancel();
});
