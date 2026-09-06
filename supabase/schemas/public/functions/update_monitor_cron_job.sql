CREATE OR REPLACE FUNCTION public.update_monitor_cron_job (
  job_name      text,
  cron_schedule text,
  monitor_id    uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
  DECLARE
    job_id INTEGER;
    v_user_id UUID;
  BEGIN
    -- Lookup the monitor owner to include user_id in body
    SELECT m.user_id INTO v_user_id FROM public.monitors m WHERE m.id = monitor_id;

    PERFORM cron.unschedule(job_name);

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
        COALESCE(v_user_id::text, '')
      )
    ) INTO job_id;

    INSERT INTO public.monitor_logs (monitor_id, status, error_message, checked_at)
    VALUES (monitor_id, 'info', 'Cron job updated: ' || job_name || ' (ID: ' || COALESCE(job_id::text, 'null') || ')', NOW());

    RETURN job_id IS NOT NULL;
  EXCEPTION
    WHEN OTHERS THEN
      INSERT INTO public.monitor_logs (monitor_id, status, error_message, checked_at)
      VALUES (monitor_id, 'error', 'Failed to update cron job: ' || SQLERRM, NOW());
      RETURN FALSE;
  END;
  $function$;

GRANT EXECUTE ON FUNCTION "public"."update_monitor_cron_job"(text, text, uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
