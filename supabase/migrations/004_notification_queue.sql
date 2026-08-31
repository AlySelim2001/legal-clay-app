-- ============================================================
-- CRIM-SYS 2026 — Migration 004: Notification Queue
-- ============================================================

CREATE TABLE public.notification_queue (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id        uuid NOT NULL REFERENCES public.schedule(id),
  notification_type  text NOT NULL CHECK (notification_type IN ('7d', '1d', 'today')),
  message            text NOT NULL,
  sent               boolean NOT NULL DEFAULT false,
  sent_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_queue_pending
  ON public.notification_queue (created_at)
  WHERE sent = false;

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_notification_queue"
  ON public.notification_queue FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
