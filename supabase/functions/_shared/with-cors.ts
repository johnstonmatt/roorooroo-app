import { defineMiddleware } from "@supabase/middleware";
import type { Middleware } from "@supabase/middleware";
// The canonical set the Supabase SDK keeps in sync with the headers its
// clients actually send, so a new SDK header cannot silently start failing
// preflights here.
import { corsHeaders } from "@supabase/supabase-js/cors";

/** Per-instance configuration for {@link withCORS}. */
export interface WithCORSConfig {
  /**
   * Headers to apply to every response.
   * @defaultValue the canonical `@supabase/supabase-js/cors` set
   */
  headers?: Record<string, string>;
}

/** What {@link withCORS} adds to the context. */
export interface CORSContribution {
  /** The `Origin` the request declared, or `null` for a same-origin call. */
  origin: string | null;
}

/**
 * Answer preflights, and put CORS headers on everything that leaves.
 *
 * This belongs *first* in the pipeline. `withSupabase` applies CORS to the
 * responses it produces, but only those: any middleware above it that
 * short-circuits returns a response the auth layer never sees. That is not a
 * hypothetical -- `withOpenAPI` serves the document itself, and shipped
 * answering 200 with no `Access-Control-Allow-Origin`, so the status badge on
 * every Vercel preview failed its preflight and read "Disconnected" while the
 * API was healthy. Handling CORS at the outermost layer makes that structural
 * rather than something each short-circuit has to remember.
 *
 * A preflight is answered here and goes no further: it carries no credentials
 * and names a route it has not called yet, so there is nothing below worth
 * consulting.
 *
 * On the way out it only *backfills*. `withSupabase` stamps its own CORS
 * headers on everything that reaches it, and it is the layer that knows to
 * expose `x-supabase-server-error`; overwriting its work would clobber a
 * deliberately narrow `Access-Control-Allow-Origin` with this wildcard the
 * moment someone configures one. So this fills the gap the short-circuits
 * leave and otherwise defers to whoever already answered.
 */
export const withCORS: Middleware<
  "cors",
  WithCORSConfig,
  Record<never, never>,
  CORSContribution
> = defineMiddleware<
  "cors",
  WithCORSConfig,
  Record<never, never>,
  CORSContribution
>({
  key: "cors",
  run: (config) =>
    async function* (req) {
      const headers = config.headers ?? corsHeaders;

      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }

      const response = yield { cors: { origin: req.headers.get("origin") } };

      // Backfill only. Anything below that already answered -- withSupabase
      // stamping its own set, or a handler with a deliberately narrow origin
      // -- keeps what it chose.
      const absent = Object.entries(headers).filter(([key]) =>
        !response.headers.has(key)
      );
      if (absent.length === 0) return response;

      // A Response's headers are immutable for some constructions, so fall back
      // to rebuilding it rather than throwing on the way out.
      try {
        for (const [key, value] of absent) {
          response.headers.set(key, value);
        }
        return response;
      } catch {
        const merged = new Headers(response.headers);
        for (const [key, value] of absent) {
          merged.set(key, value);
        }
        return new Response(
          response.bodyUsed || response.body?.locked ? null : response.body,
          {
            status: response.status,
            statusText: response.statusText,
            headers: merged,
          },
        );
      }
    },
});
