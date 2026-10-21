// Mẫu văn bản riêng cho từng hồ sơ phải soạn của các bước pháp lý (khớp theo tên mục checklist / tên bước).
// Thể thức theo Nghị định 30/2020/NĐ-CP (Phụ lục I, III); căn cứ pháp lý cập nhật tới 10/2026, tra cứu trên thuvienphapluat.vn.
// Chỗ chưa có dữ liệu để dạng «[cần bổ sung: …]» — hệ thống không cho chốt khi còn chỗ trống.

const tvpl = so => `https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=${encodeURIComponent(so)}&match=True`;
// văn bản căn cứ dùng chung: [tên đầy đủ để ghi «Căn cứ …», số hiệu tra TVPL]
const L = {
  dd: ['Luật Đất đai số 31/2024/QH15 (đã được sửa đổi, bổ sung)', '31/2024/QH15'],
  nd88: ['Nghị định số 88/2024/NĐ-CP ngày 13/7/2024 của Chính phủ quy định về bồi thường, hỗ trợ, tái định cư khi Nhà nước thu hồi đất', '88/2024/NĐ-CP'],
  nd102: ['Nghị định số 102/2024/NĐ-CP ngày 30/7/2024 của Chính phủ quy định chi tiết thi hành một số điều của Luật Đất đai', '102/2024/NĐ-CP'],
  nd151: ['Nghị định số 151/2025/NĐ-CP ngày 12/6/2025 của Chính phủ quy định về phân định thẩm quyền của chính quyền địa phương 02 cấp, phân quyền, phân cấp trong lĩnh vực đất đai', '151/2025/NĐ-CP'],
  no: ['Luật Nhà ở số 27/2023/QH15 (đã được sửa đổi, bổ sung)', '27/2023/QH15'],
  nq201: ['Nghị quyết số 201/2025/QH15 ngày 29/5/2025 của Quốc hội thí điểm về một số cơ chế, chính sách đặc thù phát triển nhà ở xã hội', '201/2025/QH15'],
  nd192: ['Nghị định số 192/2025/NĐ-CP ngày 01/7/2025 của Chính phủ quy định chi tiết một số điều và biện pháp thi hành Nghị quyết số 201/2025/QH15', '192/2025/NĐ-CP'],
  nd261: ['Nghị định số 261/2025/NĐ-CP của Chính phủ sửa đổi, bổ sung một số điều của Nghị định số 100/2024/NĐ-CP và Nghị định số 192/2025/NĐ-CP', '261/2025/NĐ-CP'],
  pknd: ['Luật Phòng không nhân dân số 49/2024/QH15', '49/2024/QH15'],
  nd198: ['Nghị định số 198/2025/NĐ-CP ngày 08/7/2025 của Chính phủ quy định chi tiết một số điều và biện pháp thi hành Luật Phòng không nhân dân', '198/2025/NĐ-CP'],
  nd32: ['Nghị định số 32/2016/NĐ-CP của Chính phủ quy định về quản lý độ cao chướng ngại vật hàng không và các trận địa quản lý, bảo vệ vùng trời tại Việt Nam (Văn bản hợp nhất số 20/VBHN-BQP năm 2025)', '20/VBHN-BQP'],
  nd117: ['Nghị định số 117/2007/NĐ-CP của Chính phủ về sản xuất, cung cấp và tiêu thụ nước sạch (đã được sửa đổi, bổ sung)', '117/2007/NĐ-CP'],
  nd80: ['Nghị định số 80/2014/NĐ-CP của Chính phủ về thoát nước và xử lý nước thải (đã được sửa đổi, bổ sung)', '80/2014/NĐ-CP'],
  db: ['Luật Đường bộ số 35/2024/QH15', '35/2024/QH15'],
  nd165: ['Nghị định số 165/2024/NĐ-CP ngày 26/12/2024 của Chính phủ quy định chi tiết và hướng dẫn thi hành một số điều của Luật Đường bộ', '165/2024/NĐ-CP'],
  dl: ['Luật Điện lực số 61/2024/QH15', '61/2024/QH15'],
  nd30: ['Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư (thể thức, kỹ thuật trình bày)', '30/2020/NĐ-CP'],
};
const can = (...k) => k.map(x => 'Căn cứ ' + L[x][0] + ';');
const src = (...k) => [...k, 'nd30'].map(x => `${L[x][1]} · ${x === 'nd30' ? 'https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Nghi-dinh-30-2020-ND-CP-cong-tac-van-thu-436532.aspx' : tvpl(L[x][1])}`);
const B = s => `[cần bổ sung: ${s}]`;

