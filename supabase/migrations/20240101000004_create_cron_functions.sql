-- =============================================================
-- Script: 20240101000004_create_cron_functions.sql
-- Purpose: Create database functions for managing monitor cron jobs
-- Safety: Idempotent (uses CREATE OR REPLACE)
-- Notes: Requires pg_cron extension to be enabled
-- =============================================================

BEGIN;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
create EXTENSION IF NOT EXISTS pg_net;

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
BEGIN
  -- Get the Supabase function URL for the monitor check endpoint
  api_url := current_setting('app.settings.api_base_url', true) || '/api/monitors/check';
  
  -- If api_base_url is not set, use a default (this should be configured in production)
  IF api_url IS NULL OR api_url = '/api/monitors/check' THEN
    api_url := 'https://hfzyljzxjrhvenwjyxlo.supabase.co/functions/v1/api/monitors/check';
  END IF;

  -- Create the cron job that will call the monitor check endpoint
  SELECT cron.schedule(
    job_name,
    cron_schedule,
    format('SELECT net.http_post(
      url := %L,
      headers := %L,
      body := %L
    )', 
    api_url,
    '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}',
    '{"monitor_id": "' || monitor_id || '", "user_id": "' || user_id || '"}'
    )
  ) INTO job_id;

  -- Log the cron job creation
  INSERT INTO public.monitor_logs (monitor_id, status, error_message, checked_at)
  VALUES (monitor_id, 'info', 'Cron job created: ' || job_name || ' (ID: ' || job_id || ')', NOW());

  RETURN job_id IS NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
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
BEGIN
  -- First, try to unschedule the existing job
  PERFORM cron.unschedule(job_name);
  
  -- Get the API URL
  api_url := current_setting('app.settings.api_base_url', true) || '/api/monitors/check';
  IF api_url IS NULL OR api_url = '/api/monitors/check' THEN
    api_url := 'https://hfzyljzxjrhvenwjyxlo.supabase.co/functions/v1/api/monitors/check';
  END IF;

  -- Create the updated cron job
  SELECT cron.schedule(
    job_name,
    cron_schedule,
    format('SELECT net.http_post(
      url := %L,
      headers := %L,
      body := %L
    )', 
    api_url,
    '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}',
    '{"monitor_id": "' || monitor_id || '"}'
    )
  ) INTO job_id;

  -- Log the update
  INSERT INTO public.monitor_logs (monitor_id, status, error_message, checked_at)
  VALUES (monitor_id, 'info', 'Cron job updated: ' || job_name, NOW());

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
  -- Unschedule the cron job
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
  SELECT COUNT(*)
  FROM cron.job
  WHERE jobname = job_name
  INTO job_count;
  
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
  SELECT ARRAY_AGG(jobname)
  FROM cron.job
  WHERE jobname LIKE 'monitor_check_%'
  AND jobname IN (
    SELECT 'monitor_check_' || REPLACE(m.id::TEXT, '-', '_')
    FROM public.monitors m
    WHERE m.user_id = list_user_cron_jobs.user_id
  )
  INTO job_names;
  
  RETURN COALESCE(job_names, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_monitor_cron_job(TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_monitor_cron_job(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_monitor_cron_job(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_cron_job_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION list_user_cron_jobs(UUID) TO authenticated;

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
  FROM cron.job
  WHERE jobname = job_name
  INTO job_info;
  
  RETURN job_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_monitor_cron_job(TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_monitor_cron_job(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_monitor_cron_job(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_cron_job_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION list_user_cron_jobs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cron_job_info(TEXT) TO authenticated;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION create_monitor_cron_job(TEXT, TEXT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_monitor_cron_job(TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION delete_monitor_cron_job(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION check_cron_job_exists(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION list_user_cron_jobs(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_cron_job_info(TEXT) TO service_role;

COMMIT;