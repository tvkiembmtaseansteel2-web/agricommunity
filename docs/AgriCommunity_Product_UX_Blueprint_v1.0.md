# AgriCommunity --- Product & UX Blueprint v1.0

## Định hướng hoàn thiện ứng dụng cho nông dân Đắk Lắk / Tây Nguyên

> **Mục tiêu:** Hoàn thiện AgriCommunity thành một ứng dụng đơn giản,
> thân thiện, dễ dùng cho nông dân trong cộng đồng địa phương; tập trung
> trước mắt vào **3 cây trồng chính: cà phê, sầu riêng và tiêu**.
>
> **Định vị sản phẩm:**\
> **AgriCommunity = Nhật ký + Bác sĩ cây trồng + Trợ lý chăm vườn + Cộng
> đồng nông dân địa phương.**

------------------------------------------------------------------------

## 1. Nguyên tắc sản phẩm

AgriCommunity không nên trở thành một ứng dụng "có thật nhiều tính
năng".

Mục tiêu chính là giúp người nông dân trả lời được 5 câu hỏi:

1.  **Tôi có những vườn nào?**
2.  **Vườn của tôi đang ở tình trạng thế nào?**
3.  **Hôm nay tôi nên làm gì?**
4.  **Tôi đã làm gì trong quá trình chăm sóc?**
5.  **Cuối vụ tôi thu được gì và có lịch sử canh tác rõ ràng không?**

Mọi tính năng mới cần được đánh giá theo câu hỏi:

> **Tính năng này có giúp người nông dân chăm vườn tốt hơn, dễ hơn hoặc
> có thêm giá trị từ dữ liệu của mình không?**

Nếu không, chưa cần ưu tiên.

------------------------------------------------------------------------

# 2. Phạm vi sản phẩm giai đoạn hiện tại

## 2.1. Khu vực

Ưu tiên:

-   Đắk Lắk
-   Tây Nguyên

Có thể mở rộng sang các tỉnh/khu vực khác trong tương lai, nhưng **không
làm UX hiện tại quá tổng quát**.

## 2.2. Cây trồng trọng tâm

### ☕ Cà phê

### 🌳 Sầu riêng

### 🌿 Tiêu

Mọi nội dung về:

-   nhật ký
-   sâu bệnh
-   khuyến cáo
-   thời tiết
-   AI chẩn đoán
-   cộng đồng
-   thống kê

nên ưu tiên và tối ưu trước cho 3 cây này.

------------------------------------------------------------------------

# 3. Định vị UX

## Không nên

> "Một dashboard nông nghiệp có rất nhiều chức năng."

## Nên

> **"Một người trợ lý giúp tôi quản lý và chăm vườn mỗi ngày."**

Home không chỉ hiển thị dữ liệu.

Home phải trả lời:

> **"Hôm nay vườn của tôi cần làm gì?"**

------------------------------------------------------------------------

# 4. Navigation đề xuất

Bottom navigation hiện tại có:

-   Trang chủ
-   Nhật ký
-   Bác sĩ AI
-   Cộng đồng
-   Xuất khẩu
-   Thống kê
-   Hồ sơ

### Đề xuất giảm xuống 5 tab chính:

1.  **Trang chủ**
2.  **Nhật ký**
3.  **Bác sĩ AI**
4.  **Cộng đồng**
5.  **Tôi**

### Đưa vào "Tôi":

-   Vườn của tôi
-   Thống kê
-   Xuất khẩu / truy xuất
-   Hồ sơ
-   Cài đặt
-   Hỗ trợ

### Lý do

7 tab ở bottom navigation khiến app trở nên giống hệ thống nghiệp vụ hơn
là ứng dụng dành cho người dùng phổ thông.

Đặc biệt:

-   Xuất khẩu không phải nhu cầu hàng ngày.
-   Thống kê cũng không phải thao tác hàng ngày.
-   Vườn của tôi nên có thể truy cập từ Home và Hồ sơ.

------------------------------------------------------------------------

# 5. HOME --- màn hình quan trọng nhất

## 5.1. Cấu trúc Home đề xuất

Thứ tự ưu tiên:

