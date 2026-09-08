-- ============================================================================
-- Phase 12: pgvector — tìm kiếm ngữ nghĩa cho KB (chuẩn bị KB lớn)
-- ----------------------------------------------------------------------------
-- 1) Bật extension pgvector.
-- 2) kb_entries.embedding vector(3072) (khớp gemini-embedding-001).
-- 3) Hàm match_kb_similarity(query_embedding, match_count) → top-k gần nhất.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Cột embedding cho kb_entries (đã published) — 3072 chiều từ gemini-embedding-001
ALTER TABLE public.kb_entries ADD COLUMN IF NOT EXISTS embedding vector(3072);

-- LƯU Ý: pgvector bản hiện tại giới hạn index ≤ 2000 chiều, trong khi vector 3072
-- (gemini-embedding-001) vượt giới hạn cho cả HNSW lẫn ivfflat.
-- → KHÔNG tạo index; dùng toán tử <=> (cosine) + quét tuần tự. Đủ nhanh cho KB
--   ~vài nghìn bản ghi. Khi KB rất lớn, cân nhắc model embedding ≥3072→1928 chiều
--   (clip) hoặc nâng cấp pgvector hỗ trợ chiều lớn hơn.

-- Hàm tìm kiếm ngữ nghĩa: trả về các kb_entries gần nhất theo cosine.
-- SECURITY DEFINER + riêng published để AI chỉ dùng dữ liệu đã duyệt.
CREATE OR REPLACE FUNCTION public.match_kb_similarity(query_embedding vector, match_count int DEFAULT 5)
RETURNS TABLE(id bigint, plant_type text, category text, problem_name text, scientific_name text, symptoms_description text, active_ingredients text[], dosage_notes text, similarity real)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    e.id, e.plant_type, e.category, e.problem_name, e.scientific_name,
    e.symptoms_description, e.active_ingredients, e.dosage_notes,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.kb_entries e
  WHERE e.status = 'published' AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;
