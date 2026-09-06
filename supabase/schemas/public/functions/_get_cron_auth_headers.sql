CREATE OR REPLACE FUNCTION public._get_cron_auth_headers()
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $function$
  DECLARE
    svc_key text := NULL;
    headers jsonb;
  BEGIN
    -- Prefer Vault for service role; fallback to DB setting if needed
    BEGIN
      svc_key := public.vault_get('supabase/service_role_key');
      IF svc_key IS NULL OR svc_key = '' THEN
        svc_key := public.vault_get('supabase/service_role');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Vault may not be available; ignore and fallback
      NULL;
    END;

    IF svc_key IS NULL OR svc_key = '' THEN
      svc_key := current_setting('app.settings.service_role_key', true);
    END IF;

    IF svc_key IS NULL OR svc_key = '' THEN
      RAISE EXCEPTION 'Missing service role key. Set via Vault (supabase/service_role_key) or DB: ALTER DATABASE postgres SET app.settings.service_role_key = ''<SERVICE_ROLE_KEY>'';';
    END IF;

    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key,
      'apikey', svc_key
    );
    RETURN headers;
  END;
  $function$;

GRANT EXECUTE ON FUNCTION "public"."_get_cron_auth_headers"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
