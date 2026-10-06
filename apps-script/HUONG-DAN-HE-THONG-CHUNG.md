# Hệ thống chung STC BG V2 — Google Sheet

Báo giá, đặt cọc, tồn kho dùng chung cho cả công ty. **Đặt cọc = trừ kho. Hủy báo giá đã cọc = hoàn kho.** Mọi lần trừ/hoàn ghi vào tab PhieuXuat.

Nhân viên: **Nguyễn Thành Công**, **Lê Thị Nhàng** — cả hai được lưu, đặt cọc (trừ kho), hoàn tất, hủy.
Kho khởi tạo: tồn cuối kỳ file NXT TH09.26 (30/09/2026). File NXT của kế toán chỉ được ĐỌC, không bị ghi.

---

## Bước 1 — Tạo file Sheet (2 phút)
1. Đăng nhập Google bằng tài khoản công ty, mở **https://sheets.new**
2. Đổi tên file thành **STC_BaoGia_Data**. Giữ chế độ chia sẻ **riêng tư** (không cần chia sẻ cho ai).

## Bước 2 — Dán mã (2 phút)
1. Trên file Sheet: **Tiện ích mở rộng → Apps Script**.
2. Xóa hết mã mẫu, mở file `apps-script/Code.gs` (trong gói STC-BG-V2), **copy toàn bộ** dán vào.
3. Đổi tên dự án (góc trên) thành **STC BG API**, bấm **💾 Lưu** (Ctrl+S).

## Bước 3 — Khởi tạo (2 phút)
1. Quay lại tab Google Sheet, **tải lại trang (F5)** → xuất hiện menu **STC Báo Giá** trên thanh menu.
2. Chọn **STC Báo Giá → 1. Khởi tạo hệ thống**.
3. Google hỏi cấp quyền: **Tiếp tục → chọn tài khoản → Nâng cao → Đi tới STC BG API (không an toàn) → Cho phép**.
   (Cảnh báo "không an toàn" là bình thường với mã tự viết chưa gửi Google xét duyệt.)
4. Chạy lại **1. Khởi tạo hệ thống** nếu lần đầu chỉ hiện bước cấp quyền.
5. Hộp thoại báo: **"Đã khởi tạo kho: 203 mã…"** và **mã PIN 6 số của 2 nhân viên** → ghi lại, **gửi riêng từng người** (Zalo riêng). Xem lại bất cứ lúc nào: menu **STC Báo Giá → Xem mã PIN**.

File sẽ có 5 tab: **BaoGia, ChiTiet, Kho, PhieuXuat, DoiChieu** (37 dòng NXT cần kế toán đối chiếu: trùng mã, thiếu mã, tồn âm).

## Bước 4 — Triển khai ứng dụng web (1 phút)
1. Trong Apps Script: **Triển khai → Tùy chọn triển khai mới**.
2. Bánh răng ⚙ cạnh "Chọn loại" → **Ứng dụng web**.
3. **Thực thi với tư cách: Tôi** · **Người có quyền truy cập: Bất kỳ ai** → **Triển khai**.
4. Copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).
   → **Gửi URL này cho Claude** để gắn sẵn vào app (nhân viên chỉ cần nhập PIN).

> "Bất kỳ ai" chỉ cho phép gọi link; mọi thao tác đều cần PIN đúng. File Sheet vẫn riêng tư. Sai PIN 30 lần → khóa 10 phút.

## Bước 5 — Kết nối trên từng máy
Mở **https://stc-bg-nhanh-v2.vercel.app** → tab **Công ty** → mục **Kết nối hệ thống chung** → dán link (nếu chưa có sẵn) + **PIN của mình** → **Kết nối**. Hiện "✓ Đã kết nối: Tên nhân viên".

---

## Cách dùng hằng ngày
Mục **05 · Hệ thống chung** ở cuối trang Soạn báo giá:

| Nút | Ý nghĩa | Kho |
|---|---|---|
| **Lưu lên hệ thống** | Báo giá vào danh sách chung (trạng thái Nháp) | Không đổi |
| **Đánh dấu đã gửi khách** | Đã gửi cho khách | Không đổi |
| **Đặt cọc & trừ kho** | Nhập tiền cọc (gợi ý 20%); báo giá phương án (cổng) phải chọn phương án khách lấy | **Trừ kho**, tạo phiếu PX-yyMMdd-001; báo giá khóa |
| **Hoàn tất** | Đã giao/thi công, thu đủ | Không đổi |
| **Hủy** | Khách hủy | Nếu đã cọc: **hoàn kho**, phiếu …-HK |

- Không đủ tồn → **không cho đặt cọc**, báo rõ mã thiếu. Hàng không có trong tab Kho (vd. động cơ cổng, công lắp) được ghi "không theo dõi tồn".
- Tab **Đã lưu → Báo giá chung**: xem báo giá cả công ty, lọc theo trạng thái / nhân viên, bấm **Mở** để xem/in lại.
- Khi đã kết nối, gợi ý "ưu tiên hàng còn tồn" dùng **tồn trên Sheet** (cả 2 người thấy cùng số).
- Mất mạng: vẫn soạn/lưu trên máy như cũ; có mạng thì bấm "Lưu lên hệ thống".

## Kế toán
- Xem trực tiếp tab **Kho** (tồn hiện tại) và **PhieuXuat** (nhật ký trừ/hoàn).
- Nhập hàng / kiểm kê: sửa số ở cột **Tồn** của tab Kho (ghi chú lý do ở cột Ghi chú). Mã mới: thêm dòng (Mã hàng, Tên, ĐVT đúng như danh mục, Tồn).
- **Không sửa** cột "Dữ liệu (không sửa)" ở tab BaoGia và không đổi tên các tab.

## Khi cần cập nhật mã Apps Script
Dán mã mới → Lưu → **Triển khai → Quản lý triển khai → ✏ Chỉnh sửa → Phiên bản: Phiên bản mới → Triển khai** (giữ nguyên URL, không phải nhập lại trên máy).
Đổi PIN: menu **STC Báo Giá → Đổi mã PIN nhân viên**.
