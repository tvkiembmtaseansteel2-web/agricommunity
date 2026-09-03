# Kế hoạch triển khai hoàn chỉnh: Ứng dụng Nông nghiệp Cộng đồng (AgriCommunity)

> **Phiên bản:** v2.0 — bản kế hoạch đã họp kín (đánh giá code + chốt quyết định)
> **Đối tượng:** Nông dân trồng **cà phê, sầu riêng, hồ tiêu** tại Tây Nguyên (mở rộng cả nước)
> **Mục tiêu cốt lõi:** Nền tảng Web (PWA) rẻ nhất, dễ dùng nhất cho nông dân: quản lý vườn, chẩn đoán bệnh bằng AI, chia sẻ kiến thức cộng đồng có kiểm duyệt, truy xuất nguồn gốc & đối chiếu hoạt chất theo chuẩn xuất khẩu.

---

## 1. Đánh giá hiện trạng (đã rà soát toàn bộ code ngày 27/08/2026)

### 1.1 Điểm mạnh cần giữ
| Khía cạnh | Nhận xét |
| :--- | :--- |
| Kiến trúc | Serverless (React + Vite + Supabase + Gemini) — đúng hướng tối ưu chi phí. |
| Chạy được ngay | Mock database trong localStorage cho phép demo không cần backend. |
| Bảo mật dữ liệu | Đã có màn hình đồng ý chia sẻ dữ liệu (Nghị định 13/2023) + RLS trên từng bảng. |
| Cộng đồng | Luồng kiểm duyệt bài đăng (pending → approved/rejected) đã hiện diện trong UI. |
| AI | Prompt chẩn đoán + đối chiếu MRL theo thị trường xuất khẩu đã được thiết kế tốt. |

### 1.2 Lỗi & khoảng trống đã phát hiện (ưu tiên sửa)
| # | Vấn đề | Ảnh hưởng | Trạng thái |
| :-- | :--- | :--- | :--- |
| 1 | Insert `logs`/`posts`/`yields` thiếu `profile_id` | Bị RLS từ chối ở Supabase thật | ✅ Đã sửa |
| 2 | `fetchUserData` đọc hồ sơ từ `auth.user` thay vì bảng `profiles` | Hồ sơ trống khi dùng Supabase thật | ✅ Đã sửa |
| 3 | Like/Duyệt bài ghi trực tiếp localStorage | Không đồng bộ ở chế độ thật | ✅ Đã sửa |
| 4 | AI Doctor chưa có upload ảnh lá cây | Mất tính năng "chẩn đoán qua ảnh" cốt lõi | ✅ Đã sửa |
| 5 | Lỗi cú pháp `justify-content` trong style JSX | React cảnh báo, style không áp dụng | ✅ Đã sửa |
| 6 | Model Gemini cũ `1.5-flash`, cứng trong code | Tốn chi phí, không đổi được model | ✅ Đã sửa (mặc định `gemini-2.5-flash`, cấu hình qua env) |
| 7 | Chưa có PWA (manifest, service worker, icon) | Không cài được lên điện thoại, không offline | ✅ Đã bổ sung cơ bản |
| 8 | Thiếu `@supabase/supabase-js`, `.env.example`, README | Khó chạy chế độ thật, khó onboard | ✅ Đã bổ sung |
| 9 | Schema thiếu: policy INSERT `profiles`, trigger `updated_at`, index, dữ liệu mẫu idempotent | Vận hành kém, dữ liệu mẫu chạy lỗi khi re-run | ✅ Đã bổ sung |
| 10 | Không có đăng nhập/đăng ký UI (chỉ có mock auto-login) | Chưa dùng được thực tế | ⏳ Phase 1 |
| 11 | Thời tiết hardcode, chưa có API | Thông tin thiếu thực tế | ⏳ Phase 1 |
| 12 | Lượt thích là cột đếm, không chống thích trùng | Cần bảng `post_likes` | ⏳ Phase 2 |
| 13 | Chưa có kiểm thử tự động, chưa có CI/CD | Rủi ro regression | ⏳ Phase 2 |

---

## 2. Người dùng & nhu cầu (Personas)

| Persona | Đặc điểm | Nhu cầu chính |
| :--- | :--- | :--- |
| **Bác Năm** — nông dân sầu riêng (50 tuổi) | Dùng điện thoại phổ thông, mạng yếu, ít quen công nghệ | Ghi nhật ký ít thao tác, chụp ảnh hỏi AI, xem thời tiết, đọc tin cộng đồng |
| **Chị Hoa** — nông dân cà phê (35 tuổi) | Thành thạo hơn, hay lên mạng tìm kiếm | Tham gia cộng đồng, học kỹ thuật, đối chiếu thuốc với chuẩn xuất khẩu EU |
| **Kỹ sư Lâm** — cán bộ HTX / khuyến nông | Có chuyên môn, quản lý nhiều hộ | Duyệt bài, theo dõi sản lượng vùng, phổ biến kỹ thuật, cảnh báo dịch bệnh |
| **Quản trị viên dự án** | Vận hành hệ thống | Quản lý dữ liệu chuẩn xuất khẩu, tài khoản admin, thống kê |

**Nguyên tắc thiết kế (đã chốt):** giao diện thẻ lớn, ít thuật ngữ kỹ thuật, icon rõ ràng, tối đa 2 chạm cho thao tác chính, hỗ trợ nhập liệu tối giản, văn bản tiếng Việt giản dị.

---

## 3. Kiến trúc tổng thể (đã chốt)

```
┌─────────────────────────────────────────────┐
│  Frontend: React + Vite (PWA, mobile-first)  │
│  - 5 tab: Trang chủ / Nhật ký / Bác sĩ AI /  │
│    Cộng đồng / Hồ sơ                          │
│  - Service Worker (offline app shell)         │
└──────────────┬──────────────────────────────┘
               │ HTTPS (Supabase Auth - phone/password)
┌──────────────▼──────────────────────────────┐
│  Supabase (Postgres + Auth + Storage)        │
│  - profiles, logs, yields, posts,             │
│    export_standards, post_likes (Phase 2)     │
│  - RLS toàn bộ bảng                           │
│  - Storage: bucket ảnh vườn (nén <1GB free)   │
└──────────────┬──────────────────────────────┘
               │ REST (Gemini generateContent)
┌──────────────▼──────────────────────────────┐
│  Google Gemini API (gemini-2.5-flash)         │
│  - Chẩn đoán bệnh/thiếu chất qua ảnh + text   │
│  - Đối chiếu hoạt chất theo chuẩn xuất khẩu    │
└─────────────────────────────────────────────┘
```

**Quyết định công nghệ:**
- **Frontend:** React 18 + Vite 5, không dùng UI framework nặng (giữ vanilla CSS) → tải nhanh ở vùng sóng yếu.
- **Backend/DB:** Supabase (Postgres) — free tier đủ cho giai đoạn thử nghiệm 500 hộ.
- **Storage:** Supabase Storage — nén ảnh về ≤1024px/JPEG 80% trước khi upload (đã triển khai trong AI Doctor) để tiết kiệm dung lượng.
- **AI:** Gemini API — `gemini-2.5-flash` mặc định (có thể đổi `VITE_GEMINI_MODEL`), chế độ mock offline khi chưa có key.

---

## 4. Quyết định thiết kế (trả lời các Open Questions cũ)

> Các câu hỏi còn bỏ ngỏ trong bản v1 đã được chốt như dưới đây. Nếu bạn muốn đổi hướng bất kỳ quyết định nào, chỉ cần báo — chi phí thay đổi đều thấp ở giai đoạn này.

### Q1. Phương thức đăng nhập ❓→ ✅ **Đã chốt**
- **Giai đoạn 1 (miễn phí):** Đăng nhập bằng **Số điện thoại + mật khẩu đơn giản**. Không tốn phí SMS. (Cơ chế đã có trong mock client, cần thêm UI đăng nhập.)
- **Giai đoạn 2 (khi có kinh phí):** Gửi mã OTP qua SMS (phí ~400–800đ/tin) hoặc qua Zalo OA (rẻ hơn, phổ biến với nông dân). Đề xuất **Zalo OTP** trước vì chi phí thấp và nông dân Việt dùng Zalo rất nhiều.
- Tài khoản admin không tạo từ app — do quản trị viên cấu hình trực tiếp trong DB.

### Q2. Ai kiểm duyệt nội dung? ❓→ ✅ **Đã chốt**
- **Kiểm duyệt viên:** Cán bộ hợp tác xã / kỹ sư khuyến nông của dự án (tài khoản `is_admin = true`), do quản trị hệ thống cấp.
- Giao diện "Duyệt bài đăng" đã có sẵn trong tab Cộng đồng (chỉ hiển thị nút hành động khi là admin).
- **Giai đoạn 2:** nâng cấp lên kiểm duyệt 2 lớp (HTX → dự án), thêm báo cáo bài viết sai, cảnh báo nội dung chứa hoạt chất cấm.

