-- =============================================================
-- Migration: add vault secret utility + use in cron headers
-- Timestamp: 2025-10-02 23:23:46 UTC
-- Purpose:
--   - Provide a stable wrapper around Supabase Vault for secret reads
--   - Add a convenience getter for the cron secret with DB setting fallback
--   - Update _get_cron_headers() to use the new getter
-- Safety:
--   - Idempotent via CREATE OR REPLACE
--   - Restrictive grants (service_role only for secret getters)
-- Requirements:
--   - supabase_vault extension installed
-- =============================================================

BEGIN;

-- Ensure the Vault extension is available (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Utility: secure getter for secrets by name (Vault -> text)
CREATE OR REPLACE FUNCTION public.vault_get(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  secret_value text;
BEGIN
  -- Try Vault first; ignore errors if extension/privileges are unavailable
  BEGIN
    SELECT ds.decrypted_secret
        INTO secret_value
      FROM vault.decrypted_secrets AS ds
      WHERE ds.name = secret_name
      ORDER BY ds.created_at DESC
      LIMIT 1;
      
  EXCEPTION WHEN OTHERS THEN
    secret_value := NULL;
  END;

  RETURN secret_value;
END;
$fn$;

-- Restrict execution to service_role only
REVOKE ALL ON FUNCTION public.vault_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_get(text) TO service_role;

-- Convenience: specific getter for the cron secret with fallback to DB setting
CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_secret text := NULL;
BEGIN
  v_secret := public.vault_get('cron/secret');

  IF v_secret IS NULL OR v_secret = '' THEN
    v_secret := current_setting('app.settings.cron_secret', true);
  END IF;

  RETURN v_secret;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_cron_secret() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role;

-- Update the header helper to use get_cron_secret()
CREATE OR REPLACE FUNCTION public._get_cron_headers()
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  cron_secret text := NULL;
  anon_key text := NULL;
  headers jsonb;
BEGIN
  -- Use new convenience getter
  cron_secret := public.get_cron_secret();

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE EXCEPTION 'Missing cron secret. Set via Vault (cron/secret) or DB: ALTER DATABASE postgres SET app.settings.cron_secret = ''<CRON_SECRET>'';';
  END IF;

  -- Obtain anon key (safe to store; needed by gateway on custom/project domains)
  BEGIN
    anon_key := public.vault_get('supabase/anon_key');
  EXCEPTION WHEN OTHERS THEN
    anon_key := NULL;
  END;
  IF anon_key IS NULL OR anon_key = '' THEN
    anon_key := current_setting('app.settings.anon_key', true);
  END IF;
  IF anon_key IS NULL OR anon_key = '' THEN
    RAISE EXCEPTION 'Missing anon key. Set via Vault (supabase/anon_key) or DB: ALTER DATABASE postgres SET app.settings.anon_key = ''<ANON_KEY>'';';
  END IF;

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Cron-Secret', cron_secret,
    'apikey', anon_key
  );
  RETURN headers;
END;
$fn$;

-- Keep grants consistent with prior migrations
GRANT EXECUTE ON FUNCTION public._get_cron_headers() TO authenticated;
GRANT EXECUTE ON FUNCTION public._get_cron_headers() TO service_role;

COMMIT;
