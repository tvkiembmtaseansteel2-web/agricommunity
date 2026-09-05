-- ============================================================================
-- Phase 9: Hạn mức AI + phân gói (free/pro)
-- ----------------------------------------------------------------------------
-- 1) profiles.plan: 'free' | 'pro' (mặc định free). Admin bật PRO thủ công.
-- 2) Bảng ai_usage: đếm số lượt dùng AI/user/ngày → áp hạn mức.
-- 3) Hàm get_ai_usage_limit(plan): trả về hạn mức (free=5, pro=100).
-- 4) Hàm get_ai_quota(user_id): còn lại bao nhiêu lượt hôm nay.
-- 5) Hàm increment_ai_usage(user_id): ghi nhận 1 lượt (tự tạo dòng nếu chưa có).
--    SECURITY DEFINER để Edge Function đọc qua JWT an toàn.
-- ============================================================================

-- 1) Cột plan
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
COMMENT ON COLUMN public.profiles.plan IS 'Gói dịch vụ: free | pro (admin bật pro)';
-- Ràng buộc chặt (chống giá trị lạ)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free','pro'));
  END IF;
END $$;

-- 2) Bảng ai_usage
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    use_date DATE DEFAULT CURRENT_DATE NOT NULL,
    request_count INT NOT NULL DEFAULT 1,
    UNIQUE (profile_id, use_date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- User thấy & ghi được chỉ dữ liệu của mình (đếm lượt)
CREATE POLICY "ai_usage user xem của mình" ON public.ai_usage FOR SELECT USING (auth.uid() = profile_id);
-- Chặn insert/update trực tiếp qua API client (chỉ qua hàm SECURITY DEFINER)
CREATE POLICY "ai_usage user không tự chỉnh" ON public.ai_usage FOR INSERT WITH CHECK (false);
CREATE POLICY "ai_usage user không tự sửa" ON public.ai_usage FOR UPDATE USING (false);

-- 3) Hạn mức theo gói
CREATE OR REPLACE FUNCTION public.get_ai_usage_limit(p_plan TEXT)
RETURNS INT AS $$
  SELECT CASE
    WHEN p_plan = 'pro' THEN 100
    ELSE 5 -- free
  END;
$$ LANGUAGE sql STABLE;

-- 4) Số lượt ĐÃ dùng hôm nay của user
CREATE OR REPLACE FUNCTION public.get_ai_usage_today(p_user UUID)
RETURNS INT AS $$
  SELECT COALESCE((SELECT request_count FROM public.ai_usage
                   WHERE profile_id = p_user AND use_date = CURRENT_DATE), 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 5) Ghi nhận 1 lượt dùng (tạo dòng nếu chưa có; tăng nếu có) — SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user UUID)
RETURNS INT AS $$
DECLARE
  cur INT;
  lim INT;
BEGIN
  INSERT INTO public.ai_usage (profile_id, use_date, request_count)
  VALUES (p_user, CURRENT_DATE, 1)
  ON CONFLICT (profile_id, use_date)
  DO UPDATE SET request_count = public.ai_usage.request_count + 1
  RETURNING request_count INTO cur;

  SELECT public.get_ai_usage_limit((SELECT plan FROM public.profiles WHERE id = p_user)) INTO lim;
  RETURN lim - cur; -- lượt còn lại sau khi trừ
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Index cho đếm nhanh
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage (profile_id, use_date);