### Q3. Tiêu chuẩn xuất khẩu (MRL) lấy dữ liệu từ đâu? ❓→ ✅ **Đã chốt**
- **Hiện tại:** Dữ liệu mẫu 5 hoạt chất (bảng `export_standards`) + kiến thức của Gemini → cảnh báo định tính. Đủ cho pilot.
- **Nếu bạn có tài liệu thật** (bảng MRL EU/Mỹ/Trung Quốc dạng PDF/Excel) → gửi vào thư mục `docs/` của dự án; bản kế hoạch Phase 2 sẽ nạp vào hệ thống làm dữ liệu tham chiếu chuẩn (kèm trích xuất tự động bằng AI).
- **Giai đoạn 2:** admin có UI thêm/sửa hoạt chất + MRL; AI truy vấn đúng dữ liệu trong DB trước khi trả lời.

### Q4. (Mới) Thời tiết lấy từ đâu? → ✅ **Đã chốt**
- **Open-Meteo** (miễn phí, không cần API key) theo tọa độ vườn trong hồ sơ nông hộ. Dữ liệu mẫu hiện tại chỉ là placeholder.

### Q5. (Mới) Tài liệu `docs/2nong_MRL_upgrade_analysis.md` xử lý thế nào? → ✅ **Đã chốt**
- **Quyết định:** Tài liệu về app **2nong chỉ để THAM KHẢO** (do chủ dự án xác nhận). Chúng ta **KHÔNG** sao chép toàn bộ (không làm marketplace/lab hub/QR phức tạp ở giai đoạn này).
- **Lọc ra 2 giá trị cốt lõi phù hợp nông dân Đắk Lắk:**
  1. **MRL Advisor** — tra cứu nhanh hoạt chất CẤM / HẠN CHẾ / ĐƯỢC PHÉP theo cây + thị trường → ✅ **Đã triển khai** (tab "Xuất khẩu", component `src/MRLAdvisor.jsx`).
  2. **REI (thời gian cách ly)** — mỗi hoạt chất có số ngày cách ly trước thu hoạch + tính "ngày an toàn thu hoạch" từ ngày phun → ✅ **Đã thêm** cột `rei_days` trong `export_standards` và bộ tính ngày an toàn trong MRL Advisor.
- **Nguyên tắc giữ đơn giản:** không hiện thuật ngữ kỹ thuật khó hiểu; giao diện 2 lựa chọn (cây + thị trường) → kết quả bằng màu sắc + icon.
- **Lưu ý dữ liệu:** số MRL/REI trong schema là **giá trị tham khảo ban đầu** — cần kiểm chứng với tài liệu chính thức (EU MRL database, GACC Trung Quốc) và chuyên gia trước khi vận hành chính thức.

---

## 5. Mô hình dữ liệu (nâng cấp từ v1)

| Bảng | Vai trò | Thay đổi so với v1 |
| :--- | :--- | :--- |
| `profiles` | Hồ sơ nông hộ + phân quyền admin | + Policy INSERT (người dùng tự tạo hồ sơ), + trigger `updated_at`, + index |
| `gardens` *(entity trung tâm)* | Vườn — nền tảng cho "hiểu vườn" | Tạo mới: name, crop_type, area, plant_count, age, tọa độ. Nhật ký/sản lượng gắn `garden_id` |
| `logs` | Nhật ký chăm sóc | + index `profile_id`; + cột `garden_id` (liên kết vườn) |
| `yields` | Nhật ký thu hoạch/sản lượng | + index `profile_id`; + cột `garden_id` (liên kết vườn) |
| `posts` | Bài đăng cộng đồng (có kiểm duyệt) | + index `status`, `profile_id`; + policy UPDATE cho lượt thích |
| `export_standards` | Danh mục MRL hoạt chất theo thị trường + **REI** + **commodity_form** + **cờ xác minh** | + UNIQUE 4 cột; + cột `rei_days`, `commodity_form`, `requires_verification`; 21 dòng (MRL + mycotoxin) |
| `crop_knowledge` *(Phase 2)* | Hồ sơ bệnh cây (RAG-lite cho AI) | 9 bệnh thực tế 3 cây |
| `regulatory_references` *(Phase 2)* | Nguồn pháp lý xuất khẩu đã xác minh | 12 văn bản (luật, thông tư, QCVN, nghị định thư, EU/US...) |
| `post_likes` *(Phase 2)* | Chống thích trùng, đếm like chính xác | Tạo mới |
| `notifications` *(Phase 2)* | Thông báo duyệt bài | Tạo mới |

**Lưu ý bảo mật:** client KHÔNG bao giờ gửi `is_admin` lên — quyền admin chỉ do quản trị hệ thống cấp trong DB (đã sửa trong code).

---

## 6. Lộ trình triển khai theo pha + tiêu chí nghiệm thu

### 🔵 Phase 0 — Củng cố prototype (TUẦN NÀY, đã thực hiện)
- Sửa toàn bộ lỗi chặn mục 1.2 (đã xong).
- Bổ sung PWA cơ bản, `.env.example`, README, cập nhật schema.
- **Nghiệm thu:** `npm run build` pass; app chạy mock đầy đủ 5 tab; AI Doctor nhận ảnh.

### 🟢 Phase 1 — Pilot 50 nông hộ (tuần 1–3)
**Frontend:**
- [x] **Tham khảo chất cấm/hạn chế** (tab "Chất cấm"): chọn cây + thị trường → xem hoạt chất CẤM/HẠN CHẾ/CHO PHÉP + MRL + REI + dạng sản phẩm + nguồn pháp lý. **Chỉ để THAM CHIẾU** — quy trình bón phân/phun thuốc do "Bác sĩ cây trồng AI" đưa ra (không dùng bảng này làm căn cứ phun thuốc). *(Quyết định sản phẩm: ưu tiên nông học, MRL là lưu ý phụ.)*
- [x] **Màn hình Đăng nhập / Đăng ký** (SĐT + mật khẩu, tab chuyển đổi, cam kết Nghị định 13, nút demo nhanh, đăng xuất). Đã thêm trigger tự tạo hồ sơ khi đăng ký trong schema.
- [ ] Trang Điều khoản & Đồng ý chia sẻ dữ liệu riêng (hiện tích hợp trong màn đăng ký; tách trang riêng nếu cần pháp lý chặt hơn).
- [ ] Ghi nhật ký nhanh bằng giọng nói (Web Speech API, miễn phí, chạy trình duyệt).
- [x] **Thời tiết thật Open-Meteo** (miễn phí, không cần API key) — tọa độ mặc định Đắk Lắk (Buôn Ma Thuột), icon + khuyến nghị nông vụ tự động theo mưa/nhiệt. (Bước tiếp theo: theo tọa độ vườn trong hồ sơ.)
- [x] **Upload ảnh vườn lên Supabase Storage** khi đăng bài (thay link tay): chọn/chụp ảnh → xem trước → nén tự động (≤1024px/JPEG 80%) → upload bucket `farm-images` → public URL; mock dùng dataUrl. Code sẵn sàng (`storageService.js`), cần tạo bucket qua `storage_bucket.sql`.
- [ ] Nút "Lưu nhật ký" hoạt động ở cả 2 chế độ mock/thật (đã sửa nền tảng).

**Backend:**
- [x] Tạo project Supabase thật + **chạy schema thành công** (qua Management API, ngày 27/08): 5 bảng + RLS + trigger + 14 dòng MRL + index.
- [x] (Code sẵn sàng) Storage bucket `farm-images` + policies — trong `storage_bucket.sql`; cần dán lên SQL Editor để chạy (token tạm đã thu hồi).
- [ ] Điền `.env` thật (đã xong); kiểm thử RLS đầy đủ (nông dân ↔ admin).

**Nghiệm thu Phase 1:** 10 nông dân thật dùng được trọn vòng: đăng ký → nhập hồ sơ → ghi nhật ký → chụp ảnh hỏi AI → đăng bài → admin duyệt → bài hiện công khai.

