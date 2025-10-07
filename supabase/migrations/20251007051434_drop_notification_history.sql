-- Drop unused notification_history view (it is a view, not a table)
-- Safe to run multiple times
DROP VIEW IF EXISTS public.notification_history CASCADE;
