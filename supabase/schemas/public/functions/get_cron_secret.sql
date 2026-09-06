CREATE OR REPLACE FUNCTION public.get_cron_secret()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_secret text := NULL;
BEGIN
  v_secret := public.vault_get('cron/secret');

  IF v_secret IS NULL OR v_secret = '' THEN
    v_secret := current_setting('app.settings.cron_secret', true);
  END IF;

  RETURN v_secret;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_cron_secret"() TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."get_cron_secret"() FROM PUBLIC;
