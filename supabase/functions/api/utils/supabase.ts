import { createClient } from 'jsr:@supabase/supabase-js@^2.45.4'

/**
 * Creates a Supabase client for user-authenticated operations
 * Uses the anon key for client-side operations
 */
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing required Supabase environment variables')
  }
  
  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Creates a Supabase client with service role privileges
 * Used for admin operations that bypass RLS
 */
export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required Supabase service role environment variables')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * Creates a Supabase client with a specific user's JWT token
 * Used for operations that need to be performed as a specific user
 */
export function createSupabaseClientWithAuth(token: string) {
  const client = createSupabaseClient()
  // Set the auth header directly instead of using setSession
  client.auth.setSession({
    access_token: token,
    refresh_token: ''
  })
  return client
}