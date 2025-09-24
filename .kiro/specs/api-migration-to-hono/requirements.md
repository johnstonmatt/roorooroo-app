# Requirements Document

## Introduction

This feature involves migrating the existing Next.js API routes to a Hono-based backend running in Supabase Edge Functions, while converting the Next.js frontend to export mode for static deployment. The migration will modernize the architecture by separating concerns, using Deno's standard library where possible, and enabling the frontend to make client-side API calls to the new backend.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to migrate API routes from Next.js to Hono backend, so that I can have a clear separation between frontend and backend concerns.

#### Acceptance Criteria

1. WHEN the migration is complete THEN the system SHALL have all existing API routes (`/api/admin/sms-costs`, `/api/monitors`, `/api/monitors/check`, `/api/webhooks/sms-status`) implemented in Hono
2. WHEN implementing Hono routes THEN the system SHALL use `jsr:@hono/hono` as the web framework
3. WHEN possible THEN the system SHALL replace Node.js dependencies with `jsr.io/@std/*` equivalents
4. WHEN the backend is deployed THEN it SHALL run as Supabase Edge Functions

### Requirement 2

**User Story:** As a developer, I want the Next.js frontend to run in export mode, so that it can be deployed as a static site and make client-side API calls.

#### Acceptance Criteria

1. WHEN the frontend is configured THEN Next.js SHALL be set to export mode
2. WHEN the frontend makes API calls THEN it SHALL call the new Hono backend endpoints
3. WHEN the frontend is built THEN it SHALL generate static files that can be deployed anywhere
4. WHEN API calls are made THEN they SHALL be made from the client-side, not server-side

### Requirement 3

**User Story:** As a user, I want all existing functionality to work seamlessly after the migration, so that there is no disruption to the application's behavior.

#### Acceptance Criteria

1. WHEN the migration is complete THEN all monitor management functionality SHALL work identically
2. WHEN SMS cost monitoring is accessed THEN it SHALL function the same as before
3. WHEN webhook endpoints are called THEN they SHALL process requests correctly
4. WHEN notifications are managed THEN the system SHALL maintain all existing capabilities

### Requirement 4

**User Story:** As a developer, I want proper error handling and CORS configuration, so that the frontend can communicate with the backend securely.

#### Acceptance Criteria

1. WHEN the Hono backend receives requests THEN it SHALL handle CORS properly for the frontend domain
2. WHEN errors occur in the backend THEN they SHALL be properly formatted and returned to the client
3. WHEN authentication is required THEN the system SHALL validate Supabase JWT tokens
4. WHEN rate limiting is needed THEN it SHALL be implemented at the backend level

### Requirement 5

**User Story:** As a developer, I want the backend to integrate properly with Supabase services, so that database operations and authentication continue to work.

#### Acceptance Criteria

1. WHEN the backend accesses the database THEN it SHALL use Supabase client properly
2. WHEN authentication is required THEN the system SHALL validate user sessions through Supabase
3. WHEN the backend is deployed THEN it SHALL have access to all necessary Supabase environment variables
4. WHEN database operations are performed THEN they SHALL maintain the same security policies as before

### Requirement 6

**User Story:** As a developer, I want database migration scripts moved to the backend directory, so that all backend-related code is centralized.

#### Acceptance Criteria

1. WHEN the migration is complete THEN all SQL migration scripts SHALL be moved from `./frontend/scripts/` to `./backend/supabase/migrations/`
2. WHEN migrations are applied THEN they SHALL work correctly from the new location
3. WHEN the backend is set up THEN it SHALL have proper migration management through Supabase CLI
4. WHEN new migrations are needed THEN they SHALL be created in the backend directory structure

### Requirement 7

**User Story:** As a developer, I want to use Supabase cron for scheduling monitor jobs, so that monitoring checks run automatically without external dependencies.

#### Acceptance Criteria

1. WHEN monitor checks need to be scheduled THEN the system SHALL use Supabase cron jobs instead of external scheduling
2. WHEN cron jobs are configured THEN they SHALL call the appropriate Hono backend endpoints
3. WHEN monitor checks run THEN they SHALL execute at the correct intervals as defined by user settings
4. WHEN cron jobs fail THEN the system SHALL handle errors gracefully and log appropriately