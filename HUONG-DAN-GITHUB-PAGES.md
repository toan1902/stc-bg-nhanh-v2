# STC Báo Giá — triển khai GitHub Pages

Ứng dụng tĩnh, không cần npm, máy chủ riêng, API key hoặc bước build.

## Đưa lên GitHub
1. Giải nén STC-BAO-GIA-GITHUB.zip trên máy.
2. Tạo repository của bạn trên GitHub.
3. Chọn Add file > Upload files. Tải toàn bộ nội dung đã giải nén vào gốc repository: index.html, app.js, core.js, style.css, assets/, vendor/ và .nojekyll. Không chỉ tải file ZIP. Không đặt thêm một thư mục bao ngoài.
4. Commit changes vào nhánh main.
5. Vào Settings > Pages > Build and deployment. Chọn Source: Deploy from a branch, Branch: main, Folder: / (root), rồi Save.
6. Chờ triển khai hoàn tất. Settings > Pages sẽ hiển thị địa chỉ thật, thường có dạng https://TEN-GITHUB.github.io/TEN-REPOSITORY/.

Tài liệu GitHub: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Cách thử
- Chọn Nạp mẫu 7 sản phẩm: tổng 88.514.000đ.
- Đổi ổ cắm BLE từ 6 về 1: tổng 86.589.000đ.
- Thử tải Ảnh PNG, Excel và PDF.
- Bảng giá > Nhập bảng giá: XLSX, CSV UTF-8, JSON; có xem trước và ghép cột.
- Lưu báo giá rồi mở tab Đã lưu. Tải bản sao lưu JSON trước khi chuyển thiết bị.
- Tab Công ty cho thay thông tin, logo và ngân hàng. Bấm Áp dụng vào báo giá đang soạn khi muốn cập nhật bản hiện tại.

## Dữ liệu và giới hạn
Dữ liệu khách và báo giá nhập thêm được lưu trên trình duyệt/thiết bị, không tự đồng bộ. Dữ liệu ở link thử localhost không tự chuyển sang tên miền GitHub; dùng tải/khôi phục bản sao lưu.
Gói có bảng giá 7 sản phẩm mẫu, thông tin liên hệ và STK công ty Vietcombank 0231000648025 theo yêu cầu. Đây là app tĩnh không có đăng nhập riêng; người truy cập trang được xuất bản có thể xem dữ liệu mặc định. Kiểm tra dữ liệu trước khi công khai repository/trang.
Logo FPT gốc riêng chưa có: app hiển thị chữ FPT Smart Home và cho tải logo trong tab Công ty. PNG quá dài sẽ yêu cầu dùng PDF nhiều trang. PDF xuất dưới dạng ảnh độ phân giải cao, không phải văn bản có thể chọn.

## Chạy trên máy
Phải mở qua HTTP, không nhấp đúp index.html vì app đọc file JSON.
Nếu máy có Python, mở terminal tại thư mục giải nén và chạy:
python -m http.server 8765 --bind 127.0.0.1
Sau đó mở http://127.0.0.1:8765/ . Link này chỉ dùng trên máy chạy server.

## Cấu trúc
index.html: giao diện; style.css: thiết kế; app.js: nhập liệu/xuất file; core.js: tính toán; assets/: logo và dữ liệu khởi tạo; vendor/: thư viện được đóng gói sẵn.

## STC BG V2 — Động cơ cổng
- Lần mở đầu, app tự thêm 4 mã động cơ cổng vào danh mục (không ghi đè mã đã có): CONG-AB-AMSAN 30.000.000đ, CONG-DEA-GHOST100-24V 34.000.000đ, CONG-DEA-LIVI900-24V 24.000.000đ, CONG-AB-ACQUY 1.990.000đ. Sửa giá ở tab Bảng giá.
- Nút "Nạp mẫu động cơ cổng": 3 phương án kèm ưu đãi T10/2026, hiệu lực, bảo hành, điều khoản thanh toán.
- Mục 03 có thêm: Loại báo giá (Thiết bị thông minh / Động cơ cổng), Cách tính tổng (Cộng dồn / Phương án lựa chọn), ô Ưu đãi.
- Báo giá Động cơ cổng: bỏ chữ FPT, tiêu đề "BÁO GIÁ ĐỘNG CƠ CỔNG TỰ ĐỘNG", tự thêm phụ lục chỉ tiêu kỹ thuật, thành phần, yêu cầu mặt bằng, quy trình (PDF thêm 2 trang phụ lục).
- Mỗi dòng có "Giá gốc gạch ngang" (tùy chọn) để hiện giá cũ bị gạch.
- Dữ liệu cổng nằm trong assets/gate-products.json (chỉnh thông số/thành phần/ưu đãi mẫu tại đây).

## V2 — Rèm kéo ngang theo giá FPT (bỏ AOK)
- Bỏ khỏi danh mục 8 mã AOK (động cơ 20041058, 6 thanh ray AOK, bộ phụ kiện 20041790) và 4 mã mẫu STC-001..004.
- Thêm FPT-REM-KN-BO "Động cơ và phụ kiện rèm cửa kéo ngang" 3.774.000đ/Bộ và FPT-RAY-KN-M "Thanh ray rèm kéo ngang" 550.000đ/mét (giá trước chiết khấu 10% theo báo giá FPT; dùng ô Chiết khấu nếu áp 10%).
- Gộp mã mẫu trùng: STC-008 → 20038367 (Bộ điều khiển trung tâm), STC-009 → 20046328 (Thiết bị mở rộng sóng ZigBee 3.0).
- Báo giá đã lưu giữ nguyên giá/tên cũ. Số tồn NXT gốc không bị xóa; mã AOK không còn trong danh mục nên không được khởi tạo tồn.
- Dữ liệu nằm trong assets/curtain-fpt.json.

## V2 — Tồn kho online & chế độ thông minh
- Tab Tồn kho: ô link mặc định là Google Sheet NXT của STC (gid=667618843). Bấm "Cập nhật tồn từ Google Sheet" → xem trước → xác nhận. Sheet đang chia sẻ công khai "ai có link đều xem được" nên trình duyệt đọc trực tiếp.
- Đọc được định dạng kế toán của CSV: "2.409.000", "-" = 0, "- 1" = âm (bị loại để đối chiếu, không tự nhập).
- Tháng mới: dán link tab NXT mới (có gid) vào ô rồi bấm cập nhật.
- Soạn báo giá: bật "Thông minh: ưu tiên hàng còn tồn" (mặc định bật) → hàng còn tồn lên đầu, ghi "✓ Còn N" (đã trừ số lượng đang chọn trong báo giá); hàng hết tồn hiện gợi ý công tắc cùng loại còn tồn để bấm thêm nhanh.

## V2 — Hệ thống chung (Google Sheet): báo giá dùng chung, đặt cọc trừ kho
Xem hướng dẫn chi tiết: apps-script/HUONG-DAN-HE-THONG-CHUNG.md (mã: apps-script/Code.gs).
