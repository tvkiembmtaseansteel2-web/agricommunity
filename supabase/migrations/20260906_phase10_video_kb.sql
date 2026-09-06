-- ============================================================================
-- Phase 10: Nguồn YouTube + kiểm chứng KB (PoC)
-- ----------------------------------------------------------------------------
-- 1) video_sources: danh sách kênh được phép (whitelist) + điểm tin cậy.
-- 2) raw_articles thêm cột source_credibility (điểm tin cậy nguồn) + manual_verified.
-- 3) kb_entries thêm cột source_credibility + cross_source_url (bằng chứng nguồn thứ 2).
-- ============================================================================

-- 1) Bảng nguồn video (whitelist kênh uy tín)
CREATE TABLE IF NOT EXISTS public.video_sources (
    id BIGSERIAL PRIMARY KEY,
    channel_name TEXT NOT NULL,          -- Tên kênh
    channel_url TEXT,                    -- Link kênh
    organization TEXT,                   -- Tổ chức chủ kênh (WASI, ĐH Nông Lâm, khuyến nông...)
    credibility_score INT NOT NULL DEFAULT 2, -- 0=không rõ, 1=thương mại (thấp), 2=uy tín, 3=chính thống (viện/trường)
    notes TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.video_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mọi người xem kênh đang bật" ON public.video_sources FOR SELECT USING (enabled = true);
CREATE POLICY "Admin quản lý kênh" ON public.video_sources FOR ALL USING (public.is_admin());

-- 2) raw_articles — thêm điểm tin cậy + cờ xác minh
ALTER TABLE public.raw_articles ADD COLUMN IF NOT EXISTS source_credibility INT DEFAULT 0;
ALTER TABLE public.raw_articles ADD COLUMN IF NOT EXISTS manual_verified BOOLEAN DEFAULT false;

-- 3) kb_entries — thêm bằng chứng nguồn (chống đưa thông tin chưa kiểm chứng vào AI)
ALTER TABLE public.kb_entries ADD COLUMN IF NOT EXISTS source_credibility INT DEFAULT 0;
ALTER TABLE public.kb_entries ADD COLUMN IF NOT EXISTS cross_source_url TEXT; -- nguồn thứ 2 xác nhận
