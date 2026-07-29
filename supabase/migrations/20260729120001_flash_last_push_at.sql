-- +goose Up
-- Coluna para throttle de re-push no redispatch da Corrida Flash.

ALTER TABLE public.trip_driver_candidates
  ADD COLUMN IF NOT EXISTS last_push_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tdc_pending_last_push
  ON public.trip_driver_candidates(trip_id, last_push_at)
  WHERE status = 'pending';

-- +goose Down
DROP INDEX IF EXISTS public.idx_tdc_pending_last_push;
ALTER TABLE public.trip_driver_candidates DROP COLUMN IF EXISTS last_push_at;
