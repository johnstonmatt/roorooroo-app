// Main Hono application entry point
import { Hono } from 'jsr:@hono/hono'

// Import middleware
import { corsMiddleware, webhookCorsMiddleware } from './middleware/cors.ts'
import { authMiddleware, optionalAuthMiddleware, adminMiddleware } from './middleware/auth.ts'
import { errorHandler, asyncHandler } from './middleware/error-handler.ts'

// Import route handlers
import { admin } from './routes/admin.ts'
import { monitors } from './routes/monitors.ts'
import { monitorCheck } from './routes/monitor-check.ts'
import { notifications } from './routes/notifications.ts'
import { webhooks } from './routes/webhooks.ts'

// Create main Hono application
const app = new Hono()

// Global error handler
app.onError(errorHandler)

// Apply CORS middleware globally (except for webhooks which have their own)
app.use('*', async (c, next) => {
  // Skip CORS for webhook endpoints as they use their own middleware
  if (c.req.url.includes('/webhooks/')) {
    await next()
  } else {
    await corsMiddleware(c, next)
  }
})

// Health check endpoint (no auth required)
app.get('/health', asyncHandler(async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: Deno.env.get('DENO_DEPLOYMENT_ID') ? 'production' : 'development'
  })
}))

// Status endpoint with basic system info (no auth required)
app.get('/status', asyncHandler(async (c) => {
  return c.json({
    service: 'Hono API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: performance.now(),
    environment: Deno.env.get('DENO_DEPLOYMENT_ID') ? 'production' : 'development',
    endpoints: {
      health: '/health',
      status: '/status',
      admin: '/api/admin/*',
      monitors: '/api/monitors',
      monitorCheck: '/api/monitors/check',
      notifications: '/api/notifications',
      webhooks: '/api/webhooks/*'
    }
  })
}))

// Default root route
app.get('/', asyncHandler(async (c) => {
  return c.json({
    message: 'Hono API Server',
    version: '1.0.0',
    documentation: 'Visit /status for available endpoints',
    timestamp: new Date().toISOString()
  })
}))

// API Routes with authentication middleware

// Admin routes - require authentication and admin role
app.route('/api/admin', admin.use('*', authMiddleware).use('*', adminMiddleware))

// Monitor routes - require authentication
app.route('/api/monitors', monitors.use('*', authMiddleware))

// Monitor check routes - require authentication
app.route('/api/monitors/check', monitorCheck.use('*', authMiddleware))

// Notifications routes - require authentication
app.route('/api/notifications', notifications.use('*', authMiddleware))

// Webhook routes - use webhook-specific CORS, no auth required for external webhooks
app.route('/api/webhooks', webhooks.use('*', webhookCorsMiddleware))

// Catch-all route for undefined endpoints
app.all('*', asyncHandler(async (c) => {
  return c.json({
    error: 'Not Found',
    message: `Endpoint ${c.req.method} ${c.req.url} not found`,
    availableEndpoints: [
      'GET /health',
      'GET /status',
      'GET /',
      'GET|POST /api/admin/sms-costs',
      'GET /api/monitors',
      'POST /api/monitors/check',
      'GET /api/notifications',
      'GET|POST /api/webhooks/sms-status'
    ]
  }, 404)
}))

// Export the app for Supabase Edge Functions
Deno.serve(app.fetch)