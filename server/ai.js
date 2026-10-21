// AI (Claude) của Module Pháp lý dự án. Mọi kết quả là gợi ý / bản nháp để người dùng kiểm tra — AI không tự thay đổi hồ sơ.
// Tệp đưa cho AI: PDF (document), ảnh scan (image), .docx / .xlsx / .txt (trích chữ).
const Anthropic = require('@anthropic-ai/sdk').default;
const path = require('path');
const { docxText, readXlsx } = require('./xlsx');

const MODEL = 'claude-opus-5-5';
let client = null;
const enabled = () => !!process.env.ANTHROPIC_API_KEY;
const getClient = () => (client ||= new Anthropic());
const setClient = c => { client = c; };   // dùng cho kiểm thử; null = tạo lại khi đổi khóa API

const ROLE = `Bạn là chuyên viên pháp lý dự án của Công ty Cát Tường — chủ đầu tư dự án nhà ở xã hội tại Việt Nam.
Chỉ dựa trên DỮ LIỆU và TỆP được cung cấp; không bịa số hiệu, ngày tháng, số liệu, điều khoản. Thông tin không có thì nói rõ là không có.
Viết tiếng Việt, ngắn gọn, đúng thuật ngữ pháp lý và quản lý dự án đầu tư xây dựng.`;

const str = { type: 'string' };
const strs = d => ({ type: 'array', items: { ...str, description: d } });
const obj = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });

const FACTS = obj({
  loai_van_ban: { ...str, description: 'vd Quyết định, Tờ trình, Giấy phép, Biên bản, Bản vẽ, Báo cáo, Đơn' },
  so_hieu: { ...str, description: 'số, ký hiệu; rỗng nếu không có' },
  ngay_ban_hanh: { ...str, description: 'YYYY-MM-DD; rỗng nếu không đọc được' },
  co_quan_ban_hanh: str,
  nguoi_ky: { ...str, description: 'chức vụ và họ tên người ký; rỗng nếu chưa ký' },
  trich_yeu: str,
  tom_tat: { ...str, description: 'tóm tắt nội dung chính 2–5 câu' },
  thong_tin: { type: 'array', description: 'các thông số then chốt để đối chiếu với hồ sơ khác: tên dự án, chủ đầu tư, địa điểm, diện tích, quy mô, số tầng, số căn, tổng mức đầu tư, số tiền, số hộ, thửa đất, thời hạn, số văn bản được viện dẫn…',
    items: obj({ ten: str, gia_tri: str }) },
  can_cu: strs('văn bản được viện dẫn làm căn cứ (số hiệu + trích yếu ngắn)'),
  chat_luong: { ...str, description: 'nhận xét bản scan: rõ/mờ, thiếu trang, thiếu chữ ký, thiếu dấu… ; rỗng nếu ổn' },
});
const WARN = { type: 'array', items: obj({
  muc_do: { type: 'string', enum: ['cao', 'trung_binh', 'thap'] },
  loai: { type: 'string', enum: ['thieu_ho_so', 'sai_sot', 'mau_thuan', 'sai_lech_buoc_truoc', 'het_hieu_luc', 'the_thuc', 'khac'] },
  noi_dung: { ...str, description: 'mô tả cụ thể: giá trị nào ở hồ sơ nào khác giá trị nào ở hồ sơ nào' },
  ho_so: strs('tên hồ sơ / tệp liên quan, đúng như trong dữ liệu'),
  de_xuat: { ...str, description: 'người dùng cần sửa gì' },
}) };
const CHECK = obj({
  tom_tat: { ...str, description: 'kết luận ngắn 2–4 câu' },
  ket_luan: { type: 'string', enum: ['dat', 'can_sua', 'khong_du_du_lieu'] },
  canh_bao: WARN,
  da_doi_chieu: strs('các nội dung đã đối chiếu và khớp (để người dùng biết AI đã kiểm những gì)'),
});
const SUGGEST = obj({
  ghi_chu: { ...str, description: 'tóm tắt văn bản luật được cung cấp và ảnh hưởng tới thủ tục này' },
  bo_sung: { type: 'array', description: 'mục hồ sơ cần BỔ SUNG vào checklist (không lặp mục đã có)', items: obj({
    ten: str, kind: { type: 'string', enum: ['dau_vao', 'soan', 'ket_qua'] }, bat_buoc: { type: 'boolean' },
    can_cu: { ...str, description: 'điều, khoản, văn bản' }, doc_kind: { type: 'string', enum: ['', 'cong_van', 'to_trinh', 'don', 'quyet_dinh', 'thong_bao', 'bao_cao', 'ke_hoach', 'bien_ban'] } }) },
  sua_doi: { type: 'array', description: 'mục ĐÃ CÓ cần sửa tên / căn cứ hoặc không còn áp dụng', items: obj({ ten_hien_tai: str, de_xuat: str, can_cu: str }) },
});
const DRAFT = obj({
  trich_yeu: { ...str, description: 'trích yếu, không có chữ "V/v" / "Về việc" ở đầu' },
  kinh_gui: strs('từng nơi ở phần «Kính gửi»'),
  tham_quyen: { ...str, description: 'chỉ với QUYẾT ĐỊNH: dòng thẩm quyền ban hành, vd «CHỦ TỊCH ỦY BAN NHÂN DÂN XÃ …»; rỗng nếu không phải quyết định' },
  can_cu: strs('từng dòng căn cứ (với quyết định, tờ trình), mỗi dòng kết thúc bằng «;», dòng cuối «.»'),
  noi_dung: { ...str, description: 'toàn bộ nội dung văn bản; mỗi đoạn / mục một dòng (\\n); quyết định viết «Điều 1. …»' },
  noi_nhan: strs('từng dòng «Nơi nhận»'),
  chuc_vu_ky: { ...str, description: 'chức vụ người ký, có thể kèm quyền hạn ký, xuống dòng bằng \\n' },
  nguon: strs('hồ sơ / văn bản đã lấy thông tin (tên đúng như trong dữ liệu)'),
  can_kiem_tra: strs('điểm người soạn phải kiểm tra / điền trước khi trình ký'),
});

