-- =============================================================
-- Script: 20240101000000_create_tables.sql
-- Purpose: Bootstrap core tables, RLS policies, and indexes
-- Safety: Idempotent (uses IF NOT EXISTS where supported)
-- Notes:
--   - Keep schema-qualified names for clarity
--   - RLS policies do not support IF NOT EXISTS; reruns may error if renamed
-- =============================================================

BEGIN;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create profiles table for user management
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create monitors table for website monitoring jobs
CREATE TABLE IF NOT EXISTS public.monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'contains', -- 'contains', 'regex', 'not_contains'
  check_interval INTEGER NOT NULL DEFAULT 300, -- seconds (5 minutes default)
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_checked TIMESTAMP WITH TIME ZONE,
  last_status TEXT DEFAULT 'pending', -- 'pending', 'found', 'not_found', 'error'
  notification_channels JSONB DEFAULT '[]'::jsonb, -- array of notification configs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create monitor_logs table for tracking check history
CREATE TABLE IF NOT EXISTS public.monitor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'found', 'not_found', 'error'
  response_time INTEGER, -- milliseconds
  error_message TEXT,
  content_snippet TEXT, -- snippet of matched content
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table for tracking sent notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'found', 'not_found', 'error'
  channel TEXT NOT NULL, -- 'email', 'webhook', etc.
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent' -- 'sent', 'failed'
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
-- Note: CREATE POLICY does not support IF NOT EXISTS; adjust in migrations if renaming
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_delete_own'
  ) THEN
    CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);
  END IF;
END $$;

-- Monitors policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitors' AND policyname = 'monitors_select_own'
  ) THEN
    CREATE POLICY "monitors_select_own" ON public.monitors FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitors' AND policyname = 'monitors_insert_own'
  ) THEN
    CREATE POLICY "monitors_insert_own" ON public.monitors FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitors' AND policyname = 'monitors_update_own'
  ) THEN
    CREATE POLICY "monitors_update_own" ON public.monitors FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitors' AND policyname = 'monitors_delete_own'
  ) THEN
    CREATE POLICY "monitors_delete_own" ON public.monitors FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Monitor logs policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitor_logs' AND policyname = 'monitor_logs_select_own'
  ) THEN
    CREATE POLICY "monitor_logs_select_own" ON public.monitor_logs 
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.monitors 
          WHERE monitors.id = monitor_logs.monitor_id 
          AND monitors.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitor_logs' AND policyname = 'monitor_logs_insert_system'
  ) THEN
    CREATE POLICY "monitor_logs_insert_system" ON public.monitor_logs 
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.monitors 
          WHERE monitors.id = monitor_logs.monitor_id 
          AND monitors.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Notifications policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_select_own'
  ) THEN
    CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_insert_own'
  ) THEN
    CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON public.monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_active ON public.monitors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_monitor_logs_monitor_id ON public.monitor_logs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_logs_checked_at ON public.monitor_logs(checked_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_monitor_id ON public.notifications(monitor_id);

-- Quick verification queries (safe to run repeatedly)
-- SELECT count(*) FROM public.profiles;
-- SELECT count(*) FROM public.monitors;
-- SELECT count(*) FROM public.monitor_logs;
-- SELECT count(*) FROM public.notifications;


-- Consolidated: Profile creation trigger and updated_at triggers
-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers for profiles and monitors
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_monitors_updated_at ON public.monitors;
CREATE TRIGGER update_monitors_updated_at
  BEFORE UPDATE ON public.monitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Consolidated: Notifications enhancements (columns, indexes, view)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_message_id ON public.notifications(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON public.notifications(channel);

ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE OR REPLACE VIEW public.notification_history AS
SELECT 
  id,
  monitor_id,
  user_id,
  type,
  channel,
  message,
  status,
  error_message,
  message_id,
  COALESCE(created_at, sent_at) as created_at,
  sent_at
FROM public.notifications
ORDER BY COALESCE(created_at, sent_at) DESC;

GRANT SELECT ON public.notification_history TO authenticated;

COMMIT;
