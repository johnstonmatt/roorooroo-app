import type { SupabaseClient, User } from "jsr:@supabase/supabase-js@^2.45.4";

export type AppVariables = {
  user?: User;
  userId?: string;
  userEmail?: string;
  supabase?: SupabaseClient;
};
