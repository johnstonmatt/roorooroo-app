-- Update _get_cron_headers to include apikey header for Supabase gateway
-- and keep X-Cron-Secret for function-level auth.

BEGIN;

-- Ensure Vault is available for secret retrieval
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Recreate helper to build headers for cron using X-Cron-Secret + apikey
CREATE OR REPLACE FUNCTION _get_cron_headers()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  cron_secret text := NULL;
  anon_key text := NULL;
  headers jsonb;
BEGIN
  -- Prefer Vault for cron secret
  cron_secret := vault.get('cron/secret');
  
  -- Fallback to DB setting if Vault not configured
  IF cron_secret IS NULL OR cron_secret = '' THEN
    cron_secret := current_setting('app.settings.cron_secret', true);
  END IF;

  -- Obtain anon key (safe to store; needed by gateway on custom/project domains)
  -- Prefer Vault path; set via Dashboard > Database > Vault
  anon_key := vault.get('supabase/anon_key');

  -- Fallback to DB setting if Vault not configured
  IF anon_key IS NULL OR anon_key = '' THEN
    anon_key := current_setting('app.settings.anon_key', true);
  END IF;

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE EXCEPTION 'Missing cron secret. Set it via Vault at cron/secret or via: ALTER DATABASE postgres SET app.settings.cron_secret = ''<CRON_SECRET>'';';
  END IF;

  IF anon_key IS NULL OR anon_key = '' THEN
    RAISE EXCEPTION 'Missing anon key. Set it via Vault at supabase/anon_key or via: ALTER DATABASE postgres SET app.settings.anon_key = ''<ANON_KEY>'';';
  END IF;

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Cron-Secret', cron_secret,
    'apikey', anon_key
  );
  RETURN headers;
END;
$$;

COMMIT;
