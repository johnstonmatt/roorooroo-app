import { createClient } from "jsr:@supabase/supabase-js@^2.45.4";

/**
 * Creates a Supabase client with service role privileges
 * Used for admin operations that bypass RLS
 */
export function createServiceClient() {
  const supabaseUrl = Deno.env.get("OG_SUPABASE_URL") ??
    Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("OG_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing required Supabase service role environment variables",
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}