### 🟡 Phase 2 — Mở rộng 500 hộ & nâng cấp (tuần 4–8)
- [x] **Bảng `post_likes`** chống thích trùng (schema + mock + UI toggle like/unlike, nút hiện "Đã thích").
- [x] **Nhập nhật ký bằng giọng nói** (Web Speech API, tiếng Việt — `VoiceInput.jsx`, nhấn giữ để nói / thả để xong).
- [x] **Quét hóa đơn bằng AI** (`receiptScanner.js` + nút trong nhật ký): chụp ảnh hóa đơn mua phân/thuốc → Gemini đọc tên sản phẩm, loại, liều lượng → nông dân chọn để tự điền vào nhật ký.
- [x] **Thời tiết theo tọa độ vườn** (trường lat/lng trong hồ sơ; mặc định Đắk Lắk).
- [x] **Thời tiết "theo thời gian thực" theo định vị GPS** (`weatherService.js` tách riêng, dễ test): nút **📍 Định vị** trên widget thời tiết (cả trên Home và màn hồ sơ) → lấy vị trí thực tế của nông dân qua trình duyệt → fetch Open-Meteo theo tọa độ đó + đảo ngược địa chỉ (Nominatim, không key) để hiện tên vùng; **tự làm mới mỗi 10 phút**; hiển thị nguồn vị trí ("Vị trí hiện tại / Vườn của bạn / Đắk Lắk") + "Cập nhật lúc HH:MM"; thứ tự ưu tiên GPS → tọa độ vườn → mặc định Đắk Lắk; thất bại GPS → fallback mềm (không làm hỏng luồng). Kèm `src/test/weatherService.test.js` (5 test). *(Nâng cấp)*: **icon theo ngày/đêm** (đêm trời quang/ít mây → 🌙, nền widget đổi sang tối `weather-widget--night`, nhãn "☀️ Ban ngày / 🌙 Ban đêm"); **không còn alert chặn** khi định vị lỗi — thông báo mềm trên card + tự fallback (trình duyệt chỉ cho GPS trên HTTPS/localhost, HTTP/IP LAN sẽ thấy ghi chú hướng dẫn).
- [x] **Thông báo khi bài được duyệt** (bảng `notifications` + chuông 🔔 + dropdown, badge số chưa đọc, tự đánh dấu đã đọc).
- [x] **UI admin quản lý hoạt chất MRL** (trong tab Xuất khẩu: thêm/sửa trạng thái/xóa hoạt chất — chỉ admin).
- [x] **Cảnh báo tự động hoạt chất cấm trong bài đăng** (quét nội dung vs danh mục CẤM → `flagged_chemical`, hiển thị nổi bật cho admin khi duyệt).
- [x] **Thống kê sản lượng theo vùng** (tab Thống kê: tổng theo cây/vùng + **xuất CSV mở bằng Excel**).
- [x] **Kiểm thử tự động**: Vitest (6 test: AI mock + mock supabase `.eq()` chain) + Playwright E2E (2 test, chế độ mock) + CI GitHub Actions.
- [x] **Analytics ẩn danh** (Plausible — tôn trọng Nghị định 13, không cookie; bật qua `VITE_ANALYTICS_DOMAIN`).

**Nghiệm thu Phase 2:** 500 hộ sử dụng ổn định; dữ liệu MRL chuẩn hóa; 99% yêu cầu AI trả lời < 5 giây. *(Còn lại: nạp bảng MRL thật khi có tài liệu của bạn + báo cáo Excel nâng cao)*

### 📘 Phase 2.5 — Tái cấu trúc UX theo Product & UX Blueprint v1.0 (docs/)
*Mục tiêu: đơn giản hóa, tập trung luồng chăm sóc + 3 cây + 1 vùng. Ưu tiên không phá vỡ flow hiện tại.*
- [x] **Ngôn ngữ tự nhiên** (form nhật ký: "Bạn đã làm gì?", "Bạn dùng bao nhiêu?"...) — nói nông dân hiểu ngay.
- [x] **Garden entity trung tâm** (bảng `gardens`, `phase3_gardens.sql` đã chạy; `GardensManager.jsx`; nhật ký chọn vườn + tự điền cây).
- [x] **Home "Hôm nay vườn cần làm gì?"** — chuyển từ dashboard → trợ lý chăm vườn (dữ liệu thời tiết + nhật ký → hành động).
- [x] **Giảm bottom nav còn 5 tab** (Trang chủ / Nhật ký / Bác sĩ AI / Cộng đồng / **Tôi**); gom Vườn/Thống kê/Chất cấm/Hồ sơ vào "Tôi".
- [x] **Voice bóc tách dữ liệu tự động** (`voiceParse.js`): nói "Bón 2kg NPK cho 50 cây sầu riêng" → tự điền cây/hoạt động/sản phẩm/liều + **modal xác nhận trước khi lưu** (✅ Đúng / ✏️ Sửa).
- [x] **Ghi nhật ký nhanh trước** (⚡ Ghi nhanh: 3 trường bắt buộc + nút lưu) + form chi tiết để bổ sung sau.
- [x] **Rà soát state**: empty (vườn, nhật ký, cộng đồng, AI), loading (weather, vườn, AI), **error thân thiện** (AI hiện "Chưa kết nối được" thay vì lỗi kỹ thuật), success (alert xác nhận).

### 🧠 Phase 2.6 — Hệ thống Quản trị Tri thức (KB) theo PRD
*(PRD: `docs/` — KB chuẩn hóa + luồng duyệt nội bộ)*
- [x] **Schema KB chuẩn hóa** (`kb_entries` + `raw_articles` + `is_expert` — `phase4_kb.sql` đã chạy): `plant_type × category × target_part × problem_name × scientific_name × agents × symptoms × solutions × source_metadata`; **`active_ingredients` tách riêng** (mảng) để map danh mục thuốc BVTV.
- [x] **Dữ liệu mẫu** 6 mục KB (`phase4_seed_kb.sql` đã chạy) — kèm lưu ý cần chuyên gia xác thực trước khi dùng chính thức.
- [x] **Luồng duyệt nội bộ** (PRD Mục 4): `raw_articles` (Draft → Phê duyệt/Expert → Published).
- [x] **UI `KBAdmin.jsx`** (tab Tôi → KB Admin, chỉ admin): Hàng đợi duyệt / Tri thức đã duyệt / Thêm mục (form cấu trúc chuẩn).
- [x] **Tự động đăng lên cộng đồng khi phê duyệt**: phê duyệt bài crawl → nội dung chính + nguồn tự đăng lên bảng tin (status approved, author "📚 Kiến thức từ [nguồn]"), link nguồn click được; refresh bảng tin sau khi đăng.
- [x] **Phê duyệt → tạo KB truy vấn được**: khi duyệt, tự bóc tách raw_content → bản ghi `kb_entries` chuẩn hóa (plant_type từ từ khóa, category đoán bằng regex, problem_name = tiêu đề, source_url/source_name); nút **"Phê duyệt tất cả draft"** (duyệt hàng loạt).
- [x] **Tích hợp AI Doctor**: `fetchKnowledge` đọc từ `kb_entries` (published) thay `crop_knowledge` — AI chẩn đoán dùng dữ liệu chuẩn.
- [x] **Crawl tự động (PRD Mục 3) — ĐÃ DEPLOY THÀNH CÔNG**:
  - [x] **Edge Function `kb-crawler`** deploy lên Supabase (test HTTP 200, crawl 6 bài từ Viện WASI).
  - [x] **URL RSS đã xác minh thực tế**: `wasi.org.vn/feed/` + `khuyennongvn.gov.vn/feed/` (2 feed thật); ppd/sofri/nongnghiep **không có RSS** (cần web scraper riêng nếu muốn thêm).
  - [x] **pg_cron**: đã bật, job `kb-crawler-weekly` (06:00 thứ 2 hàng tuần).
  - [x] **8 bài draft** trong `raw_articles` (6 tự động + 2 seed) — sẵn sàng cho Admin phê duyệt.
  - [x] Secrets: không cần set (Supabase tự cung cấp SUPABASE_URL/SERVICE_ROLE).
  - *Còn lại (tuỳ chọn): thêm nguồn ppd/sofri/nongnghiep cần viết web scraper; Google Alerts qua Zapier/Make.*

### 🌱 Phase 2.7 — Hiểu vườn (P0) — trợ lý chăm vườn trên Home
*(UX Blueprint: biến "Nhật ký" → "Hiểu vườn" → "Trợ lý chăm vườn")*
- [x] **Module thuần `src/gardenHealth.js`**: `computeGardenHealth(garden, logs, weather)` tính trạng thái từng vườn theo **thời tiết + nhật ký**. Tách logic khỏi UI để tái sử dụng & kiểm thử (Vitest).
- [x] **Trạng thái 🟢🟡🔴** mỗi vườn: `good` (Ổn định 🟢) / `warn` (Cần chú ý 🟡) / `risk` (Cần xử lý 🔴); mức tổng = mức nghiêm trọng nhất của các chỉ báo.
- [x] **Cảnh báo sâu bệnh theo vườn**: trời ẩm (mưa > 0 hoặc độ ẩm ≥ 85%) + vườn chưa phun phòng nấm gần đây → cảnh báo nguy cơ nấm/thán thư. Ngưỡng: ≥10 ngày 🟡, ≥14 ngày 🔴.
- [x] **Nhắc lịch chăm sóc**: "đã X ngày chưa tưới" (nắng ≥34°C kéo dài ngưỡng dày hơn: 3 ngày 🟡), "chưa ghi nhật ký tưới", "đã X ngày chưa bón phân".
- [x] **Nhật ký cũ không gắn `garden_id`** vẫn được tính qua fallback theo `crop_type` (tránh bỏ sót bản ghi lịch sử).
- [x] **UI `Hiểu vườn` trên Home**: thẻ tổng quan từng vườn (tên + cây trồng + trạng thái + các gợi ý đơn, nút "Ghi nhật ký" / "Hỏi Bác sĩ AI"); trống → nhắc tạo vườn.
- [x] **Kiểm thử**: `src/test/gardenHealth.test.js` (8 test — thời tiết khô/humid, muộn phun thuốc, nắng nóng thiếu nước, chưa có nhật ký, fallback crop_type, sắp xếp vườn).
- [ ] *(Nâng cao, tùy chọn)* Gợi ý theo crop cụ thể; cảnh báo dịch bệnh theo vùng (Phase 3); liên kết chẩn đoán AI → vườn.

