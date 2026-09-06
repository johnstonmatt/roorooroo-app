CREATE OR REPLACE FUNCTION public.get_cron_job_info (
  job_name text
)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
  DECLARE
    job_info JSON;
  BEGIN
    SELECT json_build_object(
      'schedule', j.schedule,
      'active', j.active,
      'last_run', d.last_run,
      'next_run', NULL::timestamptz
    )
    INTO job_info
    FROM cron.job j
    LEFT JOIN (
      SELECT jobid, max(end_time) AS last_run
      FROM cron.job_run_details
      GROUP BY jobid
    ) d ON d.jobid = j.jobid
    WHERE j.jobname = job_name;

    RETURN job_info;
  END;
  $function$;

GRANT EXECUTE ON FUNCTION "public"."get_cron_job_info"(text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
