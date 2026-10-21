// Checklist hồ sơ mẫu khởi tạo theo thủ tục. Đây là bộ KHỞI ĐẦU để Pháp chế rà soát:
// thành phần hồ sơ thông dụng của từng thủ tục + danh mục hồ sơ bắt buộc của QLDA + biểu mẫu QLDA gắn với thủ tục.
// Người dùng bổ sung / sửa ở màn «Thư viện checklist & mẫu», hoặc đưa văn bản luật mới cho AI đề xuất bổ sung.
// Chạy lại an toàn (khóa seed_key); không ghi đè mục người dùng đã sửa.
const R = 'Thành phần hồ sơ thông dụng — Pháp chế rà soát theo quy định hiện hành';
// [loại, tên, {req:false, doc:'don'|..., tag, basis}]
const D = 'dau_vao', S = 'soan', K = 'ket_qua';
const SEED = {
  'TT-GIAOCDT': [
    [S, 'Văn bản đề nghị giao chủ đầu tư / chấp thuận chủ trương đầu tư', { doc: 'cong_van' }],
    [D, 'Đề xuất dự án đầu tư (quy mô, vốn, tiến độ, địa điểm, nhu cầu sử dụng đất)'],
    [D, 'Hồ sơ pháp lý nhà đầu tư (ĐKDN, điều lệ, giấy ủy quyền người đại diện)'],
    [D, 'Tài liệu chứng minh năng lực tài chính (BCTC 2 năm gần nhất / cam kết hỗ trợ tài chính)'],
    [D, 'Văn bản về địa điểm, hiện trạng khu đất, sự phù hợp quy hoạch'],
    [D, 'Thỏa thuận liên danh (nếu là liên danh)', { req: false }],
    [K, 'Quyết định giao chủ đầu tư / chấp thuận chủ trương đầu tư đồng thời giao CĐT'],
  ],
  'TT-CTDT': [
    [S, 'Văn bản đề nghị thực hiện dự án đầu tư', { doc: 'cong_van' }],
    [D, 'Đề xuất dự án đầu tư'],
    [D, 'Hồ sơ pháp lý và năng lực tài chính nhà đầu tư'],
    [D, 'Đề xuất nhu cầu sử dụng đất / tài liệu về quyền sử dụng địa điểm'],
    [K, 'Quyết định chấp thuận chủ trương đầu tư'],
  ],
  'TT-DCCDT': [
    [S, 'Văn bản đề nghị điều chỉnh quyết định giao CĐT / chủ trương đầu tư', { doc: 'cong_van' }],
    [D, 'Báo cáo tình hình triển khai dự án đến thời điểm đề nghị điều chỉnh'],
    [D, 'Quyết định giao CĐT / chấp thuận chủ trương đầu tư đã được cấp'],
    [D, 'Giải trình nội dung điều chỉnh và lý do'],
    [K, 'Quyết định điều chỉnh'],
  ],
  'TT-QHCT': [
    [S, 'Tờ trình đề nghị thẩm định, phê duyệt đồ án QHCT 1/500', { doc: 'to_trinh' }],
    [D, 'Thuyết minh đồ án quy hoạch chi tiết'],
    [D, 'Bản vẽ đồ án QHCT (hiện trạng, tổng mặt bằng sử dụng đất, hạ tầng kỹ thuật…)'],
    [D, 'Dự thảo quy định quản lý theo đồ án quy hoạch'],
    [D, 'Báo cáo tổng hợp ý kiến cộng đồng dân cư, cơ quan, tổ chức liên quan'],
    [D, 'Văn bản góp ý của Sở Xây dựng và các sở, ngành'],
    [D, 'Hồ sơ năng lực đơn vị tư vấn lập quy hoạch'],
    [K, 'Báo cáo thẩm định đồ án QHCT'],
    [K, 'Quyết định phê duyệt QHCT 1/500'],
    [K, 'Biên bản / thông báo công bố công khai quy hoạch', { req: false }],
  ],
  'TT-TBTHUHOI': [
    [S, 'Văn bản đề nghị ban hành thông báo thu hồi đất', { doc: 'cong_van' }],
    [D, 'Kế hoạch thu hồi đất, điều tra, khảo sát, đo đạc, kiểm đếm'],
    [D, 'Trích lục / trích đo bản đồ địa chính khu đất'],
    [D, 'Văn bản chấp thuận chủ trương đầu tư / giao CĐT (căn cứ thu hồi)'],
    [K, 'Thông báo thu hồi đất'],
    [K, 'Biên bản họp phổ biến thông báo thu hồi đất cho người dân', { req: false }],
    [K, 'Biên bản điều tra, khảo sát, đo đạc, kiểm đếm từng thửa', { req: false }],
  ],
  'TT-PDPA': [
    [D, 'Biên bản điều tra, kiểm đếm đất, tài sản từng hộ'],
    [D, 'Hồ sơ nguồn gốc đất, xác nhận của UBND cấp xã'],
    [D, 'Bảng giá đất cụ thể / quyết định giá đất tính bồi thường'],
    [S, 'Dự thảo phương án bồi thường, hỗ trợ, tái định cư', { doc: 'bao_cao' }],
    [D, 'Biên bản niêm yết và kết thúc niêm yết phương án'],
    [D, 'Biên bản lấy ý kiến / đối thoại về phương án'],
    [S, 'Tờ trình đề nghị thẩm định, phê duyệt phương án BTHT-TĐC', { doc: 'to_trinh' }],
    [D, 'Bảng tổng hợp phương án bồi thường, hỗ trợ (chi tiết từng hộ)'],
    [K, 'Biên bản / báo cáo thẩm định phương án'],
    [K, 'Quyết định phê duyệt phương án BTHT-TĐC (tổng hợp)'],
    [S, 'Quyết định phê duyệt phương án bồi thường, hỗ trợ chi tiết từng hộ (xuất từ bảng tổng hợp)', { doc: 'quyet_dinh', tag: 'qd_pa_ho', req: false }],
  ],
  'TT-QDTHUHOI': [
    [D, 'Quyết định phê duyệt phương án BTHT-TĐC'],
    [D, 'Bảng tổng hợp diện tích thu hồi từng hộ / từng thửa'],
    [S, 'Tờ trình đề nghị ban hành quyết định thu hồi đất', { doc: 'to_trinh' }],
    [S, 'Quyết định thu hồi đất từng hộ (xuất từ bảng tổng hợp)', { doc: 'quyet_dinh', tag: 'qd_thu_hoi_ho' }],
    [K, 'Quyết định thu hồi đất (đã ký, đóng dấu)'],
  ],
  'TT-CHITRA': [
    [D, 'Quyết định phê duyệt phương án BTHT chi tiết từng hộ'],
    [S, 'Phiếu chi tiền bồi thường, hỗ trợ từng hộ (xuất từ bảng tổng hợp)', { doc: 'bien_ban', tag: 'phieu_chi_ho' }],
    [S, 'Thông báo / giấy mời nhận tiền bồi thường', { doc: 'thong_bao', req: false }],
    [K, 'Danh sách ký nhận tiền, chứng từ chi trả / ủy nhiệm chi'],
    [K, 'Biên bản xác nhận hoàn thành chi trả', { req: false }],
  ],
  'TT-BGMB': [
    [D, 'Chứng từ hoàn thành chi trả bồi thường'],
    [S, 'Biên bản bàn giao mặt bằng', { doc: 'bien_ban' }],
    [K, 'Biên bản bàn giao mặt bằng có đủ chữ ký các bên'],
  ],
  'TT-GIAODAT': [
    [S, 'Đơn xin giao đất / cho thuê đất', { doc: 'don' }],
    [D, 'Quyết định chấp thuận chủ trương đầu tư / giao CĐT'],
    [D, 'Quyết định thu hồi đất, biên bản bàn giao mặt bằng'],
    [D, 'Trích lục / trích đo địa chính khu đất'],
    [D, 'Văn bản xác nhận hoàn thành bồi thường, GPMB'],
    [K, 'Quyết định giao đất / cho thuê đất'],
    [K, 'Biên bản bàn giao đất trên thực địa'],
    [K, 'Hợp đồng thuê đất / chứng từ nộp tiền sử dụng đất', { req: false }],
  ],
  'TT-XNKHAUTRU': [
    [S, 'Văn bản đề nghị xác nhận kinh phí BTHT được khấu trừ', { doc: 'cong_van' }],
    [D, 'Bảng tổng hợp kinh phí bồi thường, hỗ trợ đã chi trả'],
    [D, 'Chứng từ chi trả bồi thường'],
    [K, 'Văn bản xác nhận kinh phí BTHT được khấu trừ'],
  ],
  'TT-DKMT': [
    [S, 'Văn bản đăng ký môi trường (theo mẫu)', { doc: 'cong_van' }],
    [D, 'Thông tin dự án, quy mô, công nghệ xử lý nước thải'],
    [K, 'Văn bản tiếp nhận đăng ký môi trường', { req: false }],
  ],
  'TT-GPMT': [
    [S, 'Văn bản đề nghị cấp giấy phép môi trường', { doc: 'cong_van' }],
    [D, 'Báo cáo đề xuất cấp giấy phép môi trường'],
    [K, 'Giấy phép môi trường'],
  ],
  'TT-DTM': [
    [S, 'Văn bản đề nghị thẩm định báo cáo ĐTM', { doc: 'cong_van' }],
    [D, 'Báo cáo đánh giá tác động môi trường'],
    [D, 'Báo cáo nghiên cứu khả thi / tài liệu tương đương của dự án'],
    [K, 'Quyết định phê duyệt kết quả thẩm định báo cáo ĐTM'],
  ],
  'TT-DAUNOI-DIEN': [[S, 'Văn bản đề nghị thỏa thuận đấu nối cấp điện', { doc: 'cong_van' }], [D, 'Mặt bằng vị trí, công suất phụ tải dự kiến'], [K, 'Văn bản thỏa thuận đấu nối cấp điện']],
  'TT-HLLD': [[S, 'Văn bản đề nghị thỏa thuận an toàn hành lang lưới điện', { doc: 'cong_van' }], [D, 'Bản vẽ vị trí công trình so với lưới điện'], [K, 'Văn bản thỏa thuận an toàn hành lang lưới điện']],
  'TT-CAPNUOC': [[S, 'Văn bản đề nghị thỏa thuận cấp nước', { doc: 'cong_van' }], [D, 'Mặt bằng, nhu cầu dùng nước'], [K, 'Văn bản thỏa thuận cấp nước']],
  'TT-THOATNUOC': [[S, 'Văn bản đề nghị thỏa thuận thoát nước mưa, nước thải', { doc: 'cong_van' }], [D, 'Bản vẽ điểm đấu nối thoát nước'], [K, 'Văn bản thỏa thuận thoát nước']],
  'TT-DAUNOI-GT': [[S, 'Văn bản đề nghị thỏa thuận đấu nối giao thông', { doc: 'cong_van' }], [D, 'Bản vẽ nút giao, vị trí đấu nối'], [K, 'Văn bản chấp thuận đấu nối giao thông']],
  'TT-THUYLOI': [[S, 'Đơn đề nghị cấp giấy phép hoạt động trong phạm vi bảo vệ công trình thủy lợi', { doc: 'don' }], [D, 'Bản vẽ vị trí, phạm vi hoạt động'], [D, 'Báo cáo đánh giá ảnh hưởng tới công trình thủy lợi'], [K, 'Giấy phép hoạt động trong phạm vi bảo vệ công trình thủy lợi']],
  'TT-TINHKHONG': [[S, 'Văn bản đề nghị chấp thuận độ cao công trình', { doc: 'cong_van' }], [D, 'Bản đồ vị trí, tọa độ, độ cao công trình'], [K, 'Văn bản chấp thuận độ cao công trình']],
  'TT-TDBCNCKT-A': [
    [S, 'Tờ trình thẩm định Báo cáo nghiên cứu khả thi', { doc: 'to_trinh' }],
    [D, 'Báo cáo nghiên cứu khả thi (thuyết minh, thiết kế cơ sở)'],
    [D, 'Văn bản chấp thuận chủ trương / giao CĐT; QĐ phê duyệt QHCT'],
    [D, 'Báo cáo kết quả thẩm tra BCNCKT, TMĐT'],
    [D, 'Hồ sơ khảo sát xây dựng'],
    [D, 'Văn bản thỏa thuận đấu nối hạ tầng kỹ thuật, chấp thuận độ cao'],
    [D, 'Văn bản về thủ tục môi trường'],
    [D, 'Hồ sơ năng lực tổ chức tư vấn lập BCNCKT, thẩm tra'],
    [K, 'Thông báo kết quả thẩm định BCNCKT'],
  ],
  'TT-TDBCNCKT-B': [
    [D, 'Báo cáo nghiên cứu khả thi (thuyết minh, thiết kế cơ sở)'],
    [D, 'Báo cáo kết quả thẩm tra BCNCKT, TMĐT'],
    [S, 'Tờ trình thẩm định BCNCKT (nội bộ)', { doc: 'to_trinh' }],
    [S, 'Thông báo kết quả thẩm định BCNCKT (người QĐĐT/CĐT tự thẩm định)', { doc: 'thong_bao' }],
    [K, 'Thông báo kết quả thẩm định BCNCKT đã ký'],
  ],
  'TT-PDDA': [
    [D, 'Thông báo kết quả thẩm định BCNCKT'],
    [D, 'Hồ sơ BCNCKT đã hoàn thiện theo kết quả thẩm định'],
    [S, 'Tờ trình phê duyệt dự án', { doc: 'to_trinh' }],
    [S, 'Quyết định phê duyệt dự án', { doc: 'quyet_dinh' }],
    [K, 'Quyết định phê duyệt dự án đã ký'],
  ],
  'TT-TDTK-CDT': [
    [D, 'Hồ sơ thiết kế triển khai sau thiết kế cơ sở và dự toán'],
    [D, 'Báo cáo kết quả thẩm tra thiết kế, dự toán'],
    [D, 'Hồ sơ khảo sát bổ sung', { req: false }],
    [S, 'Tờ trình thẩm định, phê duyệt thiết kế và dự toán', { doc: 'to_trinh' }],
    [S, 'Thông báo kết quả thẩm định thiết kế', { doc: 'thong_bao' }],
    [S, 'Quyết định phê duyệt thiết kế, dự toán', { doc: 'quyet_dinh' }],
    [K, 'Quyết định phê duyệt thiết kế, dự toán đã ký'],
  ],
  'TT-TDPCCC': [
    [S, 'Văn bản đề nghị thẩm định thiết kế về PCCC', { doc: 'cong_van' }],
    [D, 'Hồ sơ thiết kế PCCC (thuyết minh, bản vẽ)'],
    [D, 'Văn bản phê duyệt / kết quả thẩm định dự án liên quan'],
    [D, 'Hồ sơ năng lực đơn vị tư vấn thiết kế PCCC'],
    [K, 'Văn bản thẩm định thiết kế về PCCC'],
  ],
  'TT-GPXD': [
    [S, 'Đơn đề nghị cấp giấy phép xây dựng', { doc: 'don' }],
    [D, 'Giấy tờ chứng minh quyền sử dụng đất (QĐ giao đất / cho thuê đất)'],
    [D, 'Quyết định phê duyệt dự án; thông báo kết quả thẩm định BCNCKT'],
    [D, 'Văn bản thẩm định thiết kế về PCCC'],
    [D, 'Bản vẽ thiết kế (tổng mặt bằng, mặt bằng, mặt đứng, mặt cắt, móng, đấu nối HTKT)'],
    [D, 'Văn bản về thủ tục môi trường'],
    [D, 'Bản kê khai năng lực, kinh nghiệm tổ chức thiết kế', { req: false }],
    [K, 'Giấy phép xây dựng'],
  ],
  'TT-GPXD-DC': [
    [S, 'Đơn đề nghị điều chỉnh / gia hạn giấy phép xây dựng', { doc: 'don' }],
    [D, 'Giấy phép xây dựng đã được cấp'],
    [D, 'Bản vẽ thiết kế điều chỉnh / lý do gia hạn'],
    [K, 'Giấy phép xây dựng điều chỉnh / gia hạn'],
  ],
  'TT-TBKC': [
    [S, 'Thông báo khởi công xây dựng', { doc: 'thong_bao' }],
    [D, 'Giấy phép xây dựng (hoặc căn cứ miễn GPXD)'],
    [D, 'Hợp đồng thi công xây dựng; quyết định phê duyệt thiết kế'],
    [D, 'Hồ sơ năng lực nhà thầu thi công, giám sát'],
    [K, 'Xác nhận đã gửi thông báo khởi công (dấu đến / biên nhận)', { req: false }],
  ],
  'TT-CBTT': [[S, 'Văn bản cung cấp thông tin dự án nhà ở xã hội', { doc: 'cong_van' }], [D, 'Thông tin dự án: số căn, loại căn, giá dự kiến, thời gian nhận hồ sơ'], [K, 'Thông tin đã được đăng tải / văn bản tiếp nhận', { req: false }]],
  'TT-HTTTL': [
    [S, 'Văn bản đề nghị thông báo nhà ở hình thành trong tương lai đủ điều kiện bán', { doc: 'cong_van' }],
    [D, 'Giấy tờ về quyền sử dụng đất'],
    [D, 'Hồ sơ dự án, thiết kế được phê duyệt; giấy phép xây dựng'],
    [D, 'Biên bản nghiệm thu hoàn thành phần móng'],
    [D, 'Văn bản bảo lãnh nghĩa vụ tài chính (nếu thuộc trường hợp phải bảo lãnh)', { req: false }],
    [K, 'Văn bản của Sở Xây dựng: nhà ở đủ điều kiện được bán'],
  ],
  'TT-GUIGIA': [[S, 'Văn bản gửi quyết định giá bán NOXH kèm hồ sơ', { doc: 'cong_van' }], [D, 'Quyết định giá bán NOXH của CĐT'], [D, 'Kết quả thẩm tra giá bán'], [K, 'Thông báo tiếp nhận hồ sơ của Sở Xây dựng']],
  'TT-KTNT': [[S, 'Văn bản đề nghị kiểm tra công tác nghiệm thu', { doc: 'cong_van' }], [D, 'Báo cáo hoàn thành thi công xây dựng'], [D, 'Hồ sơ hoàn thành công trình'], [K, 'Văn bản chấp thuận kết quả nghiệm thu']],
  'TT-NTPCCC': [[D, 'Hồ sơ nghiệm thu PCCC'], [S, 'Biên bản nghiệm thu PCCC', { doc: 'bien_ban' }], [K, 'Xác nhận khai báo kết quả nghiệm thu trên CSDL PCCC', { req: false }]],
  'TT-KIEMTOAN-GIA': [[D, 'Báo cáo kiểm toán'], [S, 'Văn bản gửi Sở Xây dựng kiểm tra giá bán', { doc: 'cong_van' }], [K, 'Văn bản ý kiến của Sở Xây dựng về giá bán']],
  'TT-BCGSDT': [[S, 'Báo cáo giám sát, đánh giá đầu tư', { doc: 'bao_cao' }], [K, 'Xác nhận đã gửi trên hệ thống', { req: false }]],
  'TT-BCDT': [[S, 'Báo cáo tình hình thực hiện dự án đầu tư', { doc: 'bao_cao' }], [K, 'Xác nhận đã gửi', { req: false }]],
  'TT-BCHDDA': [[S, 'Báo cáo tình hình thực hiện hợp đồng dự án', { doc: 'bao_cao' }], [K, 'Xác nhận đã gửi', { req: false }]],
  'TT-BCTD-SXD': [[S, 'Báo cáo tiến độ thực hiện dự án gửi Sở Xây dựng', { doc: 'bao_cao' }], [K, 'Xác nhận đã gửi', { req: false }]],
  'TT-TTDABDS': [[D, 'Thông tin dự án, giao dịch cập nhật'], [K, 'Xác nhận đã cập nhật trên hệ thống', { req: false }]],
};
// danh mục hồ sơ bắt buộc QLDA (mã PC-xx) → kết quả của thủ tục
const QLDA_RESULT = {
  'PC-06': 'TT-GIAOCDT', 'PC-11': 'TT-QHCT', 'PC-12': 'TT-QHCT', 'PC-20': 'TT-TBTHUHOI', 'PC-23': 'TT-TBTHUHOI', 'PC-24': 'TT-PDPA', 'PC-25': 'TT-PDPA',
  'PC-26': 'TT-PDPA', 'PC-27': 'TT-PDPA', 'PC-28': 'TT-QDTHUHOI', 'PC-29': 'TT-BGMB', 'PC-30': 'TT-XNKHAUTRU', 'PC-31': 'TT-GIAODAT', 'PC-32': 'TT-GIAODAT',
  'PC-40': 'TT-DAUNOI-DIEN', 'PC-41': 'TT-CAPNUOC', 'PC-42': 'TT-TINHKHONG', 'PC-43': 'TT-THOATNUOC', 'PC-44': 'TT-DKMT', 'PC-45': 'TT-TDBCNCKT-A',
  'PC-46': 'TT-TDBCNCKT-A', 'PC-47': 'TT-PDDA', 'PC-50': 'TT-TDPCCC', 'PC-51': 'TT-TDTK-CDT', 'PC-52': 'TT-GPXD',
};
const kindOfForm = n => /^Tờ trình/i.test(n) ? 'to_trinh' : /^Đơn/i.test(n) ? 'don' : /^Quyết định/i.test(n) ? 'quyet_dinh' : /^Thông báo/i.test(n) ? 'thong_bao' : /^Báo cáo/i.test(n) ? 'bao_cao' : null;

