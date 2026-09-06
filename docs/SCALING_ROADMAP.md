# 📈 AgriCommunity — Lộ trình bảo vệ dữ liệu & mở rộng (SCALING ROADMAP)

> Tài liệu này là "bộ nhớ" bền vững của dự án. Khi số người dùng tăng, hãy đọc
> `implementation_plan.md` + tài liệu này để biết hành động tiếp theo theo giai đoạn.
> (Cập nhật: 2026-09-04)

---

## 🔒 Khẳng định quan trọng
- **Supabase KHÔNG tự xóa dữ liệu người dùng** sau một thời gian.
- Dữ liệu chỉ mất khi: (1) xóa project chủ động, (2) vi phạm hạn mức quá lâu,
  (3) backup 7 ngày hết hạn mà cần khôi phục, (4) lỗi logic/ghi đè/xóa nhầm.
- RLS đã bảo vệ: **user chỉ thấy/sửa dữ liệu của mình** → hàng loạt user không thể
  "phá" dữ liệu của nhau. Đây là lớp bảo vệ quan trọng nhất.

---

## ✅ Đã triển khai
### 1. Soft-delete (chống xóa nhầm) — Phase 8
- Thêm cột `deleted_at TIMESTAMPTZ` cho bảng **`gardens`**, **`logs`**, **`yields`**.
- RLS SELECT của 3 bảng giờ `AND deleted_at IS NULL` → row "đã xóa" tự ẩn khỏi user.
- Chỉ mục `idx_*_active` (partial, WHERE deleted_at IS NULL) → truy vấn nhanh.
- Hàm `public.soft_delete(table_name, row_id, owner_id)` dùng chung (SECURITY DEFINER,
  kiểm tra ownership, không xóa thật).
- App: `GardensManager.handleDelete` đổi từ `.delete()` → `.update({deleted_at})`
  (thông báo "khôi phục được"). Đọc dữ liệu tự ẩn row đã xóa nhờ RLS.
- **Migration:** `supabase/migrations/20260904_phase8_soft_delete.sql` (đã `db push`).

### 2. RLS per-user (đã có từ trước)
- `gardens`, `logs`, `yields` đều chặn theo `profile_id = auth.uid()`.
- Farmer không thể đọc/sửa/xóa dữ liệu của người khác.

---

## 🗺️ Hành động theo giai đoạn (THỰC HIỆN KHI SỐ USER TĂNG)

### Giai đoạn 0–100 user (hiện tại)
- ✅ RLS + soft-delete đã có.
- ✅ **Backup PG dump tự động** — GitHub Actions cron `.github/workflows/db-backup.yml` chạy hằng ngày (02:30 UTC), lưu Artifact `supabase-backup` (30 ngày). Xem mục "Backup" bên dưới.
- ✅ **Error tracking** — Sentry (`src/sentry.js`), bật khi có `VITE_SENTRY_DSN`; dev/mock bỏ qua.
- ✅ **Gemini key ở server** — Edge Function `gemini-proxy` (verify_jwt, key không lộ).
- ✅ **Hạn mức AI + phân gói (Phase 9)** — `profiles.plan` (free/pro) + bảng `ai_usage`; `gemini-proxy` chặn vượt hạn mức (free=5, pro=100 lượt/ngày); UI hiện "lượt còn lại" + nút nâng cấp; Admin bật Pro trong "Phân quyền". Bảo vệ quota free + giới hạn chi phí khi lên paid.
- ✅ **Export CSV** — nút "⬇️ Xuất CSV" ở tab Nhật ký (nhật ký) + card sản lượng (sản lượng). Tải file `.csv` UTF-8 (BOM) mở đúng tiếng Việt trong Excel. Lưới an toàn dữ liệu cho nông dân (tự lưu dữ liệu của mình).
- ✅ **PoC KB từ video YouTube (Phase 10)** — Edge Function `kb-from-video`: whitelist `video_sources` (điểm tin cậy) → AI tóm tắt/trích cấu trúc → **đối chiếu chéo với KB** (cờ conflict) → chỉ ghi `raw_articles` **draft** (chưa vào AI), admin duyệt mới published. Bảo vệ: chỉ kênh credibility≥2 mới được đưa vào. *(Chạy được qua transcript client gửi; cần thêm nguồn kênh uy tín thật.)*
- 🔲 **Thu phí tự động** (Momo/Stripe) cho gói Pro — hiện admin bật thủ công.

### Giai đoạn 100–1000 user
- 🔲 Nâng lên **Supabase Pro** để bật **PITR (Point-in-time Recovery)** — phục hồi
  về bất kỳ thời điểm trong 7 ngày, chống mất do lỗi/bug release.
- 🔲 **Giới hạn rate-limit + cache** cho **Gemini API** (mỗi câu Bác sĩ AI = 1 request)
  → tránh vượt hạn mức gây gián đoạn.
- 🔲 Monitoring + alert cho backup chạy đúng, lưu lượng, tỷ lệ lỗi.

### Giai đoạn >1000 user
- 🔲 **Đọc replica** / tối ưu truy vấn nếu cần.
- 🔲 Xem xét **cache CDN + tối ưu asset** (đã có `netlify.toml` cache immutable).
- 🔲 Chiến lược backup nâng cao (retention dài hơn, multi-region).

---

## 💡 Chi phí dự kiến (Netlify + Supabase) cho ~1000 user
| Hạng mục | Ước tính |
|---|---|
| **Netlify** | ~0đ (free) — PWA tĩnh, data động gọi thẳng lên Supabase/Gemini |
| **Supabase Free** | DB + Auth + Storage (đủ cho ~1000 user nếu ít ảnh lớn) |
| **Supabase Pro** (nếu cần PITR) | ~$25/tháng |
| **Gemini API** | **Đáng chú ý nhất** — trả theo số request AI Doctor |

