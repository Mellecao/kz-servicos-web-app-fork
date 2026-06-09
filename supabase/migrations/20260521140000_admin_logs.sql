-- +goose Up
CREATE TABLE admin_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id     UUID        DEFAULT auth.uid() NOT NULL REFERENCES users(id),
  action       TEXT        NOT NULL,
  entity_type  TEXT        NOT NULL DEFAULT 'trip',
  entity_id    UUID,
  details      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read logs"
  ON admin_logs FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins can insert logs"
  ON admin_logs FOR INSERT
  WITH CHECK (public.get_user_role() = 'admin');

CREATE INDEX idx_admin_logs_created_at ON admin_logs (created_at DESC);
CREATE INDEX idx_admin_logs_admin_id   ON admin_logs (admin_id);

-- +goose Down
DROP TABLE IF EXISTS admin_logs;
