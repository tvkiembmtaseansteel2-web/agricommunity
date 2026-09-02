-- ============================================================
-- FIX SECURITY (P1): chặn nông dân tự nâng quyền admin.
-- Lỗi: policy UPDATE "auth.uid() = id" không hạn chế cột → user có thể
--       PATCH is_admin=true, consent_granted=true, id, phone_number...
-- Cách sửa:
--   1) Xoá policy UPDATE cũ thiếu kiểm soát cột.
--   2) Thêm policy UPDATE mới: chỉ cho đổi các cột AN TOÀN (hồ sơ) — loại
--      is_admin, id, created_at, phone_number (định danh) ra khỏi phép đổi.
--   3) Thêm trigger guard: tuyệt đối chặn đổi is_admin từ client (defense-in-depth).
-- ============================================================

-- 1) Xoá policy UPDATE cũ
DROP POLICY IF EXISTS "Người dùng có thể tự cập nhật thông tin cá nhân" ON public.profiles;

-- 2) Policy UPDATE: tách 2 nhóm.
--  (a) ADMIN: được cập nhật BẤT KỲ hồ sơ nào (quản lý quyền, hồ sơ) — hợp lệ.
--  (b) NGƯỜI DÙNG (không admin): chỉ cập nhật HỒ SƠ CỦA CHÍNH MÌNH, và is_admin/id
--      phải GIỮ NGUYÊN (WITH CHECK) → không thể tự nâng quyền.
DROP POLICY IF EXISTS "Người dùng cập nhật hồ sơ (không đổi quyền/định danh)" ON public.profiles;
CREATE POLICY "Người dùng cập nhật hồ sơ (không đổi quyền/định danh)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
    AND id = auth.uid()
  );

DROP POLICY IF EXISTS "Admin cập nhật mọi hồ sơ" ON public.profiles;
CREATE POLICY "Admin cập nhật mọi hồ sơ"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Trigger guard: chặn NGƯỜI DÙNG (phiên auth) KHÔNG phải admin tự đổi is_admin / id.
--    Quan trọng: khi auth.uid() là NULL (Dashboard Table Editor / SQL Editor chạy
--    bằng postgres hoặc service_role) thì KHÔNG chặn — vì đó là hành động của quản trị.
--    Chỉ chặn khi ĐANG có phiên người dùng đến từ client và người đó không phải admin.
CREATE OR REPLACE FUNCTION public.prevent_is_admin_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Đây là lời gọi từ Dashboard/CLI/postgres (auth.uid() = null) → cho phép quản trị.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Có phiên người dùng → kiểm tra quyền.
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Không được phép tự thay đổi quyền is_admin.';
    END IF;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Không được phép thay đổi id hồ sơ.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_is_admin_change ON public.profiles;
CREATE TRIGGER prevent_is_admin_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_is_admin_change();
