import { defineMiddleware } from "@supabase/middleware";
import type { Middleware } from "@supabase/middleware";
// Types only, so the document is checked against the real OAS 3.1 model
// without adding anything to the function's cold start.
import type { OpenAPIObject } from "openapi3-ts/oas31";

/** Per-instance configuration for {@link withOpenAPI}. */
export interface WithOpenAPIConfig {
  /** The document to serve. Its `paths` double as the route table. */
  document: OpenAPIObject;
  /** Path serving the document. @defaultValue `'/openapi.json'` */
  path?: string;
  /** Function name to strip from the incoming pathname. @defaultValue `'api'` */
  functionName?: string;
}

/** The route left over after the function prefix is stripped. */
export interface APIRouteContribution {
  /** Normalized pathname, e.g. `/check-endpoint`. Guaranteed to be a declared path. */
  path: string;
}

/**
 * Serve the OpenAPI document, and reject paths it does not declare.
 *
 * The document is the single source of truth for what this API offers, so the
 * route table comes from `document.paths` rather than a second list that could
 * drift from it. A declared path falls through to whatever follows; anything
 * else 404s here.
 *
 * Placed *after* `withSupabase`, so every response it produces passes back
 * through the auth layer's CORS handling on the way out and this middleware
 * needs no CORS of its own. The cost is that the gate runs first: reaching
 * the document requires `none` in the auth config, and a request carrying a
 * bearer token that is not a valid user JWT is rejected by the gate before
 * this layer is ever consulted. Disclosing the path list to unauthenticated
 * callers is intentional and consistent: the document that lists them is
 * itself public.
 */
export const withOpenAPI: Middleware<
  "apiRoute",
  WithOpenAPIConfig,
  Record<never, never>,
  APIRouteContribution
> = defineMiddleware<
  "apiRoute",
  WithOpenAPIConfig,
  Record<never, never>,
  APIRouteContribution
>({
  key: "apiRoute",
  run: (config) => {
    const specPath = config.path ?? "/openapi.json";
    const functionName = config.functionName ?? "api";
    // Computed once, when the middleware is constructed.
    const declared = new Set(Object.keys(config.document.paths ?? {}));
    const prefix = new RegExp(`^(/functions/v1)?/${functionName}`);

    return (req) => {
      // The gateway forwards /functions/v1/<fn>/<path> with the function name
      // still in the pathname. Collapse repeated slashes too: a base URL that
      // ends in "/" produces //openapi.json.
      const path = new URL(req.url).pathname
        .replace(prefix, "")
        .replace(/\/{2,}/g, "/")
        .replace(/(.)\/$/, "$1") || "/";

      if (path === specPath) {
        return Promise.resolve(
          Response.json(config.document, {
            headers: { "content-type": "application/openapi+json" },
          }),
        );
      }

      if (!declared.has(path)) {
        return Promise.resolve(Response.json({
          error: "Not Found",
          message: `Endpoint ${path} is not declared in the OpenAPI document`,
          document: specPath,
        }, { status: 404 }));
      }

      return Promise.resolve({ apiRoute: { path } });
    };
  },
});
