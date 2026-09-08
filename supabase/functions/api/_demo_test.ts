import { api } from "../_shared/openapi-document.ts";
import type { RoutesOf } from "@croutonian/with-openapi";

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

type Doc = typeof api.document;

// The route table is a union, not `string`.
type _routes = Expect<
  Equals<RoutesOf<Doc>, "/openapi.json" | "/check-endpoint">
>;

// servers[0].url is the literal, which is why the `??` fallback could go.
type _prefix = Expect<Equals<Doc["servers"][0]["url"], "/functions/v1/api">>;

// The operation reads back as declared, not as `unknown`.
const op = api.operation("/check-endpoint", "post");
type _summary = Expect<Equals<(typeof op)["summary"], "Run a monitor check">>;
type _codes = Expect<
  Equals<keyof (typeof op)["responses"], "200" | "400" | "401" | "404" | "500">
>;

Deno.test("typed projections are live", () => {
  console.log("summary:", op.summary);
  console.log("declared 400:", op.responses["400"].description);
});

void (null as unknown as [_routes, _prefix, _summary, _codes]);
