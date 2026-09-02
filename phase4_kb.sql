-- ============================================================
-- AgriCommunity — PRD: Hệ thống Quản trị Tri thức (Knowledge Base)
-- Schema chuẩn hóa theo cấu trúc PRD Mục 2.
-- Lưu ý Coder: active_ingredients TÁCH RIÊNG (mảng) để map với
-- danh mục sản phẩm thuốc BVTV thương mại sau này.
-- Cách dùng: Supabase Dashboard → SQL Editor → dán → Run (idempotent)
-- ============================================================

-- 1. BẢNG TRI THỨC KB (Published — dữ liệu chuẩn hóa, đã duyệt)
CREATE TABLE IF NOT EXISTS public.kb_entries (
    id BIGSERIAL PRIMARY KEY,
    plant_type TEXT NOT NULL,          -- cafe / sau_rieng / ho_tieu
    category TEXT NOT NULL,            -- sau_hat | benh_hat | dinh_duong | dat
    target_part TEXT NOT NULL,         -- la / qua / than / canh / re / toan_than
    problem_name TEXT NOT NULL,        -- Tên phổ thông (vd: Thán thư)
    scientific_name TEXT,              -- Tên khoa học (vd: Colletotrichum gloeosporioides)
    agents TEXT,                       -- Nấm / Vi khuẩn / Tuyến trùng / Côn trùng / Thiếu vi lượng...
    symptoms_description TEXT,         -- Mô tả chi tiết triệu chứng
    symptoms_images TEXT[],            -- Danh sách URL ảnh triệu chứng
    severity_levels TEXT,              -- Nhẹ / Trung bình / Nặng
    farming_method TEXT,               -- Biện pháp canh tác
    biological_method TEXT,            -- Biện pháp sinh học
    active_ingredients TEXT[],         -- [TÁCH RIÊNG] mảng hoạt chất khuyến cáo
    dosage_notes TEXT,                 -- Lưu ý cách phun, thời gian cách ly (PHI)
    source_url TEXT,                   -- Link nguồn thu thập
    source_name TEXT,                  -- Tên nguồn (wasi, khuyennongvn...)
    verified_by UUID,                  -- ID chuyên gia phê duyệt
    status TEXT DEFAULT 'published' NOT NULL, -- published (dữ liệu đã duyệt, dùng cho AI/tra cứu)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: mọi người xem published; chỉ admin/expert sửa
ALTER TABLE public.kb_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mọi người xem KB đã duyệt" ON public.kb_entries;
CREATE POLICY "Mọi người xem KB đã duyệt" ON public.kb_entries FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "Admin/Expert quản lý KB" ON public.kb_entries;
CREATE POLICY "Admin/Expert quản lý KB" ON public.kb_entries FOR ALL USING (public.is_admin());

-- 2. BẢNG BÀI VIẾT THÔ NGUỒN (Raw Articles — hàng đợi duyệt, mục 4 Bước 1)
-- Nhận bài viết từ crawler (sau này) hoặc dán tay; chỉ là dữ liệu thô.
CREATE TABLE IF NOT EXISTS public.raw_articles (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    source_url TEXT,
    source_name TEXT,                  -- ppd.gov.vn, khuyennongvn.gov.vn, wasi.org.vn...
    raw_content TEXT,                  -- Nội dung thô (bóc tách được)
    matched_keywords TEXT[],           -- Từ khóa phát hiện (Cà phê, Sầu riêng, Tiêu...)
    status TEXT DEFAULT 'draft' NOT NULL, -- draft | in_review | approved | rejected | published
    assigned_editor UUID,              -- Biên tập viên gán cấu trúc
    reviewer_id UUID,                  -- Chuyên gia xác thực
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.raw_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mọi người xem bài thô đã duyệt" ON public.raw_articles;
CREATE POLICY "Mọi người xem bài thô đã duyệt" ON public.raw_articles FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "Admin/Expert quản lý bài thô" ON public.raw_articles;
CREATE POLICY "Admin/Expert quản lý bài thô" ON public.raw_articles FOR ALL USING (public.is_admin());

-- 3. INDEX
CREATE INDEX IF NOT EXISTS idx_kb_plant ON public.kb_entries(plant_type, category);
CREATE INDEX IF NOT EXISTS idx_kb_status ON public.kb_entries(status);
CREATE INDEX IF NOT EXISTS idx_raw_status ON public.raw_articles(status);

-- 4. Thêm cột is_expert vào profiles (phân quyền Chuyên gia — mục 4 Bước 3)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_expert BOOLEAN DEFAULT false;
