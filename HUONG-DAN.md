# Module Pháp lý dự án (CTG ERP V2 · app-09 · MOD-09) — phiên bản 2

Phiên bản 2 (17/10/2026) bỏ toàn bộ chức năng cũ (tổng quan, hồ sơ xin phép, điều kiện mở bán, lịch hạn, trợ lý tra cứu, thay đổi quy định, thống kê việc). Module giờ có 4 nhóm chức năng:
1. Checklist hồ sơ
2. Soạn dự thảo văn bản
3. Chức năng riêng từng bước
4. Lập kế hoạch pháp lý

Module dùng chung CSDL `ctg_qlda`, tài khoản và phiên đăng nhập với Quản lý dự án (cổng 3200) và Quản lý thiết kế (cổng 3300).

## Chạy
- Bấm đúp `Chay app Phap ly du an.bat`. Tệp này tạo bảng, đồng bộ danh mục từ QLDA rồi mở http://localhost:3400.
- Bật AI: điền `ANTHROPIC_API_KEY=` trong `.env` rồi chạy lại. AI dùng model Claude Opus 5.5.
- Khi chưa có khóa API, các chức năng không cần AI vẫn chạy: checklist, cảnh báo thiếu hồ sơ, xuất bộ hồ sơ, soạn văn bản theo mẫu, xuất văn bản từng hộ, kế hoạch và nhắc việc.
- In PDF dùng Microsoft Edge có sẵn trên Windows, chạy ẩn. Nếu máy không có Edge, đặt `EDGE_PATH=` trỏ tới Chrome.

## Màn hình
| Màn | Chức năng |
|---|---|
| Trợ lý AI (đầu menu + nút trên thanh trên cùng) | Hỏi đáp tự do với Claude về pháp lý dự án: báo cáo tình hình, việc phải làm, hồ sơ thiếu, tra cứu thủ tục, soạn văn bản. AI dùng dữ liệu trong phần mềm (bước, kế hoạch, hồ sơ thiếu, cảnh báo, dự thảo, thư viện văn bản) của dự án đang chọn. **Đính kèm** tệp (PDF, ảnh scan, Word, Excel) hoặc chọn **Từ hồ sơ trong phần mềm**. Lưu lịch sử trò chuyện riêng từng người; sao chép, tải Word câu trả lời. Chế độ: Trả lời nhanh / Tiêu chuẩn / Phân tích kỹ. Chưa có khóa API: quản trị bấm **Kết nối Trợ lý AI** và dán khóa (ghi vào .env, bật ngay) |
| 09-01 Hôm nay | Nhắc việc trong ngày. **Phải làm hôm nay**: đến ngày bắt đầu, đến hạn nộp, cơ quan sắp hết hoặc đã quá hạn trả kết quả. **Chậm trễ** so với kế hoạch gốc. Hồ sơ còn thiếu, cảnh báo AI chưa xử lý, bước sắp tới trong 14 ngày |
| 09-02 Kế hoạch pháp lý | **Khởi tạo các bước** từ 40 thủ tục QLDA. Phụ thuộc giữa các bước lấy từ quan hệ mốc tiền đề. Thời hạn giải quyết lấy theo quy định; ngày làm việc bỏ T7, CN. Bước có mốc QLDA đã xong tự đánh dấu hoàn thành. Biểu đồ Gantt so kế hoạch hiện hành với kế hoạch gốc. Mỗi lần cập nhật trạng thái hoặc ngày thực tế, các bước sau tự dời. Có lập lại kế hoạch, chốt kế hoạch gốc, thêm bước riêng, xuất Excel, khai **thông tin chủ đầu tư** |
| 09-03 Hồ sơ theo bước | Checklist của từng bước, chia 3 nhóm: văn bản cần soạn, hồ sơ đầu vào, kết quả. **Cảnh báo hồ sơ bắt buộc còn thiếu**. Tải tệp lên (nhiều tệp, thay phiên bản), AI đọc từng tệp. **Đủ hồ sơ → AI tự kiểm tra sai sót, mâu thuẫn**. **Tải bản scan kết quả → AI tự đối chiếu với hồ sơ bước trước**. Thêm mục theo yêu cầu riêng. AI bổ sung checklist từ văn bản luật mới. Lấy checklist từ dự án khác, lưu thành mẫu. **Xuất bộ hồ sơ**: PDF có trang danh mục và số trang để in, ký; hoặc ZIP để nộp điện tử |
| 09-04 Dự thảo văn bản | AI soạn đúng mẫu (biểu mẫu QLDA gắn thủ tục) và thể thức NĐ 30/2020. Nội dung lấy từ hồ sơ các bước trước. Chỗ thiếu để dạng «[cần bổ sung]». Sửa có xem trước khổ A4. **AI kiểm tra lại** dự thảo với hồ sơ liên quan. **Chốt** → in PDF, tự gắn vào checklist (chưa điền hết chỗ […] thì không chốt được). Tải Word, in. Khi AI tắt: dùng mẫu soạn sẵn |
| 09-05 Bồi thường từng hộ | Nhập bảng tổng hợp phương án bồi thường được duyệt (Excel; tự nhận cột, xem trước, theo đợt). Kiểm tra số liệu: tổng ≠ cộng các khoản, trùng thửa, thiếu thông tin. Xuất cho từng hộ: **QĐ phê duyệt phương án BTHT**, **QĐ thu hồi đất**, **phiếu chi** (số tiền bằng chữ). Sửa căn cứ, nội dung mẫu, số bắt đầu. Xuất PDF hoặc Word, lưu thẳng vào checklist bước tương ứng |
| 09-06 Thư viện checklist mẫu | Checklist mẫu theo thủ tục. Bộ khởi tạo gồm thành phần hồ sơ thông dụng, danh mục hồ sơ bắt buộc QLDA và biểu mẫu QLDA. Pháp chế thêm, sửa; AI đọc văn bản luật mới và đề xuất; áp dụng mục mới vào các dự án |

## Lưu ý
- **Checklist khởi tạo và mẫu văn bản là bộ khởi đầu, Pháp chế rà soát theo văn bản hiện hành.** Riêng căn cứ trong mẫu văn bản từng hộ có ghi chú [kiểm tra hiệu lực].
- Mọi kết quả AI (đọc tệp, cảnh báo, dự thảo, đề xuất checklist) là gợi ý. Người dùng kiểm tra trước khi dùng; AI không tự sửa hồ sơ.
- AI nhận tệp PDF, ảnh scan (JPG/PNG), Word .docx, Excel .xlsx. Tệp .doc/.xls cũ: lưu lại dạng mới.
- Ghép PDF chỉ nhận tệp PDF và ảnh. Tệp Word/Excel được đưa vào bản ZIP.
- Khi tính thời hạn ngày làm việc, chưa trừ ngày lễ.

## Quyền
- **Xem tất cả dự án**: quản trị, lãnh đạo (LD), Pháp chế (`PLDA`, `PCKS`).
- **Thao tác**: theo vai trò trong dự án. `PLDA` được coi là Người lập, `PCKS` là Người duyệt.
- **Xóa bước, xóa mục đã có tệp**: Người duyệt.
- **Sửa thư viện checklist mẫu**: Pháp chế hoặc quản trị.
