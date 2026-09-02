-- ============================================================
-- AgriCommunity — Phase 2 (tiếp): Cảnh báo hoạt chất cấm trong bài đăng
-- Cách dùng: Supabase Dashboard → SQL Editor → dán → Run
-- (An toàn chạy lại nhiều lần)
-- ============================================================

-- Thêm cột cảnh báo hoạt chất cấm vào bảng posts (nếu chưa có)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS flagged_chemical TEXT;
-- Giá trị: NULL (không phát hiện) hoặc tên hoạt chất cấm bị phát hiện trong nội dung

-- Index để admin lọc bài có cảnh báo
CREATE INDEX IF NOT EXISTS idx_posts_flagged ON public.posts(flagged_chemical) WHERE flagged_chemical IS NOT NULL;
