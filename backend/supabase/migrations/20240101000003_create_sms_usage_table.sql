-- =============================================================
-- Script: 20240101000003_create_sms_usage_table.sql
-- Purpose: Create sms_usage table, RLS, indexes, and triggers
-- Safety: Idempotent; uses IF NOT EXISTS and OR REPLACE
-- =============================================================

BEGIN;

-- Create SMS usage tracking table for rate limiting and cost monitoring
-- This table tracks SMS usage per user to implement rate limits and cost controls

CREATE TABLE IF NOT EXISTS public.sms_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Usage counters
  hourly_count INTEGER DEFAULT 0 NOT NULL,
  daily_count INTEGER DEFAULT 0 NOT NULL,
  monthly_count INTEGER DEFAULT 0 NOT NULL,
  
  -- Cost tracking
  monthly_cost_usd DECIMAL(10,4) DEFAULT 0 NOT NULL,
  
  -- Reset timestamps
  last_reset_hour TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_reset_day TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_reset_month TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure one record per user
  UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_usage_user_id ON public.sms_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_usage_monthly_cost ON public.sms_usage(monthly_cost_usd);
CREATE INDEX IF NOT EXISTS idx_sms_usage_updated_at ON public.sms_usage(updated_at);

-- Enable Row Level Security
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own usage data
DO $ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sms_usage' AND policyname = 'Users can view own SMS usage'
  ) THEN
    CREATE POLICY "Users can view own SMS usage" ON public.sms_usage
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $;

-- Policy: System can insert/update usage data (for rate limiting service)
-- Caution: This wide policy allows all authenticated users to manage all rows.
-- Prefer using service role (bypass RLS) from server, or restrict by auth.uid().
DO $ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sms_usage' AND policyname = 'System can manage SMS usage'
  ) THEN
    CREATE POLICY "System can manage SMS usage" ON public.sms_usage
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_sms_usage_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_sms_usage_updated_at ON public.sms_usage;
CREATE TRIGGER update_sms_usage_updated_at
  BEFORE UPDATE ON public.sms_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_usage_updated_at();

-- Add helpful comments
COMMENT ON TABLE public.sms_usage IS 'Tracks SMS usage per user for rate limiting and cost monitoring';
COMMENT ON COLUMN public.sms_usage.hourly_count IS 'Number of SMS sent in current hour';
COMMENT ON COLUMN public.sms_usage.daily_count IS 'Number of SMS sent in current day';
COMMENT ON COLUMN public.sms_usage.monthly_count IS 'Number of SMS sent in current month';
COMMENT ON COLUMN public.sms_usage.monthly_cost_usd IS 'Total SMS cost in USD for current month';

-- Quick verification queries
-- SELECT * FROM public.sms_usage WHERE user_id = auth.uid();

COMMIT;