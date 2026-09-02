-- ============================================================
-- AgriCommunity — Knowledge Base Bệnh Cây (RAG-lite cho AI)
-- Lưu hồ sơ bệnh hại của 3 cây trồng: cà phê, sầu riêng, hồ tiêu.
-- App sẽ tra bảng này theo cây + từ khóa triệu chứng rồi nhúng
-- vào prompt để AI chẩn đoán DỰA TRÊN DỮ LIỆU (không tự bịa).
-- Cách dùng: Supabase Dashboard → SQL Editor → dán → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crop_knowledge (
    id BIGSERIAL PRIMARY KEY,
    crop_type TEXT NOT NULL,        -- cafe, sau_rieng, ho_tieu
    disease_key TEXT NOT NULL,      -- từ khóa để match (vd: 'xi_mu', 'ri_sat')
    disease_name TEXT NOT NULL,     -- tên bệnh (tiếng Việt + khoa học)
    symptoms TEXT[] DEFAULT '{}',   -- triệu chứng đặc trưng
    distinguishers TEXT,            -- cách phân biệt với bệnh tương tự
    treatment TEXT NOT NULL,        -- quy trình xử lý (các bước)
    active_ingredients TEXT,        -- hoạt chất + REI
    prevention TEXT,                -- phòng ngừa
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crop_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mọi người xem kiến thức bệnh cây" ON public.crop_knowledge;
CREATE POLICY "Mọi người xem kiến thức bệnh cây" ON public.crop_knowledge FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin sửa kiến thức" ON public.crop_knowledge;
CREATE POLICY "Admin sửa kiến thức" ON public.crop_knowledge FOR ALL USING (public.is_admin());

-- Dữ liệu mẫu (idempotent)
INSERT INTO public.crop_knowledge (crop_type, disease_key, disease_name, symptoms, distinguishers, treatment, active_ingredients, prevention) VALUES
('sau_rieng', 'xi_mu', 'Xì mủ / Thối rễ (Phytophthora palmivora)',
 ARRAY['*xì mủ* thân sát gốc', 'vàng lá rụng nhiều', 'thối rễ, gốc mềm'],
 'Khác với chết chậm tiêu: vết thối lan nhanh, có mủ trắng/nâu; lá vàng cả cây, không theo tầng.',
 'Cạo vết bệnh, quét thuốc gốc đồng + tưới gốc; khơi rãnh thoát nước, hạn chế đọng nước.',
 'Metalaxyl (REI 30 ngày), Phosphonate/Fosetyl-Al sinh học ưu tiên',
 'Thoát nước tốt, bón Trichoderma quanh tán, không để đọng nước mùa mưa'),
('sau_rieng', 'chay_la', 'Cháy lá / Chết ngọn (Rhizoctonia solani)',
 ARRAY['cháy khô từ chóp lá lan vào', 'vân đồng tâm trên vết bệnh', 'màu vàng→nâu, ranh giới rõ'],
 'Khác với thiếu Kali: vết có vân đồng tâm và ranh giới rõ; thiếu Kali cháy mép lá đều hơn.',
 'Cắt bỏ lá bệnh, phun thuốc trừ nấm gốc đồng; tăng thông thoáng, giảm đạm khi trời ẩm.',
 'Copper Oxychloride (REI 7-14 ngày), Hexaconazole 2 lần/vụ, Bacillus subtilis sinh học',
 'Vệ sinh vườn, tỉa cành thông thoáng, hạn chế tưới đẫm'),
('sau_rieng', 'thieu_magie', 'Thiếu Magie / Vi lượng',
 ARRAY['nhạt màu giữa gân lá', 'gân còn xanh', 'chóp lá khô dần'],
 'Khác với bệnh nấm: không có vết loang lổ/đốm, chỉ nhạt màu đều giữa gân.',
 'Bón Canxi-Magie-Kẽm (EDTA) gốc/phun lá; bón hữu cơ hoai, hạn chế đạm cao.',
 'Phân vi lượng EDTA Zn/Mg, Trichoderma',
 'Bón cân đối NPK, bổ sung hữu cơ định kỳ'),
('cafe', 'ri_sat', 'Rỉ sắt (Hemileia vastatrix)',
 ARRAY['đốm bột vàng cam mặt dưới lá', 'rụng lá sớm', 'cây suy kiệt'],
 'Khác với phồng lá: đốm bột màu cam đặc trưng mặt dưới; phồng lá có mụn nước.',
 'Tỉa cành thông thoáng sau thu hoạch, phun phòng đầu mùa mưa, thu gom lá rụng.',
 'Hexaconazole (REI 30 ngày, MRL rất thấp), Propiconazole, đồng sinh học ưu tiên',
 'Phòng bệnh đầu mùa mưa, vệ sinh vườn, bón cân đối Kali'),
('cafe', 'thieu_kali', 'Thiếu Kali (K)',
 ARRAY['mép lá già cháy vàng→khô', 'cây phát triển kém', 'vàng úa từ ngọn'],
 'Khác với rỉ sắt: không đốm bột, cháy mép đều; thiếu K vàng từ mép vào.',
 'Bón Kali Sulphate (K2SO4), tránh KCl nếu đất mặn; bổ sung hữu cơ.',
 'Phân Kali Sulphate, humic',
 'Bón cân đối K, tưới đủ, kiểm tra độ mặn'),
('cafe', 'rep_sap', 'Rệp sáp hại rễ',
 ARRAY['lớp sáp trắng cổ rễ', 'cây vàng úa', 'kiến quanh gốc'],
 'Khác với thiếu dinh dưỡng: có lớp sáp trắng, kiến; cây vàng không đồng đều.',
 'Làm sạch cỏ quanh gốc, xịt nước áp lực gốc, phun sinh học diệt rệp.',
 'Beauveria bassiana, dầu khoáng',
 'Vệ sinh gốc, khuyến khích thiên địch'),
('ho_tieu', 'chet_nhanh', 'Chết nhanh (Phytophthora)',
 ARRAY['héo rũ đột ngột', 'thối gốc vàng lá', 'rụng lá nhanh'],
 'Khác với chết chậm: diễn biến nhanh vài ngày, thối gốc rõ, lá rụng đột ngột.',
 'Cách ly cây bệnh, rải vôi quanh gốc, xử lý gốc bằng thuốc trừ nấm gốc đồng.',
 'Metalaxyl + Mancozeb (REI 30 ngày), Chitosan sinh học',
 'Thoát nước, rải vôi định kỳ, khử trùng đất'),
('ho_tieu', 'chet_cham', 'Chết chậm (Tuyến trùng + Fusarium)',
 ARRAY['vàng lá từ từ', 'rễ u sưng do tuyến trùng', 'cây suy yếu dần'],
 'Khác với chết nhanh: tiến triển chậm, rễ u sưng, vàng lá từng bước.',
 'Xử lý tuyến trùng sinh học, bón hữu cơ hoai, hạn chế tưới úng.',
 'Chitosan, nấm đối kháng (Trichoderma)',
 'Bón hữu cơ hoai, vệ sinh đất, luân canh'),
('ho_tieu', 'vang_la', 'Vàng lá héo rũ khác (thiếu dinh dưỡng / mặn)',
 ARRAY['vàng lá không thối gốc', 'rễ ít u sưng', 'thường do đất bạc màu'],
 'Khác với tuyến trùng/fusarium: không có rễ u sưng nổi bật.',
 'Cân đối NPK + vi lượng, cải tạo đất hữu cơ, kiểm tra pH.',
 'Phân hữu cơ, vi lượng EDTA, vôi cải tạo',
 'Bón hữu cơ định kỳ, kiểm tra đất')
ON CONFLICT DO NOTHING;
