CREATE OR REPLACE FUNCTION public.delete_monitor_cron_job (
  job_name text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
  BEGIN
    PERFORM cron.unschedule(job_name);
    RETURN TRUE;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN FALSE;
  END;
  $function$;

GRANT EXECUTE ON FUNCTION "public"."delete_monitor_cron_job"(text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
