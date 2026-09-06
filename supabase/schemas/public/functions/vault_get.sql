CREATE OR REPLACE FUNCTION public.vault_get (
  secret_name text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."vault_get"(text) TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."vault_get"(text) FROM PUBLIC;
