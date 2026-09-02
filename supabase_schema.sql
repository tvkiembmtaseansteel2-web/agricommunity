-- AgriCommunity Supabase SQL Schema
-- Hướng dẫn: Copy nội dung dưới đây và paste vào mục SQL Editor trên trang quản trị Supabase.

-- 1. BẢNG HỒ SƠ NÔNG HỘ (Tuân thủ Nghị định 13 về bảo mật dữ liệu)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    address TEXT,
    farm_area_m2 NUMERIC,
    latitude NUMERIC, -- Tọa độ vườn (để lấy thời tiết theo vị trí)
    longitude NUMERIC,
    primary_crops TEXT[] DEFAULT '{}', -- Ví dụ: {'cafe', 'sau_rieng', 'ho_tieu'}
    consent_granted BOOLEAN DEFAULT FALSE NOT NULL, -- Đồng ý thu thập dữ liệu theo luật
    consent_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    is_admin BOOLEAN DEFAULT FALSE NOT NULL, -- Phân quyền admin để duyệt bài
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bật Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Hàm is_admin() dùng SECURITY DEFINER để tránh "infinite recursion" trong policy
-- (policy KHÔNG được tự truy vấn lại bảng profiles — sẽ đệ quy vô hạn)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Tạo Policy cho profiles
CREATE POLICY "Người dùng có thể xem thông tin cá nhân của mình" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

-- UPDATE: chia 2 nhóm (an toàn — tránh tự nâng quyền admin):
--   * Người dùng (không admin): chỉ sửa HỒ SƠ CỦA MÌNH, is_admin/id phải GIỮ NGUYÊN.
--   * Admin: được cập nhật mọi hồ sơ (quản lý quyền).
CREATE POLICY "Người dùng cập nhật hồ sơ (không đổi quyền/định danh)" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (
      auth.uid() = id
      AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
      AND id = auth.uid()
    );

CREATE POLICY "Admin cập nhật mọi hồ sơ" 
    ON public.profiles FOR UPDATE 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admin được phép xem tất cả hồ sơ để quản lý" 
    ON public.profiles FOR SELECT 
    USING (public.is_admin());

-- Cho phép người dùng tạo hồ sơ của chính mình khi đăng ký (quan trọng: thiếu policy này
-- thì người dùng mới không thể tạo hồ sơ ở Supabase thật)
CREATE POLICY "Người dùng tạo hồ sơ của chính mình khi đăng ký" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Chặn người KHÔNG phải admin tự đổi is_admin / id (defense-in-depth — chống mọi đường bypass).
-- Quan trọng: khi auth.uid() là NULL (Dashboard/SQL Editor chạy bằng postgres/service_role)
-- thì KHÔNG chặn — cho phép quản trị. Chỉ chặn khi có phiên user không phải admin.
CREATE OR REPLACE FUNCTION public.prevent_is_admin_change()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Không được phép tự thay đổi quyền is_admin.'; END IF;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Không được phép thay đổi id hồ sơ.'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_is_admin_change ON public.profiles;
CREATE TRIGGER prevent_is_admin_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_is_admin_change();

-- TỰ ĐỘNG tạo hồ sơ nông hộ khi người dùng đăng ký qua Supabase Auth
-- (Chạy trigger này để không phải tạo hồ sơ thủ công mỗi lần có thành viên mới)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone_number, full_name, consent_granted, consent_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.phone, split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'consent_granted')::boolean, false),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- (Index cho truy vấn thường dùng được đặt ở CUỐI file, sau khi đã tạo đủ các bảng)

