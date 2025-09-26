// Main Hono application entry point
import { Hono } from "jsr:@hono/hono";
// Import middleware
import { logger } from "jsr:@hono/hono/logger";
import { corsMiddleware, webhookCorsMiddleware } from "./middleware/cors.ts";
import {
  adminMiddleware,
  authMiddleware,
  // optionalAuthMiddleware,
} from "./middleware/auth.ts";
import { errorHandler, syncHandler } from "./middleware/error-handler.ts";

// Import route handlers
import { admin } from "./routes/admin.ts";
import { monitors } from "./routes/monitors.ts";
import { monitorCheck } from "./routes/monitor-check.ts";
import { notifications } from "./routes/notifications.ts";
import { webhooks } from "./routes/webhooks.ts";

// Create main Hono application
const api = new Hono().basePath("/api");

api.use(logger());

// Global error handler
api.onError(errorHandler);

// Apply CORS middleware globally (except for webhooks which have their own)
api.use("*", async (c, next) => {
  // Skip CORS for webhook endpoints as they use their own middleware
  if (c.req.url.includes("/webhooks/")) {
    await next();
  } else {
    await corsMiddleware(c, next);
  }
});

// Health check endpoint (no auth required)
api.get(
  "/health",
  syncHandler((c) =>
    c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: Deno.env.get("DENO_DEPLOYMENT_ID")
        ? "production"
        : "development",
    })
  ),
);

// Status endpoint with basic system info (no auth required)
api.get(
  "/status",
  syncHandler((c) =>
    c.json({
      service: "Hono API Server",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime: performance.now(),
      environment: Deno.env.get("DENO_DEPLOYMENT_ID")
        ? "production"
        : "development",
      endpoints: {
        health: "/health",
        status: "/status",
        admin: "/admin/*",
        monitors: "/monitors",
        monitorCheck: "/monitors/check",
        notifications: "/notifications",
        webhooks: "/webhooks/*",
      },
    })
  ),
);

// Default root route
api.get(
  "/meta",
  syncHandler((c) =>
    c.json({
      message: "Hono API Server",
      version: "1.0.0",
      documentation: "Visit /status for available endpoints",
      timestamp: new Date().toISOString(),
    })
  ),
);

// Webhook routes - use webhook-specific CORS, no auth required for external webhooks
webhooks.use(webhookCorsMiddleware);
api.route("/webhooks", webhooks);

// API Routes with authentication middleware
api.use(authMiddleware);

// Monitor routes - require authentication
api.route("/monitors", monitors);

// Monitor check routes - require authentication
api.route("/monitors/check", monitorCheck);

// Notifications routes - require authentication
api.route("/notifications", notifications);

// admin routes - require authentication and admin role
admin.use(authMiddleware, adminMiddleware);

// Admin routes - require authentication and admin role
api.route("/admin", admin);

const availableEndpoints = api.routes
  .filter((route) => route.method !== "ALL")
  .sort((a, b) => a.path.localeCompare(b.path))
  .map((route) => `${route.method} ${route.path}`);

// Catch-all route for undefined endpoints
api.all(
  "*",
  syncHandler((c) =>
    c.json({
      error: "Not Found",
      message: `Endpoint ${c.req.method} ${c.req.url} not found`,
      availableEndpoints,
    }, 404)
  ),
);

// Export the app for Supabase Edge Functions
Deno.serve(api.fetch);
