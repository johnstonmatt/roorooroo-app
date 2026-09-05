import type { SupabaseClient, User } from "jsr:@supabase/supabase-js@^2.45.4";

export type AppVariables = {
  user?: User;
  userId?: string;
  userEmail?: string;
  supabase?: SupabaseClient;
  /**
   * Set only when a request authenticated as an end user rather than as cron
   * or service role. When present it is the verified `sub` of the caller's JWT
   * and MUST be used in place of any user id supplied in the request body.
   */
  authUserId?: string;
};
