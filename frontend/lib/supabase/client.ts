import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@db/database.types";

/** Typed against the generated schema, so queries and rpc calls are checked. */
export type Client = SupabaseClient<Database>;

// Ensure a single browser client instance across the app (and across HMR in dev)
const globalForSupabase = globalThis as unknown as {
  __supabase?: Client;
};

const supabaseSingleton = globalForSupabase.__supabase ??
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.__supabase = supabaseSingleton;
}

export function createClient(): Client {
  return supabaseSingleton;
}
