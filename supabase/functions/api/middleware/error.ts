import { Context } from "jsr:@hono/hono@^4.6.3";

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function errorHandler(error: Error, c: Context) {
  console.error("API Error:", {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: c.req.url,
    method: c.req.method,
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    timestamp: new Date().toISOString(),
  });

  switch (error.name) {
    case "ValidationError":
      return c.json({
        error: "Validation failed",
        message: error.message,
        field: (error as ValidationError).field,
      }, 400);

    case "PostgrestError":
      return c.json({
        error: "Database error",
        message: "An error occurred while processing your request",
      }, 500);

    case "TypeError":
      if (error.message.includes("fetch")) {
        return c.json({
          error: "External service error",
          message: "Failed to connect to external service",
        }, 502);
      }
      break;

    case "SyntaxError":
      if (error.message.includes("JSON")) {
        return c.json({
          error: "Invalid JSON",
          message: "Request body contains invalid JSON",
        }, 400);
      }
      break;
  }

  const isDevelopment = Deno.env.get("DENO_DEPLOYMENT_ID") === undefined;

  return c.json({
    error: "Internal server error",
    message: isDevelopment ? error.message : "An unexpected error occurred",
    ...(isDevelopment && { stack: error.stack }),
  }, 500);
}
