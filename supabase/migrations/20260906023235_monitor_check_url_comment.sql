SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._get_monitor_check_url()
  RETURNS text
  LANGUAGE plpgsql
  AS $function$
DECLARE
  base_url text := NULL;
  url text;
BEGIN
  base_url := current_setting('app.settings.api_base_url', true);
  IF base_url IS NULL OR base_url = '' THEN
    -- Fallback: project-specific default
    base_url := 'https://hfzyljzxjrhvenwjyxlo.supabase.co/functions/v1';
  END IF;
  -- Ensure no trailing slash on base_url
  IF right(base_url, 1) = '/' THEN
    base_url := left(base_url, length(base_url)-1);
  END IF;

  -- Single 'api' Edge Function; withOpenAPI routes within it
  url := base_url || '/api/check-endpoint';
  RETURN url;
END;
$function$;
