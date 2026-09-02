TASK — AGriCommunity: Xây dựng hệ thống Quản lý vườn theo Zone
1. Mục tiêu

Nâng cấp module Quản lý vườn của AgriCommunity thành hệ thống quản lý dựa trên bản đồ + Zone, giúp nông dân:

Tạo vườn nhanh bằng GPS/bản đồ.
Tự chia vườn thành 4–5 khu vực A/B/C/D/E.
Có thể chỉnh ranh giới Zone bằng tay.
Ghi nhật ký công việc cho toàn vườn hoặc từng Zone.
Khi sử dụng Bác sĩ AI, hệ thống tự lấy GPS và xác định vấn đề thuộc Zone nào.
Tự động cập nhật trạng thái Zone.
Có màn hình "Hôm nay cần làm gì?" để nông dân biết việc cần thực hiện.
Nguyên tắc UX quan trọng

Nông dân không được yêu cầu đi tới từng cây để định vị hoặc nhập dữ liệu.

Không triển khai trong task này:

định vị từng cây;
nhập GPS từng cây;
nhận diện cây bằng AI;
drone;
nhận diện cây từ ảnh vệ tinh;
GPS tracking trong lúc phun/bón;
quản lý hàng cây.

Các tính năng này để dành cho phase sau.

2. Mô hình dữ liệu

Kiến trúc MVP:

Garden
   │
   ├── Boundary Polygon
   │
   ├── Zone A
   ├── Zone B
   ├── Zone C
   ├── Zone D
   └── Zone E
          │
          ├── Activities
          │
          └── Issues
Garden
id
name
crop_types
area
boundary_polygon
center_lat
center_lng
created_at
updated_at

crop_types phải hỗ trợ nhiều loại cây.

Ví dụ:

[
  "durian",
  "coffee",
  "pepper"
]

Không được thiết kế Garden.crop dạng single value.

3. Zone
id
garden_id
name
code
polygon
area
created_at
updated_at

Ví dụ:

Zone A
Zone B
Zone C
Zone D
Lưu ý quan trọng

Không lưu color như trạng thái cố định của Zone.

Màu phải được tính từ dữ liệu hiện tại.

Ví dụ:

GREEN  = bình thường
YELLOW = cần theo dõi
RED    = có vấn đề

Sau này nếu trạng thái thay đổi, UI tự thay đổi màu.

4. Chức năng 1 — Tạo ranh giới vườn

Màn hình hiện tại:

Tên vườn
Trồng cây gì?
Diện tích
Số cây
Tuổi vườn
Ghi chú

UX mới

Không bắt người dùng nhập tất cả ngay.

Flow:

+ Thêm vườn
      ↓
Tên vườn
      ↓
Cây trồng
      ↓
📍 Xác định vị trí vườn
      ↓
Vẽ ranh giới
      ↓
Tính diện tích
      ↓
Chia Zone
      ↓
Xác nhận
      ↓
Hoàn tất
Màn hình "Xác định vườn"

Hiển thị:

┌─────────────────────────┐
│       BẢN ĐỒ            │
│                         │
│          📍             │
│                         │
│                         │
└─────────────────────────┘

📍 Vị trí hiện tại

[ Vẽ ranh giới vườn ]

[ Tôi sẽ làm sau ]

Khi chọn vẽ:

Người dùng chạm các điểm trên bản đồ để tạo polygon.

Ví dụ:

       ●────────●
      /          \
     ●            ●
      \          /
       ●────────●

Sau khi hoàn thành:

Diện tích ước tính

12.430 m²

[ Xác nhận ]
[ Vẽ lại ]
5. Chức năng 2 — Tự chia 4–5 Zone

Sau khi xác định polygon:

Vườn của bạn: 12.430 m²

Bạn muốn chia thành:

[ 4 KHU ]    [ 5 KHU ]

Mặc định chọn 4 Zone.

Hệ thống tự chia polygon thành các vùng tương đối cân bằng.

Ví dụ:

┌────────────────┬────────────────┐
│                │                │
│       A        │       B        │
│                │                │
├────────────────┼────────────────┤
│                │                │
│       C        │       D        │
│                │                │
└────────────────┴────────────────┘
Rất quan trọng

Các Zone phải nằm hoàn toàn bên trong polygon của Garden.

Không được tạo các vùng hình chữ nhật vượt ra ngoài ranh giới vườn.

Ví dụ vườn méo:

             ┌──────── B ───────┐
            /                    │
       A   /                     │
          /                      │
         ├──────────┬────────────┘
         │    C     │
         │          │
         └──────────┘
