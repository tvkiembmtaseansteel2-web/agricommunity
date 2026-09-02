-- ============================================================
-- AgriCommunity — Cập nhật DB theo MASTER REGULATORY MATRIX (2026-08)
-- 1) Thêm cột commodity_form vào export_standards (MRL theo dạng sản phẩm)
-- 2) Bổ sung bản ghi chất ô nhiễm (mycotoxin) theo EU 2023/915
-- 3) Bảng regulatory_references (nguồn pháp lý đã xác minh)
-- Cách dùng: Supabase Dashboard → SQL Editor → dán → Run (idempotent)
-- ============================================================

-- 1. Thêm cột commodity_form vào export_standards
--    Ý nghĩa: MRL khác nhau theo dạng sản phẩm (fresh/dried/roasted...)
ALTER TABLE public.export_standards ADD COLUMN IF NOT EXISTS commodity_form TEXT;
-- Giá trị: fresh | dried | roasted | ground | frozen | processed
-- Mặc định gán theo cây: sầu riêng=fresh, cà phê=green_bean (nhân), tiêu=dried
UPDATE public.export_standards SET commodity_form = 'fresh' WHERE crop_type = 'sau_rieng' AND commodity_form IS NULL;
UPDATE public.export_standards SET commodity_form = 'green_bean' WHERE crop_type = 'cafe' AND commodity_form IS NULL;
UPDATE public.export_standards SET commodity_form = 'dried' WHERE crop_type = 'ho_tieu' AND commodity_form IS NULL;

-- 2. Bổ sung bản ghi chất ô nhiễm (mycotoxin) — chỉ tiêu riêng, không phải MRL thuốc BVTV
--    Theo EU Regulation (EU) 2023/915. Dùng mrl_ppm = -1 để đánh dấu "cần kiểm soát ô nhiễm".
INSERT INTO public.export_standards (crop_type, market, chemical_name, mrl_ppm, status, rei_days, notes, commodity_form) VALUES
('cafe', 'EU', 'Ochratoxin A', 0.005, 'restricted', NULL, 'Mycotoxin — giới hạn EU 2023/915 cho cà phê rang (~5 µg/kg). Cần kiểm soát phơi sấy/kho. Nguy cơ riêng, không phải MRL thuốc BVTV.', 'roasted'),
('cafe', 'EU', 'Aflatoxins', -1, 'banned', NULL, 'Mycotoxin — EU 2023/915. Cà phê cần kiểm nghiệm nếu thị trường/hợp đồng yêu cầu. Đây là chỉ tiêu ô nhiễm.', 'green_bean'),
('ho_tieu', 'EU', 'Ochratoxin A', 0.01, 'restricted', NULL, 'Mycotoxin — EU 2023/915 cho hồ tiêu khô (~10 µg/kg). Quan trọng với tiêu xuất EU.', 'dried'),
('ho_tieu', 'EU', 'Aflatoxins', -1, 'banned', NULL, 'Mycotoxin — cần kiểm soát sấy/kho ẩm mốc. Chỉ tiêu ô nhiễm riêng.', 'dried'),
('sau_rieng', 'CN', 'Aflatoxins', -1, 'banned', NULL, 'Chỉ tiêu ô nhiễm — kiểm soát vệ sinh đóng gói/bảo quản. Không phải MRL thuốc BVTV.', 'fresh'),
('sau_rieng', 'EU', 'Aflatoxins', -1, 'banned', NULL, 'Mycotoxin theo EU 2023/915 — kiểm tra nếu thị trường/hợp đồng yêu cầu.', 'fresh')
ON CONFLICT (crop_type, market, chemical_name) DO NOTHING;

-- 3. Bảng nguồn pháp lý đã xác minh (cho MRL Advisor + knowledge base)
CREATE TABLE IF NOT EXISTS public.regulatory_references (
    id BIGSERIAL PRIMARY KEY,
    source_number TEXT NOT NULL,        -- số hiệu văn bản (vd: 75/2025/TT-BNNMT)
    source_type TEXT NOT NULL,          -- law, decree, circular, qcvn, tcvn, protocol, foreign_regulation
    title TEXT NOT NULL,
    issuing_authority TEXT,
    issued_date DATE,
    effective_date DATE,
    legal_status TEXT DEFAULT 'effective', -- effective, replaced, amended, expired
    domain TEXT,                        -- fertilizer, pesticide, food_safety, plant_health, traceability
    verification_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (source_number)
);

ALTER TABLE public.regulatory_references ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mọi người xem nguồn pháp lý" ON public.regulatory_references;
CREATE POLICY "Mọi người xem nguồn pháp lý" ON public.regulatory_references FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin sửa nguồn pháp lý" ON public.regulatory_references;
CREATE POLICY "Admin sửa nguồn pháp lý" ON public.regulatory_references FOR ALL USING (public.is_admin());

