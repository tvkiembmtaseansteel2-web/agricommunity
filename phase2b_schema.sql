-- ============================================================
-- AgriCommunity — Phase 2 (tiếp): Bảng notifications
-- Thông báo cho nông dân khi bài đăng được admin duyệt/từ chối
-- Cách dùng: Supabase Dashboard → SQL Editor → dán → Run
-- (An toàn chạy lại nhiều lần)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Người nhận
    title TEXT NOT NULL, -- Tiêu đề: "Bài đăng đã được duyệt"
    body TEXT, -- Nội dung chi tiết
    link TEXT, -- Đường dẫn (ví dụ tab community)
    read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index truy vấn nhanh theo người nhận
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON public.notifications(profile_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Người dùng xem thông báo của chính mình
DROP POLICY IF EXISTS "Xem thông báo của mình" ON public.notifications;
CREATE POLICY "Xem thông báo của mình"
    ON public.notifications FOR SELECT
    USING (auth.uid() = profile_id);

-- (Thông báo được tạo bởi admin qua client; cần policy insert cho admin)
DROP POLICY IF EXISTS "Admin tạo thông báo" ON public.notifications;
CREATE POLICY "Admin tạo thông báo"
    ON public.notifications FOR INSERT
    WITH CHECK (public.is_admin() OR auth.uid() = profile_id);

-- Người dùng đánh dấu đã đọc thông báo của mình
DROP POLICY IF EXISTS "Đánh dấu đã đọc" ON public.notifications;
CREATE POLICY "Đánh dấu đã đọc"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Người dùng xóa thông báo của mình
DROP POLICY IF EXISTS "Xóa thông báo của mình" ON public.notifications;
CREATE POLICY "Xóa thông báo của mình"
    ON public.notifications FOR DELETE
    USING (auth.uid() = profile_id);