6. Cho phép chỉnh Zone bằng tay

Sau khi tự chia:

Kéo đường phân chia để điều chỉnh

UX càng đơn giản càng tốt.

Ví dụ:

         A              B
┌──────────────┬──────────────┐
│              │              │
│              │              │
│              │              │
└──────────────┴──────────────┘
               ↕
          Kéo để chỉnh

Có:

[↩ Hoàn tác]

[Xác nhận phân khu]

Sau khi xác nhận

Hiển thị:

✓ Đã tạo 4 khu

Zone A — 3.120 m²
Zone B — 3.050 m²
Zone C — 3.140 m²
Zone D — 3.120 m²

Người dùng có thể đổi tên:

A → Khu trên
B → Khu gần nhà
...

Nhưng mặc định vẫn:

A/B/C/D/E

7. Chức năng 3 — Nhật ký toàn vườn / Zone

Đây là chức năng phải cực kỳ nhanh.

Nông dân không cần bản đồ khi nhập công việc.

+ Ghi nhật ký

Màn hình:

Bạn vừa làm gì?

🌱 Bón phân
💊 Phun thuốc
💧 Tưới nước
🌿 Làm cỏ
✂️ Cắt tỉa
📝 Khác

Sau đó:

Phạm vi
Làm ở đâu?

🌐 Toàn vườn

☐ Zone A
☐ Zone B
☐ Zone C
☐ Zone D
☐ Zone E

Cho phép chọn nhiều Zone.

Ví dụ 1

Nông dân:

Hôm nay bón phân toàn vườn.

Thao tác:

Bón phân
↓
Toàn vườn
↓
Lưu

Backend có thể lưu:

scope = GARDEN
garden_id = X

Không cần tạo 5 bản ghi Zone nếu không cần thiết.

UI khi xem bản đồ vẫn hiển thị:

A ✓
B ✓
C ✓
D ✓
Ví dụ 2

Hôm nay chỉ bón A và B.

Bón phân

☑ A
☑ B
☐ C
☐ D

[ Lưu ]

Backend:

scope = ZONES
zone_ids = [A, B]
8. Một Activity phải có cấu trúc đủ mở

Tối thiểu:

id
garden_id
zone_ids
scope
activity_type
date
product
quantity
unit
note
created_at

Có thể bổ sung sau:

crop_type
operator
weather
photo

Nhưng không bắt buộc trong MVP.

9. Chức năng 4 — Bác sĩ AI tự xác định Zone

Đây là phần quan trọng nhất cần tích hợp.

Khi người dùng mở:

🩺 Bác sĩ AI

và chụp ảnh:

📷 Chụp ảnh cây/lá/quả

App đồng thời lấy:

GPS latitude
GPS longitude
timestamp

Backend nhận:

latitude
longitude
garden_id

Sau đó thực hiện:

GPS point
    ↓
Point-in-Polygon
    ↓
Zone

Ví dụ:

GPS
 ↓
Zone B

AI record:

garden_id = Kiem
zone_id = B

GPS = ...
photo = ...
AI result = ...
confidence = ...
10. UX Bác sĩ AI

Khi mở Bác sĩ AI:

🩺 BÁC SĨ AI

📍 Bạn đang ở:

Vườn Kiem
Zone B

[ 📷 Chụp ảnh ]

[ 🎤 Mô tả bằng giọng nói ]

Sau khi AI phân tích:

⚠️ Có dấu hiệu cần kiểm tra

Khả năng:
Bệnh/nấm lá

Độ tin cậy:
78%

📍 Vị trí:
Zone B

[ Ghi nhận vấn đề ]
[ Chụp lại ]

Nếu người dùng xác nhận:

→ tạo Issue.

11. Xử lý sai số GPS

Không được mặc định GPS luôn chính xác.

Nếu GPS cách ranh giới Zone một khoảng nhỏ:

📍 Bạn đang ở gần ranh giới
Zone A / Zone B

Bạn muốn ghi nhận ở:

[ A ] [ B ]

Nếu GPS không xác định được Zone:

Không xác định được khu vực.

Bạn đang ở đâu?

[ A ] [ B ] [ C ] [ D ]

GPS chỉ là gợi ý tự động, người dùng luôn có quyền sửa.

12. Issue

Schema:

id
garden_id
zone_id
issue_type
description
photo
latitude
longitude
ai_result
confidence
status
created_at
updated_at

Status:

