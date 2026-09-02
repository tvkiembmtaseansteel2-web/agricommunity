# 🤖 Crawl Dữ Liệu KB — Triển khai xong (PRD Mục 3)

> ✅ **Đã deploy và chạy thử thành công** (28/08/2026). Đọc phần "Trạng thái" bên dưới.

## ✅ Trạng thái

| Hạng mục | Trạng thái |
|---|---|
| Edge Function `kb-crawler` | ✅ Đã deploy (supabase functions deploy) |
| Test gọi function | ✅ HTTP 200, crawl được 6 bài (Viện WASI) |
| Dữ liệu vào `raw_articles` | ✅ 8 bài draft (6 tự động + 2 seed) |
| pg_cron | ✅ Đã bật, lịch `kb-crawler-weekly` (06:00 thứ 2 hàng tuần) |
| Đăng nhập CLI | ✅ Logged in (dùng token PAT) |
| Secrets | ✅ Không cần set `SUPABASE_URL`/`SERVICE_ROLE` (Supabase tự cung cấp). ⚠️ **Cần set `CRAWLER_SECRET`** (bảo mật, xem dưới) |

## 🔐 Bảo mật lời gọi crawler (đã nâng cấp)

Từ 28/08/2026, edge function `kb-crawler` **yêu cầu `x-crawler-secret`** khớp với secret `CRAWLER_SECRET` — tránh người lạ gọi/kích hoạt crawl (tiêu tốn tài nguyên, chèn dữ liệu rác). Nếu chưa đặt secret → function trả **503**.

**Bước 1 — đặt secret (1 lần):**
```bash
supabase secrets set CRAWLER_SECRET=<mật khẩu mạnh ngẫu nhiên>
```
Ví dụ: `supabase secrets set CRAWLER_SECRET="kwH9xQ2v8mNpL5rT7bY..."`

**Bước 2 — gọi crawler thủ công (kèm header):**
```bash
curl -X POST https://gjavupiyrnuwtersagnw.supabase.co/functions/v1/kb-crawler \
  -H 'Content-Type: application/json' \
  -H 'x-crawler-secret: <CRAWLER_SECRET>'
```

**Bước 3 — đồng bộ pg_cron:** cập nhật job trong `supabase/cron.sql` để truyền `x-crawler-secret` (thay `<THAY_BANG_CRAWLER_SECRET_CUA_BAN>`). Dán lại vào SQL Editor → chạy.

> 💡 Cách kiểm tra nhanh secret đã đặt: gọi function **không** kèm secret → phải trả **401** (Sai/thiếu x-crawler-secret).

## 📡 Nguồn RSS ĐÃ XÁC MINH (đã cập nhật vào `index.ts`)

| Nguồn | URL feed | Trạng thái |
|---|---|---|
| **Viện WASI** (cà phê, tiêu) | `https://wasi.org.vn/feed/` | ✅ Feed thật (rss+xml) |
| **Khuyến nông Quốc gia** | `https://khuyennongvn.gov.vn/feed/` | ✅ Feed thật (wp) |
| Cục BVTV (ppd.gov.vn) | không có RSS | ⚠️ Cần web scraper riêng |
| Viện SOFRI | không có RSS | ⚠️ Cần web scraper riêng |
| Báo Nông nghiệp | `/feed/` trả HTML, không phải feed | ⚠️ Cần web scraper riêng |

> 💡 3 nguồn chưa có RSS: để thêm, cần **viết web scraper** (đọc HTML trang, tìm bài viết theo cấu trúc) — khác với RSS. Hiện crawler đã hoạt động với 2 feed thật (WASI + Khuyến nông) — đây là 2 nguồn kỹ thuật chất lượng cao.

## 🔁 Vòng lặp đã hoàn chỉnh
```
Crawler (chạy thủ công hoặc pg_cron 06:00 thứ 2)
        ↓
raw_articles [draft]  ← Crawler đã ghi bài vào đây
        ↓
Admin/Expert: Tôi → KB Admin → Hàng đợi → Phê duyệt
        ↓
kb_entries [published]
        ↓
AI Doctor chẩn đoán dùng dữ liệu chuẩn
```

## 🚀 Cách chạy crawler thủ công (kiểm tra nhanh)
```bash
curl -X POST https://gjavupiyrnuwtersagnw.supabase.co/functions/v1/kb-crawler
```
Hoặc qua Supabase Dashboard → Edge Functions → kb-crawler → Invoke.

## 🧩 Muốn thêm nguồn / web scraper?
- **Thêm RSS**: thêm `{ name, url }` vào mảng `RSS_SOURCES` trong `index.ts` → `supabase functions deploy kb-crawler`.
- **Web scraper**: cần viết thêm hàm fetch + regex bóc nội dung trang HTML (không dùng RSS). Có thể thêm 1 Edge Function riêng `kb-scraper`.

## 📞 Google Alerts (PRD Mục 3.3 — tùy chọn)
Dùng Zapier/Make gửi bài về `raw_articles` (bảng đã sẵn sàng nhận qua `INSERT` từ function `kb-callbacks`).
