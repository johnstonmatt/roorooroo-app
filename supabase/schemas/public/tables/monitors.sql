CREATE TABLE "public"."monitors" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"               uuid                     NOT NULL,
  "name"                  text                     NOT NULL,
  "url"                   text                     NOT NULL,
  "pattern"               text                     NOT NULL,
  "pattern_type"          text                     NOT NULL DEFAULT 'contains'::text,
  "check_interval"        integer                  NOT NULL DEFAULT 300,
  "is_active"             boolean                  NOT NULL DEFAULT true,
  "last_checked"          timestamp with time zone,
  "last_status"           text                     DEFAULT 'pending'::text,
  "notification_channels" jsonb                    DEFAULT '[]'::jsonb,
  "created_at"            timestamp with time zone DEFAULT now(),
  "updated_at"            timestamp with time zone DEFAULT now(),
  CONSTRAINT "monitors_pkey" PRIMARY KEY (id),
  CONSTRAINT "monitors_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."monitors"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_monitors_active ON public.monitors USING btree (is_active)
  WHERE (is_active = true);

CREATE INDEX idx_monitors_user_id ON public.monitors USING btree (user_id);

CREATE TRIGGER update_monitors_updated_at
  BEFORE UPDATE ON public.monitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "monitors_delete_own" ON "public"."monitors"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "monitors_insert_own" ON "public"."monitors"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "monitors_select_own" ON "public"."monitors"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "monitors_update_own" ON "public"."monitors"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."monitors" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."monitors" FROM "anon";

GRANT MAINTAIN, SELECT ON TABLE "public"."monitors" TO "anon";

REVOKE ALL ON TABLE "public"."monitors" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."monitors" TO "authenticated";
