/**
 * API client for making requests to the Edge Function
 */

import { createClient } from "@/lib/supabase/client";

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiClientOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Makes authenticated API requests to the Edge Function
 */
export async function apiClient(
  endpoint: string,
  options: ApiClientOptions = {},
) {
  const { method = "GET", body, headers = {} } = options;
  const supabase = createClient();

  // Get the current session for authentication
  const { data: { session } } = await supabase.auth.getSession();

  // Single "api" function; `endpoint` is a route within it (e.g. "/status").
  // Derived from the Supabase URL rather than configured separately: auth and
  // the Edge Function must come from the SAME project, because the function
  // verifies the browser's JWT against that project's JWKS and a token minted
  // by a different project can never match by `kid`. Deriving keeps the two in
  // step wherever the build points -- local, a preview branch, or production.
  // NEXT_PUBLIC_API_BASE_URL stays as an escape hatch for pointing elsewhere.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://localhost:54321";
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ||
    `${supabaseUrl}/functions/v1/api`).replace(/\/+$/, "");
  const url = `${apiBaseUrl}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Always include the project's anon key so Supabase Functions gateway can route the request
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) {
    requestHeaders["apikey"] = anonKey;
  }

  // Authorization header: use user session token if available; otherwise fall back to anon key
  if (session?.access_token) {
    requestHeaders["Authorization"] = `Bearer ${session.access_token}`;
  } else if (anonKey) {
    requestHeaders["Authorization"] = `Bearer ${anonKey}`;
  }

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== "GET") {
    requestOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new ApiError(errorMessage, response.status);
    }

    // Handle empty responses (like DELETE requests).
    // Match structured JSON suffixes too (RFC 6839), not just
    // application/json: the OpenAPI document is served as
    // application/openapi+json, and a plain substring check silently
    // returned null for it.
    const contentType = response.headers.get("content-type") ?? "";
    if (/^application\/([\w.+-]+\+)?json\b/i.test(contentType)) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error(`API request failed: ${method} ${endpoint}`, error);
    throw error;
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: (endpoint: string, headers?: Record<string, string>) =>
    apiClient(endpoint, { method: "GET", headers }),

  post: (endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    apiClient(endpoint, { method: "POST", body, headers }),

  put: (endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    apiClient(endpoint, { method: "PUT", body, headers }),

  delete: (endpoint: string, headers?: Record<string, string>) =>
    apiClient(endpoint, { method: "DELETE", headers }),
};
