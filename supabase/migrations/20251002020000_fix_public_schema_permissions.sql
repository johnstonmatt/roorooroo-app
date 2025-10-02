-- Fix public schema privileges so authenticated users can read/write with RLS
-- and avoid "permission denied for schema public" errors when posting monitors.
-- This also restores table/sequence privileges consistent with Supabase defaults
-- while keeping RLS as the enforcement mechanism.

BEGIN;

-- Ensure roles can reference objects in the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Base table privileges (RLS still applies on RLS-enabled tables)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- Sequence privileges for DEFAULT values (e.g., gen_random_uuid or sequences)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Future objects: keep privileges correct going forward
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO authenticated, service_role;

COMMIT;