### 🧩 Phase 2.8 — Zone Management theo `docs/Zone.md` — **Phase A (Bác sĩ AI gắn Zone + Issue)**
*(Zone.md §1–§12; theo §24: mở rộng schema hiện tại, không phá dữ liệu cũ. Đã chọn làm Phase A trước.)*
- [x] **Migration `supabase/phase5_zones.sql`** (đã push lên Supabase thật, **tables `zones` + `issues` đã tồn tại**): 
  - `gardens`: + `crop_types JSONB` (hỗ trợ xen canh nhiều cây — Zone.md §2), + `boundary_polygon`, `center_lat/lng`.
  - `zones` (garden_id, name, code A/B/C/D/E, polygon, area_m2, center, `UNIQUE(garden_id,code)`). **Không lưu màu** (trạng thái tính từ dữ liệu).
  - `issues` (garden_id, zone_id, issue_type, photo, lat/lng, ai_result, confidence, status). **Status mặc định `NEEDS_REVIEW`** (AI không tự khẳng định bệnh — Zone.md §12).
  - `logs`: + `scope` (GARDEN/ZONES), `zone_ids[]`.
  - RLS cho `zones`/`issues`: chủ vườn (qua garden→profile) toàn quyền.
- [x] **`src/zoneService.js`** (thuần, dễ test): `pointInPolygon` (ray-casting), `distanceToBoundary`, `polygonArea` (shoelace), `resolveZoneFromGps` (found / near-ranh-giới / none), `polygonCentroid`, `generateSampleZones` (placeholder 2×2 khi chưa vẽ polygon thật).
- [x] **Bác sĩ AI gắn Zone (Zone.md §9–§11)**: trong tab Bác sĩ AI → chọn vườn → **"📍 Tự xác định khu từ vị trí của bạn"** (GPS → point-in-polygon) → nếu gần ranh giới (`near`) chọn khu gần nhất + cho phép sửa tay; nếu không xác định (`none`) → bắt chọn thủ công. GPS chỉ là gợi ý, người dùng luôn sửa được.
- [x] **Tạo Issue từ phản hồi AI**: sau khi AI chẩn đoán → thẻ "⚠️ Ghi nhận vấn đề này?" → lưu `issues` với garden_id, zone_id, ảnh, GPS, ai_result, confidence, status `NEEDS_REVIEW` → alert + refresh danh sách.
- [x] **Kiểm thử**: `src/test/zoneService.test.js` (**15 test**: điểm trong/ngoài/trên biên, found/near/none, diện tích, centroid, sample zones).
- [x] **Zone status 🟢🟡🔴 từng khu (Phase B)**: `src/zoneHealth.js` (`computeZoneHealth(zone, issues, logs, weather)` + `computeAllZonesHealth`) — trạng thái TÍNH từ dữ liệu (không lưu màu): Issue chưa xử lý (NEEDS_REVIEW→🟡, CONFIRMED/TREATING→🔴) + nhắc lịch (chưa phun phòng khi trời ẩm, chưa tưới, chưa bón) + thời tiết; `logAppliesToZone` (scope=GARDEN áp toàn vườn, scope=ZONES chỉ khi zone_ids chứa khu). Hiển thị **"🧩 Khu vực trong vườn"** trong card "Hiểu vườn" (mỗi khu A/B/C/D, nguồn zone từ DB hoặc sinh mẫu quanh tâm vườn). Kiểm thử `src/test/zoneHealth.test.js` (**9 test**).
- [x] **Bản đồ + vẽ ranh giới + chia khu (Phase C)** — **không cần tile network** (chạy offline / qua HTTP LAN):
  - `zoneService.js` + thêm **hình học polygon**: `polygonBounds`, `clipPolygonToRect` (Sutherland–Hodgman cắt 4 cạnh), `splitPolygonIntoZones(polygon, N)` — **chia N khu nằm HOÀN TOÀN trong polygon** (grid cells ∩ polygon, giữ N ô lớn nhất, tên A/B/C/D…). Kiểm thử +8 test (tổng `zoneService.test.js` = 23 test).
  - `src/GardenMap.jsx` (SVG editor, tự chứa): **chạm để vẽ polygon** → tính diện tích (shoelace) → **chia 4/5 khu** → **kéo chỉnh điểm** → xác nhận; màu khu + nhãn diện tích; hoàn tác/xóa. Neo sơ đồ quanh tâm vườn (lat/lng) để điểm vẽ ra tọa độ real.
  - `GardensManager.jsx` tích hợp: nút **"🗺️ Vẽ ranh giới & chia khu"** trên từng vườn → mở `GardenMap` → **Lưu** cập nhật `gardens.boundary_polygon/area_m2/center_lat/lng` + thay `zones` (xóa cũ, insert mới).
  - *(Nâng cao, tuỳ chọn)*: đổi tên khu, undo khi chỉnh polygon, hiển thị ảnh Issue trên bản đồ, log scope GARDEN/ZONES trong UI ghi nhật ký, "Hôm nay cần làm gì" cấp Zone tương tác — để dành phase sau.

### 💬 Phase 2.9 — Nâng cấp Bác sĩ AI (nhật ký vườn + lịch sử + chống trùng lặp)
- [x] **Sửa modal voice bị ẩn phía trên**: modal "Tôi ghi nhận như sau" & "Nhập đợt thu hoạch" đổi `alignItems: center` → `flex-start` + `overflowY: auto` + `margin: auto` → khi nội dung cao hơn màn hình thì cuộn được, tiêu đề không bị cắt.
- [x] **Bác sĩ AI đọc nhật ký vườn**: `analyzeCropDisease(userMessage, images, gardenLogs)` chấp nhận nhật ký; khối `=== NHẬT KÝ VƯỜN GẦN ĐÂY ===` đưa 8 bản ghi gần nhất vào prompt + hướng dẫn AI **đối chiếu & phân tích ảnh hưởng qua lại** (vd: phun thuốc nấm rồi trời mưa 3 giờ → thuốc có bị trôi? cần phun lại?; bón phân hóa học trộn vi sinh / vôi trộn phân hóa học → phản ứng? cách bón đúng). `formatGardenLogs()` tách riêng, dễ test.
- [x] **Lưu lịch sử chat (5 phiên gần nhất)**: `chatSessions` + `loadChatSessions/saveChatSessions` (localStorage); tự khôi phục phiên gần nhất khi mở lại, tự lưu mỗi khi chat đổi. Thêm **"✨ Cuộc trò chuyện mới"** + thanh **📜 mở lại các hội thoại cũ** trong tab Bác sĩ AI.
- [x] **Chống trùng lặp câu hỏi**: so sánh câu hỏi hiện tại với các phiên trước (bỏ dấu tiếng Việt + Jaccard similarity ≥ 0.7) → nếu giống, **tái sử dụng câu trả lời cũ** thay vì gọi AI lại (tiết kiệm chi phí, tránh lặp).
- [x] **Kiểm thử**: `geminiService.test.js` +3 test `formatGardenLogs` (rỗng, hợp lệ, sắp xếp & giới hạn 8).

### ☁️ Phase 2.10 — Icon thời tiết SVG theo ngày/đêm & điều kiện
- [x] **Icon SVG nhiều lớp** (`src/WeatherIcon.jsx`): mặt trời (ngày, tia vàng) / trăng khuyết (đêm, cắt bằng mask — không phụ thuộc nền) + đám mây + giọt mưa/tuyết/sét theo **điều kiện thực tế**:
  - Trời quang → chỉ mặt trời/trăng (không mây); Có mây (partly) → mặt trời/trăng nhỏ + 1 mây; Nhiều mây (cloudy) → 2 mây; Mưa (rain) → mây + giọt mưa; Dông (thunder) → mây + tia sét + giọt; Tuyết (snow) → mây + bông tuyết; Sương mù (fog) → mây mờ + vệt sương. Có **nền tròn mờ** để mây trắng nổi rõ trên nền widget (ngày xanh/đêm tối).