-- 2. BẢNG VƯỜN (Garden = entity trung tâm — theo UX Blueprint)
-- Nhật ký, sản lượng, sâu bệnh đều gắn với một vườn cụ thể.
CREATE TABLE IF NOT EXISTS public.gardens (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- Ví dụ: "Vườn sầu riêng A", "Vườn cà phê B"
    crop_type TEXT NOT NULL, -- cafe, sau_rieng, ho_tieu
    area_m2 NUMERIC, -- Diện tích vườn
    plant_count INT, -- Số cây
    plant_age_years INT, -- Tuổi vườn (năm)
    latitude NUMERIC, -- Tọa độ vườn
    longitude NUMERIC,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.gardens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Người dùng xem vườn của mình" ON public.gardens FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Người dùng thêm vườn" ON public.gardens FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Người dùng sửa vườn của mình" ON public.gardens FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Người dùng xóa vườn của mình" ON public.gardens FOR DELETE USING (auth.uid() = profile_id);

-- 3. BẢNG NHẬT KÝ CHĂM SÓC VƯỜN (Bón phân, phun thuốc, làm cỏ, tưới nước)
CREATE TABLE IF NOT EXISTS public.logs (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    garden_id BIGINT REFERENCES public.gardens(id) ON DELETE SET NULL, -- gắn với vườn (tùy chọn)
    crop_type TEXT NOT NULL, -- cafe, sau_rieng, ho_tieu
    activity_type TEXT NOT NULL, -- bon_phan, phun_thuoc, tuoi_nuoc, cat_tia, khac
    activity_date DATE DEFAULT CURRENT_DATE NOT NULL,
    product_name TEXT, -- Tên loại phân/thuốc sử dụng
    dosage TEXT, -- Liều lượng (ví dụ: 500g/gốc, 20ml/bình 20L)
    notes TEXT, -- Ghi chú thêm
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Người dùng chỉ có thể xem nhật ký của mình" 
    ON public.logs FOR SELECT 
    USING (auth.uid() = profile_id);

CREATE POLICY "Người dùng chỉ có thể thêm nhật ký cho mình" 
    ON public.logs FOR INSERT 
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Người dùng chỉ có thể sửa nhật ký của mình" 
    ON public.logs FOR UPDATE 
    USING (auth.uid() = profile_id);

CREATE POLICY "Người dùng chỉ có thể xóa nhật ký của mình" 
    ON public.logs FOR DELETE 
    USING (auth.uid() = profile_id);

-- 4. BẢNG THEO DÕI SẢN LƯỢNG THU HOẠCH
CREATE TABLE IF NOT EXISTS public.yields (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    garden_id BIGINT REFERENCES public.gardens(id) ON DELETE SET NULL, -- gắn với vườn (tùy chọn)
    crop_type TEXT NOT NULL,
    harvest_date DATE DEFAULT CURRENT_DATE NOT NULL,
    quantity_kg NUMERIC NOT NULL,
    quality_grade TEXT, -- Loại 1, Loại 2, Xuất khẩu...
    revenue_vnd NUMERIC, -- Có thể ghi nhận doanh thu nếu muốn
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.yields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nông dân xem sản lượng của mình" ON public.yields FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Nông dân thêm sản lượng" ON public.yields FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Nông dân sửa sản lượng của mình" ON public.yields FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Nông dân xóa sản lượng của mình" ON public.yields FOR DELETE USING (auth.uid() = profile_id);

-- 4. BẢNG BÀI ĐĂNG CỘNG ĐỒNG (Có kiểm duyệt nội dung)
CREATE TABLE IF NOT EXISTS public.posts (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    author_name TEXT NOT NULL, -- Tên hiển thị khi đăng bài
    content TEXT NOT NULL,
    image_url TEXT, -- Link ảnh vườn chia sẻ
    status TEXT DEFAULT 'pending' NOT NULL, -- pending (chờ duyệt), approved (đã duyệt), rejected (từ chối)
    likes_count INT DEFAULT 0,
    flagged_chemical TEXT, -- Hoạt chất CẤM phát hiện tự động trong bài (kiểm duyệt lớp 2)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    moderated_at TIMESTAMP WITH TIME ZONE,
    moderator_id UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Ai cũng được xem bài đã duyệt (Approved)
CREATE POLICY "Xem bài đăng công khai đã được duyệt" 
    ON public.posts FOR SELECT 
    USING (status = 'approved');

-- Tác giả có thể xem cả bài đang chờ duyệt của mình
CREATE POLICY "Tác giả xem bài của chính mình" 
    ON public.posts FOR SELECT 
    USING (auth.uid() = profile_id);

-- Chỉ cho phép người dùng đăng bài
CREATE POLICY "Thành viên tạo bài viết mới" 
    ON public.posts FOR INSERT 
    WITH CHECK (auth.uid() = profile_id);

-- Chỉ Admin mới được quyền SELECT tất cả và UPDATE (để duyệt hoặc từ chối bài)
CREATE POLICY "Admin quản lý tất cả bài đăng" 
    ON public.posts FOR ALL 
    USING (public.is_admin());

-- Cho phép mọi thành viên thích bài đã được duyệt (tăng likes_count).
-- Giai đoạn 2 sẽ thay bằng bảng post_likes riêng để chống thích trùng.
CREATE POLICY "Thành viên thích bài đăng đã duyệt" 
    ON public.posts FOR UPDATE 
    USING (status = 'approved')
    WITH CHECK (status = 'approved');

-- 4b. BẢNG LƯỢT THÍCH BÀI ĐĂNG (chống thích trùng — Phase 2)
CREATE TABLE IF NOT EXISTS public.post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (post_id, profile_id) -- Mỗi người chỉ thích 1 lần/bài
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Ai đăng nhập cũng có thể xem lượt thích của bài công khai (để biết mình đã thích chưa)
CREATE POLICY "Xem lượt thích bài đã duyệt" 
    ON public.post_likes FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_likes.post_id AND posts.status = 'approved')
        OR auth.uid() = profile_id
    );

-- Thành viên thích bài (insert một lần nhờ UNIQUE)
CREATE POLICY "Thành viên thích bài" 
    ON public.post_likes FOR INSERT 
    WITH CHECK (auth.uid() = profile_id);

-- Thành viên bỏ thích bài của mình
CREATE POLICY "Thành viên bỏ thích" 
    ON public.post_likes FOR DELETE 
    USING (auth.uid() = profile_id);

-- 5. BẢNG DANH MỤC TIÊU CHUẨN HOẠT CHẤT XUẤT KHẨU (Để AI đối chiếu + MRL Advisor)
CREATE TABLE IF NOT EXISTS public.export_standards (
    id BIGSERIAL PRIMARY KEY,
    crop_type TEXT NOT NULL, -- cafe, sau_rieng, ho_tieu
    commodity_form TEXT, -- fresh, dried, green_bean, roasted, frozen... (dạng sản phẩm)
    market TEXT NOT NULL, -- EU, US, China, Japan...
    chemical_name TEXT NOT NULL, -- Tên hoạt chất (ví dụ: Glyphosate, Carbendazim)
    mrl_ppm NUMERIC NOT NULL, -- Giới hạn dư lượng tối đa (MRL) tính bằng ppm (-1 nếu bị cấm hoàn toàn)
    status TEXT NOT NULL, -- allowed (cho phép), restricted (hạn chế), banned (cấm)
    rei_days INT, -- Thời gian cách ly (REI) khuyến nghị trước thu hoạch, tính bằng ngày
    requires_verification BOOLEAN DEFAULT false, -- true = chờ xác minh từ văn bản pháp lý gốc
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (crop_type, market, chemical_name, commodity_form)
);

-- Bảng này công khai để xem, chỉ admin mới sửa được
ALTER TABLE public.export_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mọi người đều được xem tiêu chuẩn xuất khẩu" ON public.export_standards FOR SELECT USING (true);
CREATE POLICY "Chỉ Admin sửa đổi tiêu chuẩn" ON public.export_standards FOR ALL USING (
    public.is_admin()
);

-- Nhập dữ liệu hoạt chất mẫu (MRL + REI theo tài liệu tham khảo 2nong, kiểm chứng lại trước khi vận hành chính thức)
INSERT INTO public.export_standards (crop_type, market, chemical_name, mrl_ppm, status, rei_days, notes) VALUES
-- SẦU RIÊNG → Trung Quốc (thị trường chính)
('sau_rieng', 'China', 'Carbendazim', 0.5, 'restricted', 21, 'Giới hạn chặt chẽ, khuyên dùng hoạt chất sinh học thay thế'),
('sau_rieng', 'China', 'Chlorpyrifos', -1, 'banned', NULL, 'CẤM hoàn toàn nhập khẩu sầu riêng có dư lượng chất này'),
('sau_rieng', 'China', 'Metalaxyl', 0.1, 'restricted', 30, 'Trị nấm Phytophthora nhưng phải tính đủ thời gian cách ly'),
('sau_rieng', 'China', 'Dimethoate', -1, 'banned', NULL, 'CẤM — thuốc trừ sâu độc cao'),
-- SẦU RIÊNG → EU (thị trường khó tính)
('sau_rieng', 'EU', 'Chlorpyrifos', -1, 'banned', NULL, 'EU cấm toàn cầu từ 2020'),
('sau_rieng', 'EU', 'Carbendazim', -1, 'banned', NULL, 'Không có MRL cho phép — xem như cấm'),
-- CÀ PHÊ → EU (thị trường chính của cà phê Đắk Lắk)
('cafe', 'EU', 'Glyphosate', 0.1, 'restricted', 45, 'EU kiểm soát cực kỳ nghiêm ngặt thuốc trừ cỏ này'),
('cafe', 'EU', 'Ochratoxin A', -1, 'banned', NULL, 'Độc tố nấm mốc - yêu cầu phơi sấy đạt chuẩn'),
('cafe', 'EU', 'Chlorpyrifos', -1, 'banned', NULL, 'Cấm toàn cầu'),
('cafe', 'EU', 'Hexaconazole', 0.01, 'restricted', 30, 'Trị rỉ sắt nhưng MRL rất thấp — ưu tiên phòng ngừa'),
-- CÀ PHÊ → Mỹ
('cafe', 'US', 'Chlorpyrifos', 0.1, 'restricted', 30, 'Mỹ còn cho phép ở mức thấp (khác EU)'),
-- HỒ TIÊU → EU
('ho_tieu', 'EU', 'Metalaxyl', 0.05, 'restricted', 30, 'Thường dùng trị nấm nhưng EU giới hạn dư lượng rất thấp'),
('ho_tieu', 'EU', 'Carbendazim', -1, 'banned', NULL, 'CẤM hoàn toàn'),
('ho_tieu', 'EU', 'Chlorpyrifos', -1, 'banned', NULL, 'CẤM hoàn toàn')
ON CONFLICT (crop_type, market, chemical_name) DO NOTHING;

-- 5b. BẢNG THÔNG BÁO (khi bài được admin duyệt/từ chối)
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Người nhận
    title TEXT NOT NULL, -- Tiêu đề: "Bài đăng đã được duyệt"
    body TEXT, -- Nội dung chi tiết
    link TEXT, -- Đường dẫn (ví dụ tab community)
    read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_profile ON public.notifications(profile_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Xem thông báo của mình"
    ON public.notifications FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Admin tạo thông báo"
    ON public.notifications FOR INSERT
    WITH CHECK (public.is_admin() OR auth.uid() = profile_id);

CREATE POLICY "Đánh dấu đã đọc"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Xóa thông báo của mình"
    ON public.notifications FOR DELETE
    USING (auth.uid() = profile_id);

-- 6. INDEX CHO TRUY VẤN THƯỜNG DÙNG (đặt ở cuối file — sau khi đã tạo đủ các bảng)
CREATE INDEX IF NOT EXISTS idx_logs_profile ON public.logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_yields_profile ON public.yields(profile_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_profile ON public.posts(profile_id);

-- 7. STORAGE: BUCKET ẢNH VƯỜN (để nông dân đăng ảnh vườn lên bài viết)
-- Tạo bucket công khai 'farm-images' (idempotent — chạy lại không lỗi)
INSERT INTO storage.buckets (id, name, public)
VALUES ('farm-images', 'farm-images', true)
ON CONFLICT (id) DO NOTHING;

-- Mọi người (kể cả chưa đăng nhập) đều xem được ảnh công khai
CREATE POLICY "Mọi người xem ảnh vườn công khai"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'farm-images');

-- Chỉ thành viên đã đăng nhập mới được upload ảnh vào bucket
CREATE POLICY "Thành viên upload ảnh vườn"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'farm-images' AND auth.role() = 'authenticated');

-- Người dùng chỉ được xóa ảnh của chính mình
CREATE POLICY "Chủ ảnh xóa ảnh của mình"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'farm-images' AND owner = auth.uid());