1.  Lời chào / thông tin người dùng
2.  Thời tiết nông nghiệp hôm nay
3.  **Hôm nay vườn cần làm gì?**
4.  Tình trạng vườn
5.  Nhật ký nhanh
6.  Bác sĩ cây trồng AI
7.  Tổng hợp sản lượng
8.  Nhật ký gần đây

Không nhất thiết hiển thị tất cả ngay từ đầu.

Home phải ưu tiên **hành động quan trọng nhất**.

------------------------------------------------------------------------

# 6. "Hôm nay vườn cần làm gì?" --- P0

Đây là thay đổi UX quan trọng nhất.

Thay vì Home chỉ hiển thị:

> Thời tiết → nhật ký → sản lượng → lịch sử

hãy tạo một vùng:

## 🌱 Hôm nay vườn cần làm gì?

Ví dụ:

### 🔴 Cần kiểm tra

**Sầu riêng --- Khu A**

Độ ẩm cao, thời tiết thuận lợi cho nấm bệnh.

> Kiểm tra các cây ở khu vực thấp và vùng thoát nước kém.

**\[ Kiểm tra vườn \]**

------------------------------------------------------------------------

### 🟡 Chưa ghi hoạt động

Lần tưới gần nhất: 2 ngày trước.

**\[ Ghi nhật ký \]**

------------------------------------------------------------------------

### 🟢 Thời tiết thuận lợi

Có thể thăm vườn trong hôm nay.

### Nguyên tắc

Khuyến cáo phải chuyển:

**Dữ liệu → Ý nghĩa → Hành động**

Không chỉ:

> Độ ẩm 87%.

Mà:

> **Độ ẩm cao → nguy cơ nấm bệnh tăng → nên kiểm tra khu vực ẩm thấp.**

------------------------------------------------------------------------

# 7. CARD THỜI TIẾT --- P0

Màn hình hiện tại đã đi đúng hướng vì có:

-   nhiệt độ
-   độ ẩm
-   gió
-   mưa
-   diễn giải bằng ngôn ngữ nông nghiệp

Tiếp tục hướng này.

## Đề xuất

### 🌦 Thời tiết hôm nay

**24°C**

Nhiều mây · Độ ẩm **87%**

💧 Mưa: 0 mm\
💨 Gió: 10 km/h

### ⚠️ Độ ẩm cao

> Có nguy cơ nấm bệnh tăng. Nên kiểm tra các cây ở vùng đất thấp.

**\[ Xem dự báo 7 ngày \]**

## Quy tắc

Không biến Weather thành màn hình dữ liệu kỹ thuật.

Weather phải trở thành:

> **Agricultural Weather Assistant**

Tức là thời tiết phải liên hệ với:

-   tưới
-   phun
-   nấm bệnh
-   thăm vườn
-   thu hoạch
-   chăm sóc

------------------------------------------------------------------------

# 8. VƯỜN CỦA TÔI --- P0

Cần có khái niệm "vườn" rõ ràng.

Ví dụ:

## 🌳 Vườn sầu riêng A

-   Diện tích: 1.2 ha
-   Số cây: 320
-   Tuổi vườn: 6 năm

### Tình trạng

🟢 Bình thường

### Theo dõi

-   💧 Độ ẩm: Cao
-   🌧️ Mưa 7 ngày: 42 mm
-   🐛 Cảnh báo sâu bệnh: 1
-   📋 Việc cần làm: 3

**\[ Xem vườn \]**

------------------------------------------------------------------------

## Nếu có nhiều vườn

Cho phép:

-   Vườn sầu riêng A
-   Vườn cà phê B
-   Vườn tiêu C

Mỗi vườn có:

-   cây trồng
-   diện tích
-   khu vực
-   tuổi cây
-   lịch sử chăm sóc
-   sâu bệnh
-   sản lượng
-   chi phí
-   ghi chú

------------------------------------------------------------------------

# 9. NHẬT KÝ --- P0

Screenshot hiện tại có nhiều trường:

-   loại cây
-   công việc
-   ngày
-   sản phẩm
-   quét hóa đơn
-   liều lượng
-   ghi chú
-   giọng nói

Nội dung tốt nhưng form hơi dài.

## Nguyên tắc mới

> **Ghi nhanh trước → bổ sung sau.**

------------------------------------------------------------------------

