CREATE OR REPLACE FUNCTION public.create_monitor_cron_job (
  job_name      text,
  cron_schedule text,
  monitor_id    uuid,
  user_id       uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
  DECLARE
    job_id INTEGER;
  BEGIN
    -- Schedule with runtime resolution of URL and headers
    SELECT cron.schedule(
      job_name,
      cron_schedule,
      format(
        $cmd$SELECT net.http_post(
            url := _get_monitor_check_url(),
            headers := _get_cron_headers(),
            body := jsonb_build_object('monitor_id', %L, 'user_id', %L)
          )$cmd$,
        monitor_id::text,
        user_id::text
      )
    ) INTO job_id;

    INSERT INTO public.monitor_logs (monitor_id, status, error_message, checked_at)
    VALUES (monitor_id, 'info', 'Cron job created: ' || job_name || ' (ID: ' || COALESCE(job_id::text, 'null') || ')', NOW());

    RETURN job_id IS NOT NULL;
  EXCEPTION
    WHEN OTHERS THEN
      INSERT INTO public.monitor_logs (monitor_id, status, error_message, checked_at)
      VALUES (monitor_id, 'error', 'Failed to create cron job: ' || SQLERRM, NOW());
      RETURN FALSE;
  END;
  $function$;

GRANT EXECUTE ON FUNCTION "public"."create_monitor_cron_job"(text, text, uuid, uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
