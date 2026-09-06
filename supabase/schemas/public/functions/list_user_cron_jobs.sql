CREATE OR REPLACE FUNCTION public.list_user_cron_jobs (
  user_id uuid
)
  RETURNS text[]
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
  DECLARE
    job_names TEXT[];
  BEGIN
    SELECT ARRAY_AGG(jobname) INTO job_names
    FROM cron.job
    WHERE jobname LIKE 'monitor_check_%'
      AND jobname IN (
        SELECT 'monitor_check_' || REPLACE(m.id::TEXT, '-', '_')
        FROM public.monitors m
        WHERE m.user_id = list_user_cron_jobs.user_id
      );

    RETURN COALESCE(job_names, ARRAY[]::TEXT[]);
  END;
  $function$;

GRANT EXECUTE ON FUNCTION "public"."list_user_cron_jobs"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