async function seedTemplates(x) {
  let n = 0;
  const ins = async (key, proc, kind, name, o = {}) => {
    const r = await x(`INSERT INTO pl_tpl (procedure_code, kind, name, required, basis, source, form_code, doc_kind, tag, ord, seed_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (seed_key) DO NOTHING`,
      [proc, kind, name, o.req !== false, o.basis || null, o.source || 'quy_dinh', o.form || null, o.doc || null, o.tag || null, o.ord || 0, key]);
    n += r.rowCount;
  };
  for (const [proc, items] of Object.entries(SEED))
    for (const [i, [kind, name, o]] of items.entries()) await ins(`seed:${proc}:${i}`, proc, kind, name, { basis: R, ...o, ord: (i + 1) * 10 });
  // biểu mẫu QLDA gắn thủ tục: có mục khởi tạo cùng loại văn bản, cùng nội dung → gắn mẫu vào mục đó; không thì thêm mục mới
  const words = s => new Set(String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter(w => w.length > 1));
  const close = (a, b) => { const A = words(a), B = [...words(b)]; const hit = B.filter(w => A.has(w)).length; return hit >= Math.min(3, B.length) && hit / Math.min(A.size, B.length) >= 0.5; };
  for (const f of (await x(`SELECT * FROM pl_form WHERE usable AND cardinality(procedure_codes) > 0`)).rows) {
    const kind = kindOfForm(f.name); if (!kind) continue;
    const basis = f.legal_number ? `${f.name} kèm ${f.legal_number}` : f.name;
    for (const proc of f.procedure_codes) {
      const same = (await x(`SELECT id, name, form_code FROM pl_tpl WHERE procedure_code = $1 AND kind = 'soan' AND doc_kind = $2 AND (seed_key LIKE 'seed:%' OR seed_key IS NULL)`, [proc, kind])).rows.find(t => close(t.name, f.name));
      if (same) {
        if (!same.form_code) { await x(`UPDATE pl_tpl SET form_code = $2, basis = $3 WHERE id = $1`, [same.id, f.code, 'Theo ' + basis]); n++; }
        await x(`DELETE FROM pl_tpl WHERE seed_key = $1`, [`form:${f.code}:${proc}`]);
      } else await ins(`form:${f.code}:${proc}`, proc, 'soan', f.name, { form: f.code, doc: kind, req: false, source: 'qlda', basis: 'Theo ' + basis, ord: 5 });
    }
  }
  return n;
}
module.exports = { seedTemplates, SEED, QLDA_RESULT };
