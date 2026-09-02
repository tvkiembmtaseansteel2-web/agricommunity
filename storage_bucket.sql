-- ============================================================
-- AgriCommunity — Tạo Storage bucket 'farm-images' + Policies
-- Cách dùng: Supabase Dashboard → SQL Editor → dán → Run
-- (An toàn chạy lại nhiều lần: các lệnh đều idempotent)
-- ============================================================

-- 1. Tạo bucket công khai (nếu chưa tồn tại)
INSERT INTO storage.buckets (id, name, public)
VALUES ('farm-images', 'farm-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Ai cũng xem được ảnh công khai
DROP POLICY IF EXISTS "Mọi người xem ảnh vườn công khai" ON storage.objects;
CREATE POLICY "Mọi người xem ảnh vườn công khai"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'farm-images');

-- 3. Thành viên đã đăng nhập được upload ảnh
DROP POLICY IF EXISTS "Thành viên upload ảnh vườn" ON storage.objects;
CREATE POLICY "Thành viên upload ảnh vườn"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'farm-images' AND auth.role() = 'authenticated');

-- 4. Chủ ảnh được xóa ảnh của mình
DROP POLICY IF EXISTS "Chủ ảnh xóa ảnh của mình" ON storage.objects;
CREATE POLICY "Chủ ảnh xóa ảnh của mình"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'farm-images' AND owner = auth.uid());

-- 5. Cho phép xem thông tin bucket (để app kiểm tra bucket tồn tại)
DROP POLICY IF EXISTS "Mọi người xem bucket farm-images" ON storage.buckets;
CREATE POLICY "Mọi người xem bucket farm-images"
    ON storage.buckets FOR SELECT
    USING (id = 'farm-images');

-- Kiểm tra: chạy lệnh dưới để xem bucket (sẽ trả về 1 dòng farm-images)
-- select id, name, public from storage.buckets where id = 'farm-images';
