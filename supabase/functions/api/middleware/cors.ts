import { cors } from "jsr:@hono/hono@^4.6.3/cors";

/**
 * CORS middleware configuration for frontend communication
 * Allows requests from development and production frontend domains
 *
 * Note: When credentials are enabled, Access-Control-Allow-Origin
 * must echo the requesting origin and cannot be "*".
 */
export const corsMiddleware = cors({
  origin: (origin, _c) => {
    // Normalize helper to avoid trailing slash mismatches
    const normalize = (u?: string | null) => (u ? u.replace(/\/$/, "") : u);

    const prodURL = normalize(Deno.env.get("PRODUCTION_FRONTEND_URL"));
    const devURL = normalize(
      Deno.env.get("FRONTEND_URL") || "http://localhost:3000",
    );

    // Optional: comma-separated list of extra allowed origins
    const extra = (Deno.env.get("ADDITIONAL_ALLOWED_ORIGINS") || "")
      .split(",")
      .map((s) => normalize(s.trim()))
      .filter((s): s is string => Boolean(s));

    const reqOrigin = normalize(origin);
    if (!reqOrigin) return null;

    // Build allowlist. If a prod URL is defined, prefer that, but also allow dev & extras
    const allowlist = [prodURL, devURL, ...extra].filter((s): s is string =>
      Boolean(s)
    );

    // Exact match against normalized origins
    if (allowlist.includes(reqOrigin)) {
      return reqOrigin; // echo back the request origin (not "*")
    }

    // Support subdomain patterns if prodURL is a registrable domain (basic endsWith check)
    // e.g., allowing https://app.example.com when prodURL is https://example.com
    if (prodURL) {
      try {
        const prod = new URL(prodURL);
        const req = new URL(reqOrigin);
        if (prod.protocol === req.protocol && req.host.endsWith(prod.host)) {
          return reqOrigin;
        }
      } catch {
        // Ignore URL parsing errors and fall through to deny
      }
    }

    return null; // deny
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "apikey",
    "X-Cron-Secret",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Cache-Control",
    "X-File-Name",
  ],
  exposeHeaders: [
    "Content-Length",
    "X-JSON",
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
});

/**
 * Simple CORS middleware for webhooks that don't need credentials
 */
export const webhookCorsMiddleware = cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-Twilio-Signature"],
  credentials: false,
});