async function call(system, schema, content, effort = 'medium') {
  if (!enabled()) { const e = new Error('Chưa cấu hình ANTHROPIC_API_KEY trong file .env của module — AI đang tắt.'); e.status = 400; throw e; }
  const msg = await getClient().beta.messages.stream({
    model: MODEL, max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }],
  }).finalMessage();
  if (msg.stop_reason === 'refusal') { const e = new Error('AI từ chối xử lý yêu cầu này.'); e.status = 422; throw e; }
  if (msg.stop_reason === 'max_tokens') { const e = new Error('Kết quả quá dài, bị cắt. Hãy giảm số tệp đưa vào.'); e.status = 422; throw e; }
  return JSON.parse(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
}

// ---------- tệp → khối nội dung ----------
const IMG = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
const MAX_BYTES = 24e6;   // giới hạn tổng dung lượng tệp gửi một lần (yêu cầu tối đa 32 MB sau base64)
function fileBlocks(f, buf) {
  const ext = path.extname(f.name || '').toLowerCase(), label = { type: 'text', text: `--- TỆP: «${f.label || f.name}» ---` };
  if (ext === '.pdf' || f.mime === 'application/pdf') return [label, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }];
  if (IMG[ext]) return [label, { type: 'image', source: { type: 'base64', media_type: IMG[ext], data: buf.toString('base64') } }];
  let t = null;
  try {
    if (ext === '.docx') t = docxText(buf);
    else if (ext === '.xlsx') t = readXlsx(buf).map(s => `[Trang tính ${s.name}]\n` + s.rows.filter(r => r.some(c => c !== '')).map(r => r.join(' | ')).join('\n')).join('\n\n');
    else if (['.txt', '.csv', '.md', '.html', '.htm'].includes(ext)) t = buf.toString('utf8');
  } catch { t = null; }
  if (t == null) return [{ type: 'text', text: `--- TỆP: «${f.label || f.name}» — định dạng ${ext || '?'} không đọc được nội dung ---` }];
  return [{ type: 'text', text: `--- TỆP: «${f.label || f.name}» ---\n${t.slice(0, 200000)}` }];
}
// files: [{name,label,mime,buffer}] — tệp quá giới hạn dung lượng chỉ đưa tên (dựa vào phần tóm tắt đã trích)
function packFiles(files) {
  let used = 0; const blocks = [], sent = [], skipped = [];
  for (const f of files) {
    const n = f.buffer.length * 1.37;
    if (used + n > MAX_BYTES) { skipped.push(f.label || f.name); continue; }
    used += n; blocks.push(...fileBlocks(f, f.buffer)); sent.push(f.label || f.name);
  }
  return { blocks, sent, skipped };
}

