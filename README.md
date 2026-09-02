# 🌱 AgriCommunity - Ứng dụng Quản lý Nông nghiệp & Trợ lý AI Cộng đồng

Chào mừng bạn đến với **AgriCommunity**, giải pháp công nghệ số tối giản, gần gũi và thực tế được thiết kế dành riêng cho nông dân trồng sầu riêng, cà phê, hồ tiêu. Ứng dụng hỗ trợ quản lý nhật ký chăm sóc vườn, theo dõi sản lượng, kết nối cộng đồng có kiểm duyệt và tích hợp bác sĩ cây trồng AI thông minh.

Dự án được xây dựng trên nền tảng **React (Vite) + Vanilla CSS (Mobile-first PWA)** và được thiết kế để tối ưu hóa chi phí vận hành (0 đồng cho quy mô ban đầu).

---

## 🚀 Hướng dẫn khởi chạy ứng dụng nhanh (Local Development)

Hiện tại toàn bộ ứng dụng đã được biên dịch thành công. Bạn có thể khởi chạy server thử nghiệm ngay bằng các bước sau:

1. Đảm bảo bạn đã cài đặt Node.js trên máy.
2. Mở terminal tại thư mục dự án và chạy lệnh:
   ```bash
   npm run dev
   ```
3. Truy cập địa chỉ `http://localhost:3000` trên trình duyệt điện thoại hoặc máy tính của bạn để trải nghiệm.

### 💡 Chế độ chạy thử nghiệm (Không cần cấu hình)
Để thuận tiện cho việc kiểm thử ngay lập tức mà không cần tạo tài khoản cloud, ứng dụng tự động kích hoạt **chế độ Mock Offline**:
- **Cơ sở dữ liệu**: Dữ liệu hồ sơ, nhật ký, sản lượng được lưu trữ trực tiếp tại `localStorage` của trình duyệt. Bạn có thể thêm, sửa, xóa nhật ký trực tiếp.
- **Đăng nhập**: Màn hình Đăng nhập/Đăng ký bằng SĐT + mật khẩu; có sẵn 2 nút **demo nhanh** — *Nông dân mẫu (0912345678)* và *Admin mẫu (0900000000)*.
- **Trợ lý AI**: Tự động chẩn đoán thông minh dựa trên từ khóa khi bạn hỏi về bệnh trên sầu riêng, cà phê, hồ tiêu (ví dụ thử nghiệm nhanh: *"Sầu riêng bị cháy lá vàng lá"*, *"Cà phê bị rỉ sắt"*).
- **Phân quyền Admin**: Bạn có thể chuyển đổi qua lại giữa vai trò **Nông dân** và **Admin** bằng nút nhấn góc trên bên phải màn hình tiêu đề để thử nghiệm quy trình **Duyệt bài đăng cộng đồng** trước khi hiển thị công khai.

---

## ☁️ Hướng dẫn cấu hình kết nối Cloud thực tế

Khi dự án sẵn sàng đưa vào vận hành thực tế cho 500-1000 nông hộ, bạn thực hiện các bước cấu hình sau:

### 1. Cấu hình Cơ sở dữ liệu Supabase (Miễn phí)
1. Đăng ký tài khoản miễn phí tại [Supabase.com](https://supabase.com/).
2. Tạo một Project mới (Ví dụ: `AgriCommunity`).
3. Truy cập vào mục **SQL Editor** ở thanh menu bên trái.
4. Copy toàn bộ nội dung file [supabase_schema.sql](file:///C:/Users/OS/.gemini/antigravity/scratch/agri-community-app/supabase_schema.sql) trong thư mục gốc dự án và paste vào đây, sau đó nhấn **Run**. Lệnh này sẽ tự động khởi tạo các bảng dữ liệu, chính sách bảo mật RLS và dữ liệu hoạt chất mẫu.
5. Tạo Storage bucket ảnh vườn: dán nội dung [storage_bucket.sql](storage_bucket.sql) vào SQL Editor rồi **Run** (tự tạo bucket `farm-images` public + quyền upload/xóa).
6. Vào mục **Settings > API** để lấy `Project URL` và `Anon public API key`.

### 2. Cấu hình Trợ lý AI Gemini (Rất rẻ)
1. Truy cập vào [Google AI Studio](https://aistudio.google.com/).
2. Tạo một API Key mới cho **Gemini API**.

> ⚠️ **Quan trọng — Cấu hình đăng nhập (Supabase Auth):**
> Ứng dụng dùng **SĐT + mật khẩu** (SĐT được ánh xạ thành email nội bộ `09xxxxxxxx@agri.vn` để không cần tốn phí SMS).
> Trên Supabase Dashboard, vào **Authentication > Sign In / Providers**, bật **Phone** (nếu muốn dùng OTP sau này).
> Trong **Authentication > Emails**, tắt tùy chọn **Confirm email** để nông dân đăng ký xong là dùng được ngay
> (nếu không, họ phải mở email xác nhận — không phù hợp với người ít dùng email).
> Trigger `handle_new_user` trong schema sẽ tự tạo hồ sơ nông hộ khi đăng ký.

### 3. Kết nối mã nguồn với Cloud
Tạo một file tên là `.env` trong thư mục gốc của dự án (`agri-community-app/`) với nội dung như sau:

```env
# Địa chỉ URL dự án Supabase của bạn
VITE_SUPABASE_URL=https://your-supabase-project-id.supabase.co

# Khóa API Anon của Supabase
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Khóa API Google Gemini để chạy trợ lý AI
VITE_GEMINI_API_KEY=your-gemini-api-key
```

*Sau khi tạo file `.env`, hãy khởi động lại dev server (`npm run dev`). Hệ thống sẽ tự động ngắt kết nối Mock Offline và chuyển sang kết nối đồng bộ trực tiếp lên Cloud thật!*

### 🔍 Kiểm tra kết nối Cloud nhanh
Chạy lệnh sau (không in key ra ngoài) để kiểm tra Supabase + Gemini đã kết nối đúng chưa:

```bash
node check_connection.mjs
```

> ⚠️ Nếu báo *"Could not find the table"* nghĩa là bạn **chưa chạy `supabase_schema.sql`** trong SQL Editor của Supabase — làm bước 4 ở mục trên trước đã.

---

## ⚖️ Tuân thủ Pháp luật & Bảo vệ dữ liệu nông hộ

Ứng dụng tuân thủ nghiêm ngặt **Nghị định 13/2023/NĐ-CP** của Chính phủ về bảo vệ dữ liệu cá nhân:
- Tại màn hình **Hồ sơ nông hộ**, nông dân bắt buộc phải bấm chọn đồng ý cam kết chia sẻ thông tin phục vụ chuyển đổi số thì hệ thống mới lưu trữ dữ liệu (SĐT, diện tích, địa chỉ).
- Toàn bộ cơ sở dữ liệu Supabase đều được áp dụng chính sách **Row Level Security (RLS)** ở mức cao nhất, đảm bảo nông dân chỉ xem được nhật ký vườn của chính mình, thông tin được bảo mật và không bị rò rỉ chéo.
