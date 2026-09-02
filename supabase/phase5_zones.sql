-- ============================================================================
-- Phase A — Zone Management (theo Zone.md): Bác sĩ AI gắn Zone + Issue.
-- Không phá dữ liệu cũ: mở rộng schema hiện tại bằng ALTER ... IF NOT EXISTS.
-- ============================================================================

-- 1) GARDENS — hỗ trợ nhiều cây trồng (xen canh) + ranh giới vườn.
--    Giữ nguyên crop_type (đang chạy ổn) — thêm crop_types là mảng.
ALTER TABLE public.gardens
  ADD COLUMN IF NOT EXISTS crop_types JSONB DEFAULT '["sau_rieng"]'::jsonb,
  ADD COLUMN IF NOT EXISTS boundary_polygon JSONB,   -- [[lat,lng],[lat,lng],...]
  ADD COLUMN IF NOT EXISTS center_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS center_lng NUMERIC;

-- 2) ZONES — các khu vực trong vườn (A/B/C/D/E). Không lưu màu (trạng thái tính sau).
CREATE TABLE IF NOT EXISTS public.zones (
    id BIGSERIAL PRIMARY KEY,
    garden_id BIGINT REFERENCES public.gardens(id) ON DELETE CASCADE NOT NULL,
    name TEXT,                 -- Ví dụ: "Khu trên"
    code TEXT NOT NULL,        -- A/B/C/D/E (bắt buộc để gắn dữ liệu)
    polygon JSONB,             -- [[lat,lng],...] — phải NẰM TRONG garden polygon
    area_m2 NUMERIC,
    center_lat NUMERIC,
    center_lng NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (garden_id, code)
);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- Chỉ chủ vườn mới xem/sửa/xóa zone của vườn mình (qua garden → profile)
DROP POLICY IF EXISTS "Chủ vườn xem zone" ON public.zones;
CREATE POLICY "Chủ vườn xem zone" ON public.zones FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.gardens WHERE gardens.id = zones.garden_id AND gardens.profile_id = auth.uid()));
DROP POLICY IF EXISTS "Chủ vườn thêm zone" ON public.zones;
CREATE POLICY "Chủ vườn thêm zone" ON public.zones FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.gardens WHERE gardens.id = zones.garden_id AND gardens.profile_id = auth.uid()));
DROP POLICY IF EXISTS "Chủ vườn sửa zone" ON public.zones;
CREATE POLICY "Chủ vườn sửa zone" ON public.zones FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.gardens WHERE gardens.id = zones.garden_id AND gardens.profile_id = auth.uid()));
DROP POLICY IF EXISTS "Chủ vườn xóa zone" ON public.zones;
CREATE POLICY "Chủ vườn xóa zone" ON public.zones FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.gardens WHERE gardens.id = zones.garden_id AND gardens.profile_id = auth.uid()));

-- 3) ISSUES — vấn đề ghi nhận từ Bác sĩ AI (hoặc tay). AI không tự khẳng định bệnh 100%.
CREATE TABLE IF NOT EXISTS public.issues (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    garden_id BIGINT REFERENCES public.gardens(id) ON DELETE CASCADE,
    zone_id BIGINT REFERENCES public.zones(id) ON DELETE SET NULL,
    issue_type TEXT,           -- ví dụ: "Bệnh/nấm lá" (từ ai_result.diagnosis)
    description TEXT,          -- mô tả triệu chứng người dùng nhập
    photo TEXT,                -- URL hoặc base64 ảnh (có thể rỗng)
    latitude NUMERIC,          -- GPS lúc chụp/gửi
    longitude NUMERIC,
    ai_result JSONB,           -- JSON đầy đủ từ Gemini: {diagnosis, confidence, protocol,...}
    confidence TEXT,           -- cao / trung_binh / thap
    status TEXT DEFAULT 'NEEDS_REVIEW' NOT NULL, -- NEEDS_REVIEW / CONFIRMED / TREATING / RESOLVED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_issues_garden ON public.issues(garden_id);
CREATE INDEX IF NOT EXISTS idx_issues_zone ON public.issues(zone_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chủ vườn xem issue" ON public.issues;
CREATE POLICY "Chủ vườn xem issue" ON public.issues FOR SELECT USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Chủ vườn thêm issue" ON public.issues;
CREATE POLICY "Chủ vườn thêm issue" ON public.issues FOR INSERT WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Chủ vườn sửa issue" ON public.issues;
CREATE POLICY "Chủ vườn sửa issue" ON public.issues FOR UPDATE USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Chủ vườn xóa issue" ON public.issues;
CREATE POLICY "Chủ vườn xóa issue" ON public.issues FOR DELETE USING (auth.uid() = profile_id);

-- 4) LOGS — nâng cấp để ghi nhật ký theo phạm vi toàn vườn hoặc từng Zone.
ALTER TABLE public.logs
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'GARDEN',   -- GARDEN / ZONES
  ADD COLUMN IF NOT EXISTS zone_ids BIGINT[];             -- [] = toàn vườn

-- (Tuỳ chọn) thêm hoạt động "làm cỏ" — chỉ khi có CHECK constraint trên activity_type
-- ALTER TABLE public.logs DROP CONSTRAINT IF EXISTS logs_activity_type_check;
-- ALTER TABLE public.logs ADD CONSTRAINT logs_activity_type_check CHECK (activity_type IN ('bon_phan','phun_thuoc','tuoi_nuoc','cat_tia','lam_co','khac'));
