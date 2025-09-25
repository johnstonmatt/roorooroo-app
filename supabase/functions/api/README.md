# Hono API Backend

This is the Hono-based backend API running on Supabase Edge Functions, migrated from Next.js API routes.

## Project Structure

```
api/
├── index.ts                    # Main Hono app entry point
├── deno.json                   # Deno configuration, dependencies, and TypeScript options
├── middleware/                 # Middleware functions
│   ├── auth.ts                 # JWT authentication middleware
│   ├── cors.ts                 # CORS configuration
│   └── error-handler.ts        # Global error handling
├── routes/                     # API route handlers
│   ├── admin.ts                # Admin SMS cost monitoring
│   ├── monitors.ts             # Monitor CRUD operations
│   ├── monitor-check.ts        # Monitor checking logic
│   └── webhooks.ts             # SMS status webhooks
├── services/                   # Business logic services
│   ├── sms-service.ts          # SMS sending service
│   ├── notification-service.ts # Notification handling
│   ├── sms-cost-monitor.ts     # Cost monitoring service
│   └── sms-rate-limiter.ts     # Rate limiting service
└── utils/                      # Utility functions
    ├── config.ts               # Configuration management
    ├── supabase.ts             # Supabase client setup
    └── validation.ts           # Request validation
```

## Dependencies

This project uses JSR (JavaScript Registry) packages for Deno:

- `@hono/hono` - Web framework
- `@std/http` - HTTP utilities
- `@std/crypto` - Cryptographic functions
- `@std/encoding` - Encoding utilities
- `@std/uuid` - UUID generation
- `@supabase/supabase-js` - Supabase client

## Development

```bash
# Run in development mode with file watching
deno task dev

# Run in production mode
deno task start
```

## API Endpoints

### System Endpoints (No Authentication Required)
- `GET /` - Root endpoint with API information
- `GET /health` - Health check endpoint with system status
- `GET /status` - Detailed status endpoint with available endpoints

### Admin Endpoints (Authentication + Admin Role Required)
- `GET /api/admin/sms-costs` - Get SMS cost data
- `POST /api/admin/sms-costs` - Update SMS cost settings

### Monitor Endpoints (Authentication Required)
- `GET /api/monitors` - Get user monitors
- `POST /api/monitors/check` - Execute monitor check

### Webhook Endpoints (No Authentication Required)
- `GET /api/webhooks/sms-status` - SMS status webhook (GET)
- `POST /api/webhooks/sms-status` - SMS status webhook (POST)

## Middleware Stack

The main application applies middleware in the following order:

1. **Global Error Handler** - Catches and formats all errors consistently
2. **CORS Middleware** - Handles cross-origin requests (except webhooks)
3. **Authentication Middleware** - Validates Supabase JWT tokens (where required)
4. **Admin Middleware** - Validates admin role (for admin endpoints)
5. **Webhook CORS** - Special CORS handling for webhook endpoints

## Route Organization

Routes are organized using Hono's routing system:

- **Admin routes** (`/api/admin/*`) - Require authentication and admin role
- **Monitor routes** (`/api/monitors`) - Require user authentication
- **Monitor check routes** (`/api/monitors/check`) - Require user authentication  
- **Webhook routes** (`/api/webhooks/*`) - Use webhook-specific CORS, no auth required

## Error Handling

The application includes comprehensive error handling:

- **Custom Error Classes** - ValidationError, AuthenticationError, AuthorizationError, etc.
- **Async Error Wrapper** - Catches async errors in route handlers
- **Structured Error Responses** - Consistent error format across all endpoints
- **Development vs Production** - Different error detail levels based on environment

## Environment Variables

Required environment variables for Supabase integration:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)