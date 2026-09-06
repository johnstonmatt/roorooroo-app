import { assertEquals } from "jsr:@std/assert@1";
import { pipeline } from "@supabase/middleware";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { withOpenAPI } from "./with-openapi.ts";

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
