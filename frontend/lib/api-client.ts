/**
 * API client for making requests to the Hono backend
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
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Makes authenticated API requests to the Hono backend
 */
export async function apiClient(
  endpoint: string,
  options: ApiClientOptions = {},
) {
  const { method = "GET", body, headers = {} } = options;
  const supabase = createClient();

  // Get the current session for authentication
  const { data: { session } } = await supabase.auth.getSession();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:54321/functions/v1/api";
  const url = `${apiBaseUrl}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Add authentication header if we have a session
  if (session?.access_token) {
    requestHeaders["Authorization"] = `Bearer ${session.access_token}`;
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

    // Handle empty responses (like DELETE requests)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      return null;
    }
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

  post: (endpoint: string, body?: any, headers?: Record<string, string>) =>
    apiClient(endpoint, { method: "POST", body, headers }),

  put: (endpoint: string, body?: any, headers?: Record<string, string>) =>
    apiClient(endpoint, { method: "PUT", body, headers }),

  delete: (endpoint: string, headers?: Record<string, string>) =>
    apiClient(endpoint, { method: "DELETE", headers }),
};
