---
name: cinema-feature-review
overview: Review QuickShow theo góc nhìn nghiệp vụ rạp chiếu phim thực tế và đề xuất roadmap cải thiện cho admin/user, ưu tiên sửa logic lõi trước khi mở rộng tính năng.
todos:
  - id: secure-admin-apis
    content: Bảo vệ các endpoint admin/show mutation bằng `protectAdmin` và rà lại route public/private.
    status: pending
  - id: fix-seat-payment-flow
    content: Làm atomic luồng giữ ghế, validate seat map, đồng bộ hold timeout với Stripe webhook.
    status: pending
  - id: expand-admin-ops
    content: Thiết kế thêm admin CRUD phòng, quản lý suất chiếu, booking lifecycle, giá vé và dashboard vận hành.
    status: pending
  - id: improve-user-flow
    content: Bổ sung tìm kiếm, trang rạp chiếu, vé điện tử/QR, countdown giữ ghế và xử lý guest state.
    status: pending
  - id: add-tests-observability
    content: Thêm test cho booking/payment/show scheduling và audit log cho thao tác admin quan trọng.
    status: pending
isProject: false
---

# Kế Hoạch Cải Thiện QuickShow

## A. Nhận Định Nhanh

QuickShow đã có nền tảng tốt cho demo đặt vé: React client, Express API, Clerk auth, MongoDB models cho `Room`, `Show`, `Booking`, Stripe checkout, Socket.io cập nhật ghế realtime. Tuy nhiên để giống một web quản lý rạp chiếu phim thực tế, cần ưu tiên độ đúng nghiệp vụ và an toàn dữ liệu trước.

Các file lõi hiện tại:

- Backend: [server/routes/showRoutes.js](server/routes/showRoutes.js), [server/routes/adminRoutes.js](server/routes/adminRoutes.js), [server/controllers/bookingController.js](server/controllers/bookingController.js), [server/controllers/showController.js](server/controllers/showController.js), [server/models/Room.js](server/models/Room.js), [server/models/Show.js](server/models/Show.js), [server/models/Booking.js](server/models/Booking.js)
- Frontend: [client/src/App.jsx](client/src/App.jsx), [client/src/context/AppContext.jsx](client/src/context/AppContext.jsx), [client/src/pages/SeatLayout.jsx](client/src/pages/SeatLayout.jsx), [client/src/pages/admin/AddShow.jsx](client/src/pages/admin/AddShow.jsx), [client/src/pages/admin/ListShows.jsx](client/src/pages/admin/ListShows.jsx), [client/src/pages/admin/ListBookings.jsx](client/src/pages/admin/ListBookings.jsx), [client/src/pages/MyBookings.jsx](client/src/pages/MyBookings.jsx)



frontend :

## **1. Page and main component files (absolute paths)**

