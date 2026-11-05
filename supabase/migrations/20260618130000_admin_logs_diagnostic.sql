-- ============================================================================
-- Migration: Create admin_logs table
-- Description: Test sem seção Down para verificar se a hipótese de goose
--   rodando Down junto com Up está certa.
-- ============================================================================

-- +goose Up

CREATE TABLE public.admin_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id     UUID        DEFAULT auth.uid() NOT NULL REFERENCES public.users(id),
  action       TEXT        NOT NULL,
  entity_type  TEXT        NOT NULL DEFAULT 'trip',
  entity_id    UUID,
  details      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_logs_select" ON public.admin_logs
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin'::user_role);

CREATE POLICY "admin_logs_insert" ON public.admin_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin'::user_role);

CREATE INDEX idx_admin_logs_created_at ON public.admin_logs (created_at DESC);
CREATE INDEX idx_admin_logs_admin_id   ON public.admin_logs (admin_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_logs TO authenticated;
GRANT SELECT ON TABLE public.admin_logs TO anon;
GRANT ALL ON TABLE public.admin_logs TO service_role;

NOTIFY pgrst, 'reload schema';
