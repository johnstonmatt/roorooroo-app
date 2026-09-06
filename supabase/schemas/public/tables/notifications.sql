CREATE TABLE "public"."notifications" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "monitor_id"    uuid                     NOT NULL,
  "user_id"       uuid                     NOT NULL,
  "type"          text                     NOT NULL,
  "channel"       text                     NOT NULL,
  "message"       text                     NOT NULL,
  "sent_at"       timestamp with time zone DEFAULT now(),
  "status"        text                     NOT NULL DEFAULT 'sent'::text,
  "error_message" text,
  "message_id"    text,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "notifications_monitor_id_fkey" FOREIGN KEY (monitor_id) REFERENCES public.monitors(id) ON DELETE CASCADE,
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."notifications"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_channel ON public.notifications USING btree (channel);

CREATE INDEX idx_notifications_message_id ON public.notifications USING btree (message_id)
  WHERE (message_id IS NOT NULL);

CREATE INDEX idx_notifications_monitor_id ON public.notifications USING btree (monitor_id);

CREATE INDEX idx_notifications_status ON public.notifications USING btree (status);

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);

CREATE POLICY "notifications_insert_own" ON "public"."notifications"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "notifications_select_own" ON "public"."notifications"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."notifications" FROM "anon";

GRANT MAINTAIN, SELECT ON TABLE "public"."notifications" TO "anon";

REVOKE ALL ON TABLE "public"."notifications" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."notifications" TO "authenticated";
