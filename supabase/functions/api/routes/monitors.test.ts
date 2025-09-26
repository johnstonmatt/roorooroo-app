// Test for monitors API endpoint
import { assertEquals, assertExists } from "jsr:@std/assert";
import { Hono } from "jsr:@hono/hono@4.9.8";
import { monitors } from "./monitors.ts";

// Mock authentication middleware for testing
const mockAuthMiddleware = async (
  c: { set: (key: string, value: unknown) => void },
  next: () => Promise<void>,
) => {
  // Mock authenticated user
  c.set("userId", "test-user-id");
  c.set("supabase", {
    from: (_table: string) => ({
      select: (_columns: string) => ({
        eq: (_column: string, _value: string) => ({
          order: (_column: string, _options: unknown) => ({
            // Mock successful response
            data: [
              {
                id: "test-monitor-1",
                user_id: "test-user-id",
                name: "Test Monitor",
                url: "https://example.com",
                pattern: "test pattern",
                pattern_type: "contains",
                check_interval: 300,
                is_active: true,
                last_checked: null,
                last_status: "pending",
                notification_channels: [],
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  });
  await next();
};

Deno.test("GET /api/monitors - should return user monitors", async () => {
  const app = new Hono();
  app.use("*", mockAuthMiddleware);
  app.route("/", monitors);

  const req = new Request("http://localhost/", {
    method: "GET",
    headers: {
      "Authorization": "Bearer test-token",
    },
  });

  const res = await app.fetch(req);
  const data = await res.json();

  assertEquals(res.status, 200);
  assertExists(data.success);
  assertEquals(data.success, true);
  assertExists(data.data);
  assertEquals(Array.isArray(data.data), true);
  assertEquals(data.count, 1);
  assertExists(data.timestamp);
});

Deno.test("GET /api/monitors - should require authentication", async () => {
  const app = new Hono();
  app.route("/", monitors);

  const req = new Request("http://localhost/", {
    method: "GET",
  });

  const res = await app.fetch(req);
  const data = await res.json();

  assertEquals(res.status, 401);
  assertExists(data.error);
});

Deno.test("GET /api/monitors - should handle database errors gracefully", async () => {
  const mockAuthWithError = async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set("userId", "test-user-id");
    c.set("supabase", {
      from: (_table: string) => ({
        select: (_columns: string) => ({
          eq: (_column: string, _value: string) => ({
            order: (_column: string, _options: unknown) => ({
              data: null,
              error: { message: "Database connection failed" },
            }),
          }),
        }),
      }),
    });
    await next();
  };

  const app = new Hono();
  app.use("*", mockAuthWithError);
  app.route("/", monitors);

  const req = new Request("http://localhost/", {
    method: "GET",
    headers: {
      "Authorization": "Bearer test-token",
    },
  });

  const res = await app.fetch(req);
  const data = await res.json();

  assertEquals(res.status, 500);
  assertExists(data.error);
  assertEquals(data.error, "Failed to fetch monitors");
});

Deno.test("GET /api/monitors - should return empty array when no monitors exist", async () => {
  const mockAuthWithEmptyResult = async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set("userId", "test-user-id");
    c.set("supabase", {
      from: (_table: string) => ({
        select: (_columns: string) => ({
          eq: (_column: string, _value: string) => ({
            order: (_column: string, _options: unknown) => ({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    });
    await next();
  };

  const app = new Hono();
  app.use("*", mockAuthWithEmptyResult);
  app.route("/", monitors);

  const req = new Request("http://localhost/", {
    method: "GET",
    headers: {
      "Authorization": "Bearer test-token",
    },
  });

  const res = await app.fetch(req);
  const data = await res.json();

  assertEquals(res.status, 200);
  assertEquals(data.success, true);
  assertEquals(Array.isArray(data.data), true);
  assertEquals(data.data.length, 0);
  assertEquals(data.count, 0);
});
