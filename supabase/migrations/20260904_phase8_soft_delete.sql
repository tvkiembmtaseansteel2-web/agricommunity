-- ============================================================================
-- Phase 8: Soft-delete cho bảng quan trọng (gardens, logs, yields)
-- ----------------------------------------------------------------------------
-- Mục đích: chống mất dữ liệu do người dùng/admin xóa nhầm. Thay vì DELETE,
-- ta đánh dấu deleted_at. Người dùng chỉ thấy/sửa row còn hoạt động.
-- Bảng bị ẩn khi deleted_at IS NOT NULL (RLS), nhưng có thể khôi phục được.
-- ============================================================================

-- 1) Thêm cột deleted_at (timestamptz, NULL = còn hoạt động) cho 3 bảng
ALTER TABLE public.gardens ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.yields ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2) Chỉ mục để truy vấn nhanh "còn hoạt động"
CREATE INDEX IF NOT EXISTS idx_gardens_active ON public.gardens (profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_logs_active ON public.logs (profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_yields_active ON public.yields (profile_id) WHERE deleted_at IS NULL;

-- 3) Hàm soft-delete dùng chung: đặt deleted_at = now() (không xóa thật)
CREATE OR REPLACE FUNCTION public.soft_delete(table_name text, row_id bigint, owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ok boolean;
BEGIN
    EXECUTE format('UPDATE %I SET deleted_at = now() WHERE id = $1 AND profile_id = $2 RETURNING id', table_name)
      INTO ok USING row_id, owner_id;
    IF ok IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy bản ghi hoặc không có quyền (id=% , profile_id=%)', row_id, owner_id;
    END IF;
END;
$$;

-- ============================================================================
-- 4) Điều chỉnh RLS: ẩn row đã soft-delete (deleted_at IS NULL)
-- ============================================================================

-- GARDENS
DROP POLICY IF EXISTS "Người dùng xem vườn của mình" ON public.gardens;
CREATE POLICY "Người dùng xem vườn của mình"
    ON public.gardens FOR SELECT
    USING (auth.uid() = profile_id AND deleted_at IS NULL);

-- LOGS
DROP POLICY IF EXISTS "Người dùng chỉ có thể xem nhật ký của mình" ON public.logs;
CREATE POLICY "Người dùng chỉ có thể xem nhật ký của mình"
    ON public.logs FOR SELECT
    USING (auth.uid() = profile_id AND deleted_at IS NULL);

-- YIELDS
DROP POLICY IF EXISTS "Nông dân xem sản lượng của mình" ON public.yields;
CREATE POLICY "Nông dân xem sản lượng của mình"
    ON public.yields FOR SELECT
    USING (auth.uid() = profile_id AND deleted_at IS NULL);
