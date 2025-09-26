import { Context } from "jsr:@hono/hono@^4.6.3";

/**
 * Custom error classes for better error handling
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = "Insufficient permissions") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string = "Rate limit exceeded") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Global error handling middleware
 * Catches and formats errors consistently across the API
 */
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

  // Handle specific error types
  switch (error.name) {
    case "ValidationError":
      return c.json({
        error: "Validation failed",
        message: error.message,
        field: (error as ValidationError).field,
      }, 400);

    case "AuthenticationError":
      return c.json({
        error: "Authentication required",
        message: error.message,
      }, 401);

    case "AuthorizationError":
      return c.json({
        error: "Insufficient permissions",
        message: error.message,
      }, 403);

    case "NotFoundError":
      return c.json({
        error: "Not found",
        message: error.message,
      }, 404);

    case "RateLimitError":
      return c.json({
        error: "Rate limit exceeded",
        message: error.message,
      }, 429);

    // Handle Supabase errors
    case "PostgrestError":
      return c.json({
        error: "Database error",
        message: "An error occurred while processing your request",
      }, 500);

    // Handle network/fetch errors
    case "TypeError":
      if (error.message.includes("fetch")) {
        return c.json({
          error: "External service error",
          message: "Failed to connect to external service",
        }, 502);
      }
      break;

    // Handle JSON parsing errors
    case "SyntaxError":
      if (error.message.includes("JSON")) {
        return c.json({
          error: "Invalid JSON",
          message: "Request body contains invalid JSON",
        }, 400);
      }
      break;
  }

  // Default error response for unhandled errors
  const isDevelopment = Deno.env.get("DENO_DEPLOYMENT_ID") === undefined;

  return c.json({
    error: "Internal server error",
    message: isDevelopment ? error.message : "An unexpected error occurred",
    ...(isDevelopment && { stack: error.stack }),
  }, 500);
}

export function syncHandler(fn: (c: Context) => Response) {
  return (c: Context) => {
    try {
      return fn(c);
    } catch (error) {
      return errorHandler(error as Error, c);
    }
  };
}

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to the error handler
 */
export function asyncHandler(fn: (c: Context) => Promise<Response>) {
  return async (c: Context) => {
    try {
      return await fn(c);
    } catch (error) {
      return errorHandler(error as Error, c);
    }
  };
}

/**
 * Validation helper that throws ValidationError
 */
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === "") {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

/**
 * Validation helper for email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError("Invalid email format", "email");
  }
}

/**
 * Validation helper for UUID format
 */
export function validateUUID(uuid: string, fieldName: string = "id"): void {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
  }
}
