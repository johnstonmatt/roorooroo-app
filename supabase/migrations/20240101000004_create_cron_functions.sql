-- =============================================================
-- Script: 20240101000004_create_cron_functions.sql
-- Purpose: Create database functions for managing monitor cron jobs
-- Safety: Idempotent (uses CREATE OR REPLACE)
-- Notes: Requires pg_cron and pg_net extensions to be enabled
-- =============================================================

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: Resolve API URL for monitor checks
CREATE OR REPLACE FUNCTION _get_monitor_check_url()
RETURNS text
LANGUAGE plpgsql
AS $$
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
$$;

-- Helper: Build headers including Service Role
CREATE OR REPLACE FUNCTION _get_cron_auth_headers()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  svc_key text := NULL;
  headers jsonb;
BEGIN
  svc_key := current_setting('app.settings.service_role_key', true);

  IF svc_key IS NULL OR svc_key = '' THEN
    RAISE EXCEPTION 'Missing setting app.settings.service_role_key. Set it via: ALTER DATABASE postgres SET app.settings.service_role_key = ''<SERVICE_ROLE_KEY>'';';
  END IF;

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || svc_key,
    'apikey', svc_key
  );
  RETURN headers;
END;
$$;

-- Helper: Build headers for cron using X-Cron-Secret (no service role in request)
CREATE OR REPLACE FUNCTION _get_cron_headers()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  cron_secret text := NULL;
  headers jsonb;
BEGIN
  cron_secret := current_setting('app.settings.cron_secret', true);

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE EXCEPTION 'Missing setting app.settings.cron_secret. Set it via: ALTER DATABASE postgres SET app.settings.cron_secret = ''<CRON_SECRET>'';';
  END IF;

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Cron-Secret', cron_secret
  );
  RETURN headers;
END;
$$;

-- Function to create a monitor cron job
CREATE OR REPLACE FUNCTION create_monitor_cron_job(
  job_name TEXT,
  cron_schedule TEXT,
  monitor_id UUID,
  user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  job_id INTEGER;
  api_url TEXT;
  headers jsonb;
  body jsonb;
BEGIN
  api_url := _get_monitor_check_url();
  headers := _get_cron_headers();

  body := jsonb_build_object(
    'monitor_id', monitor_id::text,
    'user_id', user_id::text
  );

  SELECT cron.schedule(
    job_name,
    cron_schedule,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
      api_url, headers::text, body::text
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a monitor cron job
CREATE OR REPLACE FUNCTION update_monitor_cron_job(
  job_name TEXT,
  cron_schedule TEXT,
  monitor_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  job_id INTEGER;
  api_url TEXT;
  headers jsonb;
  body jsonb;
BEGIN
  PERFORM cron.unschedule(job_name);

  api_url := _get_monitor_check_url();
  headers := _get_cron_headers();

  body := jsonb_build_object(
    'monitor_id', monitor_id::text
  );

  SELECT cron.schedule(
    job_name,
    cron_schedule,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
      api_url, headers::text, body::text
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a monitor cron job
CREATE OR REPLACE FUNCTION delete_monitor_cron_job(
  job_name TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  PERFORM cron.unschedule(job_name);
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a cron job exists
CREATE OR REPLACE FUNCTION check_cron_job_exists(
  job_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = job_name;

  RETURN job_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to list all cron jobs for a user's monitors
CREATE OR REPLACE FUNCTION list_user_cron_jobs(
  user_id UUID
) RETURNS TEXT[] AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get detailed cron job information
CREATE OR REPLACE FUNCTION get_cron_job_info(
  job_name TEXT
) RETURNS JSON AS $$
DECLARE
  job_info JSON;
BEGIN
  SELECT json_build_object(
    'schedule', schedule,
    'active', active,
    'last_run', last_run,
    'next_run', next_run
  )
  INTO job_info
  FROM cron.job
  WHERE jobname = job_name;

  RETURN job_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants to authenticated
GRANT EXECUTE ON FUNCTION create_monitor_cron_job(TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_monitor_cron_job(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_monitor_cron_job(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_cron_job_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION list_user_cron_jobs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cron_job_info(TEXT) TO authenticated;

-- Grants to service_role
GRANT EXECUTE ON FUNCTION create_monitor_cron_job(TEXT, TEXT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_monitor_cron_job(TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION delete_monitor_cron_job(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION check_cron_job_exists(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION list_user_cron_jobs(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_cron_job_info(TEXT) TO service_role;

COMMIT;