const extract = (f, buf, hint) => call(`${ROLE}\nNhiệm vụ: đọc MỘT tệp hồ sơ và trích thông tin để sau này đối chiếu với các hồ sơ khác.`, FACTS,
  [...fileBlocks(f, buf), { type: 'text', text: `Tệp này được tải lên cho mục checklist: «${hint}». Hãy trích thông tin.` }], 'low');

const SYS_CHECK = `${ROLE}
Nhiệm vụ: KIỂM TRA HỒ SƠ của một bước thủ tục pháp lý. Tìm: hồ sơ thiếu so với checklist; sai sót trong từng hồ sơ (sai tên dự án, chủ đầu tư, địa điểm, số liệu, ngày tháng, thiếu chữ ký / dấu, sai thể thức);
MÂU THUẪN giữa các hồ sơ (cùng một thông số nhưng giá trị khác nhau: diện tích, quy mô, tổng mức đầu tư, số văn bản viện dẫn, tên cơ quan…); căn cứ pháp lý hết hiệu lực.
Mỗi cảnh báo phải chỉ rõ hồ sơ nào, giá trị nào. Không cảnh báo chung chung. Không có vấn đề thì canh_bao rỗng và ket_luan = dat.`;
const SYS_RESULT = `${ROLE}
Nhiệm vụ: người dùng vừa tải lên BẢN SCAN KẾT QUẢ của một bước (văn bản cơ quan nhà nước trả, hoặc kết quả công việc). Đối chiếu kết quả này với hồ sơ đã nộp của bước và hồ sơ các bước trước:
tên dự án, chủ đầu tư, địa điểm, diện tích, quy mô, số liệu, số và ngày các văn bản được viện dẫn, nội dung chấp thuận có khớp với nội dung đề nghị không, điều kiện / yêu cầu kèm theo, thời hạn hiệu lực.
Mọi sai lệch đưa vào canh_bao (loai = sai_lech_buoc_truoc khi lệch với bước trước). Nêu rõ người dùng cần sửa hồ sơ nào hoặc đề nghị cơ quan đính chính gì.`;
const SYS_DRAFT_CHECK = `${ROLE}
Nhiệm vụ: KIỂM TRA DỰ THẢO văn bản sau khi người dùng chỉnh sửa. Đối chiếu nội dung dự thảo với hồ sơ liên quan (các bước trước, hồ sơ trong bước): số liệu, tên, số và ngày văn bản viện dẫn, căn cứ pháp lý (hết hiệu lực / không có trong thư viện),
thể thức theo Nghị định 30/2020/NĐ-CP (tên loại, trích yếu, kính gửi, nơi nhận, chức vụ người ký), chỗ còn để trống «[…]», lỗi chính tả, câu chữ mâu thuẫn.`;
const SYS_SUGGEST = `${ROLE}
Nhiệm vụ: người dùng cung cấp văn bản luật / quy định mới hoặc yêu cầu riêng của cơ quan tiếp nhận. Đọc và đề xuất BỔ SUNG / SỬA checklist hồ sơ của thủ tục cho đúng quy định đó.
Chỉ đề xuất những gì văn bản được cung cấp thực sự yêu cầu; ghi căn cứ (điều, khoản). Không lặp lại mục đã có.`;
const SYS_DRAFT = `${ROLE}
Nhiệm vụ: SOẠN DỰ THẢO văn bản cho bước thủ tục đang xử lý, đúng mẫu quy định (nếu có biểu mẫu thì theo đúng bố cục, đề mục của biểu mẫu) và thể thức văn bản hành chính theo Nghị định 30/2020/NĐ-CP.
Lấy thông tin từ hồ sơ, văn bản của các bước trước và của bước này (số, ngày quyết định đã có, diện tích, quy mô, tổng mức đầu tư…). Căn cứ pháp lý chỉ dùng văn bản còn hiệu lực trong thư viện.
Thông tin chưa có thì để «[cần bổ sung: …]» — tuyệt đối không bịa. Văn phong hành chính, trang trọng.`;