# 10. Flow "Ghi hoạt động" đề xuất

Khi bấm:

**+ Ghi hoạt động**

Hiển thị:

## Hôm nay bạn làm gì?

-   🌱 Bón phân
-   💧 Tưới nước
-   🧪 Phun thuốc
-   ✂️ Tỉa cành
-   🔍 Kiểm tra sâu bệnh
-   🌾 Thu hoạch
-   📝 Khác

Sau đó:

## Bón cho cây gì?

-   ☕ Cà phê
-   🌳 Sầu riêng
-   🌿 Tiêu

Sau đó mới hỏi thêm thông tin liên quan.

### Bắt buộc

-   cây trồng
-   hoạt động
-   ngày

### Tùy chọn

-   sản phẩm
-   liều lượng
-   ảnh
-   ghi chú
-   giọng nói

------------------------------------------------------------------------

# 11. GHI NHẬT KÝ BẰNG GIỌNG NÓI --- P0/P1

Đây là một UX rất phù hợp với nông dân.

Người dùng có thể nói:

> "Hôm nay tôi bón 2 ký NPK cho 50 cây sầu riêng khu A."

Hệ thống tự phân tích:

-   Cây: Sầu riêng
-   Hoạt động: Bón phân
-   Số lượng: 50 cây
-   Sản phẩm: NPK
-   Liều lượng: 2 kg
-   Khu vực: Khu A
-   Ngày: hôm nay

Sau đó hiển thị:

## Tôi ghi nhận như sau:

**Bón phân --- Sầu riêng**

50 cây · Khu A · 2 kg NPK

**\[ ✅ Đúng \] \[ ✏️ Sửa \]**

Không tự động lưu dữ liệu quan trọng nếu AI chưa được người dùng xác
nhận.

------------------------------------------------------------------------

# 12. NGÔN NGỮ GIAO DIỆN

Ưu tiên ngôn ngữ tự nhiên, gần cách nói của người dùng.

### Không nên

> Tên sản phẩm sử dụng (Phân bón / Thuốc bảo vệ thực vật)

### Nên

> **Bạn đã dùng sản phẩm gì?**

------------------------------------------------------------------------

### Không nên

> Liều lượng sử dụng

### Có thể dùng

> **Bạn dùng bao nhiêu?**

------------------------------------------------------------------------

### Không nên

> Ghi chú chi tiết

### Nên

> **Có điều gì cần ghi lại không?**

------------------------------------------------------------------------

# 13. QUÉT HÓA ĐƠN / BAO BÌ --- P1

Tính năng hiện tại rất đáng giữ.

Có thể phát triển thành:

**📷 Chụp hóa đơn / bao bì**

→ OCR / AI

→ tự điền:

-   tên sản phẩm
-   nhà sản xuất
-   quy cách
-   hoạt chất nếu có
-   loại vật tư

→ người dùng xác nhận.

## Kho vật tư cá nhân

Sau một thời gian có thể hiển thị:

### NPK

Đã dùng: 5 lần\
Tổng: 125 kg

### Thuốc X

Đã dùng: 2 lần\
Lần cuối: 18/08

Tuyệt đối không tự suy diễn thành khuyến cáo sử dụng thuốc nếu chưa có
dữ liệu/nguồn chuyên môn phù hợp.

------------------------------------------------------------------------

# 14. BÁC SĨ CÂY TRỒNG AI --- P0

Đây nên là một feature signature của AgriCommunity.

## Entry point

### 🩺 Bác sĩ cây trồng

**Cây có dấu hiệu bất thường?**

Chụp ảnh lá, thân hoặc quả để AI hỗ trợ nhận diện.

**\[ 📷 Chụp ảnh \]**

------------------------------------------------------------------------

# 15. AI DIAGNOSIS --- nguyên tắc quan trọng

AI không nên tạo cảm giác:

> "AI đã xác định chắc chắn cây bị bệnh X."

Nên hiển thị:

## Kết quả hỗ trợ

### 🟠 Có khả năng: Thán thư

**Độ phù hợp: Cao**

### Dấu hiệu quan sát được

-   đốm bệnh
-   vị trí tổn thương
-   hình dạng
-   mức độ lan rộng

### Nên kiểm tra thêm

