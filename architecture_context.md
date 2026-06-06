# Project Architecture & Context

Đây là file tài liệu gốc dùng để ghi nhớ cấu trúc toàn bộ dự án `finance_chart`. Bất cứ khi nào có yêu cầu mới, AI sẽ đọc file này để nắm bắt context trước khi lập trình. Nếu có thay đổi lớn về cấu trúc, file này phải được cập nhật tương ứng.

## 1. Cấu trúc thư mục cốt lõi
- `src/`
  - `App.jsx`: Component gốc (Main Container).
  - `Chart.jsx`: Component biểu đồ tiền tệ (USD/HKD).
  - `BtcChart.jsx`: Component biểu đồ Crypto (BTC/USDT).
  - `YahooChart.jsx`: Component biểu đồ chung (Generic) dành cho các tài sản từ Yahoo Finance.
  - `index.css`: File chứa toàn bộ Design System (Glassmorphism, CSS Variables, Responsive Layout).
- `vite.config.js`: File cấu hình server và Proxy để tránh lỗi CORS.

## 2. Chi tiết các File & Component

### `App.jsx`
- **Chức năng**: Là "bảng điều khiển" (Dashboard) chính. Chứa danh sách cấu hình của các biểu đồ và quản lý tính năng Kéo thả (Drag and Drop) thông qua thư viện `@hello-pangea/dnd`.
- **State chính**:
  - `charts`: Mảng lưu trữ thứ tự hiện tại của các biểu đồ.
  - `stats`: Object lưu trữ thông số real-time (giá hiện tại, % thay đổi) của tất cả biểu đồ để hiển thị ở các khối tóm tắt bên trái.
- **Hàm quan trọng**:
  - `handleDragEnd`: Xử lý logic hoán đổi vị trí trong mảng `charts` khi người dùng thả chuột.
  - `handleDataLoaded...`: Cập nhật state `stats` khi các Component con gọi API thành công. Đã được bọc bằng `useCallback` để tránh lỗi Infinite Loop do re-render.

### `Chart.jsx`
- **Chức năng**: Render biểu đồ lịch sử 10 năm của tỷ giá USD/HKD.
- **Dữ liệu**: Lấy từ Frankfurter API qua proxy `/api`.
- **Cơ chế**: Lấy dữ liệu 1 lần lúc tải trang, không có polling (vì dữ liệu Ngân hàng chỉ cập nhật 1 lần/ngày).

### `BtcChart.jsx`
- **Chức năng**: Render biểu đồ giá Bitcoin 10 năm.
- **Dữ liệu**: Lấy trực tiếp từ Binance API (không cần proxy vì Binance hỗ trợ CORS). 
- **Cơ chế**:
  - Gọi API `klines` lấy dữ liệu nến tuần (10 năm) lúc ban đầu.
  - Dùng `setInterval` gọi API `ticker/price` mỗi 5 giây để cập nhật giá Real-time vào điểm dữ liệu cuối cùng của mảng, tạo hiệu ứng live mà không cần tải lại trang.

### `YahooChart.jsx`
- **Chức năng**: Là một Generic Component có khả năng tái sử dụng cao. Render biểu đồ cho bất kỳ mã tài sản nào có trên Yahoo Finance.
- **Props đầu vào**: `ticker` (Mã tài sản), `label` (Tên hiển thị), `color` (Màu chủ đạo), `isPercentage` (Định dạng hiển thị % hay số thập phân).
- **Hiện đang dùng cho**:
  - Nasdaq 100 (`ticker="^NDX"`)
  - US Dollar Index (`ticker="DX-Y.NYB"`)
  - Lãi suất - Fed Fund Proxy (`ticker="^IRX"`)
- **Cơ chế**:
  - Lấy 10 năm dữ liệu qua API chart của Yahoo (proxy `/yahoo`).
  - Dùng `setInterval` gọi API `interval=1d&range=1d` mỗi 5 giây để chèn giá Real-time (nếu thị trường đang mở cửa).

### `index.css`
- **Chức năng**: Quản lý UI/UX.
- **Đặc điểm**:
  - Dùng hệ thống biến CSS (`--bg-color`, `--card-bg`, v.v.) để dễ dàng đổi Theme sau này.
  - Sử dụng phong cách Glassmorphism (Kính mờ) với hiệu ứng `backdrop-filter: blur()`.
  - Có các class tiện ích như `.trend.up`, `.trend.down` để hiển thị màu xanh/đỏ cho % thay đổi giá.

### `vite.config.js`
- **Chức năng**: Cấu hình môi trường dev.
- **Đặc điểm quan trọng nhất**: Cấu hình **Proxy**.
  - `/api` -> `https://api.frankfurter.app`
  - `/yahoo` -> `https://query1.finance.yahoo.com`
  - *Lý do*: Trình duyệt sẽ chặn các request API trực tiếp đến các server không bật CORS. Proxy giúp lừa trình duyệt rằng request được gửi nội bộ, từ đó vượt qua rào cản CORS một cách hợp lệ trong môi trường dev.

---
*Ghi chú cho AI: Bất kỳ khi nào thực hiện thay đổi logic lớn, thay đổi API, hoặc thêm Component mới, hãy cập nhật lại file này.*