- [x] **`weatherCondition(code)`** trong `weatherService.js` phân loại WMO → clear/partly/cloudy/rain/thunder/snow/fog (dựng icon). Thêm `code` vào kết quả `fetchWeatherData` để truyền vào icon.
- [x] **Kiểm thử**: `weatherService.test.js` +5 test `weatherCondition`; `WeatherIcon.test.jsx` +6 test render (mặt trời ngày, trăng đêm, mưa, dông, tuyết, băng backdrop).
- [x] **Hiệu ứng sinh động (CSS animation, GPU-friendly — chỉ opacity/transform, tắt khi `prefers-reduced-motion`)**: mây **trôi ngang** (`wx-drift`), giọt mưa **rơi** (`wx-rain`), tia sét **nhấp nháy** (`wx-bolt`), tia nắng **xoay chậm** (`wx-spin`), icon **lơ lửng** (`wx-float`); nút **phóng nhẹ khi nhấn** (`.btn:active`), card nổi lên khi hover, tab điều hướng co lại khi chạm, chấm **"AI đang nghĩ..."** động (`thinking-dot`).
- [x] **Nút send Bác sĩ AI: nhấn = gửi văn bản, nhấn giữ ~2s = nhập thoại** (`handleSendPointerDown/Up/Leave` + hẹn giờ 2s): nhấn nhanh → `sendToAI`; nhấn giữ đủ 2s → mở **overlay nhập thoại** (Web Speech API tiếng Việt, `aiStartVoice/aiStopVoice/aiCancelVoice/aiSendVoice`, ghi nhận tạm thời tự điền → nút **Gửi**); overlay mở kể cả khi micro chưa sẵn sàng (kèm gợi ý Chrome/Edge), card bị chặn `maxHeight 88vh` + cuộn được; nút có hiệu ứng hold.
- [x] **Bác sĩ AI phân biệt vùng phân tích + nhận diện đúng cây**: thêm **bộ chọn chế độ "🌱 Vườn của tôi" ↔ "🗺️ Vùng/Vườn khác"** (state `aiMode`):
  - *Vườn của tôi*: AI đối chiếu **nhật ký + vườn + khu** đã lưu (như cũ); hiện card chọn vườn/khu + "Ghi nhận vấn đề → Issue".
  - *Vùng/Vườn khác*: AI phân tích **độc lập**, **KHÔNG áp nhật ký/vườn của nông dân** (tránh nhầm lẫn); ẩn card vườn/khu + ẩn nút Ghi nhận Issue.
  - Prompt nâng cấp: **BƯỚC 0 bắt buộc nhận diện cây** (sầu riêng/cà phê/hồ tiêu/khác) qua ảnh/mô tả → ghi `crop` + `crop_name` vào JSON; hiện badge "🌿 Cây nhận diện: ..." trong kết quả; `sendToAI` truyền `vineyardMode` + `cropHint` (từ vườn đang chọn) cho Gemini.


### 🚀 Phase 2.11 — Sẵn sàng Production (P1)
- [x] **Bảo mật Edge Function `kb-crawler`** (trước đây `verify_jwt=false` hoàn toàn mở — ai cũng kích hoạt được crawler): thêm xác thực **`x-crawler-secret`** so sánh với secret `CRAWLER_SECRET` (đặt qua `supabase secrets set`); chưa đặt secret → trả **503**; sai/thiếu → **401**; đúng → chạy crawl. Đã **deploy lại + set `CRAWLER_SECRET`** + verify: gọi không secret → 503, gọi đúng secret → HTTP 200 (crawl 2 nguồn, 10 bài, 7 đề xuất). Cập nhật `supabase/cron.sql` (truyền header `x-crawler-secret`) + `README-crawler.md`.
- [x] **FIX LỖI NGHIÊM TRỌNG (RLS)** — nông dân tự nâng quyền admin: policy UPDATE cũ `auth.uid()=id` **không hạn chế cột** → user có thể `PATCH is_admin=true`. Đã sửa:
  - Tách 2 policy UPDATE: *Người dùng* chỉ đổi hồ sơ mình, `is_admin/id` **giữ nguyên** (`WITH CHECK`); *Admin* được quản lý mọi hồ sơ.
  - Thêm trigger `prevent_is_admin_change` (defense-in-depth): chặn người không phải admin đổi `is_admin`/`id`.
  - **Verify trên Supabase thật**: farmer self-escalate → HTTP 400 "Không được phép tự thay đổi quyền is_admin." (is_admin giữ false); admin set is_admin → HTTP 204 (quản lý quyền hợp lệ); farmer chỉ thấy profile mình (cross-user isolation).
- [x] **Kiểm thử RLS đầy đủ** (tài khoản thật): anon → rỗng; farmer → chỉ thấy mình, không self-escalate; admin → quản lý mọi hồ sơ.
- [x] **FIX phân quyền trên UI** — nút "Vai trò: NÔNG DÂN ↔ ADMIN" (dev `toggleRole`, cho phép tự đổi vai trò do chỉ đổi state/ui) **đã bị xoá**: thay bằng **nhãn vai trò CHỈ ĐỌC** (`<span>` không onClick); quyền giờ chỉ do server cấp (`profile.is_admin`, RLS bảo vệ từ trên). Xoá `toggleRole` + đồng bộ localstorage của nó. **Verify UI thật**: admin → badge "VAI TRÒ: ADMIN" + thấy "KB Admin"; farmer → badge "VAI TRÒ: NÔNG DÂN" + **KHÔNG thấy "KB Admin"**; bấm vào badge không đổi vai trò (read-only). Nút demo nhanh chỉ hiện khi `IS_MOCK` (không ảnh hưởng production).
- [x] **Deploy readiness**: tạo `netlify.toml` (SPA redirect + cache assets); `npm run build` cho ra đầy đủ PWA (`manifest.webmanifest` + `sw.js` + `icon.svg`); `.env` đã gitignore; không có secret hardcode trong `src/`; cleanup `kb-callbacks` (config rác trong `config.toml`).
- [x] **Phân cấp vai trò (farmer < admin_v1 < admin_v0)** (`phase7_roles.sql` + `RoleManager.jsx`):
  - **Schema**: thêm cột `profiles.user_role TEXT` (`farmer`/`admin_v1`/`admin_v0`), backfill admin cũ → `admin_v0`; thêm `is_admin_v0()`; trigger `sync_is_admin_from_role` (đồng bộ `is_admin` theo role, giữ cột cũ → không vỡ tương thích); trigger `prevent_is_admin_change` chặn tự đổi role (chỉ dashboard/`auth.uid()=null` hoặc `admin_v0`).
  - **RLS tách quyền**: `posts` duyệt = `is_admin()` (V1+V0); `export_standards`, `kb_entries`, `raw_articles`, `crop_knowledge`, `regulatory_references`, `profiles` phân quyền = **chỉ `is_admin_v0()`** (toàn quyền).
  - **UI**: `App.jsx` đọc `profile.user_role` + rank (`isAdmin` = rank≥1, `isAdminV0` = rank≥2); badge chỉ đọc "Vai trò: Nông dân / Admin V1 / Admin V0"; menu **KB Admin + Phân quyền** chỉ V0; **MRLAdvisor** sửa chỉ V0; **Statistics** V1+V0 xem; Kiểm duyệt bài V1+V0.
  - **`RoleManager.jsx`** (chỉ V0): danh sách tài khoản + dropdown gán role.
  - **Verify thật**: V0 set admin_v1 → 204; admin_v1 tự nâng V0 → 400 "Chỉ Admin V0 được đổi vai trò"; admin_v1 edit MRL → **không đổi** (RLS chặn); V0 thấy "KB Admin + Phân quyền", badge "ADMIN V0".
- [x] **Chuẩn bị git cho GitHub+Netlify (Phương án A)**: `git init` + **`.gitattributes`** (chuẩn hoá line-ending) + bổ sung `.gitignore` (`supabase/.temp`, `test-results/`, `playwright-report/`); **commit ban đầu** (78 file, branch `main`); xác nhận **`.env` KHÔNG được track**, không secret hardcode (`seed_mrl`/`check_connection` đọc token từ env; crawler đọc `CRAWLER_SECRET` từ env). **`DEPLOY.md`** hướng dẫn push GitHub → import Netlify → đặt biến env → cấu hình Supabase Auth → kiểm tra.
- [x] **Deploy GitHub + Netlify (tự động, đã chạy)**: **push code lên GitHub** `tvkiembmtaseansteel2-web/agricommunity` (tạo repo mới vì username thật khác ảnh; tạm bỏ `.github/workflows/ci.yml` do token không có `workflow` scope); **deploy lên Netlify** `agricommunity.netlify.app` (state=ready, 7 assets); **set env vars** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `VITE_GEMINI_API_KEY` (qua CLI).
- [ ] *(Còn lại — cần bạn thao tác trên dashboard)*: **Bỏ "Site protection" trên Netlify** (Site settings → General → Site protection → tắt password/member-only — hiện site trả 401 do bị gate); **thêm domain** `https://agricommunity.netlify.app` vào **Allowed Redirect URLs** trong Supabase Auth; (nếu cần) cấp lại GitHub PAT có `workflow` scope để bật CI.

### 🔴 Phase 3 — Sản xuất & nhân rộng (tuần 9+)
- [ ] Đóng gói PWA phát hành, tối ưu SEO, domain riêng.
- [ ] Kết nối thương lái/doanh nghiệp thu mua; truy xuất nguồn gốc lô hàng (QR).
- [ ] Cảnh báo dịch bệnh theo vùng (dựa trên log + AI tổng hợp).
- [ ] Đánh giá chi phí; nếu vượt free tier → nâng gói Supabase có kiểm soát.

---

## 7. Trợ lý AI nông nghiệp (Bác sĩ cây trồng)

**Luồng xử lý:** ảnh lá/quả/thân (+ mô tả) → helper tra **knowledge base `crop_knowledge`** (RAG-lite) → Gemini `gemini-3.1-flash-lite` → JSON chuẩn:
`confidence` / `reasoning` / `diagnosis` / `alternatives[]` / `explanation` / `symptoms[]` / `protocol[]` / `active_ingredients` / `export_warning`.