1.  mặt dưới lá
2.  cành gần vùng bệnh
3.  tình trạng ẩm đất
4.  các cây xung quanh

### Nguồn kiến thức

Hiển thị nguồn KB đáng tin cậy khi có.

### Disclaimer

> Kết quả mang tính hỗ trợ tham khảo, không thay thế kiểm tra thực tế
> của cán bộ kỹ thuật.

------------------------------------------------------------------------

# 16. AI PHẢI GẮN VỚI 3 CÂY TRỌNG TÂM

Knowledge Base / diagnosis / recommendation ưu tiên:

## ☕ Cà phê

Ví dụ:

-   gỉ sắt
-   thán thư
-   đốm mắt cua
-   ...

## 🌳 Sầu riêng

Ví dụ:

-   Phytophthora
-   các vấn đề rễ / thân
-   ...

## 🌿 Tiêu

Xây dựng KB theo các bệnh và vấn đề canh tác phổ biến tại địa phương.

### Quan trọng

Không mở rộng KB quá nhanh.

Ưu tiên:

> **Ít nhưng chính xác và có nguồn chính thống.**

------------------------------------------------------------------------

# 17. CẢNH BÁO SÂU BỆNH --- P0/P1

Không nên chỉ có:

> "Có cảnh báo bệnh."

Cần có:

### ⚠️ Cảnh báo vườn

**Sầu riêng --- Khu A**

Điều kiện hiện tại có thể làm tăng nguy cơ bệnh nấm.

### Vì sao?

-   độ ẩm cao
-   mưa nhiều
-   khu vực thoát nước kém

### Bạn nên làm gì?

> Kiểm tra 5--10 cây ở khu vực thấp.

**\[ Ghi kết quả kiểm tra \]**

------------------------------------------------------------------------

# 18. CỘNG ĐỒNG --- P0

Tab Cộng đồng là một phần quan trọng và **không nên biến thành một mạng
xã hội tổng hợp**.

Mục tiêu:

> **Một cộng đồng nông dân địa phương cùng chia sẻ kinh nghiệm về cà
> phê, sầu riêng và tiêu.**

## 3 loại nội dung chính

### 📸 Khoảnh khắc vườn

Ví dụ:

> "Sầu riêng hôm nay bắt đầu ra hoa."

### 📚 Chia sẻ kiến thức

Ví dụ:

> "Kinh nghiệm xử lý đất sau mưa lớn."

### 💬 Hỏi đáp / kinh nghiệm

Ví dụ:

> "Vườn tiêu của tôi đang có biểu hiện này, mọi người có gặp chưa?"

------------------------------------------------------------------------

# 19. COMMUNITY FEED

Không nên có quá nhiều loại post.

Giai đoạn đầu chỉ cần:

### Bộ lọc

**Tất cả \| Cà phê \| Sầu riêng \| Tiêu**

Có thể thêm:

**Hỏi đáp \| Kinh nghiệm \| Khoảnh khắc**

------------------------------------------------------------------------

# 20. TẠO BÀI ĐĂNG

Flow đơn giản:

**+ Chia sẻ**

→ Chọn cây:

-   Cà phê
-   Sầu riêng
-   Tiêu

→ Chọn loại:

-   Khoảnh khắc
-   Kinh nghiệm
-   Hỏi cộng đồng

→ Ảnh / video

→ Nội dung

→ Đăng

Không yêu cầu quá nhiều metadata.

------------------------------------------------------------------------

# 21. COMMUNITY PHẢI CÓ CƠ CHẾ CHỐNG THÔNG TIN SAI

Đây là vấn đề đặc biệt quan trọng đối với app nông nghiệp.

Không để:

> "Thuốc X trị được bệnh Y 100%."

được hiển thị như một kiến thức chính thức.

Nên phân biệt:

### 👨‍🌾 Kinh nghiệm cộng đồng

và

### 📚 Kiến thức đã xác minh

Ví dụ:

> **Kinh nghiệm của thành viên**

khác hoàn toàn:

> **Khuyến cáo kỹ thuật từ nguồn chính thống**

------------------------------------------------------------------------

# 22. BADGE / TRUST

Có thể xây dựng:

### 🟢 Nguồn đã xác minh

Cho:

