-- ============================================================
-- AgriCommunity — Phase 3: Garden entity (theo UX Blueprint)
-- 1) Bảng gardens (vườn = entity trung tâm)
-- 2) Cột garden_id cho logs + yields
-- Cách dùng: Supabase Dashboard → SQL Editor → dán → Run (idempotent)
-- ============================================================

-- 1. Bảng vườn
CREATE TABLE IF NOT EXISTS public.gardens (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    crop_type TEXT NOT NULL, -- cafe, sau_rieng, ho_tieu
    area_m2 NUMERIC,
    plant_count INT,
    plant_age_years INT,
    latitude NUMERIC,
    longitude NUMERIC,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.gardens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Người dùng xem vườn của mình" ON public.gardens;
CREATE POLICY "Người dùng xem vườn của mình" ON public.gardens FOR SELECT USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Người dùng thêm vườn" ON public.gardens;
CREATE POLICY "Người dùng thêm vườn" ON public.gardens FOR INSERT WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Người dùng sửa vườn của mình" ON public.gardens;
CREATE POLICY "Người dùng sửa vườn của mình" ON public.gardens FOR UPDATE USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Người dùng xóa vườn của mình" ON public.gardens;
CREATE POLICY "Người dùng xóa vườn của mình" ON public.gardens FOR DELETE USING (auth.uid() = profile_id);

-- 2. Cột garden_id cho logs + yields (tùy chọn, không phá dữ liệu cũ)
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS garden_id BIGINT REFERENCES public.gardens(id) ON DELETE SET NULL;
ALTER TABLE public.yields ADD COLUMN IF NOT EXISTS garden_id BIGINT REFERENCES public.gardens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_logs_garden ON public.logs(garden_id);
CREATE INDEX IF NOT EXISTS idx_yields_garden ON public.yields(garden_id);
