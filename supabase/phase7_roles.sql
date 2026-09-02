-- ============================================================
-- PHÂN CẤP VAI TRÒ AgriCommunity (farmer / admin_v1 / admin_v0)
-- Thay boolean is_admin đơn thuần bằng hệ thống vai trò nhiều tầng.
-- GIỮ NGUYÊN cột is_admin (tương thích toàn bộ RLS/UI đang dùng) — đồng bộ tự động.
-- Vai trò: farmer < admin_v1 (duyệt bài + xem thống kê) < admin_v0 (toàn quyền).
-- ============================================================

-- 1) Cột vai trò trên profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_role TEXT NOT NULL DEFAULT 'farmer'
  CHECK (user_role IN ('farmer', 'admin_v1', 'admin_v0'));

-- Set backfill: nếu is_admin=true trước đây nhưng chưa có role → mặc định admin_v0
-- (để những tài khoản admin hiện hữu không mất quyền). Đổi sau nếu muốn V1.
UPDATE public.profiles SET user_role = 'admin_v0'
WHERE is_admin = true AND user_role = 'farmer';

-- 2) Hàm hỗ trợ vai trò (SECURITY DEFINER, tránh đệ quy)
-- is_admin(): true nếu là admin (V1 hoặc V0). Dùng cho duyệt bài + thống kê.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_role IN ('admin_v1','admin_v0'));
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- is_admin_v0(): true nếu là toàn quyền. Dùng cho KB/MRL/phân quyền (chỉ V0).
CREATE OR REPLACE FUNCTION public.is_admin_v0()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_role = 'admin_v0');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3) Trigger: đồng bộ is_admin theo user_role (giữ cột cũ đúng -> không vỡ tương thích)
CREATE OR REPLACE FUNCTION public.sync_is_admin_from_role()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_admin := (NEW.user_role IN ('admin_v1','admin_v0'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_is_admin_from_role ON public.profiles;
CREATE TRIGGER sync_is_admin_from_role
  BEFORE INSERT OR UPDATE OF user_role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_is_admin_from_role();

-- 4) Cập nhật policy (tách quyền):
--   - Duyệt bài (posts): is_admin() → V1 + V0 đều duyệt được.
--   - Quản trị hệ thống (MRL/KB/knowledge/regulatory/phân quyền): is_admin_v0() → chỉ V0.

-- POSTS: giữ is_admin() (V1+V0) — không đổi.

-- EXPORT STANDARDS (MRL): chỉ V0 sửa. Mọi người vẫn xem.
DROP POLICY IF EXISTS "Chỉ Admin sửa đổi tiêu chuẩn" ON public.export_standards;
CREATE POLICY "Chỉ Admin V0 sửa đổi tiêu chuẩn" ON public.export_standards FOR ALL USING (public.is_admin_v0());

-- KB ENTRIES (phase4_kb): chỉ V0.
DROP POLICY IF EXISTS "Admin/Expert quản lý KB" ON public.kb_entries;
CREATE POLICY "Admin V0 quản lý KB" ON public.kb_entries FOR ALL USING (public.is_admin_v0());

-- RAW ARTICLES: chỉ V0.
DROP POLICY IF EXISTS "Admin/Expert quản lý bài thô" ON public.raw_articles;
CREATE POLICY "Admin V0 quản lý bài thô" ON public.raw_articles FOR ALL USING (public.is_admin_v0());

-- CROP KNOWLEDGE: chỉ V0.
DROP POLICY IF EXISTS "Admin sửa kiến thức" ON public.crop_knowledge;
CREATE POLICY "Admin V0 sửa kiến thức" ON public.crop_knowledge FOR ALL USING (public.is_admin_v0());

-- REGULATORY REFERENCES: chỉ V0.
DROP POLICY IF EXISTS "Admin sửa nguồn pháp lý" ON public.regulatory_references;
CREATE POLICY "Admin V0 sửa nguồn pháp lý" ON public.regulatory_references FOR ALL USING (public.is_admin_v0());

-- PROFILES phân quyền: chỉ V0 được sửa mọi hồ sơ (không cho V1/ farmer tự nâng).
DROP POLICY IF EXISTS "Admin cập nhật mọi hồ sơ" ON public.profiles;
CREATE POLICY "Admin V0 cập nhật mọi hồ sơ" ON public.profiles FOR UPDATE
  USING (public.is_admin_v0())
  WITH CHECK (public.is_admin_v0());

-- 5) Trigger chống tự nâng quyền (defense-in-depth): cho phép auth.uid()=NULL (dashboard) hoặc admin_v0.
--    Chặn farmer/ V1 tự đổi user_role lên cấp cao hơn.
CREATE OR REPLACE FUNCTION public.prevent_is_admin_change()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- dashboard / SQL editor / service role
  END IF;
  -- Có phiên người dùng:
  IF NEW.user_role IS DISTINCT FROM OLD.user_role THEN
    IF NOT public.is_admin_v0() THEN
      RAISE EXCEPTION 'Chỉ Admin V0 được đổi vai trò (user_role).';
    END IF;
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.is_admin_v0() THEN
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