-   tài liệu chính thức
-   cán bộ kỹ thuật
-   nội dung đã được kiểm duyệt

### 👨‍🌾 Nông dân

Thành viên bình thường.

### 🧑‍🔬 Kỹ thuật viên

Tài khoản được xác minh.

Không cần làm ngay hệ thống điểm thưởng phức tạp.

------------------------------------------------------------------------

# 23. THỐNG KÊ --- P1

Thống kê không nên là dashboard BI.

Nên hiển thị những thứ người nông dân thực sự cần:

## 🌳 Vườn sầu riêng

### Chăm sóc

Bón phân: 5 lần\
Tưới: 12 lần\
Phun: 3 lần

### Chi phí

Phân bón: xxx\
Thuốc: xxx\
Nhân công: xxx

### Sản lượng

2026: x.xxx kg

### So với vụ trước

↑ / ↓ %

------------------------------------------------------------------------

# 24. SẢN LƯỢNG

Card hiện tại:

> 0 kg Sầu riêng\
> 0 kg Cà phê

đơn giản và tốt.

Nên giữ.

Nhưng sau này nên có:

-   theo vụ
-   theo vườn
-   theo cây
-   theo thời gian

------------------------------------------------------------------------

# 25. MÔ HÌNH DỮ LIỆU QUAN TRỌNG

Ngay từ bây giờ nên thiết kế dữ liệu xoay quanh:

``` text
User
  │
  ├── Gardens
  │      │
  │      ├── Crop
  │      ├── Area
  │      ├── Plants
  │      └── Zones
  │
  ├── Diary Activities
  │
  ├── Disease Observations
  │
  ├── AI Diagnoses
  │
  ├── Harvests
  │
  └── Community Posts
```

Điểm quan trọng:

> **Garden là entity trung tâm.**

Nhật ký, sâu bệnh, sản lượng và thống kê đều nên có thể liên kết với một
vườn cụ thể.

------------------------------------------------------------------------

# 26. TƯƠNG LAI: BẢN ĐỒ VƯỜN

Không cần làm GIS phức tạp ngay.

Có thể bắt đầu bằng:

``` text
┌─────────────────────┐
│ 🌳 🌳 🌳 🌳 🌳      │
│ 🌳 🌳 🔴 🌳 🌳      │
│ 🌳 🌳 🌳 🟡 🌳      │
│ 🌳 🌳 🌳 🌳 🌳      │
└─────────────────────┘
```

Trong đó:

🟢 Bình thường\
🟡 Cần theo dõi\
🔴 Có vấn đề

Sau này có thể mở rộng thành:

-   khu vực
-   lô
-   hàng cây
-   cây cá thể
-   vị trí GPS

Không cần triển khai ngay ở giai đoạn MVP.

------------------------------------------------------------------------

# 27. TRUY XUẤT / XUẤT KHẨU --- P2

Đây là module có tiềm năng dài hạn.

Dữ liệu được ghi hàng ngày:

> Nhật ký → vật tư → chăm sóc → sâu bệnh → thu hoạch

có thể trở thành:

> **Hồ sơ canh tác / truy xuất nguồn gốc**

Sau này:

### 🌏 Hồ sơ vườn

-   mã vùng trồng
-   nhật ký canh tác
-   vật tư
-   thu hoạch
-   truy xuất

Nhưng chưa nên để module này chiếm vị trí lớn trong MVP.

------------------------------------------------------------------------

# 28. UX CHO NGƯỜI LỚN TUỔI / ÍT DÙNG SMARTPHONE

Ưu tiên:

-   chữ dễ đọc
-   nút lớn
-   vùng chạm lớn
-   icon + chữ
-   không chỉ dùng màu để truyền tải trạng thái
-   ít thao tác
-   ít form dài
-   ít popup
-   tránh thuật ngữ kỹ thuật
-   xác nhận rõ ràng trước thao tác quan trọng

## Touch target

Ưu tiên khoảng chạm đủ lớn, đặc biệt với:

-   nút chính
-   icon navigation
-   nút ghi âm
-   camera
-   xác nhận

------------------------------------------------------------------------

# 29. OFFLINE / MẠNG YẾU --- P0

Đối tượng sử dụng có thể ở ngoài vườn, nơi mạng không ổn định.