→ Ưu tiên tối ưu chi phí: giới hạn/cache **Gemini** (AI Doctor) trước tiên.

## 💳 Gói dịch vụ (tạo doanh thu khi vượt tier free)

| Gói | Hạn mức AI/ngày | Đối tượng | Giá đề xuất |
|---|---|---|---|
| **Free** | 5 lượt AI | Nông dân mới, dùng thử | 0đ |
| **Pro** | 100 lượt AI | Nông dân chuyên, dùng nhiều | ~50.000–99.000đ/tháng |

- **Cách bật Pro:** Admin bật trong **"Phân quyền"** (RoleManager → nút ⭐ Gói Pro). Chưa cần thanh toán tự động.
- **Khi cần thu phí tự động:** tích hợp Momo/VNPay/Stripe (ghi trong mục "Giai đoạn sau"), mỗi user có hạn mức riêng.
- **Lưu ý:** hạn mức free=5 là để **vừa quota Gemini free tier** (nếu nhiều user hơn cần giảm xuống hoặc lên paid Gemini). Đây là điểm cân bằng giữa trải nghiệm & chi phí.

---

## 🗄️ Backup & Restore (Blocker #2) — ✅ Đã chạy thành công

### Backup tự động (GitHub Actions cron)
- File: `.github/workflows/db-backup.yml` — chạy **02:30 UTC hằng ngày** (+ chạy tay qua "Run workflow").
- Lệnh: `pg_dump` (bản **17**, khớp server) toàn DB → gzip → **Artifact `supabase-backup`** (giữ 30 ngày, tải từ **Actions → Artifacts**).
- Script thủ công (máy có `pg_dump`): `scripts/backup-supabase.sh`.
- **Đã xác minh**: workflow chạy success, artifact ~307 KB. (Lưu ý kỹ thuật: dùng biến `PG*` thay URL string để tránh lỗi ký tự đặc biệt trong password; cài `postgresql-client-17` để khớp server.)

### CẤU HÌNH 1 LẦN (bắt buộc để chạy):
Thêm **GitHub Secret**:
```
Name:  SUPABASE_DB_PASSWORD
Value: <mật khẩu database>  ← Supabase Dashboard → Settings → Database → Connection → Database password
```
Reference id: `gjavupiyrnuwtersagnw` (pooler `aws-0-ap-northeast-2.pooler.supabase.com`).
> ⚠️ KHÔNG commit mật khẩu này vào repo. Chỉ dùng qua Secret.

### Khôi phục (restore)
Tải `.sql.gz` từ Artifact về rồi:
```bash
gunzip -c agri_gjavupiyrnuwtersagnw_20XX.sql.gz | psql "postgresql://postgres.<ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
```
> ⚠️ Thao tác này **ghi đè lên DB đang chạy** — chỉ chạy khi thật sự cần khôi phục. Nên test trên môi trường tách trước.

### Ghi chú
- Backup này là **lưới an toàn bổ sung** cho native backup (Supabase giữ 7 ngày).
- Muốn **PITR** (phục hồi bất kỳ thời điểm) → lên **Supabase Pro** (~$25/tháng) khi >1000 user.

---

## 📌 Cách khôi phục dữ liệu đã soft-delete
Nếu cần "hoàn tác" một vườn/nhật ký/sản lượng đã xóa mềm:
```sql
-- Xem tất cả (kể cả đã xóa mềm)
SELECT * FROM public.gardens WHERE deleted_at IS NOT NULL;
-- Khôi phục: xóa deleted_at (đặt lại NULL)
UPDATE public.gardens SET deleted_at = NULL WHERE id = <id>;
```
(Chỉ admin/service-role chạy được vì user chỉ SELECT thấy row còn hoạt động.)

---

## 🧠 Nguồn tri thức cho Bác sĩ AI (KB) — Phase 10

### Pipeline hiện tại
```
Crawler (RSS) → raw_articles (draft) ─┐
Admin nhập tay                            ├─→ kb_entries (published) → AI RAG
kb-from-video (YouTube) → draft ──────────┘
```

### Quy tắc kiểm chứng (chống nội dung sai)
1. **Chỉ nguồn whitelist**: bảng `video_sources` (credibility 0–3). Chỉ kênh **≥2** (đáng tin) mới được đưa vào.
2. **Đối chiếu chéo**: function `kb-from-video` so nội dung với `kb_entries` đã duyệt → cờ `conflict` nếu hoạt chất mâu thuẫn.
3. **Chỉ ghi draft**: tuyệt đối không đưa trực tiếp vào AI; admin/expert duyệt mới `published`.
4. **Hoạt chất/liều lượng**: nếu video nêu nhưng không chắc → gắn cờ "cần xác minh", không tự tin.

### Cách dùng kb-from-video
1. Client bóc transcript (youtube-transcript-api) → gọi `functions.invoke('kb-from-video', {videoId, channelName, transcript, videoTitle})`.
2. Kết quả → `raw_articles` draft + `conflict`/`crossSource` → admin xem & duyệt trong KBAdmin.

### Việc cần làm tiếp (khi quyết định mở rộng)
- 🔲 Thêm kênh uy tín thật vào `video_sources` (viện/trường/khuyến nông) + xác minh tổ chức.
- 🔲 Tầng 3: **pgvector embedding** → tìm kiếm ngữ nghĩa thay vì lọc theo loại cây.
- 🔲 Tầng 2 đầy đủ: AI trích `raw_articles` (web) → `kb_entries` chuẩn tự động (giảm duyệt thủ công).