// thông tin địa bàn từ địa điểm dự án: «Xã Tam Đa, thành phố Bắc Ninh» → xã Tam Đa, tỉnh Bắc Ninh
function place(info) {
  const loc = String(info.dia_diem || info.project?.location || '');
  const xa = /(xã|phường|thị trấn)\s+([^,(;]+)/i.exec(loc), tinh = /Bắc Ninh/i.test(loc + info.place) ? 'Bắc Ninh' : (info.place || '');
  return { xa: xa ? `${xa[1].toLowerCase()} ${xa[2].trim()}` : B('tên xã/phường'), tinh: tinh ? 'tỉnh ' + tinh : B('tỉnh'),
    ubnd: info.ubnd || (xa ? `Ủy ban nhân dân ${xa[1].toLowerCase()} ${xa[2].trim()}` : B('Ủy ban nhân dân cấp xã')), ubt: tinh ? 'Ủy ban nhân dân tỉnh ' + tinh : B('Ủy ban nhân dân cấp tỉnh') };
}

// ctx: {info, step, item, ho:{n, dt, tong}, kq(regex) → số hiệu văn bản kết quả đã có hoặc null}
const MAU = [
  { // Bước Điều tra, khảo sát — đơn của người có đất (in theo từng hộ)
    test: (i) => /đơn đề nghị bồi thường/i.test(i.name), kind: 'don',
    make: ({ info, kq }) => { const P = place(info), tb = kq(/thông báo thu hồi/i);
      return { subject: 'Đơn đề nghị bồi thường, hỗ trợ khi Nhà nước thu hồi đất', recipients: [P.ubnd, `Đơn vị, tổ chức làm nhiệm vụ bồi thường, giải phóng mặt bằng ${P.xa}`],
        bases: [], signers: [{ title: 'NGƯỜI LÀM ĐƠN', name: '' }],
        body: [`Tôi tên là: ${B('họ và tên chủ sử dụng đất')}; năm sinh: ${B('năm sinh')}`, `Số định danh cá nhân/CCCD: ${B('số CCCD')}; ngày cấp: ${B('ngày cấp')}; nơi cấp: ${B('nơi cấp')}`,
          `Nơi cư trú: ${B('địa chỉ thường trú')}; số điện thoại: ${B('số điện thoại')}`,
          `Là người đang sử dụng thửa đất số ${B('số thửa')}, tờ bản đồ số ${B('số tờ')}, diện tích ${B('diện tích')} m², loại đất ${B('loại đất')}, tại ${P.xa}, ${P.tinh}; nguồn gốc sử dụng đất: ${B('nguồn gốc, giấy tờ về quyền sử dụng đất')}.`,
          `Thửa đất nêu trên thuộc phạm vi thu hồi đất để thực hiện dự án ${info.project.name} theo Thông báo thu hồi đất ${tb || 'số ' + B('số, ngày thông báo thu hồi đất')} của ${P.ubnd}. Diện tích bị thu hồi: ${B('diện tích thu hồi')} m².`,
          'Căn cứ Luật Đất đai năm 2024, Nghị định số 88/2024/NĐ-CP và quy định của Ủy ban nhân dân ' + P.tinh + ' về bồi thường, hỗ trợ, tái định cư, tôi đề nghị được xem xét:',
          '1. Bồi thường về đất đối với diện tích đất bị thu hồi;', '2. Bồi thường tài sản, cây trồng, vật nuôi gắn liền với đất (theo biên bản kiểm đếm);',
          '3. Các khoản hỗ trợ theo quy định (hỗ trợ ổn định đời sống, ổn định sản xuất; hỗ trợ đào tạo, chuyển đổi nghề và tìm kiếm việc làm; hỗ trợ khác nếu có);',
          `4. Hình thức nhận tiền: ${B('nhận tiền mặt / chuyển khoản – số tài khoản, ngân hàng')}.`,
          'Hồ sơ kèm theo: bản sao giấy tờ về quyền sử dụng đất (nếu có); bản sao CCCD; biên bản điều tra, khảo sát; phiếu xác nhận kết quả đo đạc thửa đất.',
          'Tôi cam đoan những nội dung kê khai trên là đúng sự thật; thửa đất không có tranh chấp, không bị kê biên; nếu sai tôi xin chịu trách nhiệm trước pháp luật./.'].join('\n'),
        cites: src('dd', 'nd88', 'nd151'), to_check: ['Đơn này do từng hộ ký — in theo số hộ (có thể dùng chức năng Bảng bồi thường › xuất từng hộ để điền sẵn thông tin).', 'Đối chiếu quy định bồi thường, hỗ trợ của UBND tỉnh Bắc Ninh đang áp dụng (đơn giá, hệ số K).'] }; } },

  { // Đơn đề nghị thu hồi phần diện tích còn lại không đủ điều kiện sử dụng — khoản 7 Điều 91 Luật Đất đai 2024
    test: (i) => /khó canh tác|còn lại/i.test(i.name), kind: 'don',
    make: ({ info }) => { const P = place(info);
      return { subject: 'Đơn đề nghị thu hồi phần diện tích đất còn lại không đủ điều kiện để tiếp tục sử dụng', recipients: [P.ubnd], bases: [], signers: [{ title: 'NGƯỜI LÀM ĐƠN', name: '' }],
        body: [`Tôi tên là: ${B('họ và tên')}; số định danh cá nhân/CCCD: ${B('số CCCD')}; nơi cư trú: ${B('địa chỉ')}; số điện thoại: ${B('số điện thoại')}.`,
          `Là người sử dụng thửa đất số ${B('số thửa')}, tờ bản đồ số ${B('số tờ')}, tổng diện tích ${B('diện tích')} m², loại đất ${B('loại đất')}, tại ${P.xa}, ${P.tinh}.`,
          `Thửa đất bị thu hồi ${B('diện tích thu hồi')} m² để thực hiện dự án ${info.project.name}; phần diện tích còn lại là ${B('diện tích còn lại')} m², nhỏ hơn diện tích tối thiểu theo quy định của Ủy ban nhân dân ${P.tinh} / không đủ điều kiện để tiếp tục canh tác do ${B('lý do: bị chia cắt, không có lối vào, không có nước tưới …')}.`,
          `Căn cứ khoản 7 Điều 91 Luật Đất đai năm 2024, tôi tự nguyện đề nghị ${P.ubnd} thu hồi phần diện tích đất còn lại nêu trên và thực hiện bồi thường, hỗ trợ theo quy định.`,
          'Hồ sơ kèm theo: bản sao giấy tờ về quyền sử dụng đất; trích đo/sơ đồ thửa đất thể hiện phần diện tích còn lại.',
          'Tôi cam đoan nội dung trên là đúng sự thật và chịu trách nhiệm trước pháp luật./.'].join('\n'),
        cites: src('dd', 'nd88', 'nd151'), to_check: ['Ghi số, ngày quyết định của UBND tỉnh Bắc Ninh quy định diện tích tối thiểu được tách thửa (khoản 2 Điều 220 Luật Đất đai) khi xác định phần còn lại.'] }; } },

  { // Tờ trình của chủ đầu tư xin xác nhận kinh phí bồi thường, hỗ trợ đã thực hiện
    test: (i, s) => /xác nhận kinh phí/i.test(i.name + ' ' + s.name) && i.kind === 'soan', kind: 'to_trinh',
    make: ({ info, ho, kq }) => { const P = place(info), pa = kq(/phê duyệt phương án BTHT.*tổng thể|phê duyệt phương án bồi thường/i), dt = kq(/dự toán chi phí tổ chức thực hiện/i);
      const n = ho?.n ? `${ho.n} hộ` : B('số hộ'), sdt = ho?.dt ? `${ho.dt.toLocaleString('vi-VN')} m²` : B('diện tích thu hồi (m²)'), st = ho?.tong ? `${Math.round(ho.tong).toLocaleString('vi-VN')} đồng` : B('tổng kinh phí (đồng)');
      return { subject: `Về việc đề nghị xác nhận kinh phí bồi thường, hỗ trợ, giải phóng mặt bằng đã thực hiện của dự án ${info.project.name}`, recipients: [P.ubnd],
        bases: [...can('dd', 'nd88', 'nd102', 'nd151'), `Căn cứ Quyết định ${pa || 'số ' + B('số, ngày quyết định phê duyệt phương án bồi thường, hỗ trợ (tổng thể)')} của ${P.ubnd} về việc phê duyệt phương án bồi thường, hỗ trợ;`,
          `Căn cứ Quyết định ${dt || 'số ' + B('số, ngày quyết định phê duyệt dự toán chi phí tổ chức thực hiện bồi thường, hỗ trợ')} của ${P.ubnd};`],
        body: [`${info.cdt || B('tên chủ đầu tư')} là chủ đầu tư dự án ${info.project.name} tại ${P.xa}, ${P.tinh}. Thực hiện phương án bồi thường, hỗ trợ đã được phê duyệt, chủ đầu tư đã phối hợp với ${P.ubnd} và đơn vị làm nhiệm vụ bồi thường, giải phóng mặt bằng tổ chức chi trả cho các hộ có đất thu hồi.`,
          'I. KẾT QUẢ THỰC HIỆN', `1. Số hộ đã chi trả: ${n}; diện tích đất đã thu hồi, bàn giao: ${sdt}.`,
          `2. Tổng kinh phí bồi thường, hỗ trợ theo phương án được duyệt: ${st}.`, `3. Kinh phí chủ đầu tư đã chuyển trả (theo chứng từ chi): ${B('số tiền đã chi trả, số chứng từ')}.`,
          `4. Chi phí tổ chức thực hiện bồi thường, hỗ trợ: ${B('số tiền')}.`, `5. Số hộ chưa nhận tiền / kinh phí gửi Kho bạc (nếu có): ${B('số hộ, số tiền')}.`,
          'II. ĐỀ NGHỊ', `Để có cơ sở thực hiện thủ tục giao đất, xác định chi phí đầu tư và quyết toán dự án, ${info.cdt || 'chủ đầu tư'} kính trình ${P.ubnd} xem xét, xác nhận tổng kinh phí bồi thường, hỗ trợ, giải phóng mặt bằng mà chủ đầu tư đã thực hiện nêu trên.`,
          'Hồ sơ kèm theo: bảng tổng hợp chi trả tiền bồi thường, hỗ trợ có chữ ký nhận của từng hộ; phiếu chi/ủy nhiệm chi; các quyết định phê duyệt phương án.',
          `Kính trình ${P.ubnd} xem xét, xác nhận./.`].join('\n'),
        receivers: ['Như trên;', `Đơn vị làm nhiệm vụ bồi thường, GPMB ${P.xa};`, `Lưu: VT, ${info.don_vi_soan || 'BQLDA'}.`],
        cites: src('dd', 'nd88', 'nd102', 'nd151'), to_check: ['Đối chiếu số liệu với bảng tổng hợp chi trả và chứng từ thực tế trước khi trình.'] }; } },

  { // Văn bản đề nghị chấp thuận chủ trương đầu tư đồng thời giao chủ đầu tư dự án NOXH — NQ 201/2025, NĐ 192/2025 (sửa đổi bởi NĐ 261/2025)
    test: (i) => /giao chủ đầu tư/i.test(i.name), kind: 'cong_van',
    make: ({ info, step }) => { const P = place(info), att = step.items?.filter(x => x.kind === 'dau_vao' && !x.na).map(x => x.name) || [];
      return { subject: `Đề nghị chấp thuận chủ trương đầu tư đồng thời giao chủ đầu tư dự án ${info.project.name}`, recipients: [P.ubt, `Sở Xây dựng ${P.tinh}`],
        bases: [],
        body: [`Căn cứ ${L.no[0]}; ${L.nq201[0]}; ${L.nd192[0]}; ${L.nd261[0]};`,
          `${info.cdt || B('tên nhà đầu tư')} kính đề nghị ${P.ubt} xem xét chấp thuận chủ trương đầu tư đồng thời giao nhà đầu tư làm chủ đầu tư dự án đầu tư xây dựng nhà ở xã hội với các nội dung sau:`,
          'I. THÔNG TIN NHÀ ĐẦU TƯ', `1. Tên nhà đầu tư: ${info.cdt || B('tên nhà đầu tư')}${info.project.investor ? ` (${info.project.investor})` : ''}.`,
          `2. Mã số doanh nghiệp: ${B('mã số doanh nghiệp, ngày cấp, nơi cấp')}.`, `3. Địa chỉ trụ sở: ${info.dia_chi || B('địa chỉ trụ sở')}; điện thoại: ${B('số điện thoại')}.`,
          `4. Người đại diện theo pháp luật: ${info.nguoi_ky || B('họ tên')}; chức vụ: ${info.chuc_vu_ky ? info.chuc_vu_ky.toLowerCase() : B('chức vụ')}.`,
          'II. THÔNG TIN DỰ ÁN', `1. Tên dự án: ${info.project.name}.`, `2. Địa điểm: ${P.xa}, ${P.tinh}.`, `3. Diện tích đất dự kiến sử dụng: ${B('diện tích (ha)')}.`,
          `4. Quy mô: ${B('số căn nhà ở xã hội, tổng diện tích sàn, tầng cao, dân số')}.`, `5. Sơ bộ tổng mức đầu tư: ${B('số tiền (đồng)')}; nguồn vốn: vốn chủ sở hữu và vốn huy động hợp pháp, không sử dụng vốn đầu tư công.`,
          `6. Tiến độ thực hiện dự kiến: ${B('tiến độ')}.`, `7. Hình thức đầu tư: dự án đầu tư xây dựng nhà ở xã hội để bán, cho thuê mua, cho thuê.`,
          'III. CAM KẾT', 'Nhà đầu tư cam kết đáp ứng các điều kiện được giao làm chủ đầu tư theo quy định; chịu trách nhiệm về tính chính xác, hợp pháp của hồ sơ; bố trí đủ vốn và triển khai dự án đúng tiến độ; bán, cho thuê mua, cho thuê nhà ở xã hội đúng đối tượng, điều kiện theo quy định của pháp luật về nhà ở.',
          'IV. HỒ SƠ KÈM THEO', ...(att.length ? att : ['Đề xuất dự án; sơ bộ tổng mức đầu tư; báo cáo tài chính được kiểm toán; cam kết cung cấp tín dụng; tài liệu chứng minh điều kiện giao chủ đầu tư.']).map((x, k) => `${k + 1}. ${x}.`),
          `${info.cdt || 'Nhà đầu tư'} kính đề nghị ${P.ubt} xem xét, chấp thuận./.`].join('\n'),
        receivers: ['Như trên;', `Lưu: VT, ${info.don_vi_soan || 'BQLDA'}.`],
        cites: src('no', 'nq201', 'nd192', 'nd261'), to_check: ['Kiểm tra thủ tục tại Sở Xây dựng Bắc Ninh (nơi tiếp nhận, mẫu riêng của tỉnh nếu có) và trình tự đồng thời chấp thuận chủ trương – giao chủ đầu tư theo Điều 6 NĐ 192/2025 đã sửa đổi.'] }; } },

  { // Văn bản đề nghị chấp thuận độ cao công trình — Mẫu số 01-ĐNCTĐC Phụ lục II NĐ 198/2025 (áp dụng từ 22/8/2025)
    test: (i) => /tĩnh không|độ cao/i.test(i.name), kind: 'cong_van',
    make: ({ info }) => { const P = place(info);
      return { subject: 'Đề nghị chấp thuận độ cao công trình', recipients: ['Bộ Quốc phòng (qua Hệ thống thông tin giải quyết thủ tục hành chính Bộ Quốc phòng)'], bases: [],
        body: [`Căn cứ ${L.pknd[0]}; ${L.nd198[0]};`, `${info.cdt || B('tên tổ chức')} đề nghị chấp thuận độ cao công trình với các nội dung sau:`,
          `1. Tên tổ chức đề nghị: ${info.cdt || B('tên tổ chức')}; địa chỉ: ${info.dia_chi || B('địa chỉ')}; điện thoại: ${B('số điện thoại')}; email: ${B('email')}.`,
          `2. Tên công trình/dự án: ${info.project.name}.`, `3. Tính chất, quy mô công trình: ${B('khu nhà ở xã hội; số tòa, số tầng, chiều cao từng tòa')}.`,
          `4. Vị trí xây dựng: ${P.xa}, ${P.tinh}.`, `- Tọa độ theo hệ WGS-84 (độ, phút, giây): ${B('kinh độ, vĩ độ các điểm góc/tâm công trình')};`,
          `- Tọa độ theo hệ VN-2000 (nếu công trình nằm ngoài khu vực lân cận sân bay): ${B('X, Y')}.`,
          `5. Độ cao đề nghị chấp thuận: cao độ cốt nền tự nhiên ${B('m')} (so với mực nước biển trung bình); chiều cao công trình ${B('m')}, kể cả kết cấu, thiết bị trên mái; độ cao tối đa so với mực nước biển ${B('m')}.`,
          `6. Thời gian dự kiến xây dựng: từ ${B('tháng/năm')} đến ${B('tháng/năm')}.`,
          'Hồ sơ kèm theo: bản sao bản đồ hoặc sơ đồ không gian, vị trí khu vực xây dựng có đánh dấu vị trí công trình; bản sao giấy tờ chứng minh quyền quản lý, sử dụng đất/công trình.',
          `${info.cdt || 'Chúng tôi'} cam kết thực hiện đúng độ cao được chấp thuận và các quy định về quản lý độ cao chướng ngại vật./.`].join('\n'),
        receivers: ['Như trên;', `Sở Xây dựng ${P.tinh} (để biết);`, `Lưu: VT, ${info.don_vi_soan || 'BQLDA'}.`],
        cites: src('pknd', 'nd198', 'nd32'), to_check: ['Từ 22/8/2025 thủ tục theo Điều 14 NĐ 198/2025 (Mẫu 01-ĐNCTĐC, Phụ lục II). Nếu công trình nằm trong khu vực lân cận sân bay thì đối chiếu thêm NĐ 32/2016 (VBHN 20/VBHN-BQP).'] }; } },

  { // Văn bản đề nghị thỏa thuận đấu nối hạ tầng kỹ thuật — nội dung theo từng loại đấu nối của bước
    test: (i) => /đấu nối/i.test(i.name) && i.kind === 'soan', kind: 'cong_van',
    make: ({ info, step }) => { const P = place(info), n = step.name;
      const T = /cấp nước/i.test(n) ? { loai: 'cấp nước', to: `Đơn vị cấp nước trên địa bàn ${P.tinh} ${B('tên công ty cấp nước')}`, nhu: `Nhu cầu dùng nước: ${B('lưu lượng (m³/ngày đêm), áp lực yêu cầu')}`, lk: ['nd117'] }
        : /thoát nước/i.test(n) ? { loai: 'thoát nước thải', to: `${B('đơn vị quản lý, vận hành hệ thống thoát nước')}`, nhu: `Lưu lượng nước thải: ${B('m³/ngày đêm')}; nước thải sau xử lý đạt ${B('QCVN, cột')}`, lk: ['nd80'] }
        : /giao thông/i.test(n) ? { loai: 'giao thông', to: `${P.ubnd} / Sở Xây dựng ${P.tinh} ${B('cơ quan quản lý tuyến đường')}`, nhu: `Tuyến đường đấu nối: ${B('tên tuyến, lý trình')}; quy mô nút giao: ${B('mô tả')}`, lk: ['db', 'nd165'] }
        : /điện/i.test(n) ? { loai: 'cấp điện', to: `Công ty Điện lực Bắc Ninh ${B('xác nhận đơn vị')}`, nhu: `Công suất đăng ký: ${B('kVA/kW')}; cấp điện áp đấu nối: ${B('kV')}`, lk: ['dl'] }
        : { loai: 'hạ tầng kỹ thuật', to: B('đơn vị quản lý hạ tầng'), nhu: `Nhu cầu: ${B('thông số')}`, lk: [] };
      return { subject: `Đề nghị thỏa thuận đấu nối ${T.loai} cho dự án ${info.project.name}`, recipients: [T.to], bases: [],
        body: [T.lk.length ? `Căn cứ ${T.lk.map(k => L[k][0]).join('; ')};` : '', `${info.cdt || B('tên chủ đầu tư')} là chủ đầu tư dự án ${info.project.name} tại ${P.xa}, ${P.tinh}, đã được phê duyệt quy hoạch chi tiết tỷ lệ 1/500.`,
          `Để bảo đảm hạ tầng ${T.loai} của dự án được kết nối đồng bộ với hệ thống hạ tầng khu vực, ${info.cdt || 'chủ đầu tư'} kính đề nghị ${T.to} xem xét, thỏa thuận đấu nối với các thông số sau:`,
          `1. Quy mô dự án: ${B('diện tích, số căn, dân số')}.`, `2. ${T.nhu}.`, `3. Vị trí điểm đấu nối dự kiến: ${B('vị trí, tọa độ điểm đấu nối')} (thể hiện tại bản vẽ kèm theo).`,
          `4. Thời gian dự kiến đấu nối, đưa vào sử dụng: ${B('thời gian')}.`, 'Hồ sơ kèm theo: thuyết minh đấu nối; bản vẽ vị trí, phương án đấu nối.',
          `${info.cdt || 'Chủ đầu tư'} cam kết thực hiện đầu tư, đấu nối theo đúng thỏa thuận và quy định hiện hành. Kính đề nghị quý cơ quan, đơn vị xem xét, giải quyết./.`].filter(Boolean).join('\n'),
        receivers: ['Như trên;', `Lưu: VT, ${info.don_vi_soan || 'BQLDA'}.`],
        cites: src(...T.lk), to_check: ['Không có mẫu bắt buộc cấp quốc gia — trình bày theo Mẫu 1.5 (công văn) Phụ lục III NĐ 30/2020; kiểm tra yêu cầu hồ sơ riêng của đơn vị tiếp nhận.'] }; } },
];

const find = (item, step) => item ? MAU.find(m => m.test(item, step)) : null;
module.exports = { find, MAU, tvpl };
