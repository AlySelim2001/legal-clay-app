-- ============================================================
-- CRIM-SYS 2026 — Migration 006: Storage Bucket
-- ============================================================

-- Create the storage bucket for case attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-attachments',
  'case-attachments',
  false,  -- PRIVATE bucket, no public access
  20971520,  -- 20MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520;

-- ============================================================
-- Storage RLS Policies
-- ============================================================

-- Admin: full access to all files
CREATE POLICY "storage_admin_all_access"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'case-attachments'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'case-attachments'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );

-- Assistant: read + insert (upload) only, no delete
CREATE POLICY "storage_assistant_select_insert"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'case-attachments'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
    )
  );

CREATE POLICY "storage_assistant_insert_only"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'case-attachments'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
    )
  );