NEEDS_REVIEW
CONFIRMED
TREATING
RESOLVED
Không cho AI tự động khẳng định bệnh 100%.

Ví dụ:

AI:
Có dấu hiệu nghi bệnh nấm
confidence: 78%

→ trạng thái:

Cần kiểm tra

Người dùng xác nhận → Đã xác nhận.

13. Chức năng 5 — Tự động cập nhật trạng thái Zone

Zone không có màu cố định.

Hệ thống tính trạng thái từ:

Issue chưa xử lý.
Công việc cần thực hiện.
Công việc đã hoàn thành.
Có cảnh báo mới.

Ví dụ:

Không có vấn đề

🟢

ZONE A
Bình thường
Có vấn đề cần theo dõi

🟡

ZONE C
Cần theo dõi
Có vấn đề nghiêm trọng/chưa xử lý

🔴

ZONE B
Có vấn đề
14. Không nên chỉ hiển thị màu

Khi bấm Zone B:

ZONE B

🔴 Có vấn đề

⚠️ Nghi nấm
31/08

💊 Chưa xử lý

Lịch sử:
✓ 28/08 — Bón phân
✓ 25/08 — Tưới

Màu chỉ giúp nhìn nhanh.

Dữ liệu chi tiết phải nằm bên dưới.

15. Chức năng 6 — "Hôm nay cần làm gì?"

Đây là màn hình có giá trị sử dụng hàng ngày.

Trên Home:

🌱 HÔM NAY

Vườn Kiem

🔴 Zone B
Cần kiểm tra vấn đề nấm

🟡 Zone C
Chưa tưới

🟢 Zone A
Đã hoàn thành

🟢 Zone D
Không có cảnh báo

Có thể bấm từng item.

16. Logic "Hôm nay"

Không cần AI phức tạp ở MVP.

Nguồn dữ liệu:

Issue
+
Activity
+
Ngày hiện tại
+
Trạng thái Zone

Ví dụ:

Issue.status != RESOLVED
→ đưa vào việc cần chú ý

Hoặc:

Có lịch công việc đến hạn
→ đưa vào danh sách

Sau này mới để AI lập kế hoạch thông minh.

17. UX tổng thể

Navigation hiện tại của bạn:

Trang chủ
Nhật ký
Bác sĩ AI
Cộng đồng
Tôi

Giữ nguyên.

Không thêm quá nhiều menu.

Trang chủ
┌─────────────────────────────┐
│ 🌱 Vườn Kiem                │
│                             │
│ 🗺️ Bản đồ                   │
│                             │
│     A 🟢    B 🔴            │
│                             │
│     C 🟡    D 🟢            │
│                             │
│ [Xem bản đồ]                │
└─────────────────────────────┘

HÔM NAY

🔴 B — Kiểm tra nấm
🟡 C — Tưới nước

[ + Ghi nhật ký ]
18. Màn hình bản đồ

Đây là màn hình trung tâm của module.

┌─────────────────────────────┐
│ ← Vườn Kiem                 │
│                             │
│        🗺️ BẢN ĐỒ           │
│                             │
│    ┌───────┬───────┐        │
│    │   A   │   B   │        │
│    │  🟢   │  🔴   │        │
│    ├───────┼───────┤        │
│    │   C   │   D   │        │
│    │  🟡   │  🟢   │        │
│    └───────┴───────┘        │
│                             │
│ [ + Ghi nhật ký ]           │
└─────────────────────────────┘

Bấm Zone B:

ZONE B

🔴 Cần xử lý

⚠️ Nghi nấm
📅 31/08

💊 Chưa xử lý

[ Xem chi tiết ]

[ Ghi nhật ký ]
19. "Ghi nhật ký" phải cực nhanh

Mục tiêu:

≤ 15–20 giây cho một nhật ký đơn giản.

Ví dụ:

+ Ghi nhật ký
↓
Bón phân
↓
Toàn vườn
↓
Lưu

Không bắt người dùng nhập:

tọa độ;
polygon;
Zone ID;
latitude;
longitude;
số cây.

Các trường kỹ thuật phải được backend xử lý.

20. Yêu cầu đặc biệt cho vườn xen canh

Một Garden có thể:

🌳 Sầu riêng
☕ Cà phê
🌿 Tiêu

Nhưng Zone không gắn cứng với một loại cây.

Ví dụ:

Garden Kiem
│
├── Zone A
│   ├── Sầu riêng
│   ├── Cà phê
│   └── Tiêu
│
├── Zone B
│   ├── Sầu riêng
│   ├── Cà phê
│   └── Tiêu

