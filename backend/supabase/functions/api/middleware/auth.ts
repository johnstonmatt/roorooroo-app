import { Context, Next } from 'jsr:@hono/hono@^4.6.3'
import { createSupabaseClient } from '../utils/supabase.ts'

/**
 * Authentication middleware that validates Supabase JWT tokens
 * Extracts user information and makes it available in the context
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const token = authHeader.substring(7)
  
  try {
    const supabase = createSupabaseClient()
    
    // Verify the JWT token and get user information
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }

    // Store user and authenticated supabase client in context
    c.set('user', user)
    c.set('userId', user.id)
    c.set('userEmail', user.email)
    
    // Create a supabase client with the user's token for RLS
    const userSupabase = createSupabaseClient()
    userSupabase.auth.setSession({
      access_token: token,
      refresh_token: ''
    })
    c.set('supabase', userSupabase)
    
    await next()
  } catch (error) {
    console.error('Authentication error:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
}

/**
 * Optional authentication middleware that doesn't require authentication
 * but extracts user info if a valid token is provided
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    try {
      const supabase = createSupabaseClient()
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (!error && user) {
        c.set('user', user)
        c.set('userId', user.id)
        c.set('userEmail', user.email)
        
        const userSupabase = createSupabaseClient()
        userSupabase.auth.setSession({
          access_token: token,
          refresh_token: ''
        })
        c.set('supabase', userSupabase)
      }
    } catch (error) {
      // Ignore authentication errors in optional middleware
      console.warn('Optional auth failed:', error)
    }
  }
  
  await next()
}

/**
 * Admin role validation middleware
 * Should be used after authMiddleware to ensure user has admin privileges
 */
export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get('user')
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  // Check if user has admin role in their metadata or profile
  const supabase = c.get('supabase')
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (error || !profile || profile.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }
    
    await next()
  } catch (error) {
    console.error('Admin validation error:', error)
    return c.json({ error: 'Access validation failed' }, 500)
  }
}