**Quy tắc prompt (đã nâng cấp để tăng độ chính xác):**
1. **Prompt 2 giai đoạn:** mô tả khách quan đặc điểm ảnh → chẩn đoán & đối chiếu (không kết luận vội).
2. **RAG-lite:** nhúng hồ sơ bệnh từ `crop_knowledge` (9 bệnh thực tế) vào prompt → AI dựa trên dữ liệu, không tự bịa.
3. **Chẩn đoán phân biệt:** trả top-2 ứng viên (`alternatives[]` + xác suất + lý do).
4. Ưu tiên sinh học; nếu hóa chất ghi rõ nồng độ + REI + số lần.
5. Cấm Chlorpyrifos/Glyphosate/Carbendazim khi xuất EU/Trung Quốc; cảnh báo MRL theo thị trường.
6. Ảnh mờ/thiếu dữ kiện → `confidence="thap"`, khuyên liên hệ kỹ sư khuyến nông.

**Chế độ offline:** chưa có API key → mock chẩn đoán 8 kịch bản mẫu (đã có) để demo.

---

## 8. PWA & Offline

| Hạng mục | Hiện trạng |
| :--- | :--- |
| Manifest (`manifest.webmanifest`) | ✅ Đã thêm (name, theme-color xanh lá, standalone, icon SVG) |
| Service Worker (`sw.js`) | ✅ Đã thêm (network-first, cache app shell, offline fallback) |
| Đăng ký SW | ✅ Đã thêm trong `main.jsx` |
| Icon | ✅ `public/icon.svg` (biểu tượng 🌱) — Phase 1 thay bằng icon đầy đủ các kích thước |
| Cài lên điện thoại | ⏳ Cần HTTPS deployment (Vercel/Netlify mặc định có) |

---

## 9. Bảo mật & Tuân thủ pháp luật

1. **Nghị định 13/2023/NĐ-CP (bảo vệ dữ liệu cá nhân):**
   - Thu thập tối thiểu: SĐT (định danh), tên, địa chỉ vườn, diện tích, cây trồng.
   - Bắt buộc checkbox đồng ý trước khi lưu (`consent_granted`, `consent_date`) — đã có.
   - Chỉ dùng cho quản lý nông vụ nội bộ + truy xuất nguồn gốc; không bán dữ liệu.
2. **RLS:** mọi bảng đều bật; người dùng chỉ thấy/sửa dữ liệu của mình; bài đăng công khai chỉ hiện khi `approved`.
3. **Quyền admin:** cấp trong DB, client không tự nâng quyền được (đã sửa).
4. **Mật khẩu:** Supabase Auth quản lý (hash chuẩn), không lưu plaintext.
5. **(Phase 2)** Log truy cập dữ liệu nhạy cảm; xóa tài khoản theo yêu cầu (quyền "quên mình").

---

## 10. Ngân sách ước tính (giai đoạn pilot, đơn vị: VNĐ/tháng)

| Hạng mục | Chi phí | Ghi chú |
| :--- | :--- | :--- |
| Supabase Free tier | 0đ | 500MB DB, 1GB storage, 50K MAU — đủ pilot |
| Gemini API (flash) | ~0–50.000đ | 1.000 lượt chẩn đoán/tháng ≈ vài chục nghìn đồng |
| Hosting frontend (Vercel/Netlify) | 0đ | Static hosting free |
| SMS OTP | 0đ (Phase 1) | Không dùng; Phase 2 dùng Zalo OTP nếu cần |
| **Tổng pilot** | **≈ 0–50.000đ/tháng** | Rất phù hợp dự án cộng đồng/phi lợi nhuận |

---

## 11. Rủi ro & Giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
| :--- | :--- | :--- |
| Nông dân khó dùng app | Cao | Giao diện thẻ lớn, đào tạo trực tiếp tại HTX, nhập liệu giọng nói |
| Mạng yếu/vùng sâu | Cao | PWA offline, nén ảnh, tải nhẹ (<100KB shell) |
| AI chẩn đoán sai | Trung bình | Luôn kèm "đây là gợi ý, tham khảo kỹ sư địa phương"; Phase 2: chỉ dùng MRL từ DB |
| Dữ liệu MRL không chuẩn | Trung bình | Dữ liệu mẫu chỉ để demo; chờ tài liệu thật từ bạn |
| Chi phí vượt free tier khi mở rộng | Thấp | Giám sát usage, nén ảnh, giới hạn request AI/ngày |

---

## 12. Kiểm thử

1. **Thủ công (mỗi phase):** trên Chrome DevTools mobile + điện thoại thật (Android/iOS); kiểm tra 2 chế độ mock/thật.
2. **Luồng kiểm duyệt:** nông dân đăng → admin duyệt → bài hiện public.
3. **AI:** ảnh lá sầu riêng cháy bìa, cà phê rỉ sắt, tiêu vàng lá → kiểm tra độ chính xác + cảnh báo MRL.
4. **Phase 2:** Vitest (logic) + Playwright (E2E luồng chính) + CI trên GitHub.

---

## 13. Triển khai & vận hành

1. **Môi trường:** `.env` (Supabase URL/Key, Gemini key) — xem `.env.example`.
2. **Deploy:** Vercel/Netlify (free) → tự động HTTPS → PWA cài được. Tùy chọn: đặt sau Cloudflare.
3. **DB:** chạy `supabase_schema.sql` trong SQL Editor của Supabase; tạo Storage bucket `farm-images`.
4. **Vận hành:** theo dõi Supabase usage + Gemini quota hằng tuần trong pilot.

---

## 14. Phân công hợp tác (DeepSeek Harness ↔ Google Antigravity)

Dự án nằm chung tại `C:\Users\OS\.gemini\antigravity\scratch\agri-community-app` — hai môi trường làm việc trên cùng bộ file, mỗi bên ghi vào nhật ký thay đổi ở cuối file này để tránh đè công việc của nhau.

- **DeepSeek Harness:** đã hoàn thành đánh giá + kế hoạch v2 + sửa lỗi chặn + PWA cơ bản + cấu hình (Phase 0).
- **Antigravity:** đề xuất tiếp nhận các task Phase 1: UI đăng nhập/đăng ký, thời tiết Open-Meteo, upload ảnh Storage, nhập liệu giọng nói.
- **Quy tắc:** trước khi sửa file, đọc nhật ký thay đổi; sau khi xong, ghi log 1 dòng.

---

## 15. Nhật ký thay đổi (Change Log)

