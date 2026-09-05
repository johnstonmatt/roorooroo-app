CREATE OR REPLACE FUNCTION public._get_cron_headers()
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $function$
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
    'Authorization', 'Bearer ' || anon_key,
    'X-Cron-Secret', cron_secret,
    'apikey', anon_key
  );
  RETURN headers;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_get_cron_headers"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
