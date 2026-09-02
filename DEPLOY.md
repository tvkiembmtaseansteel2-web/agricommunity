# 🚀 Triển khai AgriCommunity lên Netlify / Vercel

> Ứng dụng AgriCommunity là **PWA React + Vite** (build ra thư mục `dist`). Có 2 cách deploy:
> **A)** GitHub + Netlify (khuyên dùng — tự động deploy mỗi lần push), hoặc **B)** Netlify CLI / Vercel push trực tiếp.
> Cả hai cần **tài khoản của bạn**. Hướng dẫn dưới đây là bước chuẩn bị + các bước bạn cần làm (không thể thay bạn đăng nhập).

## ✅ Đã chuẩn bị sẵn trong repo
- `netlify.toml` — build command `npm run build`, publish `dist`, SPA redirect `/* → /index.html`, cache tài nguyên `/assets/*`.
- `.env.example` — mẫu cấu hình.
- `.gitignore` — đã loại trừ `.env` (bảo mật secret, không bao giờ commit).
- App đọc các biến bằng `import.meta.env.VITE_*` (chuẩn Vite → Netlify/Vercel inlines vào lúc build).

---

## PHƯƠNG ÁN A — GitHub + Netlify (khuyên dùng, tự động)

### Bước 1: Khởi tạo git & đẩy lên GitHub
```bash
git init
git add .
git commit -m "AgriCommunity - initial"
# Tạo repo trên GitHub rồi:
git remote add origin https://github.com/<ban>/<repo>.git
git push -u origin main
```

### Bước 2: Tạo site trên Netlify
1. Vào **https://app.netlify.com/start** → **Import from Git** → chọn **GitHub** → chọn repo.
2. Netlify tự nhận `netlify.toml`: **Build command** `npm run build`, **Publish directory** `dist`.
   > Nếu không tự nhận, điền tay: Build `npm run build`, Publish `dist`.

### Bước 3: Đặt biến môi trường (bắt buộc)
Trong Netlify → **Site settings → Environment variables** → thêm:
| Biến | Giá trị | Lấy từ |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://gjavupiyrnuwtersagnw.supabase.co` | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | (khóa anon JWT) | Supabase → Settings → API |
| `VITE_GEMINI_API_KEY` | (khóa Gemini) | aistudio.google.com/apikey |
| `VITE_GEMINI_MODEL` | `gemini-3.1-flash-lite` | (tuỳ chọn) |
| `VITE_ANALYTICS_DOMAIN` | *(để trống nếu chưa dùng)* | (tuỳ chọn) |

> ⚠️ **Quan trọng:** sau khi đặt biến, **Deploy lại** (Redeploy). Netlify build lại mới inline đúng.

### Bước 4: Cấu hình Supabase Auth (bắt buộc để đăng nhập hoạt động)
Supabase Dashboard → **Authentication → URL Configuration** → thêm domain vào:
- **Site URL:** `https://<site-cua-ban>.netlify.app`
- **Redirect URLs:** thêm `https://<site-cua-ban>.netlify.app/**`

### Bước 5: Bật PWA trên HTTPS
Netlify cấp HTTPS sẵn + tự phục vụ `manifest.webmanifest` / `sw.js` trong `dist`. Kiểm tra bằng cách mở site, tab Console → không lỗi; tải app có prompt "Cài đặt".

---

## PHƯƠNG ÁN B — Netlify CLI (không cần GitHub)

```bash
# Cài CLI (nếu chưa có)
npm install -g netlify-cli

# Đăng nhập (mở trình duyệt xác nhận)
netlify login

# Đặt env (trước khi deploy)
netlify env:set VITE_SUPABASE_URL "https://gjavupiyrnuwtersagnw.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "<khóa anon>"
netlify env:set VITE_GEMINI_API_KEY "<khóa gemini>"
netlify env:set VITE_GEMINI_MODEL "gemini-3.1-flash-lite"

# Deploy
netlify deploy --build --prod
```

> CLI sẽ hỏi **có tạo site mới không** → chọn tạo site mới → đặt tên.

---

## PHƯƠNG ÁN C — Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
# Trong build: "Other" → framework Vite. Add 2 dự án env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY.
```
> Vercel cần **Routing** cho SPA: thêm `vercel.json` với `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`.

---

## 🔍 Kiểm tra sau deploy
1. Mở site → đăng nhập bằng SĐT + mật khẩu (đã đăng ký) → chuyển tab hoạt động.
2. Kiểm tra **kết nối Supabase** (dữ liệu hiện ra — nhật ký, vườn, cộng đồng).
3. **Bác sĩ AI** chụp ảnh → trả kết quả (cần Gemini API key).
4. **Đăng ký tài khoản mới** → tự tạo hồ sơ (trigger `handle_new_user`).
5. **PWA**: trên điện thoại, thêm vào màn hình chính.

## ⚠️ Lưu ý bảo mật
- **KHÔNG** đưa `service_role` key hoặc `CRAWLER_SECRET` vào biến `VITE_` (client). Chúng chỉ dùng server-side (Supabase secrets, đã làm ở crawler).
- `VITE_SUPABASE_ANON_KEY` là anon key — an toàn cho client nhưng RLS vẫn phải bảo vệ dữ liệu (đã cấu hình).

## 🐛 Lỗi hay gặp
| Lỗi | Nguyên nhân / cách sửa |
|---|---|
| Trang trắng sau deploy | Thiếu biến `VITE_SUPABASE_URL`/`ANON_KEY` → kiểm tra env + **Redeploy**. Cũng có thể thiếu SPA redirect — kiểm tra `netlify.toml`. |
| Đăng nhập không được | Chưa thêm domain vào **Allowed Redirect URLs** trong Supabase Auth. |
| Bác sĩ AI trả "chưa kết nối" | Thiếu `VITE_GEMINI_API_KEY`. |
| 404 khi refresh trang con | SPA redirect chưa đúng (thêm rewrite trong `vercel.json`). |
