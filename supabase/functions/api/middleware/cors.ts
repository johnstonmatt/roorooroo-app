import { cors } from 'jsr:@hono/hono@^4.6.3/cors'

/**
 * CORS middleware configuration for frontend communication
 * Allows requests from development and production frontend domains
 */
export const corsMiddleware = cors({
  origin: (origin, c) => {
    // Allow requests from localhost during development
    if (origin?.includes('localhost') || origin?.includes('127.0.0.1')) {
      return origin
    }
    
    // Allow requests from production frontend domain
    const allowedOrigins = [
      Deno.env.get('FRONTEND_URL'),
      Deno.env.get('PRODUCTION_FRONTEND_URL'),
      // Add any additional allowed origins
    ].filter(Boolean)
    
    if (allowedOrigins.includes(origin)) {
      return origin
    }
    
    // For development, allow all origins if no specific origins are configured
    if (Deno.env.get('DENO_DEPLOYMENT_ID') === undefined) {
      return origin || '*'
    }
    
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposeHeaders: [
    'Content-Length',
    'X-JSON'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
})

/**
 * Simple CORS middleware for webhooks that don't need credentials
 */
export const webhookCorsMiddleware = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Twilio-Signature'],
  credentials: false
})