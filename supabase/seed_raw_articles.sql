-- Seed 2 bài thô mẫu vào raw_articles (để bạn thấy luồng duyệt hoạt động)
-- Min họa crawler đã chạy. Bạn có thể phê duyệt/từ chối trên App.
INSERT INTO public.raw_articles (title, source_url, source_name, raw_content, matched_keywords, status) VALUES
('Cảnh báo bệnh rỉ sắt trên cà phê tại Đắk Lắk', 'https://ppd.gov.vn/daklak-ri-sat', 'Cục BVTV', 'Theo Chi cục BVTV Đắk Lắk, bệnh rỉ sắt đang xuất hiện trên các vườn cà phê ở khu vực Buôn Ma Thuột. Khuyến cáo phun phòng bằng đồng sinh học, tỉa cành thông thoáng.', ARRAY['cà phê'], 'draft'),
('Nấm Phytophthora trên sầu riêng mùa mưa', 'https://wasi.org.vn/phytophthora-sau-rieng', 'Viện WASI', 'Viện WASI cảnh báo nguy cơ nấm Phytophthora gây xì mủ thân sầu riêng trong mùa mưa. Biện pháp: thoát nước, quét thuốc gốc đồng lên vết bệnh.', ARRAY['sầu riêng'], 'draft')
ON CONFLICT DO NOTHING;
