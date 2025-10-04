  create extension if not exists "pg_net" with schema "public" version '0.19.5';

  drop trigger if exists "update_monitors_updated_at" on "public"."monitors";

  drop trigger if exists "update_profiles_updated_at" on "public"."profiles";

  drop policy "monitor_logs_insert_system" on "public"."monitor_logs";

  drop policy "monitor_logs_select_own" on "public"."monitor_logs";

  revoke delete on table "public"."monitor_logs" from "anon";

  revoke insert on table "public"."monitor_logs" from "anon";

  revoke references on table "public"."monitor_logs" from "anon";

  revoke select on table "public"."monitor_logs" from "anon";

  revoke trigger on table "public"."monitor_logs" from "anon";

  revoke truncate on table "public"."monitor_logs" from "anon";

  revoke update on table "public"."monitor_logs" from "anon";

  revoke delete on table "public"."monitor_logs" from "authenticated";

  revoke insert on table "public"."monitor_logs" from "authenticated";

  revoke references on table "public"."monitor_logs" from "authenticated";

  revoke select on table "public"."monitor_logs" from "authenticated";

  revoke trigger on table "public"."monitor_logs" from "authenticated";

  revoke truncate on table "public"."monitor_logs" from "authenticated";

  revoke update on table "public"."monitor_logs" from "authenticated";

  revoke delete on table "public"."monitor_logs" from "service_role";

  revoke insert on table "public"."monitor_logs" from "service_role";

  revoke references on table "public"."monitor_logs" from "service_role";

  revoke select on table "public"."monitor_logs" from "service_role";

  revoke trigger on table "public"."monitor_logs" from "service_role";

  revoke truncate on table "public"."monitor_logs" from "service_role";

  revoke update on table "public"."monitor_logs" from "service_role";

  revoke delete on table "public"."monitors" from "anon";

  revoke insert on table "public"."monitors" from "anon";

  revoke references on table "public"."monitors" from "anon";

  revoke select on table "public"."monitors" from "anon";

  revoke trigger on table "public"."monitors" from "anon";

  revoke truncate on table "public"."monitors" from "anon";

  revoke update on table "public"."monitors" from "anon";

  revoke delete on table "public"."monitors" from "authenticated";

  revoke insert on table "public"."monitors" from "authenticated";

  revoke references on table "public"."monitors" from "authenticated";

  revoke select on table "public"."monitors" from "authenticated";

  revoke trigger on table "public"."monitors" from "authenticated";

  revoke truncate on table "public"."monitors" from "authenticated";

  revoke update on table "public"."monitors" from "authenticated";

  revoke delete on table "public"."monitors" from "service_role";

  revoke insert on table "public"."monitors" from "service_role";

  revoke references on table "public"."monitors" from "service_role";

  revoke select on table "public"."monitors" from "service_role";

  revoke trigger on table "public"."monitors" from "service_role";

  revoke truncate on table "public"."monitors" from "service_role";

  revoke update on table "public"."monitors" from "service_role";

  revoke delete on table "public"."notifications" from "anon";

  revoke insert on table "public"."notifications" from "anon";

  revoke references on table "public"."notifications" from "anon";

  revoke select on table "public"."notifications" from "anon";

  revoke trigger on table "public"."notifications" from "anon";

  revoke truncate on table "public"."notifications" from "anon";

  revoke update on table "public"."notifications" from "anon";

  revoke delete on table "public"."notifications" from "authenticated";

  revoke insert on table "public"."notifications" from "authenticated";

  revoke references on table "public"."notifications" from "authenticated";

  revoke select on table "public"."notifications" from "authenticated";

  revoke trigger on table "public"."notifications" from "authenticated";

  revoke truncate on table "public"."notifications" from "authenticated";

  revoke update on table "public"."notifications" from "authenticated";

  revoke delete on table "public"."notifications" from "service_role";

  revoke insert on table "public"."notifications" from "service_role";

  revoke references on table "public"."notifications" from "service_role";

  revoke select on table "public"."notifications" from "service_role";

  revoke trigger on table "public"."notifications" from "service_role";

  revoke truncate on table "public"."notifications" from "service_role";

  revoke update on table "public"."notifications" from "service_role";

  revoke delete on table "public"."profiles" from "anon";

  revoke insert on table "public"."profiles" from "anon";

  revoke references on table "public"."profiles" from "anon";

  revoke select on table "public"."profiles" from "anon";

  revoke trigger on table "public"."profiles" from "anon";

  revoke truncate on table "public"."profiles" from "anon";

  revoke update on table "public"."profiles" from "anon";

  revoke delete on table "public"."profiles" from "authenticated";

  revoke insert on table "public"."profiles" from "authenticated";

  revoke references on table "public"."profiles" from "authenticated";

  revoke select on table "public"."profiles" from "authenticated";

  revoke trigger on table "public"."profiles" from "authenticated";

  revoke truncate on table "public"."profiles" from "authenticated";

  revoke update on table "public"."profiles" from "authenticated";

  revoke delete on table "public"."profiles" from "service_role";

  revoke insert on table "public"."profiles" from "service_role";

  revoke references on table "public"."profiles" from "service_role";

  revoke select on table "public"."profiles" from "service_role";

  revoke trigger on table "public"."profiles" from "service_role";

  revoke truncate on table "public"."profiles" from "service_role";

  revoke update on table "public"."profiles" from "service_role";

  alter table "public"."monitor_logs" drop constraint "monitor_logs_monitor_id_fkey";

  alter table "public"."notifications" drop constraint "notifications_monitor_id_fkey";

  alter table "public"."monitor_logs" add constraint "monitor_logs_monitor_id_fkey" FOREIGN KEY (monitor_id) REFERENCES public.monitors(id) ON DELETE CASCADE not valid;

  alter table "public"."monitor_logs" validate constraint "monitor_logs_monitor_id_fkey";

  alter table "public"."notifications" add constraint "notifications_monitor_id_fkey" FOREIGN KEY (monitor_id) REFERENCES public.monitors(id) ON DELETE CASCADE not valid;

  alter table "public"."notifications" validate constraint "notifications_monitor_id_fkey";

  set check_function_bodies = off;

  CREATE OR REPLACE FUNCTION public.update_sms_usage_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $function$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $function$
  ;

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
  $function$
  ;

  CREATE OR REPLACE FUNCTION public._get_cron_headers()
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $function$
  DECLARE
    cron_secret text := NULL;
    anon_key text := NULL;
    headers jsonb;
  BEGIN
    -- Prefer Vault for cron secret
    BEGIN
      cron_secret := public.vault_get('cron/secret');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    -- Fallback to DB setting
    IF cron_secret IS NULL OR cron_secret = '' THEN
      cron_secret := current_setting('app.settings.cron_secret', true);
    END IF;

    -- Obtain anon key (safe to store; needed by gateway on custom/project domains)
    BEGIN
      anon_key := public.vault_get('supabase/anon_key');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    IF anon_key IS NULL OR anon_key = '' THEN
      anon_key := current_setting('app.settings.anon_key', true);
    END IF;

    IF cron_secret IS NULL OR cron_secret = '' THEN
      RAISE EXCEPTION 'Missing cron secret. Set via Vault (cron/secret) or DB: ALTER DATABASE postgres SET app.settings.cron_secret = ''<CRON_SECRET>'';';
    END IF;
    IF anon_key IS NULL OR anon_key = '' THEN
      RAISE EXCEPTION 'Missing anon key. Set via Vault (supabase/anon_key) or DB: ALTER DATABASE postgres SET app.settings.anon_key = ''<ANON_KEY>'';';
    END IF;

    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', cron_secret,
      'apikey', anon_key
    );
    RETURN headers;
  END;
  $function$
  ;

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

    url := base_url || '/api/monitors/check';
    RETURN url;
  END;
  $function$
  ;

  CREATE OR REPLACE FUNCTION public.check_cron_job_exists(job_name text)
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
  $function$
  ;

  CREATE OR REPLACE FUNCTION public.create_monitor_cron_job(job_name text, cron_schedule text, monitor_id uuid, user_id uuid)
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
  $function$
  ;

  CREATE OR REPLACE FUNCTION public.delete_monitor_cron_job(job_name text)
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
  $function$
  ;

  CREATE OR REPLACE FUNCTION public.get_cron_job_info(job_name text)
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
  $function$
  ;

  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
  END;
  $function$
  ;

  CREATE OR REPLACE FUNCTION public.list_user_cron_jobs(user_id uuid)
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
  $function$
  ;

  create or replace view "public"."notification_history" as  SELECT id,
      monitor_id,
      user_id,
      type,
      channel,
      message,
      status,
      error_message,
      message_id,
      COALESCE(created_at, sent_at) AS created_at,
      sent_at
    FROM public.notifications
    ORDER BY COALESCE(created_at, sent_at) DESC;


  CREATE OR REPLACE FUNCTION public.update_monitor_cron_job(job_name text, cron_schedule text, monitor_id uuid)
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
  $function$
  ;

  CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $function$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $function$
  ;

  create policy "monitor_logs_insert_system"
  on "public"."monitor_logs"
  as permissive
  for insert
  to public
  with check ((EXISTS ( SELECT 1
    FROM public.monitors
    WHERE ((monitors.id = monitor_logs.monitor_id) AND (monitors.user_id = auth.uid())))));


  create policy "monitor_logs_select_own"
  on "public"."monitor_logs"
  as permissive
  for select
  to public
  using ((EXISTS ( SELECT 1
    FROM public.monitors
    WHERE ((monitors.id = monitor_logs.monitor_id) AND (monitors.user_id = auth.uid())))));


  CREATE TRIGGER update_monitors_updated_at BEFORE UPDATE ON public.monitors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

  CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


  drop trigger if exists "on_auth_user_created" on "auth"."users";

  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


