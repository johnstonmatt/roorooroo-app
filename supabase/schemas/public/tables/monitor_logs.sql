CREATE TABLE "public"."monitor_logs" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "monitor_id"      uuid                     NOT NULL,
  "status"          text                     NOT NULL,
  "response_time"   integer,
  "error_message"   text,
  "content_snippet" text,
  "checked_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "monitor_logs_pkey" PRIMARY KEY (id),
  CONSTRAINT "monitor_logs_monitor_id_fkey" FOREIGN KEY (monitor_id) REFERENCES public.monitors(id) ON DELETE CASCADE
);

ALTER TABLE "public"."monitor_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_monitor_logs_checked_at ON public.monitor_logs USING btree (checked_at);

CREATE INDEX idx_monitor_logs_monitor_id ON public.monitor_logs USING btree (monitor_id);

CREATE POLICY "monitor_logs_insert_system" ON "public"."monitor_logs"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.monitors
  WHERE ((monitors.id = monitor_logs.monitor_id) AND (monitors.user_id = auth.uid())))));

CREATE POLICY "monitor_logs_select_own" ON "public"."monitor_logs"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.monitors
  WHERE ((monitors.id = monitor_logs.monitor_id) AND (monitors.user_id = auth.uid())))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."monitor_logs" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."monitor_logs" FROM "anon";

GRANT MAINTAIN, SELECT ON TABLE "public"."monitor_logs" TO "anon";

REVOKE ALL ON TABLE "public"."monitor_logs" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."monitor_logs" TO "authenticated";