| Ngày | Người | Thay đổi |
| :--- | :--- | :--- |
| 27/08/2026 | DeepSeek Harness | Viết kế hoạch v2: đánh giá code, chốt 4 quyết định thiết kế, lộ trình 4 phase, ngân sách, rủi ro, phân công hợp tác |
| 27/08/2026 | DeepSeek Harness | Sửa lỗi chặn: profile_id khi insert, fetchUserData từ profiles, like/duyệt qua supabase, upload ảnh AI Doctor, fix JSX typo |
| 27/08/2026 | DeepSeek Harness | Gemini 2.5-flash mặc định (env `VITE_GEMINI_MODEL`); thêm PWA (manifest/SW/icon); `.env.example`; README; schema SQL nâng cấp |
| 27/08/2026 | DeepSeek Harness | Đọc tài liệu 2nong MRL; chốt Q5 (chỉ tham khảo, giữ đơn giản cho Đắk Lắk); **triển khai MRL Advisor** (tab Xuất khẩu + `MRLAdvisor.jsx`); thêm cột `rei_days` + dữ liệu mẫu 14 dòng vào schema & mock; kiểm tra kết nối Supabase/Gemini thật (`check_connection.mjs` — **bảng Supabase chưa được tạo**, cần chạy schema) |
| 27/08/2026 | DeepSeek Harness | **Màn hình Đăng nhập/Đăng ký** (`AuthScreen.jsx`): SĐT + mật khẩu, cam kết Nghị định 13, nút demo nhanh, đăng xuất; mock nhớ phiên (`agri_current_user_id`); export `IS_MOCK`; trigger `handle_new_user` tự tạo profiles khi đăng ký |
| 27/08/2026 | DeepSeek Harness | **Thời tiết thật Open-Meteo** (thay dữ liệu giả): nhiệt độ/ẩm/gió/mưa theo WMO code + khuyến nghị nông vụ tự động theo thời tiết |
| 27/08/2026 | DeepSeek Harness | **Chạy schema lên Supabase thật** (project gjavupiyrnuwtersagnw) qua Management API: 5 bảng + RLS + trigger handle_new_user + 14 dòng MRL + 4 index — xác minh OK. Sửa lỗi thứ tự index trong schema. Token tạm đã thu hồi/không lưu trong dự án |
| 27/08/2026 | DeepSeek Harness | **Upload ảnh vườn Storage** (`storageService.js`): nén ảnh ≤1024px/JPEG 80%, upload bucket `farm-images`, mock dùng dataUrl; form đăng bài chọn/chụp ảnh + preview + xóa ảnh; thêm `storage_bucket.sql` (bucket + policies idempotent) |
| 27/08/2026 | DeepSeek Harness | **Chạy storage_bucket.sql + sửa 2 lỗi bảo mật nghiêm trọng**: (1) `.env` đang chứa **SECRET key** (`sb_secret_`) thay vì anon key → thay bằng anon key thật (JWT) lấy qua Management API; (2) sửa **infinite recursion** trong RLS profiles bằng hàm `is_admin()` SECURITY DEFINER + cập nhật 3 policy liên quan; thêm policy xem bucket. Kiểm tra lại toàn bộ OK |
| 28/08/2026 | DeepSeek Harness | **Phase 2 (3 tính năng đầu)**: (1) **Nhập nhật ký giọng nói** (`VoiceInput.jsx`, Web Speech API tiếng Việt); (2) **Thời tiết theo tọa độ vườn** (lat/lng trong hồ sơ, mặc định Đắk Lắk); (3) **Bảng `post_likes` chống thích trùng** (schema + `phase2_schema.sql` đã chạy lên Supabase thật + mock nâng cấp hỗ trợ chuỗi `.eq()` + UI toggle like "Đã thích"). Build OK |
| 28/08/2026 | DeepSeek Harness | **Phase 2 (3 tính năng tiếp)**: (4) **Thông báo duyệt bài** (`notifications` + chuông 🔔 + dropdown, `phase2b_schema.sql`); (5) **Admin quản lý MRL** (thêm/đổi trạng thái/xóa hoạt chất trong tab Xuất khẩu); (6) **Cảnh báo hoạt chất cấm tự động** khi đăng bài (`flagged_chemical`, nổi bật cho admin duyệt, `phase2c_schema.sql`) |
| 28/08/2026 | DeepSeek Harness | **Phase 2 (3 tính năng cuối)**: (7) **Thống kê sản lượng vùng** (`Statistics.jsx` — tab Thống kê, xuất CSV Excel); (8) **Kiểm thử tự động** — Vitest 6 test + Playwright E2E 2 test (chế độ mock qua `.env.mock`) + CI GitHub Actions; (9) **Analytics ẩn danh** (`analytics.js`, Plausible — tôn trọng Nghị định 13, bật qua `VITE_ANALYTICS_DOMAIN`). Build + toàn bộ test pass |
| 28/08/2026 | DeepSeek Harness | **Nâng cấp chẩn đoán AI (độ chính xác)**: đổi model sang `gemini-3.1-flash-lite` (model cũ 404); thêm **knowledge base `crop_knowledge`** (9 bệnh thực tế 3 cây — `phase2d_knowledge.sql`, đã chạy lên Supabase) + `knowledgeService.js` (RAG-lite); **prompt 2 giai đoạn** (mô tả ảnh → chẩn đoán); **chẩn đoán phân biệt** (top-2 ứng viên); **hướng dẫn chụp ảnh chuẩn** trong UI |
| 28/08/2026 | DeepSeek Harness | **AI Doctor hỗ trợ tối đa 3 ảnh**: chọn nhiều ảnh (multiple), xem trước + xóa từng ảnh, đếm 2/3; gửi mảng ảnh (chính + phụ) lên Gemini; hiển thị lưới ảnh trong chat. Giúp chẩn đoán chính xác hơn khi xem nhiều góc (lá/thân/quả). Build + test OK |
| 28/08/2026 | DeepSeek Harness | **Cập nhật DB theo MASTER REGULATORY MATRIX** (`phase2e_regulatory.sql`, đã chạy): thêm `commodity_form` vào `export_standards` (19 dòng: MRL + mycotoxin aflatoxin/ochratoxin theo EU 2023/915); tạo bảng `regulatory_references` (12 nguồn pháp lý đã xác minh — luật, thông tư 75/2025 & 28/2026, QCVN 106, nghị định thư sầu riêng VN-CN, EU 396/2005...) |
| 28/08/2026 | DeepSeek Harness | **Chạy phase2b + phase2c lên Supabase thật** (token mới): bảng `notifications` + cột `flagged_chemical` — xác minh OK. Đồng bộ cả 2 phần vào `supabase_schema.sql` (nguồn tái tạo đầy đủ) |
| 28/08/2026 | DeepSeek Harness | **Cập nhật MRL Advisor**: hiển thị `commodity_form` (dạng sản phẩm) cho mỗi hoạt chất + khối **"Nguồn pháp lý áp dụng"** lấy từ `regulatory_references` (lọc theo thị trường, kèm nhãn loại văn bản + trạng thái hiệu lực + link văn bản gốc). Build OK |
| 28/08/2026 | DeepSeek Harness | **Tra cứu & nạp MRL** (`seed_mrl.mjs`): xác nhận EU database không có public API (đã probe tất cả endpoint → 404); nạp 13 dòng MRL mẫu qua Management API + cột `requires_verification`; UI hiển thị cờ 🔒 "chờ xác minh" + cảnh báo tổng. Đồng bộ schema (UNIQUE 4 cột + commodity_form + requires_verification) |
| 28/08/2026 | DeepSeek Harness | **Tái cấu trúc UX theo Blueprint**: (1) ngôn ngữ tự nhiên form nhật ký; (2) **Garden entity** (`gardens` + `GardensManager.jsx` + `phase3_gardens.sql` đã chạy + nhật ký chọn vườn); (3) **Home "Hôm nay vườn cần làm gì?"**; (4) **giảm nav còn 5 tab** (gom Vườn/Thống kê/Chất cấm/Hồ sơ vào "Tôi"). Build + 6/6 test pass |
| 28/08/2026 | DeepSeek Harness | **Tái cấu trúc UX (tiếp)**: (5) **Voice bóc tách dữ liệu** (`voiceParse.js`, modal xác nhận ✅/✏️); (6) **⚡ Ghi nhanh nhật ký** (3 trường) + form chi tiết bổ sung sau; (7) **rà soát state** — error thân thiện AI, empty/loading/success. Build + 6/6 test pass |
| 28/08/2026 | DeepSeek Harness | **PRD KB**: schema chuẩn hóa `kb_entries` + `raw_articles` + `is_expert` (`phase4_kb.sql` + `phase4_seed_kb.sql` đã chạy); `active_ingredients` tách riêng; luồng duyệt Draft→Expert→Published; UI `KBAdmin.jsx` (Hàng đợi/Tri thức/Thêm mục, chỉ admin); AI Doctor đọc từ `kb_entries`. Xác minh OK — **crawl (PRD Mục 3) cần backend, đã báo trung thực** |
| 28/08/2026 | DeepSeek Harness | **Deploy crawl KB**: cài supabase CLI + login + link project; **deploy `kb-crawler`** (test HTTP 200, crawl 6 bài từ Viện WASI); xác minh URL RSS thật (wasi + khuyennongvn có feed; ppd/sofri/nongnghiep không có RSS → cần web scraper); **bật pg_cron** job `kb-crawler-weekly` (06:00 thứ 2); 8 bài draft sẵn sàng duyệt |
| 28/08/2026 | DeepSeek Harness | **Phê duyệt → tự đăng cộng đồng**: khi admin duyệt bài crawl, tự tạo bài đăng trên bảng tin (status approved, author "📚 Kiến thức từ nguồn") với nội dung + link nguồn; refresh bảng tin sau khi đăng; render link click được. Xác minh OK |
| 28/08/2026 | DeepSeek Harness | **Phê duyệt → tạo KB + duyệt hàng loạt**: khi duyệt tự tạo `kb_entries` chuẩn (rawToKbEntry: plant_type từ keyword, category đoán, source_name); thêm cột `source_name`; nút "Phê duyệt tất cả draft" (duyệt cả hàng đợi một lần). Xác minh OK (KB + cộng đồng + published) |
| 28/08/2026 | DeepSeek Harness | **Hiểu vườn (P0) trên Home** (`gardenHealth.js` thuần + `gardenHealth.test.js`): trạng thái từng vườn 🟢🟡🔴 theo thời tiết + nhật ký; cảnh báo nấm (độ ẩm cao + chưa phun phòng ≥10/14 ngày); nhắc "đã X ngày chưa tưới/bón"; fallback nhật ký cũ theo crop_type. Build + 19/19 test pass |
| 28/08/2026 | DeepSeek Harness | **Thời tiết theo thời gian thực + định vị GPS** (`weatherService.js` + `weatherService.test.js`): nút 📍 Định vị (Home + màn hồ sơ) lấy vị trí GPS thực tế → Open-Meteo theo tọa độ đó + đảo ngược địa chỉ Nominatim (không key) hiện tên vùng; **tự làm mới mỗi 10 phút**; hiển thị nguồn vị trí + "Cập nhật lúc HH:MM"; ưu tiên GPS → vườn → Đắk Lắk; fallback mềm khi GPS lỗi. Build + 19/19 test pass |
| 28/08/2026 | DeepSeek Harness | **Zone Management Phase A (theo `docs/Zone.md`)** — Bác sĩ AI gắn Zone + Issue: migration `phase5_zones.sql` (**tables `zones`+`issues` đã push lên Supabase thật**; `gardens` +crop_types/boundary/center; `logs` +scope/zone_ids); `zoneService.js` thuần (point-in-polygon, resolve found/near/none, diện tích, sample zones); UI Bác sĩ AI "📍 Tự xác định khu từ vị trí của bạn" (GPS→Zone, gần ranh giới cho sửa tay) + thẻ "⚠️ Ghi nhận vấn đề → Issue (status NEEDS_REVIEW)"; `zoneService.test.js` 15 test. Build + 37/37 test pass + smoke E2E OK |
| 28/08/2026 | DeepSeek Harness | **Zone Management Phase B (theo `docs/Zone.md`)** — Zone status 🟢🟡🔴 từng khu + "Hiểu vườn" cấp Zone: `zoneHealth.js` (`computeZoneHealth`/`computeAllZonesHealth` — trạng thái TÍNH từ Issue chưa xử lý + nhật ký + thời tiết, không lưu màu; NEEDS_REVIEW→🟡, CONFIRMED/TREATING→🔴; `logAppliesToZone` scope GARDEN/ZONES); card "Hiểu vườn" mỗi vườn hiện "🧩 Khu vực trong vườn" (A/B/C/D, nguồn zone DB hoặc sinh mẫu quanh tâm). `zoneHealth.test.js` 9 test. Build + 46/46 test pass + smoke E2E OK |
| 28/08/2026 | DeepSeek Harness | **Zone Management Phase C (theo `docs/Zone.md`)** — bản đồ + vẽ ranh giới + chia khu (KHÔNG cần tile network, chạy offline/HTTP LAN): `zoneService` + hình học polygon (`polygonBounds`, `clipPolygonToRect` Sutherland–Hodgman, `splitPolygonIntoZones` chia N khu nằm hoàn toàn trong polygon; +8 test → 23 test); `GardenMap.jsx` SVG editor (chạm vẽ polygon → tính diện tích → chia 4/5 khu → kéo chỉnh → xác nhận; màu khu + nhãn m², hoàn tác/xóa); `GardensManager` nút "🗺️ Vẽ ranh giới & chia khu" → Lưu `gardens.boundary_polygon/area_m2/center` + thay `zones`. Build + 54/54 test pass + smoke E2E OK |
| 28/08/2026 | DeepSeek Harness | **Sửa GardenMap (kéo điểm + ổn định hình)**: hệ toạ độ ĐÓNG BĂNG khi mở editor (điểm không "nhảy"); kéo chấm đỏ đúng (chặn click lan thêm điểm nhầm, dùng ref hết stale closure); điểm chạm to + hướng dẫn rõ. Build + 54/54 test pass + smoke E2E (draw + drag + split OK) |
| 28/08/2026 | DeepSeek Harness | **Nâng cấp Bác sĩ AI (nhật ký + lịch sử + chống trùng lặp)**: (1) sửa modal voice/harvest bị ẩn phía trên (cuộn được, tiêu đề không cắt); (2) `analyzeCropDisease` đọc nhật ký vườn (`formatGardenLogs` + prompt đối chiếu ảnh hưởng qua lại — thuốc bị mưa trôi? trộn phân/vôi?); (3) lưu 5 phiên chat gần nhất (localStorage) + "✨ Cuộc trò chuyện mới" + 📜 mở lại hội thoại cũ; (4) chống trùng lặp câu hỏi (bỏ dấu + Jaccard ≥0.7 → tái dùng câu trả lời cũ). `geminiService.test.js` +3 test. Build + 57/57 test pass + smoke E2E OK |
| 28/08/2026 | DeepSeek Harness | **Icon thời tiết SVG theo ngày/đêm & điều kiện** (`WeatherIcon.jsx`): mặt trời (ngày) / trăng khuyết (đêm, mask) + mây + giọt mưa/tuyết/sét theo điều kiện thực tế; `weatherCondition(code)` phân loại WMO; thêm `code` vào `fetchWeatherData`. `weatherService.test.js` +5 test, `WeatherIcon.test.jsx` +6 test render. Build + 68/68 test pass + smoke E2E OK |
| 28/08/2026 | DeepSeek Harness | **Hiệu ứng sinh động** (CSS animation, GPU-friendly — chỉ opacity/transform; tắt khi `prefers-reduced-motion`): mây trôi (`wx-drift`), giọt mưa rơi (`wx-rain`), tia sét nhấp nháy (`wx-bolt`), tia nắng xoay chậm (`wx-spin`), icon lơ lửng (`wx-float`); nút phóng nhẹ khi nhấn, card nổi lên khi hover, tab co lại khi chạm, chấm "AI đang nghĩ..." động (`thinking-dot`). Xác minh bằng 2 khung hình (mây di chuyển). Build + 68/68 test pass |
| 28/08/2026 | DeepSeek Harness | **Nút send Bác sĩ AI 2 chế độ (nhấn / nhấn giữ 2s)**: nhấn nhanh → gửi văn bản; nhấn giữ ~2s → **overlay nhập thoại** (Web Speech API tiếng Việt, tự điền → nút Gửi; mở cả khi micro chưa sẵn sàng, kèm gợi ý Chrome/Edge; card chặn 88vh cuộn được). Smoke test: tap-send hiện tin nhắn, hold mở overlay — không lỗi. Build + 68/68 test pass |
| 28/08/2026 | DeepSeek Harness | **Bác sĩ AI phân biệt vùng + nhận diện đúng cây**: thêm bộ chọn chế độ **"🌱 Vườn của tôi" ↔ "🗺️ Vùng/Vườn khác"** (`aiMode`); *Vườn của tôi* bám nhật ký/vườn/khu (có card chọn vườn + Ghi nhận Issue), *Vùng khác* phân tích độc lập (ẩn card vườn/khu + ẩn Ghi nhận Issue); prompt **BƯỚC 0 bắt buộc nhận diện cây** (sầu riêng/cà phê/hồ tiêu/khác) → ghi `crop`/`crop_name` + badge "🌿 Cây nhận diện"; `sendToAI` truyền `vineyardMode`+`cropHint`. Build + 68/68 test pass + smoke E2E OK |
| 28/08/2026 | DeepSeek Harness | **Sẵn sàng Production (P1)**: (1) **Bảo mật crawler** — thêm `x-crawler-secret` (so sánh `CRAWLER_SECRET`), deploy lại + set secret, verify 503/401/200; (2) **FIX LỖI NGHIÊM TRỌNG RLS** — nông dân tự nâng quyền admin (policy UPDATE không hạn chế cột) → tách policy người-dùng/admins + trigger `prevent_is_admin_change`; **verify trên Supabase thật** (farmer self-escalate → 400, admin quản lý → 204, cross-user isolation OK); (3) **Deploy ready** — `netlify.toml`, build PWA đầy đủ, `.env` gitignore, không secret hardcode, cleanup `kb-callbacks`. Build + 68/68 test pass |
| 28/08/2026 | DeepSeek Harness | **FIX phân quyền UI (không tự đổi vai trò)**: xoá dev `toggleRole` (nút "Vai trò: NÔNG DÂN ↔ ADMIN" — trước đây user tự đổi vai trò chỉ là state/ui) → thay bằng **nhãn chỉ đọc** (`<span>` không onClick); quyền chỉ do server cấp (`profile.is_admin`, RLS bảo vệ). Verify UI thật: admin thấy "VAI TRÒ: ADMIN" + "KB Admin"; farmer thấy "VAI TRÒ: NÔNG DÂN" + **không thấy "KB Admin"**; bấm badge không đổi vai trò. Build + 68/68 test pass + smoke E2E OK |
| 28/08/2026 | DeepSeek Harness | **Phân cấp vai trò (farmer < admin_v1 < admin_v0)** (`phase7_roles.sql` + `RoleManager.jsx`): thêm `profiles.user_role` + backfill admin→`admin_v0`; `is_admin_v0()`; trigger `sync_is_admin_from_role` (đồng bộ `is_admin`); RLS: `posts`=V1+V0, `export_standards`/`kb_entries`/`raw_articles`/`crop_knowledge`/`regulatory_references`/`profiles`=**chỉ V0**; UI đọc role+rank, badge "Vai trò: Nông dân/Admin V1/Admin V0", menu **KB Admin + Phân quyền** chỉ V0, MRL sửa chỉ V0; `RoleManager` (V0) gán role. Verify: V0 set V1→204; V1 tự nâng→400; V1 edit MRL→không đổi; V0 thấy "ADMIN V0"+"KB Admin"+"Phân quyền". Build + 68/68 test pass + smoke E2E OK |
| 28/08/2026 | DeepSeek Harness | **Chuẩn bị deploy GitHub+Netlify (Phương án A)**: `git init` + `.gitattributes` (chuẩn hoá EOL) + `.gitignore` mở rộng (`supabase/.temp`, `test-results/`, `playwright-report/`); commit ban đầu **78 file, branch `main`**; xác nhận `.env` không track, không secret hardcode; `DEPLOY.md` (hướng dẫn push GitHub → import Netlify → env → Supabase Auth). Build + 68/68 test pass. *(Còn lại: bạn push GitHub + import Netlify + đặt biến env — cần tài khoản)* |
| 28/08/2026 | DeepSeek Harness | **Deploy thật GitHub + Netlify**: push code lên GitHub `tvkiembmtaseansteel2-web/agricommunity` (user thật khác ảnh; tạo repo mới; tạm bỏ `.github/workflows/ci.yml` do token không có `workflow` scope); deploy Netlify `agricommunity.netlify.app` (state=ready, 7 assets); set env `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_GEMINI_API_KEY`. *(Còn lại: bỏ "Site protection" trên Netlify — site đang trả 401 do gate; thêm domain vào Allowed Redirect URLs Supabase Auth)* |