const check = (ctx, files) => { const p = packFiles(files); return call(SYS_CHECK, CHECK, [{ type: 'text', text: `<du_lieu>\n${ctx}\n</du_lieu>${p.skipped.length ? `\nTệp quá dung lượng, chỉ có phần tóm tắt trong dữ liệu: ${p.skipped.join('; ')}` : ''}` }, ...p.blocks, { type: 'text', text: 'Hãy kiểm tra hồ sơ của bước này.' }], 'high').then(r => ({ ...r, _sent: p.sent, _skipped: p.skipped })); };
const checkResult = (ctx, resultFile, buf, files) => { const p = packFiles(files); return call(SYS_RESULT, CHECK, [{ type: 'text', text: `<du_lieu>\n${ctx}\n</du_lieu>` }, ...p.blocks, { type: 'text', text: '=== KẾT QUẢ CẦN ĐỐI CHIẾU ===' }, ...fileBlocks(resultFile, buf), { type: 'text', text: 'Hãy đối chiếu kết quả trên với hồ sơ.' }], 'high').then(r => ({ ...r, _sent: [resultFile.name, ...p.sent], _skipped: p.skipped })); };
const checkDraft = (ctx, draftText, files) => { const p = packFiles(files); return call(SYS_DRAFT_CHECK, CHECK, [{ type: 'text', text: `<du_lieu>\n${ctx}\n</du_lieu>` }, ...p.blocks, { type: 'text', text: `=== DỰ THẢO ===\n${draftText}\n\nHãy kiểm tra dự thảo.` }], 'high').then(r => ({ ...r, _sent: p.sent, _skipped: p.skipped })); };
const suggest = (ctx, text, file, buf) => call(SYS_SUGGEST, SUGGEST, [{ type: 'text', text: `<checklist_hien_tai>\n${ctx}\n</checklist_hien_tai>` }, ...(file ? fileBlocks(file, buf) : []), ...(text ? [{ type: 'text', text: `<van_ban_moi>\n${text}\n</van_ban_moi>` }] : []), { type: 'text', text: 'Hãy đề xuất bổ sung / sửa checklist.' }], 'high');
const draft = (ctx, spec, files) => { const p = packFiles(files); return call(SYS_DRAFT, DRAFT, [{ type: 'text', text: `<du_lieu>\n${ctx}\n</du_lieu>` }, ...p.blocks, { type: 'text', text: `<yeu_cau_soan>\n${spec}\n</yeu_cau_soan>` }], 'high'); };