Do đó:

zone và crop phải là hai khái niệm độc lập.

21. Quy tắc UX quan trọng

Coder cần tuân thủ:

Không

❌ bắt nhập nhiều thông tin
❌ bắt định vị từng cây
❌ bắt mở bản đồ mỗi lần ghi nhật ký
❌ bắt GPS trong mọi hoạt động
❌ tạo quá nhiều màn hình
❌ dùng thuật ngữ GIS
❌ yêu cầu nông dân hiểu polygon

Có

✅ thao tác 1–3 bước
✅ nút lớn
✅ tiếng Việt rõ ràng
✅ bản đồ trực quan
✅ Zone A/B/C/D dễ hiểu
✅ GPS tự động khi dùng Bác sĩ AI
✅ luôn cho phép sửa Zone thủ công
✅ dữ liệu kỹ thuật ẩn khỏi UX

22. Acceptance Criteria

Coder chỉ được coi task hoàn thành khi các scenario sau chạy được.

Scenario 1

Người dùng tạo vườn:

Kiem — Sầu riêng + Cà phê + Tiêu

→ xác định polygon

→ chọn 4 Zone

→ app tạo A/B/C/D

→ chỉnh được ranh giới

→ lưu thành công.

Scenario 2

Người dùng:

Bón phân toàn vườn.

→ tạo một Activity

→ bản đồ thể hiện A/B/C/D đã được thực hiện.

Scenario 3

Người dùng:

Phun thuốc Zone A + B.

→ chọn A+B

→ lưu.

→ A/B cập nhật trạng thái.

→ C/D không bị đánh dấu đã phun.

Scenario 4

Người dùng ở Zone B:

Mở Bác sĩ AI → chụp ảnh → AI phân tích.

→ GPS tự động lấy.

→ Point-in-Polygon xác định Zone B.

→ Issue được tạo với:

garden_id
zone_id = B
GPS
photo
AI result
confidence
timestamp

→ Zone B chuyển trạng thái cảnh báo.

Scenario 5

GPS gần ranh giới:

→ không tự động ép Zone.

→ yêu cầu người dùng xác nhận.

Scenario 6

GPS không có:

→ Bác sĩ AI vẫn hoạt động.

→ người dùng chọn Zone thủ công.

Scenario 7

Trang chủ:

→ hiển thị đúng các Zone cần chú ý.

→ người dùng có thể bấm vào Zone để xem nguyên nhân.

23. Ưu tiên kỹ thuật

P0 — bắt buộc

Garden polygon.
Zone polygon.
Auto split 4/5 Zone.
Manual zone adjustment.
Activity toàn vườn/Zone.
GPS → Point-in-Polygon.
Issue từ Bác sĩ AI.
Zone status.
Today's tasks.
Mobile UX.

P1 — nếu còn thời gian

đổi tên Zone;
undo khi chỉnh polygon;
lịch sử hoạt động theo Zone;
filter theo ngày;
hiển thị ảnh Issue trên bản đồ.

Không làm trong task này

Plant-level GPS.
AI đếm cây.
Drone.
Satellite recognition.
GPS tracking khi phun.
tự nhận diện hàng cây.
24. Một yêu cầu rất quan trọng trước khi coder bắt đầu

Không được tự ý thay đổi kiến trúc hiện tại hoặc rewrite module đang chạy.

Trước tiên:

Đọc toàn bộ code hiện tại.
Xác định framework/frontend/backend/database đang sử dụng.
Kiểm tra schema hiện tại của Garden/Diary/AI Doctor.
Kiểm tra các API hiện có.
Kiểm tra component bản đồ nếu đã có.
Đề xuất migration tối thiểu.
Sau đó mới implement.

Nếu schema hiện tại khác với schema đề xuất ở trên, ưu tiên mở rộng schema hiện tại thay vì phá bỏ dữ liệu cũ.

Definition of Done

Sau khi hoàn thành, một nông dân mới sử dụng app phải có thể:

Tạo vườn → vẽ/xác định ranh giới → chia 4 khu → xác nhận → từ đó chỉ cần ghi "bón/phun/tưới toàn vườn hoặc A/B/C..." và khi gặp vấn đề chỉ cần mở Bác sĩ AI, chụp ảnh; app tự biết đang ở Zone nào và cập nhật bản đồ.

Mục tiêu UX cuối cùng:

Nông dân chỉ nhập việc mình đã làm hoặc vấn đề mình nhìn thấy. AgriCommunity tự lo phần vị trí, Zone, trạng thái và lịch sử.