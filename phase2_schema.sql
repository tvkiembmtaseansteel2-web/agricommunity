-- ============================================================
-- AgriCommunity — Phase 2: Bổ sung (không reset dữ liệu cũ)
-- 1) Cột tọa độ vườn (thời tiết theo vị trí)
-- 2) Bảng post_likes chống thích trùng
-- Cách dùng: Supabase Dashboard → SQL Editor → dán → Run
-- (An toàn chạy lại nhiều lần)
-- ============================================================

-- 1. Thêm cột tọa độ vườn vào profiles (nếu chưa có)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- 2. Bảng lượt thích bài đăng (chống thích trùng)
CREATE TABLE IF NOT EXISTS public.post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (post_id, profile_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Xem lượt thích bài đã duyệt" ON public.post_likes;
CREATE POLICY "Xem lượt thích bài đã duyệt"
    ON public.post_likes FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_likes.post_id AND posts.status = 'approved')
        OR auth.uid() = profile_id
    );

DROP POLICY IF EXISTS "Thành viên thích bài" ON public.post_likes;
CREATE POLICY "Thành viên thích bài"
    ON public.post_likes FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Thành viên bỏ thích" ON public.post_likes;
CREATE POLICY "Thành viên bỏ thích"
    ON public.post_likes FOR DELETE
    USING (auth.uid() = profile_id);
