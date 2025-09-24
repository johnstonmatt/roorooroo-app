# Implementation Plan

- [x] 1. Set up backend project structure and dependencies
  - Create Hono-based Edge Function project structure in `backend/supabase/functions/api/`
  - Configure `deno.json` with JSR dependencies for Hono and Supabase
  - Set up TypeScript configuration for Deno environment
  - _Requirements: 1.1, 1.2_

- [x] 2. Move and adapt database migration scripts
  - Move SQL migration files from `frontend/scripts/` to `backend/supabase/migrations/`
  - Rename migration files with proper timestamp prefixes for Supabase
  - Update Supabase configuration to use new migration directory
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Create core backend utilities and middleware
  - Implement Supabase client utilities for Edge Functions
  - Create JWT authentication middleware for user validation
  - Implement CORS middleware for frontend communication
  - Create global error handling middleware
  - _Requirements: 1.3, 4.1, 4.2, 5.1, 5.2_

- [x] 3.1 Create cron job management utilities
  - Implement utilities for creating, updating, and deleting Supabase cron jobs
  - Create functions to generate cron expressions from check intervals (e.g., 300 seconds = "*/5 * * * *")
  - Add error handling and logging for cron job operations
  - Create utilities to manage monitor-specific cron job naming and identification
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 4. Migrate SMS service classes to Deno/JSR
  - Adapt `SMSService` class to use Deno and JSR packages instead of Node.js
  - Migrate `SMSRateLimiter` to work with Deno environment
  - Update `SMSCostMonitor` to use JSR standard library
  - Adapt `NotificationService` for Deno compatibility
  - _Requirements: 1.2, 1.3_

- [x] 5. Implement admin SMS costs API endpoint
  - Create Hono route handler for `/api/admin/sms-costs` GET and POST methods
  - Integrate migrated `SMSCostMonitor` service
  - Implement authentication and admin role validation
  - Add request validation and error handling
  - _Requirements: 1.1, 3.1, 4.2, 4.3, 5.1_

- [x] 6. Implement monitors API endpoint
  - Create Hono route handler for `/api/monitors` GET method
  - Implement user authentication and data filtering
  - Add proper error handling and response formatting
  - _Requirements: 1.1, 3.1, 4.2, 5.1, 5.4_

- [x] 6.1 Implement monitor creation API endpoint
  - Create Hono route handler for `/api/monitors` POST method
  - Implement monitor creation with validation using existing validation utilities
  - When user submits form from NewMonitorPage, create corresponding Supabase cron job based on check_interval
  - Configure cron job to call `/api/monitors/check` endpoint at specified intervals
  - Add proper error handling for both monitor creation and cron job setup
  - _Requirements: 1.1, 3.1, 4.2, 5.1, 5.4, 7.1, 7.2_

- [x] 7. Implement monitor check API endpoint
  - Create Hono route handler for `/api/monitors/check` POST method
  - Migrate monitor checking logic from Next.js API route
  - Integrate notification service for status change alerts
  - Implement proper error handling and logging
  - _Requirements: 1.1, 3.1, 4.2, 5.1, 5.4_

- [x] 8. Implement SMS webhook API endpoint
  - Create Hono route handler for `/api/webhooks/sms-status` POST and GET methods
  - Migrate Twilio webhook handling logic
  - Implement webhook validation and security
  - Add notification status update functionality
  - _Requirements: 1.1, 3.1, 4.2_

- [x] 9. Create main Hono application with routing
  - Set up main Hono app with all route handlers
  - Configure middleware stack (CORS, auth, error handling)
  - Implement route organization and request routing
  - Add health check and status endpoints
  - _Requirements: 1.1, 1.2, 4.1_

- [x] 10. Configure Next.js frontend for export mode
  - Update `next.config.js` to enable export mode with `output: 'export'`
  - Configure environment variables for backend API base URL
  - Update build scripts to generate static files
  - _Requirements: 2.1, 2.3_

- [x] 11. Update frontend API calls to use new backend
  - Replace Next.js API route calls with fetch calls to Hono backend
  - Update authentication headers to pass Supabase JWT tokens
  - Update NewMonitorPage form submission to call new `/api/monitors` POST endpoint instead of direct Supabase insert
  - Implement proper error handling for client-side API calls
  - Update all components that make API requests
  - _Requirements: 2.2, 2.4, 3.1, 3.2, 3.3_

- [ ] 12. Test and validate migrated functionality
  - Test all API endpoints with proper authentication
  - Verify monitor creation, checking, and notification workflows including cron job creation
  - Test that cron jobs are properly created when monitors are submitted via NewMonitorPage
  - Validate that cron jobs execute at correct intervals and call monitor check endpoints
  - Test SMS cost monitoring and admin functionality
  - Validate webhook endpoints with mock Twilio payloads
  - Test cron job cleanup when monitors are deleted or deactivated
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.3, 7.4_

- [ ] 13. Deploy and configure backend Edge Functions
  - Deploy Hono Edge Functions to Supabase
  - Apply database migrations to production
  - Configure environment variables for production
  - Set up and test Supabase cron job functionality in production environment
  - Verify that monitor creation triggers proper cron job setup in production
  - Test deployed endpoints with frontend
  - _Requirements: 1.4, 5.3, 6.4, 7.1, 7.2_

- [ ] 14. Build and deploy static frontend
  - Build Next.js application in export mode
  - Configure production API base URL
  - Deploy static files to hosting service
  - Test end-to-end functionality in production
  - _Requirements: 2.1, 2.3, 3.1_