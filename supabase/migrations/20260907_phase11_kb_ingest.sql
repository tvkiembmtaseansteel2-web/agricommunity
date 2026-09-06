-- ============================================================================
-- Phase 11: Hỗ trợ kb-ingest (raw_articles → kb_entries tự động)
-- ----------------------------------------------------------------------------
-- 1) kb_entries.source_raw_id: đánh dấu bài raw_articles đã trích (tránh trùng).
-- 2) raw_articles thêm cột status mới 'ingested' (dùng để đánh dấu đã xử lý).
-- ============================================================================

ALTER TABLE public.kb_entries ADD COLUMN IF NOT EXISTS source_raw_id BIGINT;
-- Chỉ mục để tìm nhanh bài đã trích
CREATE INDEX IF NOT EXISTS idx_kb_source_raw ON public.kb_entries(source_raw_id);

-- raw_articles thêm giá trị trạng thái 'ingested' (không ràng buộc cứng để
-- không phá dữ liệu cũ; chỉ dùng như cờ đánh dấu đã qua pipeline).
-- (Check constraint cũ chỉ cho draft/in_review/approved/rejected/published — ta nới thêm)
DO $$ BEGIN
  ALTER TABLE public.raw_articles DROP CONSTRAINT IF EXISTS raw_articles_status_check;
  ALTER TABLE public.raw_articles ADD CONSTRAINT raw_articles_status_check
    CHECK (status IN ('draft','in_review','approved','rejected','published','ingested'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