// ---------- Trợ lý AI (hội thoại tự do, trả lời dạng stream) ----------
const SYS_CHAT = `${ROLE}
Bạn là TRỢ LÝ AI của phần mềm Pháp lý dự án. Người dùng là lãnh đạo, Ban QLDA, Pháp chế của chủ đầu tư.
Trả lời dựa trên DỮ LIỆU DỰ ÁN trong phần mềm (bên dưới), tệp người dùng đính kèm và TRA CỨU INTERNET.
Bạn có công cụ tìm kiếm web (web_search) và đọc trang web (web_fetch). Dùng chúng khi câu hỏi cần thông tin không có trong dữ liệu dự án: văn bản pháp luật, hiệu lực văn bản, mẫu biểu / phụ lục, thủ tục hành chính, quy định địa phương (tỉnh Bắc Ninh), tin tức chính sách. Đừng từ chối vì «không có trong dữ liệu» — hãy tra cứu.
Ưu tiên nguồn chính thống: vbpl.vn, congbao.chinhphu.vn, chinhphu.vn, dichvucong.gov.vn, cổng thông tin các bộ / UBND tỉnh, thuvienphapluat.vn, luatvietnam.vn. Với mẫu biểu: tìm đúng văn bản gốc, nêu số hiệu văn bản và số mẫu / phụ lục, đọc trang để chép đúng nội dung mẫu.
Thông tin lấy từ Internet phải ghi nguồn; kiểm tra hiệu lực (đã bị thay thế, sửa đổi chưa). Số hiệu, điều khoản chỉ nêu khi đã thấy trong dữ liệu hoặc trang tra cứu.
Khi nêu bước, hồ sơ, ngày tháng thì dùng đúng tên và số liệu trong dữ liệu. Ngày viết dd/mm/yyyy.
Trình bày bằng Markdown: tiêu đề ngắn (##), gạch đầu dòng, bảng khi so sánh hoặc liệt kê nhiều cột. Không mở đầu bằng lời chào hay nhắc lại câu hỏi.
Khi người dùng yêu cầu soạn văn bản: soạn hoàn chỉnh theo thể thức Nghị định 30/2020/NĐ-CP (quốc hiệu, tên cơ quan, số ký hiệu, địa danh ngày tháng, trích yếu, kính gửi, nội dung, nơi nhận, chức vụ người ký); thông tin chưa có ghi «[cần bổ sung: …]», không bịa.
Bạn LÀM ĐƯỢC TÁC VỤ, không chỉ trả lời:
- Thao tác dữ liệu phần mềm bằng công cụ của app: tìm công việc / hồ sơ (lấy id), đánh dấu hồ sơ đã có, cập nhật trạng thái và ngày thực tế của công việc, ghi vướng mắc, thêm hồ sơ vào checklist, lập hồ sơ bổ sung, đề xuất gia hạn, soạn dự thảo văn bản vào màn Dự thảo. Luôn gọi tim_cong_viec để lấy id trước khi thao tác; không đoán id.
- Chạy mã Python (code_execution) để tính toán, phân tích số liệu, vẽ biểu đồ và TẠO TỆP (Excel .xlsx bằng openpyxl, Word .docx bằng python-docx, PDF, ảnh). Lưu tệp kết quả vào thư mục làm việc hiện tại; tệp sẽ tự hiện cho người dùng tải về. Tên tệp tiếng Việt có dấu, rõ nội dung.
- Người dùng nhờ việc gì làm được bằng công cụ thì làm luôn rồi báo kết quả; thao tác ghi dữ liệu sẽ được hỏi người dùng xác nhận trước khi chạy (phần mềm tự hỏi) — bạn cứ gọi công cụ, không cần hỏi lại bằng lời.
- Chỉ thao tác đúng phạm vi người dùng yêu cầu. Thao tác lỗi (thiếu quyền, sai dữ liệu) thì báo rõ lý do.
Cuối câu trả lời có việc cần làm thì thêm mục «Việc nên làm tiếp» ngắn gọn.`;
// Mô hình cho Trợ lý AI (người dùng chọn; không dùng Opus / Fable). Haiku 5.5 không có chuyển dự phòng phía máy chủ khi bị từ chối.
// Gemini Flash (Google, gói miễn phí): trả lời nhanh, tra cứu — thử kèm Google Search, gói miễn phí không có thì trả lời không kèm.
const CHAT_MODELS = [
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'làm tác vụ, tạo tệp, tra cứu Internet', provider: 'anthropic', fallback: true },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'nhanh, rẻ — việc đơn giản', provider: 'anthropic', fallback: false },
  { id: 'gemini-3.5-flash', name: 'Gemini Flash', note: 'hỏi đáp nhanh, miễn phí — không làm tác vụ', provider: 'gemini' },
];
const CLAUDE_DEFAULT = 'claude-sonnet-5-5';
const geminiOn = () => !!process.env.GEMINI_API_KEY;
const modelOn = m => (m.provider === 'gemini' ? geminiOn() : enabled());
// mặc định: Sonnet nếu đã có khóa Anthropic, không thì Gemini
const chatDefault = () => (CHAT_MODELS.find(m => m.id === CLAUDE_DEFAULT && modelOn(m)) || CHAT_MODELS.find(modelOn) || CHAT_MODELS[0]).id;
const canChat = id => { const m = CHAT_MODELS.find(x => x.id === id); return !!m && modelOn(m); };
const chatSystem = ctx => `${SYS_CHAT}\n\n<du_lieu_du_an>\n${ctx}\n</du_lieu_du_an>`;
// history: [{role, content:[blocks]}]; cb: { onText(delta), onStatus(text), app: { tools, run(name, input), isWrite(name), describe(name, input) }, act: 'hoi' | 'tu' }
// Claude làm việc như một trợ lý đầy đủ: tra cứu Internet, chạy mã (tạo Excel / Word / biểu đồ), và thao tác dữ liệu phần mềm qua công cụ của app.
// Thao tác ghi dữ liệu: chế độ «hỏi trước» thì dừng lại chờ người dùng đồng ý (trả về state để chạy tiếp).
async function chat(ctx, history, effort, onText, model = chatDefault(), onStatus = () => {}, opt = {}) {
  const m = CHAT_MODELS.find(x => x.id === model) || CHAT_MODELS[0];
  if (m.provider === 'gemini') return geminiChat(m, ctx, history, onText);
  if (!enabled()) { const e = new Error('Chưa kết nối Claude (chưa có ANTHROPIC_API_KEY) — chọn Gemini Flash hoặc kết nối Trợ lý AI.'); e.status = 400; throw e; }
  return agentRun({ model: m.id, effort, ctx, messages: history, text: '', cites: [], files: [], container: null, rounds: 0, done: [] }, { onText, onStatus, ...opt });
}
// công cụ máy chủ Anthropic: tìm web, đọc trang, chạy mã Python (tạo tệp). Bản web «lọc động» đã có môi trường chạy mã riêng
// nên không khai báo chung với code_execution — dùng bản web cơ bản để có cả hai.
const SERVER_TOOLS = [
  { type: 'web_search_20250305', name: 'web_search', max_uses: 8 },
  { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 6 },
  { type: 'code_execution_20260521', name: 'code_execution' },
];
async function agentRun(st, cb) {
  const m = CHAT_MODELS.find(x => x.id === st.model) || CHAT_MODELS[0];
  const appTools = cb.app?.tools || [];
  const say = t => { st.text += t; cb.onText(t); };
  let msg;
  for (; st.rounds < 24; st.rounds++) {
    const stream = getClient().beta.messages.stream({
      model: m.id, max_tokens: 32000,
      ...(m.fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      ...(st.container ? { container: st.container } : {}),
      thinking: { type: 'adaptive' },
      output_config: { effort: st.effort },
      system: [{ type: 'text', text: SYS_CHAT }, { type: 'text', text: `<du_lieu_du_an>\n${st.ctx}\n</du_lieu_du_an>`, cache_control: { type: 'ephemeral' } }],
      tools: [...SERVER_TOOLS, ...appTools],
      messages: st.messages,
    });
    let first = true;   // chữ của lượt mới: tách đoạn với phần đã viết
    stream.on('text', t => { if (first && st.text && !/\s$/.test(st.text)) t = '\n\n' + t; first = false; st.text += t; cb.onText(t); });
    stream.on('contentBlock', b => {
      if (b.type === 'server_tool_use') cb.onStatus(b.name === 'web_fetch' ? 'Đang đọc: ' + (b.input?.url || '') : b.name === 'web_search' ? 'Đang tìm trên Internet: ' + (b.input?.query || '') : 'Đang chạy mã / tạo tệp…');
      if (b.type === 'tool_use') cb.onStatus('Đang thao tác: ' + (cb.app?.label?.(b.name) || b.name));
    });
    msg = await stream.finalMessage();
    if (msg.container?.id) st.container = msg.container.id;
    for (const b of msg.content) {
      if (b.type === 'text') for (const c of b.citations || []) if (c.url && !st.cites.some(x => x[0] === c.url)) st.cites.push([c.url, c.title || c.url]);
      // tệp do mã tạo ra (Excel, Word, ảnh biểu đồ…)
      if (/code_execution_tool_result$/.test(b.type)) for (const o of b.content?.content || []) if (o.file_id && !st.files.some(f => f.file_id === o.file_id)) st.files.push({ file_id: o.file_id });
    }
    st.messages = [...st.messages, { role: 'assistant', content: msg.content }];
    if (msg.stop_reason === 'pause_turn') continue;
    if (msg.stop_reason !== 'tool_use') break;
    // công cụ của app: đọc thì chạy luôn; ghi dữ liệu thì theo chế độ (hỏi trước / tự làm)
    const uses = msg.content.filter(b => b.type === 'tool_use');
    const writes = uses.filter(u => cb.app.isWrite(u.name));
    if (writes.length && cb.act !== 'tu') {
      st.pending = uses;
      st.ask = await Promise.all(writes.map(async u => ({ id: u.id, label: await cb.app.describe(u.name, u.input) })));
      return { paused: true, state: st };
    }
    st.messages.push({ role: 'user', content: await runUses(st, cb, uses, true) });
  }
  return finish(st, cb, msg);
}
// chạy các lời gọi công cụ của app; ok=false: người dùng không đồng ý → báo lại cho AI
async function runUses(st, cb, uses, ok) {
  const out = [];
  for (const u of uses) {
    if (cb.app.isWrite(u.name) && !ok) { out.push({ type: 'tool_result', tool_use_id: u.id, content: 'Người dùng KHÔNG đồng ý thực hiện thao tác này. Không làm lại; hỏi người dùng muốn làm gì khác.', is_error: true }); continue; }
    try {
      const r = await cb.app.run(u.name, u.input);
      if (cb.app.isWrite(u.name)) { const line = '\n\n✅ ' + (await cb.app.describe(u.name, u.input)) + (r?.link ? ` — [mở](${r.link})` : '') + '\n\n'; st.text += line; cb.onText(line); st.done.push(u.name); }
      out.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(r ?? { ok: true }).slice(0, 60000) });
    } catch (e) {
      if (cb.app.isWrite(u.name)) { const line = '\n\n⚠️ Không thực hiện được: ' + e.message; st.text += line; cb.onText(line); }
      out.push({ type: 'tool_result', tool_use_id: u.id, content: 'Lỗi: ' + e.message, is_error: true });
    }
  }
  return out;
}
// người dùng trả lời «Đồng ý / Không» cho thao tác đang chờ → chạy tiếp lượt
async function agentResume(st, ok, cb) {
  const uses = st.pending; st.pending = null; st.ask = null;
  st.messages.push({ role: 'user', content: await runUses(st, cb, uses, ok) });
  st.rounds++;
  return agentRun(st, cb);
}
async function finish(st, cb, msg) {
  if (msg?.stop_reason === 'refusal') { const e = new Error('AI từ chối xử lý yêu cầu này.'); e.status = 422; throw e; }
  // tải tệp AI tạo về máy chủ (Files API)
  const files = [];
  for (const f of st.files) {
    try {
      const meta = await getClient().files.retrieveMetadata(f.file_id);
      const buf = Buffer.from(await (await getClient().files.download(f.file_id)).arrayBuffer());
      files.push({ name: path.basename(meta.filename || 'tep') || 'tep', mime: meta.mime_type || 'application/octet-stream', buffer: buf });
    } catch (e) { const line = '\n\n⚠️ Không tải được tệp AI tạo: ' + e.message; st.text += line; cb.onText(line); }
  }
  if (st.cites.length) { const add = '\n\n**Nguồn tra cứu:**\n' + st.cites.slice(0, 10).map(([u, t], k) => `${k + 1}. [${t.replace(/[\[\]]/g, '')}](${u})`).join('\n'); st.text += add; cb.onText(add); }
  return { text: st.text, cut: msg?.stop_reason === 'max_tokens', files, acted: st.done.length > 0 };
}

