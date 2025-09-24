-- =============================================================
-- Script: 20240101000002_update_notifications_table.sql
-- Purpose: Extend notifications for SMS, tracking, and create helper view
-- Safety: Idempotent; uses IF NOT EXISTS and OR REPLACE
-- Notes: RLS is on base table; views don't support RLS. Use grants instead.
-- =============================================================

BEGIN;

-- Update notifications table to support SMS notifications and enhanced tracking
-- Add new columns for better notification tracking

-- Add error_message column for tracking notification failures
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add message_id column for tracking external service message IDs (like Twilio SID)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS message_id TEXT;

-- Update channel column to support 'sms' type (it already supports text, so this is just documentation)
-- The channel column already exists and supports text values like 'email', 'sms', 'webhook', etc.

-- Add index for message_id for faster lookups when checking delivery status
CREATE INDEX IF NOT EXISTS idx_notifications_message_id ON public.notifications(message_id) WHERE message_id IS NOT NULL;

-- Add index for status for faster filtering
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);

-- Add index for channel type for faster filtering
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON public.notifications(channel);

-- Update the sent_at column to be created_at for consistency (optional, keeping sent_at for backward compatibility)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a view for easier notification querying with better column names
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

-- Grant access to the view (visibility still constrained by base-table RLS)
GRANT SELECT ON public.notification_history TO authenticated;

-- Note: RLS does not apply to views directly; do not create policies on views.

-- Quick verification queries
-- SELECT * FROM public.notification_history LIMIT 5;
-- SELECT * FROM public.notifications ORDER BY created_at DESC NULLS LAST LIMIT 5;

COMMIT;