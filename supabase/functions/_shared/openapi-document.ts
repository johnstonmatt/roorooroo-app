import type { OpenAPIObject } from "openapi3-ts/oas31";

/** The commit this deployment was built from, short form. */
export function resolveVersion(): string {
  return Deno.env.get("CURRENT_SHA")?.slice(0, 7) || "v0.0.0";
}

/**
 * Which deployment the badge is looking at.
 *
 * `DENO_DEPLOYMENT_ID` is set on *any* deployed function, preview branches
 * included, so on its own it labels every preview "production" -- a badge that
 * reassures exactly when it should not. `APP_ENVIRONMENT` is set explicitly on
 * preview branches by `.github/workflows/preview-env.yml`; production and local
 * set nothing and keep the heuristic.
 */
export function resolveEnvironment(): string {
  return Deno.env.get("APP_ENVIRONMENT") ||
    (Deno.env.get("DENO_DEPLOYMENT_ID") ? "production" : "development");
}

/**
 * The API description served at /api/openapi.json.
 *
 * This is not decoration. withOpenApi reads it three ways: `paths` is the
 * route table, so an endpoint not declared here is not reachable; each
 * operation's `requestBody` schema is enforced against the real request before
 * the handler runs; and the whole document is what the Scalar page at
 * /api/reference renders. Loosen a schema here and you loosen the API.
 */
export const apiDocument: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "RooRooRoo API",
    version: resolveVersion(),
    description:
      "Website monitoring checks for RooRooRoo. Server-only endpoints: every " +
      "read and write the browser can perform goes directly to Supabase under " +
      "RLS instead of through this API.",
    // OpenAPI permits x- extensions; the dashboard status badge reads this.
    "x-environment": resolveEnvironment(),
  },
  servers: [{ url: "/functions/v1/api" }],
  components: {
    schemas: {
      CheckResponse: {
        type: "object",
        required: ["success", "data", "message", "timestamp"],
        properties: {
          success: {
            type: "boolean",
            description: "The check ran and was recorded.",
          },
          message: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          data: {
            type: "object",
            required: [
              "monitorId",
              "status",
              "responseTime",
              "statusChanged",
              "checkedAt",
              "didNotify",
            ],
            properties: {
              monitorId: { type: "string", format: "uuid" },
              status: { type: "string", enum: ["found", "not_found", "error"] },
              responseTime: {
                type: "integer",
                description: "Milliseconds to fetch and read the page.",
              },
              contentSnippet: { type: "string" },
              errorMessage: { type: "string" },
              statusChanged: {
                type: "boolean",
                description:
                  "The status differs from the previous check. Independent of " +
                  "whether a notification was sent, which `force` also affects.",
              },
              checkedAt: { type: "string", format: "date-time" },
              didNotify: {
                type: "boolean",
                description:
                  "At least one channel accepted the notification. False when " +
                  "none were configured, none were warranted, or all failed.",
              },
              channels: {
                type: "array",
                description:
                  "Per-channel outcome; absent when nothing was sent.",
                items: {
                  type: "object",
                  required: ["type", "success"],
                  properties: {
                    type: { type: "string", enum: ["email", "sms"] },
                    success: { type: "boolean" },
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    securitySchemes: {
      // Verified against the project JWKS.
      userJwt: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      // An sb_secret_ key, used by pg_cron.
      secretKey: { type: "apiKey", in: "header", name: "apikey" },
    },
  },
  paths: {
    "/openapi.json": {
      get: {
        summary: "This document",
        description:
          "Public without qualification: withOpenApi answers it above the " +
          "auth gate, so no credential is read and a bad one is not grounds " +
          "to refuse it. Serving it also proves the function is deployed and " +
          "running. Declared here for the reader -- the middleware serves it " +
          "ahead of route matching either way, as it does the Scalar " +
          "reference page at /reference, which has no entry of its own.",
        security: [],
        responses: {
          "200": {
            description: "The OpenAPI document",
            content: {
              "application/json": { schema: { type: "object" } },
            },
          },
        },
      },
    },
    "/check-endpoint": {
      post: {
        summary: "Run a monitor check",
        description:
          "Called by pg_cron on a schedule, or by a signed-in user asking to " +
          "re-check their own monitor. A user-mode caller is pinned to the " +
          "subject in their JWT and any user_id in the body is ignored.",
        security: [{ userJwt: [] }, { secretKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["monitor_id"],
                properties: {
                  monitor_id: { type: "string", format: "uuid" },
                  user_id: {
                    type: "string",
                    format: "uuid",
                    description:
                      "Only honoured for secretKey callers; ignored in user mode.",
                  },
                  force: {
                    type: "boolean",
                    description:
                      "Notify even when the status has not changed. User mode only.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Check completed. Every completed check returns this shape, " +
              "whatever the outcome; `success` is false only on an error status.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CheckResponse" },
              },
            },
          },
          "400": { description: "Monitor inactive, or the body is invalid" },
          "401": { description: "Missing or invalid credentials" },
          "404": {
            description: "Monitor not found, or not owned by the caller",
          },
          "500": { description: "Check failed unexpectedly" },
        },
      },
    },
  },
};