Cần thiết kế:

### Khi mất mạng

Cho phép:

-   mở nhật ký
-   tạo nhật ký
-   lưu tạm local

Sau khi có mạng:

> 🔄 Đang đồng bộ...

### Không được

Người dùng nhập xong:

> "Không thể kết nối server"

và mất toàn bộ dữ liệu.

------------------------------------------------------------------------

# 30. EMPTY STATES

Các màn hình mới sử dụng lần đầu phải có hướng dẫn.

### Nhật ký trống

Không nên chỉ:

> Chưa có nhật ký nào được ghi.

Nên:

> 🌱 Bạn chưa có hoạt động nào.

> Hãy ghi lại lần tưới, bón phân hoặc chăm sóc đầu tiên để AgriCommunity
> bắt đầu hiểu vườn của bạn.

**\[ + Ghi hoạt động \]**

------------------------------------------------------------------------

### Vườn trống

> 🌳 Bạn chưa thêm vườn.

> Thêm vườn để theo dõi sức khỏe, chăm sóc và sản lượng.

**\[ + Thêm vườn \]**

------------------------------------------------------------------------

### AI

> 📷 Chưa có lần chẩn đoán nào.

> Chụp ảnh cây có dấu hiệu bất thường để bắt đầu.

------------------------------------------------------------------------

# 31. ERROR STATES

Không dùng thông báo kỹ thuật như:

> API Error 503

Người dùng nên thấy:

> **Chưa kết nối được**

> Kiểm tra mạng rồi thử lại nhé.

**\[ Thử lại \]**

Nếu có dữ liệu local:

> Dữ liệu đã được lưu trên điện thoại và sẽ đồng bộ khi có mạng.

------------------------------------------------------------------------

# 32. NOTIFICATION

Không spam.

Chỉ gửi khi có giá trị:

### Ví dụ

🌧️ **Dự báo mưa lớn**

> Ngày mai có khả năng mưa lớn. Bạn nên kiểm tra hệ thống thoát nước
> vườn sầu riêng.

------------------------------------------------------------------------

🐛 **Cảnh báo vườn**

> Điều kiện thời tiết đang thuận lợi cho một số bệnh nấm. Bạn nên kiểm
> tra vườn hôm nay.

------------------------------------------------------------------------

📖 **Nhắc nhật ký**

> Bạn chưa ghi hoạt động chăm sóc trong 3 ngày qua.

Notification phải hướng đến **hành động**, không chỉ thông báo.

------------------------------------------------------------------------

# 33. HỆ THỐNG MÀU

Giữ màu xanh lá hiện tại.

Chuẩn hóa:

### 🟢 Green

Bình thường / tốt / đã xác nhận

### 🟡 Yellow

Cần chú ý

### 🟠 Orange

Nên kiểm tra sớm

### 🔴 Red

Cần hành động

### ⚪ Gray

Thông tin phụ / chưa có dữ liệu

Không phụ thuộc hoàn toàn vào màu.

Luôn kết hợp:

-   icon
-   text
-   trạng thái

------------------------------------------------------------------------

# 34. AI KHÔNG NÊN XUẤT HIỆN KHẮP NƠI

AI nên được dùng để:

-   nhận diện hình ảnh
-   bóc tách giọng nói
-   hỗ trợ nhập liệu
-   tổng hợp dữ liệu
-   đưa cảnh báo dựa trên KB
-   hỗ trợ hỏi đáp

Không cần gắn chữ:

> AI

vào mọi tính năng.

Người dùng quan tâm:

> "Có giúp tôi không?"

hơn là:

> "Tính năng này có AI không?"

------------------------------------------------------------------------

# 35. PRODUCT LOOP

AgriCommunity nên xây dựng vòng lặp:

``` text
Nông dân
    ↓
Tạo vườn
    ↓
Ghi hoạt động
    ↓
AgriCommunity hiểu lịch sử vườn
    ↓
Kết hợp thời tiết + mùa vụ + dữ liệu vườn
    ↓
Đưa khuyến cáo
    ↓
Nông dân hành động
    ↓
Ghi lại kết quả
    ↓
Dữ liệu vườn ngày càng đầy đủ
```

Đây là vòng lặp cốt lõi cần bảo vệ.

