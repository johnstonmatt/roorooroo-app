SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._get_cron_headers()
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $function$
DECLARE
  secret_key text := NULL;
BEGIN
  -- The Edge Function authenticates cron with auth: 'secret', i.e. a
  -- Supabase secret key (sb_secret_...) in the apikey header. This replaces
  -- the previous bespoke X-Cron-Secret shared secret plus anon-key bearer.
  BEGIN
    secret_key := public.vault_get('supabase/secret_key');
  EXCEPTION WHEN OTHERS THEN
    secret_key := NULL;
  END;

  IF secret_key IS NULL OR secret_key = '' THEN
    secret_key := current_setting('app.settings.secret_key', true);
  END IF;

  IF secret_key IS NULL OR secret_key = '' THEN
    RAISE EXCEPTION 'Missing Supabase secret key. Set via Vault (supabase/secret_key) or DB: ALTER DATABASE postgres SET app.settings.secret_key = ''<SUPABASE_SECRET_KEY>'';';
  END IF;

  -- Only apikey: sending an Authorization bearer as well would make the
  -- function try the 'user' mode first and reject the request outright,
  -- because a credential that is present but invalid never falls through.
  RETURN jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', secret_key
  );
END;
$function$;
