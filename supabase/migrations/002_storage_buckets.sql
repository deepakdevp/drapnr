-- ============================================================================
-- Drapnr: Storage Buckets
-- ============================================================================

-- =========================
-- Bucket: frames (private, 10MB max)
-- =========================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('frames', 'frames', false, 10485760);

-- =========================
-- Bucket: textures (public, 1MB max)
-- =========================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('textures', 'textures', true, 1048576);

-- =========================
-- Bucket: thumbnails (public, 500KB max)
-- =========================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('thumbnails', 'thumbnails', true, 524288);

-- ============================================================================
-- Storage RLS Policies
-- ============================================================================

-- -------------------------
-- frames: users can upload/read/delete within their own folder (uid/*)
-- -------------------------
CREATE POLICY "frames_insert_own" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'frames'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "frames_select_own" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'frames'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "frames_delete_own" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'frames'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- -------------------------
-- textures: owner can upload/delete, anyone authenticated can read (public bucket)
-- -------------------------
CREATE POLICY "textures_insert_own" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'textures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "textures_select_own" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'textures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "textures_delete_own" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'textures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- -------------------------
-- thumbnails: owner can upload/delete, anyone authenticated can read (public bucket)
-- -------------------------
CREATE POLICY "thumbnails_insert_own" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "thumbnails_select_own" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "thumbnails_delete_own" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