------------------------------------------------------------------------

# 36. ROADMAP ƯU TIÊN

## 🔴 P0 --- trước MVP / production

### Home

-   [ ] Thời tiết nông nghiệp
-   [ ] "Hôm nay vườn cần làm gì?"
-   [ ] Tình trạng vườn
-   [ ] Quick actions
-   [ ] Empty states

### Garden

-   [ ] Tạo vườn
-   [ ] Chọn 3 cây: cà phê / sầu riêng / tiêu
-   [ ] Diện tích
-   [ ] thông tin cơ bản
-   [ ] liên kết nhật ký với vườn

### Diary

-   [ ] Ghi nhanh
-   [ ] giảm số trường bắt buộc
-   [ ] chọn hoạt động bằng icon
-   [ ] voice input
-   [ ] sửa/xóa nhật ký
-   [ ] offline draft

### AI Doctor

-   [ ] chụp ảnh
-   [ ] phân tích
-   [ ] grounding vào KB
-   [ ] hiển thị nguồn
-   [ ] disclaimer
-   [ ] trạng thái đang xử lý / lỗi

### Disease

-   [ ] cảnh báo
-   [ ] mức độ
-   [ ] lý do
-   [ ] hành động đề xuất
-   [ ] liên kết tới nhật ký

### Navigation

-   [ ] giảm bottom navigation xuống 5 tab
-   [ ] đưa thống kê/xuất khẩu vào "Tôi"

------------------------------------------------------------------------

# 37. 🟠 P1 --- sau MVP

-   [ ] Quét hóa đơn / bao bì
-   [ ] Kho vật tư
-   [ ] Lịch sử chăm sóc
-   [ ] Thống kê chi phí
-   [ ] Thống kê sản lượng
-   [ ] notification thông minh
-   [ ] lịch chăm sóc
-   [ ] community moderation
-   [ ] tài khoản kỹ thuật viên
-   [ ] nội dung xác minh
-   [ ] dự báo nguy cơ sâu bệnh

------------------------------------------------------------------------

# 38. 🟢 P2 --- mở rộng

-   [ ] bản đồ vườn
-   [ ] quản lý khu/lô
-   [ ] theo dõi cây cá thể
-   [ ] truy xuất nguồn gốc
-   [ ] mã vùng trồng
-   [ ] thị trường
-   [ ] xuất khẩu
-   [ ] kết nối thương lái / doanh nghiệp
-   [ ] mở rộng tỉnh
-   [ ] mở rộng cây trồng

------------------------------------------------------------------------

# 39. Definition of Done cho UX

Một feature chỉ nên coi là hoàn thành khi:

-   [ ] Người dùng hiểu feature dùng để làm gì mà không cần hướng dẫn
    dài.
-   [ ] Người dùng có thể hoàn thành tác vụ chính trong ít bước.
-   [ ] Có empty state.
-   [ ] Có loading state.
-   [ ] Có error state.
-   [ ] Có offline behavior nếu phù hợp.
-   [ ] Có trạng thái success.
-   [ ] Không mất dữ liệu khi request thất bại.
-   [ ] Ngôn ngữ phù hợp với nông dân.
-   [ ] Không lạm dụng thuật ngữ kỹ thuật.
-   [ ] Không chỉ dùng màu để biểu thị trạng thái.
-   [ ] Các thao tác quan trọng có vùng chạm đủ lớn.
-   [ ] Nội dung AI có nguồn/grounding khi đưa ra khuyến cáo chuyên môn.

------------------------------------------------------------------------

# 40. Ưu tiên thay đổi từ 2 màn hình hiện tại

## Screenshot 1 --- Home

### Giữ

-   [x] Màu sắc
-   [x] Header
-   [x] Weather card
-   [x] Quick action
-   [x] AI Doctor
-   [x] Harvest summary
-   [x] Recent diary

### Thay đổi

-   [ ] Thêm **"Hôm nay vườn cần làm gì?"**
-   [ ] Thêm **"Tình trạng vườn"**
-   [ ] Weather → agricultural advice
-   [ ] Giảm cảm giác dashboard
-   [ ] Ưu tiên action thay vì dữ liệu
-   [ ] Chỉ hiển thị những thông tin quan trọng nhất

