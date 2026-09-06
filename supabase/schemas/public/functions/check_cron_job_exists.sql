CREATE OR REPLACE FUNCTION public.check_cron_job_exists (
  job_name text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
  DECLARE
    job_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO job_count
    FROM cron.job
    WHERE jobname = job_name;

    RETURN job_count > 0;
  END;
  $function$;

GRANT EXECUTE ON FUNCTION "public"."check_cron_job_exists"(text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
