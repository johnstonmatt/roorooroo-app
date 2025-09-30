import { cors } from "jsr:@hono/hono@^4.6.3/cors";

/**
 * CORS middleware configuration for frontend communication
 * Allows requests from development and production frontend domains
 */
export const corsMiddleware = cors({
  origin: (origin, _c) => {
    const prodURL = Deno.env.get("PRODUCTION_FRONTEND_URL");
    const devURL = Deno.env.get("FRONTEND_URL") || "http://localhost:3000";

    if (prodURL) {
      if (origin.endsWith(prodURL)) return origin;
    }

    if (origin.endsWith(devURL)) {
      return origin;
    }

    return null;
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