------------------------------------------------------------------------

## Screenshot 2 --- Diary

### Giữ

-   [x] Chọn cây
-   [x] Chọn hoạt động
-   [x] ngày
-   [x] sản phẩm
-   [x] scan
-   [x] liều lượng
-   [x] ghi chú
-   [x] voice

### Thay đổi

-   [ ] Tách form thành từng bước ngắn
-   [ ] Chỉ bắt buộc cây + hoạt động + ngày
-   [ ] Cho phép lưu nhanh
-   [ ] Bổ sung thông tin sau
-   [ ] Voice → tự bóc tách dữ liệu
-   [ ] Có bước xác nhận trước khi lưu dữ liệu AI
-   [ ] Hỗ trợ offline
-   [ ] Sau khi lưu cho phép "Bổ sung thông tin"

------------------------------------------------------------------------

# 41. Tư duy sản phẩm cuối cùng

AgriCommunity không cần thắng bằng số lượng feature.

Cần thắng bằng:

### **Đơn giản**

Người nông dân mở app là biết phải làm gì.

### **Tin cậy**

Kiến thức nông nghiệp có nguồn rõ ràng.

### **Địa phương**

Ưu tiên Đắk Lắk / Tây Nguyên và 3 cây:

**☕ Cà phê · 🌳 Sầu riêng · 🌿 Tiêu**

### **Hữu ích**

Dữ liệu phải quay trở lại giúp người nông dân.

### **Cộng đồng**

Người nông dân có thể chia sẻ khoảnh khắc, kinh nghiệm và hỏi nhau.

### **Tích lũy**

Mỗi ngày ghi một chút → cuối vụ có một hồ sơ canh tác có giá trị.

------------------------------------------------------------------------

# 42. Product Vision

> **AgriCommunity không chỉ ghi lại những gì người nông dân đã làm.**
>
> **AgriCommunity phải dần hiểu khu vườn của họ và giúp họ biết việc gì
> nên làm tiếp theo.**

Từ:

**Nhật ký**

→ thành

**Hiểu vườn**

→ thành

**Trợ lý chăm vườn**

→ thành

**Hồ sơ canh tác số**

→ và về lâu dài:

**Cầu nối giữa nông dân --- kỹ thuật --- cộng đồng --- thị trường.**

------------------------------------------------------------------------

## Ghi chú cho coder

Khi triển khai, ưu tiên:

1.  Không phá vỡ các flow hiện tại đang hoạt động.
2.  Ưu tiên refactor UX trước khi thêm feature mới.
3.  Garden nên được thiết kế là entity trung tâm.
4.  Diary Activity phải có quan hệ với Garden và Crop.
5.  Diagnosis phải liên kết được với Garden/Crop khi có thể.
6.  Community Post phải có Crop category.
7.  Không hard-code kiến thức chuyên môn trong UI.
8.  Nội dung chuyên môn phải lấy từ Knowledge Base / nguồn đã xác minh.
9.  AI output phải có trạng thái rõ ràng và không được thể hiện như chẩn
    đoán chắc chắn.
10. Thiết kế API/state để có thể hỗ trợ offline queue về sau.
11. Không thêm feature chỉ để làm Home "nhiều thứ hơn".
12. Mọi màn hình mới phải có loading / empty / error / success state.

------------------------------------------------------------------------

# Kết luận

### Trọng tâm giai đoạn hiện tại:

**Không mở rộng quá nhanh.**

Tập trung làm thật tốt:

> **3 cây + 1 khu vực + 1 cộng đồng + 1 người trợ lý vườn.**

Cụ thể:

**☕ Cà phê**\
**🌳 Sầu riêng**\
**🌿 Tiêu**

↓

**🌱 Vườn của tôi**

↓

**📝 Nhật ký dễ dùng**

↓

**🩺 Bác sĩ cây trồng**

↓

**🌦 Thời tiết → khuyến cáo**

↓

**⚠️ Cảnh báo sâu bệnh**

↓

**👥 Cộng đồng địa phương**

↓

**📊 Dữ liệu & sản lượng**

Đây là phạm vi đủ mạnh để tạo ra một sản phẩm MVP có giá trị mà không
làm app trở nên phức tạp.