INSERT INTO public.regulatory_references (source_number, source_type, title, issuing_authority, issued_date, effective_date, legal_status, domain, verification_url, notes) VALUES
('31/2018/QH14', 'law', 'Luật Trồng trọt', 'Quốc hội', '2018-11-19', '2020-01-01', 'effective', 'fertilizer', 'https://vanban.chinhphu.vn/?docid=206097&pageid=27160', 'Luật nền: giống, phân bón, truy xuất nguồn gốc'),
('41/2013/QH13', 'law', 'Luật Bảo vệ và kiểm dịch thực vật', 'Quốc hội', '2013-11-25', '2015-01-01', 'effective', 'pesticide', 'https://vanban.chinhphu.vn/?docid=171413&pageid=27160', 'Thuốc BVTV, sinh vật gây hại, kiểm dịch'),
('55/2010/QH12', 'law', 'Luật An toàn thực phẩm', 'Quốc hội', '2010-06-17', '2011-07-01', 'effective', 'food_safety', 'https://vanban.chinhphu.vn/?classid=1&docid=96032&pageid=27160', 'ATTP, dư lượng, kim loại nặng, xuất khẩu'),
('75/2025/TT-BNNMT', 'circular', 'Danh mục thuốc BVTV được phép/cấm sử dụng', 'Bộ NN&MT', '2025-12-26', '2026-02-10', 'effective', 'pesticide', 'https://vanban.chinhphu.vn/?classid=1&docid=216337', 'Danh mục hiện hành'),
('28/2026/TT-BNNMT', 'circular', 'Sửa đổi danh mục thuốc BVTV', 'Bộ NN&MT', '2026-06-30', '2026-08-15', 'amended', 'pesticide', 'https://vanban.chinhphu.vn/?docid=218752&pageid=27160', 'Sửa/bổ sung Thông tư 75/2025'),
('86/2025/TT-BNNMT', 'circular', 'QCVN 106:2025/BNNMT (phân bón)', 'Bộ NN&MT', '2025-12-31', '2026-06-30', 'effective', 'fertilizer', 'https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/01/86-bnnmt-kem.pdf', 'Thay QCVN 01-189:2019'),
('QCVN 106:2025/BNNMT', 'qcvn', 'Quy chuẩn kỹ thuật quốc gia về phân bón', 'Bộ NN&MT', '2026-01-01', '2026-06-30', 'effective', 'fertilizer', 'https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/01/86-bnnmt-kem.pdf', 'Thay thế QCVN 01-189:2019'),
('TCVN 11892-1:2017', 'tcvn', 'VietGAP trồng trọt — Phần 1', 'Bộ NN&MT', '2017-01-01', NULL, 'voluntary', 'plant_health', 'https://khuyennong.danang.gov.vn/chi-tiet-tin/group/3/nid/1553/gioi-thieu-danh-muc-tieu-chuan-quoc-gia-trong-linh-vuc-trong-trot', 'Tiêu chuẩn tự nguyện, không mặc định bắt buộc'),
('Protocol_Durian_VN_CN_2022', 'protocol', 'Nghị định thư sầu riêng tươi VN–Trung Quốc', 'BNN&MT / GACC', '2022-07-11', NULL, 'effective', 'plant_health', 'https://sansangxuatkhau.ppd.gov.vn/tin-tuc-noi-bat/nghi-dinh-thu-ve-yeu-cau-kiem-dich-thuc-vat-doi-voi-sau-rieng-tuoi-xuat-khau-tu-viet-nam-sang-trung-quoc.html', 'Yêu cầu mã vùng trồng, cơ sở đóng gói, quản lý dư lượng'),
('EU 396/2005', 'foreign_regulation', 'EU Regulation on MRLs', 'European Commission', '2005-02-23', NULL, 'effective', 'pesticide', 'https://food.ec.europa.eu/plants/pesticides/eu-legislation-mrls_en', 'Hệ thống MRL châu Âu; mặc định 0.01 mg/kg nếu không có MRL riêng'),
('EU 2023/915', 'foreign_regulation', 'EU Regulation on contaminants', 'European Commission', '2023-04-25', NULL, 'effective', 'food_safety', 'https://eur-lex.europa.eu/eli/reg/2023/915', 'Mycotoxin: aflatoxin, ochratoxin A, patulin...'),
('EU 2019/2072', 'foreign_regulation', 'EU plant health requirements', 'European Commission', '2019-11-28', NULL, 'effective', 'plant_health', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019R2072', 'Sầu riêng tươi KHÔNG cần phytosanitary cert (nhưng vẫn phải đạt ATTP)')
ON CONFLICT (source_number) DO NOTHING;

-- Kiểm tra nhanh
-- SELECT COUNT(*) FROM export_standards WHERE commodity_form IS NOT NULL;
-- SELECT COUNT(*) FROM regulatory_references;