// ---------- Gemini (REST generateContent, trả về dạng SSE) ----------
// lịch sử dạng Claude → Gemini: assistant → model; ảnh / PDF → inline_data
const toGemini = history => history.map(m => ({
  role: m.role === 'assistant' ? 'model' : 'user',
  parts: (Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content) }]).map(b =>
    b.type === 'text' ? { text: b.text }
      : (b.type === 'image' || b.type === 'document') && b.source?.type === 'base64' ? { inline_data: { mime_type: b.source.media_type, data: b.source.data } }
      : null).filter(Boolean),
})).filter(m => m.parts.length);
async function geminiChat(m, ctx, history, onText) {
  if (!geminiOn()) { const e = new Error('Chưa có GEMINI_API_KEY trong .env của module.'); e.status = 400; throw e; }
  const body = { systemInstruction: { parts: [{ text: chatSystem(ctx) }] }, contents: toGemini(history) };
  const call = withSearch => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m.id}:streamGenerateContent?alt=sse`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify(withSearch ? { ...body, tools: [{ google_search: {} }] } : body),
  });
  // thử tra cứu Google; gói miễn phí không cho dùng (429) thì hỏi lại không kèm tra cứu
  let r = await call(true), searched = true;
  if (r.status === 429) { await r.body?.cancel?.(); r = await call(false); searched = false; }
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    const e = new Error(r.status === 429 ? 'Gemini (gói miễn phí) đã hết lượt trong lúc này — thử lại sau ít phút hoặc chọn Claude.'
      : r.status === 400 || r.status === 403 ? 'Khóa Gemini không hợp lệ hoặc không dùng được mô hình này: ' + (j?.error?.message || r.status) : 'Gemini lỗi: ' + (j?.error?.message || r.status));
    e.status = r.status === 429 ? 429 : 502; throw e;
  }
  let text = '', finish = '', grounding = null, buf = '';
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let k;
    while ((k = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
      if (!line.startsWith('data:')) continue;
      let j; try { j = JSON.parse(line.slice(5)); } catch { continue; }
      if (j.error) { const e = new Error('Gemini lỗi: ' + j.error.message); e.status = 502; throw e; }
      const c = j.candidates?.[0]; if (!c) continue;
      for (const p of c.content?.parts || []) if (p.text && !p.thought) { text += p.text; onText(p.text); }
      if (c.groundingMetadata) grounding = c.groundingMetadata;
      if (c.finishReason) finish = c.finishReason;
    }
  }
  if (!text && /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(finish)) { const e = new Error('Gemini từ chối trả lời câu hỏi này — thử hỏi lại hoặc chọn Claude.'); e.status = 422; throw e; }
  // nguồn tra cứu Google (khi được dùng)
  const src = (grounding?.groundingChunks || []).map(g => g.web).filter(w => w?.uri);
  if (src.length) { const add = '\n\n**Nguồn tra cứu:**\n' + src.slice(0, 8).map((w, i) => `${i + 1}. [${w.title || w.uri}](${w.uri})`).join('\n'); text += add; onText(add); }
  return { text, cut: finish === 'MAX_TOKENS', searched };
}

module.exports = { enabled, extract, check, checkResult, checkDraft, suggest, draft, chat, agentResume, fileBlocks, MODEL, CHAT_MODELS, CLAUDE_DEFAULT, chatDefault, canChat, geminiOn, setClient };