**Pages (**`D:\QuickShow\client\src\pages\`**)**


| **File**                                               |
| ------------------------------------------------------ |
| `D:\QuickShow\client\src\pages\Home.jsx`               |
| `D:\QuickShow\client\src\pages\Movies.jsx`             |
| `D:\QuickShow\client\src\pages\MovieDetails.jsx`       |
| `D:\QuickShow\client\src\pages\SeatLayout.jsx`         |
| `D:\QuickShow\client\src\pages\MyBookings.jsx`         |
| `D:\QuickShow\client\src\pages\Favorite.jsx`           |
| `D:\QuickShow\client\src\pages\admin\Layout.jsx`       |
| `D:\QuickShow\client\src\pages\admin\DashBoard.jsx`    |
| `D:\QuickShow\client\src\pages\admin\AddShow.jsx`      |
| `D:\QuickShow\client\src\pages\admin\ListShows.jsx`    |
| `D:\QuickShow\client\src\pages\admin\ListBookings.jsx` |


**Layout / shell**


| **File**                           |
| ---------------------------------- |
| `D:\QuickShow\client\src\App.jsx`  |
| `D:\QuickShow\client\src\main.jsx` |


**Components (**`D:\QuickShow\client\src\components\`**)**


| **File**                                                    |
| ----------------------------------------------------------- |
| `D:\QuickShow\client\src\components\Navbar.jsx`             |
| `D:\QuickShow\client\src\components\Footer.jsx`             |
| `D:\QuickShow\client\src\components\HeroSection.jsx`        |
| `D:\QuickShow\client\src\components\FeaturedSection.jsx`    |
| `D:\QuickShow\client\src\components\TrailersSection.jsx`    |
| `D:\QuickShow\client\src\components\MovieCard.jsx`          |
| `D:\QuickShow\client\src\components\DateSelect.jsx`         |
| `D:\QuickShow\client\src\components\Loading.jsx`            |
| `D:\QuickShow\client\src\components\BlurCircle.jsx`         |
| `D:\QuickShow\client\src\components\admin\AdminNavbar.jsx`  |
| `D:\QuickShow\client\src\components\admin\AdminSidebar.jsx` |
| `D:\QuickShow\client\src\components\admin\Title.jsx`        |


**Context**


| **File**                                         |
| ------------------------------------------------ |
| `D:\QuickShow\client\src\context\AppContext.jsx` |


**Related (not UI pages):** `D:\QuickShow\client\src\configs\socket.js`, libs under `D:\QuickShow\client\src\lib\`, `D:\QuickShow\client\src\assets\assets.js`.

---

## **2. Booking / Payment vs your checklist**

- **Booking flow:** Pick date on movie detail (`DateSelect`) → route `/movies/:id/:date` → `SeatLayout` (seat map + checkout button).
- **No dedicated** `Booking.jsx` **or** `Payment.jsx`**.** After creating a booking, `SeatLayout` sets `window.location.href = data.url`** (external URL from the API). `MyBookings` shows a **“Thanh toán”** link to `item.paymentLink` when `!item.isPaid`.
- `Loading` route `/loading/:nextUrl` is a spinner that redirects to `'/' + nextUrl` after 5s (comment mentions payment/Stripe-style waiting).

  


```
## B. Danh sach chuc nang hien co

### B1. Phia User


| #   | Chuc nang                                  | Trang thai | Ghi chu                                              |
| --- | ------------------------------------------ | ---------- | ---------------------------------------------------- |
| 1   | Dang ky / Dang nhap (Clerk)                | OK         | Hoat dong tot qua ClerkProvider                      |
| 2   | Xem danh sach phim dang chieu              | OK         | Lay tu TMDB + Show upcoming                          |
| 3   | Xem chi tiet phim (poster, cast, overview) | OK         | `MovieDetails.jsx` lay tu MongoDB + TMDB             |
| 4   | Xem lich chieu theo ngay                   | OK         | `DateSelect` + groupBy date trong `getShow`          |
| 5   | Chon ghe real-time (Socket.io)             | OK         | 4 trang thai ghe: trong, dang chon, dang giu, da ban |
| 6   | Dat ve + Thanh toan Stripe                 | OK         | `createBooking` -> Stripe Checkout -> Webhook        |
| 7   | Giu ghe tam thoi (heldSeats)               | OK         | 5 phut timeout qua Inngest                           |
| 8   | Xem lich su dat ve                         | OK         | `MyBookings.jsx`                                     |
| 9   | Danh sach phim yeu thich                   | OK         | Luu trong Clerk privateMetadata                      |
| 10  | Email xac nhan dat ve                      | OK         | Inngest `app/show.booked`                            |
| 11  | Email nhac nho truoc 8h                    | OK         | Inngest cron moi gio                                 |
| 12  | Email thong bao phim moi                   | OK         | Inngest `app/show.added`                             |
| 13  | Gioi han 5 ghe/giao dich                   | OK         | Check ca frontend                                    |


### B2. Phia Admin


| #   | Chuc nang                                          | Trang thai | Ghi chu                             |
| --- | -------------------------------------------------- | ---------- | ----------------------------------- |
| 1   | Kiem tra quyen admin (Clerk metadata)              | OK         | `protectAdmin` middleware           |
| 2   | Dashboard tong quan (doanh thu, ve, user)          | OK         | Aggregation pipeline                |
| 3   | Them suat chieu moi (chon phim TMDB + phong + gio) | OK         | `addShow` controller                |
| 4   | Xem danh sach suat chieu + doanh thu               | OK         | Aggregation voi lookup bookings     |
| 5   | Xem danh sach dat ve                               | OK         | Populate user + show + movie        |
| 6   | Seed phong chieu mau (6 phong)                     | OK         | 3 layout: Standard, IMAX, GoldClass |
| 7   | Xem danh sach phong                                | OK         | `getAllRooms`                       |


```



---

### **Schema overview**


| **Entity**  | **Purpose**                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**    | String `_id`; `name`, `email`, `image` (all required). Matches string refs from other models.                                                                                    |
| **Movie**   | String `_id` (TMDB-style); TMDB-like fields (`poster_path`, `backdrop_path`, `genres`, `casts`, etc.); timestamps.                                                               |
| **Room**    | `name`, `roomType` (`2D` / `3D` / `IMAX`); nested `seatMap` (rows with `seatNumber` + `seatType`); timestamps. MongoDB `ObjectId` by default.                                    |
| **Show**    | `movie` (string → Movie); `room` (ObjectId → Room); `showDateTime`, `basePrice`; `occupiedSeats` / `heldSeats` as plain objects; `minimize: false` keeps empty keys; timestamps. |
| **Booking** | `user` (string → User); `show` (ObjectId → Show); denormalized `roomName`; `bookedSeats` (untyped array); `amount`; `isPaid`; optional `paymentLink`; timestamps.                |


  


## Giai Đoạn 1: Sửa Logic Lõi Và Bảo Mật

Ưu tiên các lỗi có thể làm sai dữ liệu hoặc lộ quyền admin:

- Thêm `protectAdmin` cho API tạo suất chiếu trong [server/routes/showRoutes.js](server/routes/showRoutes.js): hiện `protectAdmin` được import nhưng `POST /add` đang gọi thẳng `addShow`.
- Thêm `protectAdmin` cho `GET /api/admin/rooms` trong [server/routes/adminRoutes.js](server/routes/adminRoutes.js) vì endpoint này trả toàn bộ sơ đồ phòng/ghế.
- Chuẩn hóa luồng giữ ghế trong [server/controllers/bookingController.js](server/controllers/bookingController.js): validate `selectedSeats`, chặn ghế `EMPTY`, chặn seat id không tồn tại, loại duplicate, giới hạn số ghế, và dùng update atomic hoặc transaction để tránh hai user đặt trùng ghế.
- Đồng bộ thời gian giữ ghế với Stripe: [server/controllers/bookingController.js](server/controllers/bookingController.js) để Stripe session 30 phút, còn [server/inngest/index.js](server/inngest/index.js) nhả ghế sau 5 phút. Cần chọn một TTL duy nhất hoặc expire Stripe cùng lúc nhả ghế.
- Chuyển webhook sang xử lý `checkout.session.completed` trong [server/controllers/stripeWebhooks.js](server/controllers/stripeWebhooks.js), idempotent theo `bookingId`, và kiểm tra lại ghế trước khi chốt `occupiedSeats`.

Snippet thể hiện rủi ro chính:

```js
showRouter.post('/add',addShow)
```

```js
const isAvailable = await checkSeatsAvailability(showId, selectedSeats);
// ... sau đó mới update heldSeats bằng save()
```

## Giai Đoạn 2: Admin Đúng Nghiệp Vụ Rạp Chiếu

Bổ sung các màn hình và API admin mà một rạp chiếu cần có:

- Quản lý phòng chiếu: CRUD phòng, loại phòng, sơ đồ ghế, trạng thái bảo trì, sức chứa; hiện chỉ có seed data trong [server/controllers/adminController.js](server/controllers/adminController.js).
- Quản lý suất chiếu: sửa/xóa/hủy suất, kiểm tra trùng lịch cùng phòng, không cho tạo lịch trong quá khứ, không cho lịch đè nhau theo runtime phim + thời gian dọn phòng.
- Quản lý booking: xem trạng thái `pending/paid/cancelled/refunded/expired`, tìm theo mã vé, email, phim, ngày; hiện [client/src/pages/admin/ListBookings.jsx](client/src/pages/admin/ListBookings.jsx) chỉ list cơ bản.
- Quản lý giá: tách bảng giá khỏi `basePrice`; hỗ trợ phụ thu theo loại ghế, loại phòng, ngày cuối tuần, suất đặc biệt, mã giảm giá.
- Dashboard thực tế hơn: doanh thu theo ngày/phim/phòng, tỷ lệ lấp đầy, vé đã bán theo suất, đơn chưa thanh toán, ghế bị giữ quá hạn.
- Phân quyền nhân sự: `admin`, `staff`, `manager`; staff có thể check-in vé nhưng không chỉnh phòng/lịch.

## Giai Đoạn 3: User Flow Thực Tế Hơn

Cải thiện trải nghiệm khách hàng từ browse đến sau thanh toán:

- Trang rạp chiếu riêng thay vì navbar `Rạp chiếu` đang trỏ về `/`: hiển thị địa chỉ, phòng, tiện ích, lịch chiếu theo rạp.
- Tìm kiếm thật cho icon search trong [client/src/components/Navbar.jsx](client/src/components/Navbar.jsx): theo tên phim, thể loại, ngày chiếu.
- Vé điện tử sau thanh toán: mã booking, QR/check-in code, trạng thái thanh toán, phòng, ghế, giờ chiếu, chính sách đổi/hủy.
- Xử lý khách chưa đăng nhập ở [client/src/pages/MyBookings.jsx](client/src/pages/MyBookings.jsx): hiện có thể kẹt loading nếu không có `user`.
- Trang favorite nên có CTA đăng nhập rõ ràng và đồng bộ trạng thái sau khi user login/logout.
- Trang chọn ghế cần hiển thị countdown giữ ghế, chính sách giới hạn ghế, thông báo khi suất không còn giờ chiếu hợp lệ.

## Giai Đoạn 4: Dữ Liệu, Vận Hành Và Kiểm Thử

- Bổ sung model `Theater` nếu muốn hỗ trợ nhiều chi nhánh; `Room` nên thuộc một theater thay vì là thực thể duy nhất.
- Bổ sung trạng thái rõ cho booking thay vì chỉ `isPaid`: `pending`, `paid`, `expired`, `cancelled`, `refunded`.
- Viết test backend cho booking race condition, ghế không hợp lệ, webhook thanh toán, tạo suất trùng lịch.
- Viết test frontend hoặc integration smoke test cho admin add show, user chọn ghế, checkout redirect, my bookings.
- Thêm audit log cho các thao tác admin quan trọng: tạo/sửa/xóa suất, thay đổi giá, hoàn tiền, hủy vé.

## Thứ Tự Nên Làm

1. Khóa quyền admin và sửa booking/payment consistency.
2. Chuẩn hóa schema `Booking`, `Show`, validation ghế và trạng thái đơn.
3. Thêm admin CRUD phòng/suất/booking status.
4. Nâng cấp user flow: search, theater page, ticket QR, countdown giữ ghế.
5. Bổ sung report, phân quyền nhân sự, audit log và test coverage.

