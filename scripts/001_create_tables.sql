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
  type TEXT NOT NULL, -- 'pattern_found', 'pattern_lost', 'error'
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
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- Monitors policies
CREATE POLICY "monitors_select_own" ON public.monitors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "monitors_insert_own" ON public.monitors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "monitors_update_own" ON public.monitors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "monitors_delete_own" ON public.monitors FOR DELETE USING (auth.uid() = user_id);

-- Monitor logs policies
CREATE POLICY "monitor_logs_select_own" ON public.monitor_logs 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.monitors 
      WHERE monitors.id = monitor_logs.monitor_id 
      AND monitors.user_id = auth.uid()
    )
  );

CREATE POLICY "monitor_logs_insert_system" ON public.monitor_logs 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.monitors 
      WHERE monitors.id = monitor_logs.monitor_id 
      AND monitors.user_id = auth.uid()
    )
  );

-- Notifications policies
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON public.monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_active ON public.monitors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_monitor_logs_monitor_id ON public.monitor_logs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_logs_checked_at ON public.monitor_logs(checked_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_monitor_id ON public.notifications(monitor_id);
