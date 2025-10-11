// Main Hono application entry point
import { Hono } from "jsr:@hono/hono@4.9.8";
// Import middleware
import { logger } from "jsr:@hono/hono@4.9.8/logger";
import { corsMiddleware } from "./middleware/cors.ts";
import { cronAuthMiddleware } from "./middleware/cron.ts";
import { errorHandler } from "./middleware/error.ts";

import { monitorCheck } from "./routes/monitor-check.ts";

// Create main Hono application
import type { AppVariables } from "./types.ts";
const api = new Hono<{ Variables: AppVariables }>().basePath("/api");
const version = Deno.env.get("CURRENT_SHA")?.slice(0, 7) || "v0.0.0";
const SERVICE = "RooRooRoo API Server";

api.use(logger());

// Global error handler
api.onError(errorHandler);

// Apply CORS middleware globally
api.use("*", (c, next) => {
  // IMPORTANT: Return the result of the CORS middleware so it can
  // short-circuit and respond to OPTIONS preflight requests (204).
  return corsMiddleware(c, next);
});

// Status endpoint with basic system info (no auth required)
api.get(
  "/status",
  (c) =>
    c.json({
      service: SERVICE,
      version,
      timestamp: new Date().toISOString(),
      uptime: performance.now(),
      environment: Deno.env.get("DENO_DEPLOYMENT_ID")
        ? "production"
        : "development",
      endpoints: {
        status: "/status",
        checkEndpoint: "/check-endpoint",
      },
    }),
);

// Cron-protected monitor check endpoint
api.use("/check-endpoint", cronAuthMiddleware);
api.route("/check-endpoint", monitorCheck);

const availableEndpoints = api.routes
  .filter((route) => route.method !== "ALL")
  .sort((a, b) => a.path.localeCompare(b.path))
  .map((route) => `${route.method} ${route.path}`);

// Catch-all route for undefined endpoints
api.all(
  "*",
  (c) =>
    c.json({
      error: "Not Found",
      message: `Endpoint ${c.req.method} ${c.req.url} not found`,
      availableEndpoints,
    }, 404),
);

// Export the app for Supabase Edge Functions
Deno.serve(api.fetch);
