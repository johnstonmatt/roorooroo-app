import type { OpenAPIObject } from "openapi3-ts/oas31";

/**
 * The API description served at /api/openapi.json.
 *
 * This is not decoration: `paths` is the route table withOpenAPI enforces, so
 * an endpoint that is not declared here is not reachable.
 */
export const apiDocument: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "RooRooRoo API",
    version: Deno.env.get("CURRENT_SHA")?.slice(0, 7) || "v0.0.0",
    description:
      "Website monitoring checks for RooRooRoo. Server-only endpoints: every " +
      "read and write the browser can perform goes directly to Supabase under " +
      "RLS instead of through this API.",
    // OpenAPI permits x- extensions; the dashboard status badge reads this.
    "x-environment": Deno.env.get("DENO_DEPLOYMENT_ID")
      ? "production"
      : "development",
  },
  servers: [{ url: "/functions/v1/api" }],
  components: {
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
          "Public. Serving it also proves the function is deployed and running.",
        security: [],
        responses: {
          "200": {
            description: "The OpenAPI document",
            content: {
              "application/openapi+json": { schema: { type: "object" } },
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
          "200": { description: "Check completed" },
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
