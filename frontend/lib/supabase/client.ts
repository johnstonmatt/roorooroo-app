import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

// Ensure a single browser client instance across the app (and across HMR in dev)
const globalForSupabase = globalThis as unknown as {
  __supabase?: SupabaseClient;
};

const supabaseSingleton = globalForSupabase.__supabase ?? createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Give this app a distinct storage key to avoid collisions
      storageKey: "roorooroo-auth",
    },
  },
);

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.__supabase = supabaseSingleton;
}

export function createClient(): SupabaseClient {
  return supabaseSingleton;
}
