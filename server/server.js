// Máy chủ Module Pháp lý dự án (CTG ERP V2 · app-09 · MOD-09 — Pháp lý Cát Tường Home), phiên bản 2.
//   node server/server.js   → http://localhost:3400
// Dùng chung CSDL ctg_qlda và phiên đăng nhập (cookie qlda_sid) với Quản lý dự án (3200) và Quản lý thiết kế (3300).
// Chức năng: 1) checklist hồ sơ theo bước  2) soạn dự thảo văn bản  3) chức năng riêng từng bước (bồi thường từng hộ, đối chiếu kết quả scan)
//            4) kế hoạch pháp lý (tiến độ dự kiến, nhắc việc, cập nhật theo thực tế).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Busboy = require('busboy');
const { q, one, tx } = require('./db');
const { buildXlsx, zip, readXlsx } = require('./xlsx');
const { syncPhapLy } = require('./sync');
const { importPlan } = require('./import-plan');
const PDF = require('./pdf');
const AI = require('./ai');
const VB = require('../public/vanban.js');
const MAU = require('./mau');

const PORT = +(process.env.PORT || 3400);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC = process.env.PUBLIC_DIR ? path.resolve(process.env.PUBLIC_DIR) : path.join(__dirname, '..', 'public');   // PUBLIC_DIR: chạy giao diện khác (vd bản cũ) trên cùng dữ liệu
const FILES = path.join(__dirname, '..', 'data', 'files');
fs.mkdirSync(FILES, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const DEFAULT_PW = '123456';
const FILE_MAX = 80e6;

// ---------- tiện ích ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = msg => { throw new HttpError(400, msg); };
const deny = msg => { throw new HttpError(403, msg); };
const notFound = (x, what = 'bản ghi') => { if (!x) throw new HttpError(404, `Không tìm thấy ${what}`); return x; };
const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const sendFile = (res, buf, name, mime, inline) => {
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'Content-Length': buf.length,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}` });
  res.end(buf);
};
const readJson = req => new Promise((resolve, reject) => {
  const parts = []; let size = 0;
  req.on('data', c => { size += c.length; if (size > 8e6) { reject(new HttpError(413, 'Dữ liệu quá lớn')); req.destroy(); } else parts.push(c); });
  req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}); } catch { reject(new HttpError(400, 'JSON không hợp lệ')); } });
  req.on('error', reject);
});
const readUpload = (req, maxFiles = 30) => new Promise((resolve, reject) => {
  const files = [], fields = {}; let failed = null;
  const bb = Busboy({ headers: req.headers, limits: { fileSize: FILE_MAX, files: maxFiles }, defParamCharset: 'utf8' });
  bb.on('field', (k, v) => { fields[k] = v; });
  bb.on('file', (_n, stream, info) => {
    const chunks = [];
    stream.on('data', c => chunks.push(c));
    stream.on('limit', () => { failed = new HttpError(413, `Tệp «${info.filename}» vượt ${FILE_MAX / 1e6}MB`); });
    stream.on('end', () => { const b = Buffer.concat(chunks); if (b.length) files.push({ buffer: b, name: info.filename, mime: info.mimeType }); });
  });
  bb.on('close', () => failed ? reject(failed) : resolve({ files, fields }));
  bb.on('error', reject);
  req.pipe(bb);
});
const txt = v => (v === undefined || v === null ? null : String(v).trim() || null);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s + 'T00:00:00Z'));
const date = (v, label, req) => { if (!v) { if (req) bad(`Thiếu ${label}`); return null; } if (!isDate(v)) bad(`${label}: ngày không hợp lệ`); return v; };
const need = (v, label) => { if (v === null || v === undefined || String(v).trim() === '') bad(`Thiếu ${label}`); return String(v).trim(); };
const oneOf = (v, list, label) => { if (!list.includes(v)) bad(`${label} không hợp lệ`); return v; };
const int = (v, label, min = 0, max = 3650) => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); if (!isFinite(n) || n < min || n > max) bad(`${label} không hợp lệ`); return n; };
const num = v => { if (v === '' || v == null) return null; if (typeof v === 'number') return isFinite(v) ? v : null; const s = String(v).trim().replace(/\s/g, ''); const t = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/[.,](?=\d{3}(\D|$))/g, ''); const n = Number(t); return isFinite(n) ? n : null; };
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(a => a[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uid = v => (v && uuidRe.test(v) ? v : null);
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// ngày làm việc: bỏ thứ Bảy, Chủ nhật (chưa trừ ngày lễ)
const addWorkdays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); let k = 0; while (k < n) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) k++; } return d.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 864e5);
const maxD = (...a) => a.filter(Boolean).sort().at(-1) || null;
const dmy = s => s ? s.split('-').reverse().join('/') : '';
const safeName = s => String(s || 'tep').replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
const extOf = n => (path.extname(n || '').toLowerCase().replace(/[^.\w]/g, '') || '.bin');
const store = buf => { const id = crypto.randomUUID(); fs.writeFileSync(path.join(FILES, id), buf); return id; };
const readStored = s => fs.readFileSync(path.join(FILES, s));

function hashPw(pw) { const salt = crypto.randomBytes(16); return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(pw, salt, 32).toString('hex'); }
function checkPw(pw, stored) {
  if (!stored) return pw === DEFAULT_PW;
  const [, salt, hash] = stored.split('$');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 32));
}
const log = (user, projectId, entity, entityId, action, detail = null) =>
  q(`INSERT INTO activity (user_id, project_id, entity, entity_id, action, detail) VALUES ($1,$2,$3,$4,$5,$6)`,
    [user?.id || null, projectId, 'pl_' + entity, entityId == null ? null : String(entityId), action, detail]).catch(() => {});
const getSetting = async (k, d = null) => { const r = await one(`SELECT value FROM setting WHERE key = $1`, [k]); try { return r ? JSON.parse(r.value) : d; } catch { return d; } };
const putSetting = (k, v) => q(`INSERT INTO setting (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [k, JSON.stringify(v)]);

// ---------- quyền ----------
// Xem: quản trị, lãnh đạo (LD), Pháp chế (PLDA, PCKS) hoặc thành viên dự án. Thao tác: vai trò lập/kiểm/duyệt; PLDA = Người lập, PCKS = Người duyệt.
const isLeader = u => /\bLD\b/.test(u.src_roles || '');
const isLegal = u => /\b(PLDA|PCKS)\b/.test(u.src_roles || '');
async function perms(user, projectId) {
  const m = projectId ? await one(`SELECT * FROM member WHERE project_id = $1 AND user_id = $2`, [projectId, user.id]) : null;
  const admin = !!user.is_admin, r = user.src_roles || '';
  return { admin, lap: admin || !!m?.can_lap || /\bPLDA\b/.test(r), kiem: admin || !!m?.can_kiem, duyet: admin || !!m?.can_duyet || /\bPCKS\b/.test(r),
    xem: admin || isLeader(user) || isLegal(user) || !!m };
}
async function must(user, projectId, ...roles) {
  if (!projectId) bad('Thiếu dự án');
  const p = await perms(user, projectId);
  if (!p.xem) deny('Bạn không thuộc dự án này');
  if (roles.length && !roles.some(r => p[r])) {
    const L = { lap: 'Người lập', kiem: 'Người kiểm', duyet: 'Người duyệt', admin: 'Quản trị' };
    deny(`Thao tác này cần vai trò ${roles.map(r => L[r]).join(' hoặc ')} trong dự án`);
  }
  return p;
}
const W = ['lap', 'kiem', 'duyet'];
async function visibleProjects(user, projectId) {
  const all = user.is_admin || isLeader(user) || isLegal(user);
  const ids = (await q(`SELECT id FROM project p WHERE ($1 OR EXISTS (SELECT 1 FROM member m WHERE m.project_id = p.id AND m.user_id = $2))`, [all, user.id])).map(r => r.id);
  if (projectId) { if (!ids.includes(projectId)) deny('Bạn không thuộc dự án này'); return [projectId]; }
  return ids;
}
const libEditor = user => { if (!user.is_admin && !isLegal(user)) deny('Chỉ Pháp chế hoặc quản trị được sửa thư viện checklist'); };
const stepOf = async (user, id, ...roles) => { const s = notFound(await one(`SELECT * FROM pl_step WHERE id = $1`, [id]), 'bước'); await must(user, s.project_id, ...roles); return s; };
const itemOf = async (user, id, ...roles) => { const i = notFound(await one(`SELECT i.*, s.project_id FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE i.id = $1`, [id]), 'mục hồ sơ'); await must(user, i.project_id, ...roles); return i; };

// ---------- router ----------
const routes = [];
const route = (method, pattern, handler, opts = {}) => {
  const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, ...opts });
};

// ===== Đăng nhập (dùng chung tài khoản + phiên với các module khác) =====
route('POST', '/api/login', async ({ body, res }) => {
  const u = await one(`SELECT * FROM app_user WHERE lower(username) = lower($1) AND active`, [String(body.username || '').trim()]);
  if (!u || !checkPw(String(body.password || ''), u.pw_hash)) throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu');
  const sid = crypto.randomBytes(24).toString('base64url');
  await q(`DELETE FROM session WHERE expires_at < now()`);
  await q(`INSERT INTO session (sid, user_id, expires_at) VALUES ($1,$2, now() + interval '30 days')`, [sid, u.id]);
  await log(u, null, 'user', u.id, 'login');
  send(res, 200, { ok: true, must_change: !u.pw_hash }, { 'Set-Cookie': `qlda_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` });
}, { public: true });
route('POST', '/api/logout', async ({ req, res }) => {
  await q(`DELETE FROM session WHERE sid = $1`, [cookies(req).qlda_sid]);
  send(res, 200, { ok: true }, { 'Set-Cookie': 'qlda_sid=; Path=/; Max-Age=0' });
});
route('POST', '/api/password', async ({ user, body }) => {
  const u = await one(`SELECT pw_hash FROM app_user WHERE id = $1`, [user.id]);
  if (!checkPw(String(body.old || ''), u.pw_hash)) bad('Mật khẩu cũ không đúng');
  if (String(body.new || '').length < 6 || body.new === DEFAULT_PW) bad('Mật khẩu mới tối thiểu 6 ký tự và khác mật khẩu mặc định');
  await q(`UPDATE app_user SET pw_hash = $2 WHERE id = $1`, [user.id, hashPw(body.new)]);
  return { ok: true };
});
route('GET', '/api/me', async ({ user }) => ({ id: user.id, username: user.username, full_name: user.full_name, job_title: user.job_title,
  is_admin: user.is_admin, is_leader: isLeader(user), is_legal: isLegal(user), must_change: !user.pw_hash }));

route('GET', '/api/ref', async ({ user }) => {
  const list = await visibleProjects(user);
  const [projects, users, mine, phases, procedures, forms, agencies, sync] = await Promise.all([
    q(`SELECT id, code, name, location, legal_entity FROM project WHERE id = ANY($1) ORDER BY code`, [list]),
    q(`SELECT id, username, full_name, job_title FROM app_user WHERE active ORDER BY full_name`),
    q(`SELECT project_id, can_lap, can_kiem, can_duyet FROM member WHERE user_id = $1`, [user.id]),
    q(`SELECT code, name, ord FROM pl_phase ORDER BY ord`),
    q(`SELECT id, code, name, phase_code, agency_text, deadline_days, workdays, deadline_text, result_text FROM pl_procedure ORDER BY (SELECT ord FROM pl_phase WHERE code = phase_code), ord, code`),
    q(`SELECT code, name, legal_number, usable, procedure_codes FROM pl_form ORDER BY code`),
    q(`SELECT code, name, short_name FROM pl_agency ORDER BY name`),
    one(`SELECT value FROM setting WHERE key = 'pl_last_sync'`),
  ]);
  const r = user.src_roles || '', roles = {};
  for (const p of projects) {
    const m = mine.find(x => x.project_id === p.id);
    roles[p.id] = user.is_admin ? ['lap', 'kiem', 'duyet', 'xem'] : [...new Set([...(m ? ['lap', 'kiem', 'duyet'].filter(k => m['can_' + k]) : []),
      ...(/\bPLDA\b/.test(r) ? ['lap'] : []), ...(/\bPCKS\b/.test(r) ? ['duyet'] : []), 'xem'])];
  }
  return { projects, users, roles, phases, procedures, forms, agencies, issue_kinds: ISSUE, ai: AI.enabled(), model: AI.MODEL, chat_models: AI.CHAT_MODELS.map(m => ({ id: m.id, name: m.name, note: m.note, provider: m.provider, ok: AI.canChat(m.id) })), chat_default: AI.chatDefault(), chat_ok: AI.enabled() || AI.geminiOn(), print: PDF.canPrint(), hoso_dir: HOSO_DIR, last_sync: sync?.value || null, today: today() };
});
route('POST', '/api/sync', async ({ user }) => {
  if (!user.is_admin) deny('Chỉ quản trị được đồng bộ');
  const s = await syncPhapLy();
  await log(user, null, 'sync', null, 'sync', JSON.stringify(s));
  return s;
});

// ===== thông tin chủ đầu tư dùng khi soạn văn bản =====
async function projInfo(pid) {
  const p = await one(`SELECT id, code, name, location, legal_entity, investor FROM project WHERE id = $1`, [pid]);
  const s = await getSetting('pl_proj:' + pid, {});
  const loc = String(p?.location || '').split(/[(\[]/)[0].replace(/[,.;\s]+$/, '').trim();
  return { project: p, cdt: s.cdt || p?.legal_entity || '', viet_tat: s.viet_tat || '', dia_chi: s.dia_chi || '', dia_diem: s.dia_diem || loc, place: s.place || (/Bắc Ninh/i.test(p?.location || '') ? 'Bắc Ninh' : ''),
    nguoi_ky: s.nguoi_ky || '', chuc_vu_ky: s.chuc_vu_ky || 'TỔNG GIÁM ĐỐC', don_vi_soan: s.don_vi_soan || 'BQLDA', ubnd: s.ubnd || '', don_vi_bt: s.don_vi_bt || '' };
}
route('GET', '/api/projects/:id/info', async ({ user, params }) => { await must(user, params.id); return projInfo(params.id); });
route('PUT', '/api/projects/:id/info', async ({ user, params, body }) => {
  await must(user, params.id, ...W);
  const k = ['cdt', 'viet_tat', 'dia_chi', 'dia_diem', 'place', 'nguoi_ky', 'chuc_vu_ky', 'don_vi_soan', 'ubnd', 'don_vi_bt'];
  await putSetting('pl_proj:' + params.id, Object.fromEntries(k.map(x => [x, txt(body[x]) || ''])));
  return projInfo(params.id);
});

// =====================================================================================
// 4) KẾ HOẠCH PHÁP LÝ — các bước, phụ thuộc, lập / cập nhật tiến độ, nhắc việc
// =====================================================================================
// mặc định không chọn: nhánh thay thế, thủ tục điều chỉnh, có điều kiện, báo cáo định kỳ
const OPTIONAL = new Set(['TT-CTDT', 'TT-DCCDT', 'TT-TDBCNCKT-B', 'TT-GPMT', 'TT-DTM', 'TT-GPXD-DC', 'TT-HLLD', 'TT-THUYLOI', 'TT-BCGSDT', 'TT-BCDT', 'TT-TTDABDS', 'TT-BCHDDA', 'TT-BCTD-SXD']);
const mocRe = c => `(^|-)${c}($|-)`;
async function graph() {
  const [mp, pre] = await Promise.all([q(`SELECT * FROM pl_mmoc_proc`), q(`SELECT * FROM pl_mmoc_pre`)]);
  const mocsOf = c => mp.filter(r => r.procedure_code === c).map(r => r.moc_code);
  const procsOf = m => mp.filter(r => r.moc_code === m).map(r => r.procedure_code);
  const preOf = m => pre.filter(r => r.moc_code === m).map(r => r.pre_code);
  return { mocsOf, procsOf, preOf };
}
// bước phụ thuộc = các bước (đã chọn) thuộc mốc tiền đề gần nhất; mốc tiền đề không có bước nào được chọn thì lần tiếp lên trên
// thủ tục thuộc cả mốc tổng hợp (vd MOC-07) lẫn mốc con là tiền đề của nó (MOC-16/17/18) → chỉ xét mốc con, tránh phụ thuộc vòng
function depCodes(G, code, selected) {
  const all = G.mocsOf(code), own = all.filter(m => !G.preOf(m).some(p => G.procsOf(p).includes(code)));
  const out = new Set(), seen = new Set(), queue = (own.length ? own : all).flatMap(G.preOf);
  while (queue.length) {
    const m = queue.shift(); if (seen.has(m)) continue; seen.add(m);
    const ps = G.procsOf(m).filter(p => p !== code && selected.has(p));
    if (ps.length) ps.forEach(p => out.add(p)); else queue.push(...G.preOf(m));
  }
  return [...out];
}
route('GET', '/api/init-options', async ({ user, query }) => {
  await must(user, query.project);
  const [procs, steps, ms, G] = await Promise.all([
    q(`SELECT p.*, ph.name AS phase_name, ph.ord AS phase_ord FROM pl_procedure p LEFT JOIN pl_phase ph ON ph.code = p.phase_code ORDER BY ph.ord, p.ord, p.code`),
    q(`SELECT procedure_id FROM pl_step WHERE project_id = $1`, [query.project]),
    q(`SELECT code, actual_on, status FROM milestone WHERE project_id = $1`, [query.project]), graph()]);
  const have = new Set(steps.map(s => s.procedure_id));
  return procs.map(p => {
    const done = G.mocsOf(p.code).map(m => ms.find(x => new RegExp(mocRe(m)).test(x.code))).filter(Boolean).find(x => x.actual_on);
    return { id: p.id, code: p.code, name: p.name, phase_code: p.phase_code, phase_name: p.phase_name, deadline_days: p.deadline_days, workdays: p.workdays,
      exists: have.has(p.id), suggested: !OPTIONAL.has(p.code), done_on: done?.actual_on || null };
  });
});
async function addItemsFromTpl(t, stepId, procCode, pid) {
  const tpl = await t.q(`SELECT * FROM pl_tpl WHERE procedure_code = $1 ORDER BY kind, ord, created_at`, [procCode]);
  const ev = await t.q(`SELECT * FROM pl_qlda_line WHERE project_id = $1 AND procedure_code = $2 AND evidence IS NOT NULL`, [pid, procCode]);
  const used = new Set();
  for (const x of tpl) {
    // văn bản chứng minh QLDA: gán vào mục kết quả trùng tên, nếu không thì mục kết quả bắt buộc đầu tiên
    let ref = null;
    if (x.kind === 'ket_qua') {
      const hit = ev.find(e => !used.has(e.src_id) && (x.source === 'qlda' && x.seed_key === 'qlda:' + e.line_code || similar(x.name, e.description))) ||
        (x.required && ev.find(e => !used.has(e.src_id)));
      if (hit) { used.add(hit.src_id); ref = `${hit.evidence} (theo QLDA ${hit.line_code})`; }
    }
    await t.q(`INSERT INTO pl_item (step_id, tpl_id, kind, name, required, basis, source, form_code, doc_kind, tag, ref_text, ord) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [stepId, x.id, x.kind, x.name, x.required, x.basis, x.source, x.form_code, x.doc_kind, x.tag, ref, x.ord]);
  }
  return tpl.length;
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
function similar(a, b) { const A = new Set(norm(a)), B = norm(b); if (!A.size || !B.length) return false; const hit = B.filter(w => A.has(w)).length; return hit / Math.min(A.size, B.length) >= 0.6; }

route('POST', '/api/steps/init', async ({ user, body }) => {
  const pid = body.project_id; await must(user, pid, ...W);
  const ids = (Array.isArray(body.procedure_ids) ? body.procedure_ids : []).filter(uid);
  if (!ids.length) bad('Chọn ít nhất một thủ tục');
  const procs = await q(`SELECT p.*, ph.ord AS phase_ord FROM pl_procedure p LEFT JOIN pl_phase ph ON ph.code = p.phase_code WHERE p.id = ANY($1)`, [ids]);
  const existing = await q(`SELECT s.*, p.code AS pcode FROM pl_step s LEFT JOIN pl_procedure p ON p.id = s.procedure_id WHERE s.project_id = $1`, [pid]);
  const ms = await q(`SELECT code, actual_on FROM milestone WHERE project_id = $1`, [pid]);
  const G = await graph();
  const selected = new Set([...procs.map(p => p.code), ...existing.map(s => s.pcode).filter(Boolean)]);
  let made = 0;
  await tx(async t => {
    for (const p of procs.sort((a, b) => (a.phase_ord || 99) - (b.phase_ord || 99) || (a.ord || 0) - (b.ord || 0))) {
      if (existing.some(s => s.procedure_id === p.id)) continue;
      const done = G.mocsOf(p.code).map(m => ms.find(x => new RegExp(mocRe(m)).test(x.code))).filter(Boolean).find(x => x.actual_on);
      const s = await t.one(`INSERT INTO pl_step (project_id, procedure_id, code, name, phase_code, agency_text, ord, prep_days, proc_days, workdays, status, act_end, owner_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [pid, p.id, p.code, p.name, p.phase_code, p.agency_text, (p.phase_ord || 9) * 1000 + (p.ord || 0), p.deadline_days ? 15 : 20, p.deadline_days || 0, !!p.workdays,
          done ? 'xong' : 'chua', done?.actual_on || null, user.id]);
      await addItemsFromTpl(t, s.id, p.code, pid);
      made++;
    }
    // phụ thuộc cho toàn bộ bước theo thủ tục (giữ phụ thuộc người dùng đã sửa: chỉ ghi khi đang trống)
    const all = await t.q(`SELECT s.id, s.deps, p.code FROM pl_step s JOIN pl_procedure p ON p.id = s.procedure_id WHERE s.project_id = $1`, [pid]);
    const dmap = Object.fromEntries(all.map(s => [s.id, s.deps.slice()]));
    const reaches = (from, target, seen = new Set()) => (dmap[from] || []).some(d => d === target || (!seen.has(d) && (seen.add(d), reaches(d, target, seen))));
    for (const s of all) {
      if (s.deps.length) continue;
      for (const id of depCodes(G, s.code, selected).map(c => all.find(x => x.code === c)?.id).filter(Boolean))
        if (id !== s.id && !reaches(id, s.id)) dmap[s.id].push(id);
      if (dmap[s.id].length) await t.q(`UPDATE pl_step SET deps = $2 WHERE id = $1`, [s.id, dmap[s.id]]);
    }
  });
  const sum = await schedule(pid, { start: date(body.start, 'Ngày bắt đầu') || today(), baseline: !existing.length });
  await log(user, pid, 'step', null, 'init', String(made));
  return { made, ...sum };
});
const stepFields = b => ({ name: need(b.name, 'tên bước'), phase_code: txt(b.phase_code), agency_text: txt(b.agency_text),
  prep_days: int(b.prep_days, 'Ngày chuẩn bị') ?? 15, proc_days: int(b.proc_days, 'Thời hạn giải quyết') ?? 0, workdays: !!b.workdays,
  deps: (Array.isArray(b.deps) ? b.deps : []).filter(uid), owner_id: uid(b.owner_id), note: txt(b.note) });
route('POST', '/api/steps', async ({ user, body }) => {
  await must(user, body.project_id, ...W);
  const f = stepFields(body);
  const ph = await one(`SELECT ord FROM pl_phase WHERE code = $1`, [f.phase_code]);
  const r = await one(`INSERT INTO pl_step (project_id, code, name, phase_code, agency_text, ord, prep_days, proc_days, workdays, deps, owner_id, note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [body.project_id, txt(body.code) || 'BUOC-RIENG', f.name, f.phase_code, f.agency_text, (ph?.ord || 9) * 1000 + 999, f.prep_days, f.proc_days, f.workdays, f.deps, f.owner_id || user.id, f.note]);
  await schedule(body.project_id, {});
  return r;
});
route('PUT', '/api/steps/:id', async ({ user, params, body }) => {
  const s = await stepOf(user, params.id, ...W);
  const f = stepFields(body);
  if (f.deps.includes(s.id)) bad('Bước không thể phụ thuộc chính nó');
  const st = oneOf(body.status || s.status, ['chua', 'dang', 'cho_kq', 'xong', 'bo_qua'], 'Trạng thái');
  let as = date(body.act_start, 'Ngày bắt đầu thực tế'), asub = date(body.act_submit, 'Ngày nộp hồ sơ'), ae = date(body.act_end, 'Ngày có kết quả');
  if (st === 'dang' && !as) as = today();
  if (st === 'cho_kq') { as = as || today(); asub = asub || today(); }
  if (st === 'xong') ae = ae || today();
  if (asub && as && asub < as) bad('Ngày nộp hồ sơ trước ngày bắt đầu');
  if (ae && asub && ae < asub) bad('Ngày có kết quả trước ngày nộp hồ sơ');
  // phụ thuộc vòng
  const all = await q(`SELECT id, deps FROM pl_step WHERE project_id = $1`, [s.project_id]);
  const dmap = Object.fromEntries(all.map(x => [x.id, x.id === s.id ? f.deps : x.deps]));
  const reach = (from, target, seen = new Set()) => (dmap[from] || []).some(d => d === target || (!seen.has(d) && (seen.add(d), reach(d, target, seen))));
  if (reach(s.id, s.id)) bad('Phụ thuộc tạo thành vòng lặp — kiểm tra lại các bước phải xong trước');
  await q(`UPDATE pl_step SET name=$2, phase_code=$3, agency_text=$4, prep_days=$5, proc_days=$6, workdays=$7, deps=$8, owner_id=$9, note=$10, status=$11,
    act_start=$12, act_submit=$13, act_end=$14, issue_kind=$15, issue_text=$16, issue_since=$17, updated_at=now() WHERE id=$1`,
    [s.id, f.name, f.phase_code, f.agency_text, f.prep_days, f.proc_days, f.workdays, f.deps, f.owner_id, f.note, st, st === 'chua' ? null : as, ['cho_kq', 'xong'].includes(st) ? asub : null, st === 'xong' ? ae : null,
      ...(st === 'xong' || st === 'bo_qua' || !body.issue_kind ? [null, null, null] : [oneOf(body.issue_kind, Object.keys(ISSUE), 'Loại vướng mắc'), txt(body.issue_text), date(body.issue_since, 'Vướng từ ngày') || s.issue_since || today()])]);
  await log(user, s.project_id, 'step', s.id, 'update', st);
  return schedule(s.project_id, {});
});
route('DELETE', '/api/steps/:id', async ({ user, params }) => {
  const s = await stepOf(user, params.id, 'duyet', 'admin');
  const files = await q(`SELECT stored FROM pl_file WHERE step_id = $1`, [s.id]);
  await tx(async t => {
    await t.q(`UPDATE pl_step SET deps = array_remove(deps, $1) WHERE project_id = $2`, [s.id, s.project_id]);
    await t.q(`DELETE FROM pl_step WHERE id = $1`, [s.id]);
  });
  files.forEach(f => fs.rmSync(path.join(FILES, f.stored), { force: true }));
  await schedule(s.project_id, {});
  return { ok: true };
});

// Lập lịch: tiến lên theo phụ thuộc. Bước xong dùng ngày thực tế; bước chưa xong không được bắt đầu / kết thúc trước hôm nay.
async function schedule(pid, { start, baseline }) {
  const steps = await q(`SELECT * FROM pl_step WHERE project_id = $1 ORDER BY ord, created_at`, [pid]);
  const t = today(), anchor = start || t, by = Object.fromEntries(steps.map(s => [s.id, s])), out = {}, visiting = new Set();
  const proc = (from, s) => s.proc_days ? (s.workdays ? addWorkdays(from, s.proc_days) : addDays(from, s.proc_days)) : from;
  const calc = s => {
    if (out[s.id]) return out[s.id];
    if (visiting.has(s.id)) return { end: anchor };   // vòng lặp (không nên có) — cắt
    visiting.add(s.id);
    const depEnd = maxD(...s.deps.map(d => by[d] && calc(by[d]).end));
    let r;
    if (s.status === 'bo_qua') r = { start: null, submit: null, end: depEnd || null };
    else if (s.status === 'xong' && !s.act_end && s.fixed) r = { start: s.plan_start, submit: s.plan_submit, end: s.plan_end };
    else if (s.status === 'xong' && !s.act_end && s.src_key) r = { start: null, submit: null, end: null };
    else if (s.fixed && s.status !== 'xong' && (s.plan_start || s.plan_end)) r = { start: s.act_start || s.plan_start, submit: s.act_submit || s.plan_submit, end: s.plan_end };
    else if (s.status === 'xong') {
      const end = s.act_end || t, st = s.act_start || addDays(s.act_submit || end, -(s.prep_days || 0));
      r = { start: st, submit: s.act_submit || (s.proc_days ? null : end), end };
    } else {
      const st = s.act_start || maxD(depEnd ? addDays(depEnd, 1) : null, anchor, t);
      let sub = s.act_submit || maxD(addDays(st, s.prep_days || 0), s.status === 'dang' || s.status === 'chua' ? t : null);
      let end = maxD(proc(sub, s), t);
      r = { start: st, submit: sub, end };
    }
    visiting.delete(s.id);
    return (out[s.id] = r);
  };
  steps.forEach(calc);
  await tx(async x => {
    for (const s of steps) {
      const r = out[s.id];
      await x.q(`UPDATE pl_step SET plan_start=$2, plan_submit=$3, plan_end=$4 ${baseline ? ', base_start=$2, base_end=$4' : ''} WHERE id=$1`, [s.id, r.start, r.submit, r.end]);
    }
  });
  const ends = Object.values(out).map(r => r.end).filter(Boolean).sort();
  return { steps: steps.length, finish: ends.at(-1) || null };
}
route('POST', '/api/plan/:id/schedule', async ({ user, params, body }) => {
  await must(user, params.id, ...W);
  const mode = oneOf(body.mode || 'cap_nhat', ['lap', 'cap_nhat', 'chot_goc'], 'Chế độ');
  if (mode === 'chot_goc') { await q(`UPDATE pl_step SET base_start = plan_start, base_end = plan_end WHERE project_id = $1`, [params.id]); await log(user, params.id, 'plan', null, 'baseline'); return { ok: true }; }
  if (mode === 'lap') await q(`UPDATE pl_step SET act_start = NULL WHERE project_id = $1 AND status = 'chua'`, [params.id]);
  const r = await schedule(params.id, { start: date(body.start, 'Ngày bắt đầu') || today(), baseline: mode === 'lap' });
  await log(user, params.id, 'plan', null, mode, r.finish);
  return r;
});

// trạng thái từng bước: hồ sơ thiếu, cảnh báo AI, trễ hạn, việc hôm nay
const ST_NAME = { chua: 'Chưa làm', dang: 'Đang chuẩn bị hồ sơ', cho_kq: 'Đã nộp, chờ kết quả', xong: 'Hoàn thành', bo_qua: 'Không thực hiện' };
async function stepRows(list) {
  const rows = await q(`SELECT s.*, p.code AS project_code, p.name AS project_name, ph.name AS phase_name, ph.ord AS phase_ord, u.full_name AS owner,
      (SELECT count(*) FROM pl_item i WHERE i.step_id = s.id AND NOT i.na AND i.required AND i.kind <> 'ket_qua') AS req_n,
      (SELECT count(*) FROM pl_item i WHERE i.step_id = s.id AND NOT i.na AND i.required AND i.kind <> 'ket_qua'
         AND (i.done OR i.ref_text IS NOT NULL OR EXISTS (SELECT 1 FROM pl_file f WHERE f.item_id = i.id AND f.current))) AS req_ok,
      (SELECT count(*) FROM pl_item i WHERE i.step_id = s.id AND NOT i.na AND i.kind = 'ket_qua' AND i.required) AS kq_n,
      (SELECT count(*) FROM pl_item i WHERE i.step_id = s.id AND NOT i.na AND i.kind = 'ket_qua' AND i.required
         AND (i.done OR i.ref_text IS NOT NULL OR EXISTS (SELECT 1 FROM pl_file f WHERE f.item_id = i.id AND f.current))) AS kq_ok,
      (SELECT count(*) FROM pl_check c, jsonb_array_elements(coalesce(c.result->'canh_bao','[]')) w WHERE c.step_id = s.id AND c.status = 'xong'
         AND c.id IN (SELECT DISTINCT ON (kind, target_id) id FROM pl_check WHERE step_id = s.id ORDER BY kind, target_id, created_at DESC)) AS warn_n,
      (SELECT count(*) FROM pl_check c WHERE c.step_id = s.id AND c.status = 'dang') AS checking,
      (SELECT count(*) FROM pl_item i WHERE i.step_id = s.id AND NOT i.na AND i.required AND NOT i.done AND i.ref_text IS NULL AND coalesce(i.due_on, s.plan_end) < current_date
         AND NOT EXISTS (SELECT 1 FROM pl_file f WHERE f.item_id = i.id AND f.current)) AS overdue_n,
      (SELECT json_build_object('id', e.id, 'status', e.status, 'new_due', e.new_due) FROM pl_extend e WHERE e.step_id = s.id AND e.item_id IS NULL AND e.status <> 'rut' ORDER BY e.created_at DESC LIMIT 1) AS ext,
      (SELECT count(*) FROM pl_extend e WHERE e.step_id = s.id AND e.status = 'cho') AS ext_wait
    FROM pl_step s JOIN project p ON p.id = s.project_id LEFT JOIN pl_phase ph ON ph.code = s.phase_code LEFT JOIN app_user u ON u.id = s.owner_id
    WHERE s.project_id = ANY($1) ORDER BY p.code, s.ord, s.created_at`, [list]);
  const t = today();
  return rows.map(s => {
    const open = !['xong', 'bo_qua'].includes(s.status);
    let late = 0, late_kind = null;
    if (open && s.plan_end && s.base_end && s.plan_end > s.base_end) { late = diffDays(s.plan_end, s.base_end); late_kind = 'cham_ke_hoach'; }
    if (open && s.status === 'cho_kq' && s.act_submit && s.proc_days) {
      const due = s.workdays ? addWorkdays(s.act_submit, s.proc_days) : addDays(s.act_submit, s.proc_days);
      if (due < t) { late = diffDays(t, due); late_kind = 'qua_han_tra'; }
      s.due_on = due;
    }
    // quá ngày hoàn thành theo kế hoạch mà chưa xong
    if (open && late_kind !== 'qua_han_tra' && s.plan_end && s.plan_end < t) { late = diffDays(t, s.plan_end); late_kind = 'qua_han_ke_hoach'; }
    const slip = s.base_end && s.plan_end ? diffDays(s.plan_end, s.base_end) : 0;
    return { ...s, open, late, late_kind, slip, state_name: ST_NAME[s.status], missing: Math.max(0, s.req_n - s.req_ok) };
  });
}
route('GET', '/api/steps', async ({ user, query }) => {
  const list = await visibleProjects(user, query.project || null);
  return stepRows(list);
});
route('GET', '/api/today', async ({ user, query }) => {
  const list = await visibleProjects(user, query.project || null);
  const steps = await stepRows(list), t = today(), in3 = addDays(t, 3), in14 = addDays(t, 14);
  const open = steps.filter(s => s.open), A = [];
  const add = (s, tone, kind, text, due) => A.push({ step_id: s.id, project_code: s.project_code, step: s.name, phase: s.phase_name, tone, kind, text, due, owner: s.owner });
  for (const s of open) {
    if (s.status === 'chua' && s.plan_start && s.plan_start <= t) add(s, 'r', 'hom_nay', 'Đến ngày bắt đầu chuẩn bị hồ sơ — chưa bắt đầu', s.plan_start);
    if (s.status === 'dang' && s.plan_submit && s.plan_submit <= in3) add(s, s.plan_submit <= t ? 'r' : 'a', 'hom_nay', s.plan_submit <= t ? 'Đến hạn nộp hồ sơ theo kế hoạch' : 'Sắp đến hạn nộp hồ sơ', s.plan_submit);
    if (s.status === 'dang' && s.missing) add(s, 'a', 'thieu', `Còn thiếu ${s.missing}/${s.req_n} hồ sơ bắt buộc`, s.plan_submit);
    if (s.status === 'cho_kq' && s.due_on && s.due_on <= in3) add(s, s.due_on < t ? 'r' : 'a', 'hom_nay', s.due_on < t ? `Cơ quan quá hạn trả kết quả ${s.late} ngày — cần đôn đốc` : 'Sắp đến hạn trả kết quả — chuẩn bị đôn đốc', s.due_on);
    if (s.late_kind === 'cham_ke_hoach' && s.late > 0) add(s, s.late > 14 ? 'r' : 'a', 'cham', `Chậm ${s.late} ngày so với kế hoạch gốc`, s.plan_end);
    if (s.warn_n) add(s, 'a', 'canh_bao', `${s.warn_n} cảnh báo AI về hồ sơ chưa xử lý`, null);
    if (s.overdue_n) add(s, 'r', 'qua_han', `${s.overdue_n} hồ sơ quá hạn chưa có`, s.plan_end);
    if (s.status === 'chua' && s.plan_start > t && s.plan_start <= in14) add(s, 'b', 'sap_toi', 'Sắp bắt đầu', s.plan_start);
  }
  const rank = { r: 0, a: 1, b: 2 };
  A.sort((a, b) => rank[a.tone] - rank[b.tone] || (a.due || '9').localeCompare(b.due || '9'));
  // việc trong ngày theo từng bước, xếp theo giai đoạn dự án: bước đang làm, bước có mốc rơi vào hôm nay, bước tồn đọng
  const W = open.filter(s => ['dang', 'cho_kq'].includes(s.status) || (s.plan_start && s.plan_start <= t));
  const items = W.length ? await q(`SELECT i.step_id, i.name, i.kind, coalesce(i.due_on, s.plan_end) AS due FROM pl_item i JOIN pl_step s ON s.id = i.step_id
      WHERE i.step_id = ANY($1) AND NOT i.na AND i.required AND NOT i.done AND i.ref_text IS NULL
        AND NOT EXISTS (SELECT 1 FROM pl_file f WHERE f.item_id = i.id AND f.current) ORDER BY i.ord, i.created_at`, [W.map(s => s.id)]) : [];
  const left = d => d === t ? 'hôm nay' : d < t ? `quá ${diffDays(t, d)} ngày` : `còn ${diffDays(d, t)} ngày`;
  const work = W.map(s => {
    const miss = items.filter(i => i.step_id === s.id && (s.status !== 'dang' || i.kind !== 'ket_qua')).map(i => ({ name: i.name, due: i.due, kq: i.kind === 'ket_qua' }));
    let task, tone;
    if (s.status === 'chua') [task, tone] = s.plan_start === t ? ['Bắt đầu chuẩn bị hồ sơ hôm nay', 'a'] : [`Chưa bắt đầu — trễ ${diffDays(t, s.plan_start)} ngày so với ngày bắt đầu kế hoạch ${dmy(s.plan_start)}`, 'r'];
    else if (s.status === 'dang') [task, tone] = !s.plan_submit ? ['Chuẩn bị hồ sơ — chưa có ngày nộp kế hoạch', 'b']
      : s.plan_submit === t ? ['Nộp hồ sơ hôm nay', 'a'] : s.plan_submit < t ? [`Quá hạn nộp hồ sơ ${diffDays(t, s.plan_submit)} ngày (hạn ${dmy(s.plan_submit)})`, 'r']
      : [`Hoàn thiện hồ sơ — nộp trước ${dmy(s.plan_submit)} (${left(s.plan_submit)})`, 'b'];
    else [task, tone] = !s.due_on ? ['Đã nộp — theo dõi kết quả', 'b'] : s.due_on === t ? ['Cơ quan đến hạn trả kết quả hôm nay — gọi đôn đốc', 'a']
      : s.due_on < t ? [`Cơ quan quá hạn trả kết quả ${diffDays(t, s.due_on)} ngày — đôn đốc, làm văn bản đề nghị`, 'r'] : [`Chờ kết quả — hạn trả ${dmy(s.due_on)} (${left(s.due_on)})`, 'b'];
    if (tone !== 'r' && s.plan_end && s.plan_end < t) { task += ` · đã quá ngày có kết quả kế hoạch ${diffDays(t, s.plan_end)} ngày`; tone = 'r'; }
    else if (tone === 'b' && (s.plan_end === t || miss.some(i => i.due === t))) tone = 'a';
    if (tone === 'b' && miss.some(i => i.due < t)) tone = 'r';
    const today_ = s.plan_start === t || s.plan_submit === t || s.due_on === t || s.plan_end === t || miss.some(i => i.due === t);
    return { id: s.id, name: s.name, project_code: s.project_code, phase_code: s.phase_code, phase: s.phase_name, phase_ord: s.phase_ord, status: s.status, state_name: s.state_name,
      sheet: s.sheet, section: s.section, stt: s.stt, ord: s.ord,
      plan_start: s.plan_start, plan_submit: s.plan_submit, plan_end: s.plan_end, due_on: s.due_on || null, slip: s.slip, owner: s.owner, task, tone, today: today_,
      req_n: s.req_n, req_ok: s.req_ok, warn_n: s.warn_n, issue: s.issue_kind ? ISSUE[s.issue_kind] + (s.issue_text ? ' — ' + s.issue_text : '') : null, missing: miss };
  }).sort((a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || (a.plan_start || '9').localeCompare(b.plan_start || '9'));
  const done = steps.filter(s => s.status === 'xong').length, active = steps.filter(s => ['dang', 'cho_kq'].includes(s.status));
  // tiến độ theo phần dự án (concept): GPMB / DTXD — số việc xong / tổng
  const parts = [];
  for (const x of steps.filter(x => x.status !== 'bo_qua')) { const k = String(x.sheet || x.phase_name || 'Khác').split(' · ')[0]; let g = parts.find(p => p.k === k); if (!g) parts.push(g = { k, total: 0, done: 0, late: 0 }); g.total++; if (x.status === 'xong') g.done++; if (x.open && x.late > 0 && x.late_kind !== 'cham_ke_hoach') g.late++; }
  return { today: t, alerts: A, work, parts, steps: steps.length, done, active: active.length, late: open.filter(s => s.late > 0).length,
    finish: steps.map(s => s.plan_end).filter(Boolean).sort().at(-1) || null, base_finish: steps.map(s => s.base_end).filter(Boolean).sort().at(-1) || null,
    current: active.map(s => ({ id: s.id, name: s.name, project_code: s.project_code, status: s.status, state_name: s.state_name, plan_submit: s.plan_submit, plan_end: s.plan_end, req_n: s.req_n, req_ok: s.req_ok, late: s.late })),
    upcoming: open.filter(s => s.status === 'chua' && s.plan_start && s.plan_start <= addDays(t, 30)).map(s => ({ id: s.id, name: s.name, project_code: s.project_code, plan_start: s.plan_start, plan_end: s.plan_end })) };
});
// ===== Tổng quan: danh mục dự án, bước đang làm, tiến độ, cảnh báo chậm, vướng mắc =====
const ISSUE = { ho_so: 'Hồ sơ chưa đủ / chưa đạt', co_quan: 'Chờ cơ quan giải quyết', bo_sung: 'Cơ quan yêu cầu bổ sung, sửa đổi', quy_dinh: 'Vướng quy định / chưa rõ thẩm quyền',
  gpmb: 'Bồi thường, GPMB (người dân)', tai_chinh: 'Tài chính, nghĩa vụ nộp tiền', noi_bo: 'Phối hợp nội bộ, chờ phê duyệt', ky_thuat: 'Thiết kế, kỹ thuật', khac: 'Khác' };
// ghi / sửa / xóa nguyên nhân quá hạn: item_id → của hồ sơ, không có → của cả công việc
route('PUT', '/api/issue', async ({ user, body }) => {
  const kind = body.issue_kind ? oneOf(body.issue_kind, Object.keys(ISSUE), 'Nguyên nhân') : null, text = kind ? txt(body.issue_text) : null;
  if (kind && !text) bad('Ghi rõ vướng ở đâu, tình trạng hiện tại');
  if (uid(body.item_id)) {
    const i = await itemOf(user, body.item_id, ...W);
    await q(`UPDATE pl_item SET issue_kind = $2, issue_text = $3, issue_by = $4, issue_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() END WHERE id = $1`, [i.id, kind, text, kind ? user.id : null]);
    await log(user, i.project_id, 'item', i.id, 'issue', kind ? `${i.name}: ${ISSUE[kind]} — ${text}` : `${i.name}: xóa nguyên nhân`);
  } else {
    const s = await stepOf(user, body.step_id, ...W);
    await q(`UPDATE pl_step SET issue_kind = $2, issue_text = $3, issue_since = CASE WHEN $2::text IS NULL THEN NULL ELSE coalesce(issue_since, current_date) END, updated_at = now() WHERE id = $1`, [s.id, kind, text]);
    await log(user, s.project_id, 'step', s.id, 'issue', kind ? `${ISSUE[kind]} — ${text}` : 'xóa vướng mắc');
  }
  return { ok: true };
});
route('GET', '/api/overview', async ({ user, query }) => {
  const list = await visibleProjects(user, query.project || null);
  const [projects, phases, rows, items] = await Promise.all([
    q(`SELECT id, code, name, location FROM project WHERE id = ANY($1) ORDER BY code`, [list]),
    q(`SELECT code, name, ord FROM pl_phase ORDER BY ord`), stepRows(list),
    q(`SELECT i.id, i.name, i.step_id, i.issue_kind, i.issue_text, to_char(i.issue_at, 'YYYY-MM-DD') AS issue_at, coalesce(i.due_on, s.plan_end) AS due, i.required
      FROM pl_item i JOIN pl_step s ON s.id = i.step_id
      WHERE s.project_id = ANY($1) AND NOT i.na AND s.status NOT IN ('xong','bo_qua') AND NOT i.done AND i.ref_text IS NULL
        AND NOT EXISTS (SELECT 1 FROM pl_file f WHERE f.item_id = i.id AND f.current)
        AND (i.issue_kind IS NOT NULL OR (i.required AND coalesce(i.due_on, s.plan_end) < current_date)) ORDER BY i.ord`, [list])]);
  const t = today(), by = Object.fromEntries(rows.map(r => [r.id, r]));
  const cat = s => s.status === 'xong' ? 'xong' : s.status === 'bo_qua' ? 'bo_qua' : (s.late > 0 || s.slip > 0) ? 'cham' : ['dang', 'cho_kq'].includes(s.status) ? 'dang' : 'chua';
  // nguyên nhân vướng mắc = do người phụ trách ghi (ở công việc hoặc từng hồ sơ quá hạn); quá hạn mà chưa ai ghi → «Chưa ghi nguyên nhân»
  const NONE = "Chưa ghi nguyên nhân";
  const issuesOf = s => {
    const L = [], its = items.filter(i => i.step_id === s.id);
    if (s.issue_kind) L.push({ kind: s.issue_kind, label: ISSUE[s.issue_kind], text: s.issue_text || "", since: s.issue_since, manual: true, n: 1 });
    its.filter(i => i.issue_kind).forEach(i => L.push({ kind: i.issue_kind, label: ISSUE[i.issue_kind] || ISSUE.khac, text: i.name + (i.issue_text ? " — " + i.issue_text : ""), since: i.issue_at, manual: true, item_id: i.id, n: 1 }));
    const bare = its.filter(i => !i.issue_kind && i.required && i.due < t);
    bare.forEach(i => L.push({ kind: "chua_ghi", label: NONE, text: `Hồ sơ «${i.name}» quá hạn ${diffDays(t, i.due)} ngày (hạn ${dmy(i.due)})`, since: i.due, item_id: i.id, n: 1 }));
    if (!L.length && s.late > 0 && ["qua_han_ke_hoach", "qua_han_tra"].includes(s.late_kind))
      L.push({ kind: "chua_ghi", label: NONE, text: s.late_kind === "qua_han_tra" ? `Cơ quan quá hạn trả kết quả ${s.late} ngày` : `Công việc quá hạn ${s.late} ngày (kế hoạch xong ${dmy(s.plan_end)})`, since: s.plan_end, n: 1 });
    return L;
  };
  const out = projects.map(p => {
    const S = rows.filter(r => r.project_id === p.id && r.status !== 'bo_qua');
    const c = { xong: 0, dang: 0, cham: 0, chua: 0 }; S.forEach(s => c[cat(s)]++);
    const finish = S.map(s => s.plan_end).filter(Boolean).sort().at(-1) || null, base = S.filter(s => s.open).every(s => s.base_end) ? S.map(s => s.base_end).filter(Boolean).sort().at(-1) || null : null;
    const start = S.map(s => s.act_start || s.plan_start).filter(Boolean).sort()[0] || null;
    // độ chậm dự án = bước chậm nhất so với kế hoạch gốc của chính bước đó; chỉ có ngày gốc dự án khi mọi bước đã có kế hoạch gốc
    const noBase = S.filter(s => s.open && !s.base_end).length;
    const slip = Math.max(0, ...S.filter(s => s.open).map(s => Math.max(s.slip || 0, s.late || 0)));
    const active = S.filter(s => ['dang', 'cho_kq'].includes(s.status));
    const next = S.filter(s => s.status === 'chua').sort((a, b) => (a.plan_start || '9').localeCompare(b.plan_start || '9')).slice(0, 3);
    const ph = phases.map(x => { const P = S.filter(s => s.phase_code === x.code); return { code: x.code, name: x.name, total: P.length, done: P.filter(s => s.status === 'xong').length,
      active: P.filter(s => ['dang', 'cho_kq'].includes(s.status)).length, late: P.filter(s => cat(s) === 'cham').length }; }).filter(x => x.total);
    const cur = ph.find(x => x.done < x.total) || ph.at(-1);
    const problems = S.filter(s => s.open).flatMap(s => issuesOf(s).map(i => ({ ...i, step_id: s.id, step: s.name, slip: s.slip, late: s.late, owner: s.owner })));
    const status = !S.length ? 'chua_lap' : slip > 14 || S.some(s => s.late_kind === 'qua_han_tra' && s.late > 7) ? 'cham' : slip > 0 || problems.some(x => x.manual) ? 'canh_bao' : 'dung';
    return { ...p, no_base: noBase, total: S.length, counts: c, pct: S.length ? Math.round(c.xong / S.length * 100) : 0, start, finish, base, slip, status, phases: ph, current_phase: cur?.code || null,
      active: active.map(s => ({ id: s.id, name: s.name, status: s.status, state_name: s.state_name, plan_submit: s.plan_submit, plan_end: s.plan_end, slip: s.slip, late: s.late, late_kind: s.late_kind, req_n: s.req_n, req_ok: s.req_ok, owner: s.owner })),
      next: next.map(s => ({ id: s.id, name: s.name, plan_start: s.plan_start, plan_end: s.plan_end })),
      late_steps: S.filter(s => cat(s) === 'cham').sort((a, b) => Math.max(b.slip, b.late) - Math.max(a.slip, a.late)).map(s => ({ id: s.id, name: s.name, slip: s.slip, late: s.late, late_kind: s.late_kind, status: s.status, plan_end: s.plan_end, base_end: s.base_end })),
      problems };
  });
  const allP = out.flatMap(p => p.problems.map(x => ({ ...x, project_code: p.code })));
  const causes = Object.entries(allP.reduce((a, x) => { a[x.label] = (a[x.label] || 0) + x.n; return a; }, {})).map(([label, n]) => ({ label, n, none: label === NONE })).sort((a, b) => a.none - b.none || b.n - a.n);
  return { today: t, projects: out, causes, issue_kinds: ISSUE,
    kpi: { projects: out.length, dung: out.filter(p => p.status === 'dung').length, canh_bao: out.filter(p => p.status === 'canh_bao').length, cham: out.filter(p => p.status === 'cham').length, chua_lap: out.filter(p => p.status === 'chua_lap').length,
      steps: rows.filter(r => r.status !== 'bo_qua').length, done: rows.filter(r => r.status === 'xong').length, problems: allP.length } };
});
route('GET', '/api/plan/export.xlsx', async ({ user, query, res }) => {
  const list = await visibleProjects(user, query.project || null);
  const rows = await stepRows(list), N = id => rows.find(r => r.id === id)?.name || '';
  const buf = buildXlsx({ sheet: 'Ke hoach phap ly', boldRows: [0, 2], widths: [10, 50, 20, 34, 11, 12, 12, 12, 12, 12, 12, 10, 22, 40],
    rows: [[`CÁT TƯỜNG GROUP · KẾ HOẠCH PHÁP LÝ · ${dmy(today())}`], [], ['Dự án', 'Bước / thủ tục', 'Giai đoạn', 'Phải xong trước', 'Chuẩn bị (ngày)', 'Bắt đầu KH', 'Nộp hồ sơ KH', 'Có kết quả KH', 'Kết quả KH gốc', 'Bắt đầu TT', 'Kết quả TT', 'Lệch (ngày)', 'Trạng thái', 'Hồ sơ bắt buộc'],
      ...rows.map(s => [s.project_code, s.name, s.phase_name, s.deps.map(N).join('; '), s.prep_days, dmy(s.plan_start), dmy(s.plan_submit), dmy(s.plan_end), dmy(s.base_end), dmy(s.act_start), dmy(s.act_end), s.slip || '', s.state_name, `${s.req_ok}/${s.req_n}`])] });
  sendFile(res, buf, 'Ke-hoach-phap-ly.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}, { raw: true });

// =====================================================================================
// 1) CHECKLIST HỒ SƠ CỦA BƯỚC + tệp + AI kiểm tra
// =====================================================================================
const FILE_COLS = `f.id, f.item_id, f.name, f.mime, f.size, f.origin, f.doc_id, f.current, f.ai_status, f.ai_facts, f.ai_error, f.uploaded_at, u.full_name AS uploader`;
// các bước trước (tổ tiên theo phụ thuộc), gần nhất trước
async function ancestors(step) {
  const all = await q(`SELECT id, name, deps, status, act_end FROM pl_step WHERE project_id = $1`, [step.project_id]);
  const by = Object.fromEntries(all.map(s => [s.id, s])), out = [], seen = new Set([step.id]);
  let level = step.deps.slice();
  while (level.length) {
    const next = [];
    for (const id of level) { if (seen.has(id) || !by[id]) continue; seen.add(id); out.push(by[id]); next.push(...by[id].deps); }
    level = next;
  }
  return out;
}
route('GET', '/api/steps/:id', async ({ user, params }) => {
  const s = await stepOf(user, params.id);
  const [proc, items, files, checks, docs, rows, basis, prev] = await Promise.all([
    s.procedure_id ? one(`SELECT * FROM pl_procedure WHERE id = $1`, [s.procedure_id]) : null,
    q(`SELECT * FROM pl_item WHERE step_id = $1 ORDER BY CASE kind WHEN 'soan' THEN 0 WHEN 'dau_vao' THEN 1 ELSE 2 END, ord, created_at`, [s.id]),
    q(`SELECT ${FILE_COLS} FROM pl_file f LEFT JOIN app_user u ON u.id = f.uploaded_by WHERE f.step_id = $1 ORDER BY f.uploaded_at`, [s.id]),
    q(`SELECT c.*, u.full_name AS by_name, h.full_name AS handler, (SELECT f.name FROM pl_file f WHERE f.id = c.target_id) AS file_name FROM pl_check c LEFT JOIN app_user u ON u.id = c.created_by LEFT JOIN app_user h ON h.id = c.handled_by WHERE c.step_id = $1 ORDER BY c.created_at DESC LIMIT 40`, [s.id]),
    q(`SELECT d.id, d.item_id, d.kind, d.subject, d.status, d.by_ai, d.version, d.updated_at, d.chot_at, u.full_name AS author FROM pl_doc d LEFT JOIN app_user u ON u.id = d.created_by WHERE d.step_id = $1 ORDER BY d.created_at DESC`, [s.id]),
    stepRows([s.project_id]),
    s.procedure_id ? q(`SELECT d.number_text, d.title, d.effective_from, d.effective_to, d.src_status, b.article_text FROM pl_procedure_basis b JOIN pl_legal_doc d ON d.src_id = b.legal_src_id WHERE b.procedure_id = $1`, [s.procedure_id]) : [],
    ancestors(s),
  ]);
  const me = rows.find(r => r.id === s.id);
  const prevFiles = prev.length ? await q(`SELECT f.id, f.step_id, f.name, f.ai_facts, i.name AS item FROM pl_file f JOIN pl_item i ON i.id = f.item_id WHERE f.step_id = ANY($1) AND f.current ORDER BY f.uploaded_at`, [prev.map(p => p.id)]) : [];
  const similarSteps = s.procedure_id ? await q(`SELECT s.id, p.code AS project_code, p.name AS project_name, s.status, (SELECT count(*) FROM pl_item WHERE step_id = s.id) AS items
    FROM pl_step s JOIN project p ON p.id = s.project_id WHERE s.procedure_id = $1 AND s.id <> $2`, [s.procedure_id, s.id]) : [];
  const hh = await one(`SELECT count(*) AS n, count(DISTINCT batch) AS batches FROM pl_household WHERE project_id = $1`, [s.project_id]);
  return { ...me, procedure: proc, basis, items: items.map(i => ({ ...i, files: files.filter(f => f.item_id === i.id) })), checks, docs,
    prev: prev.map(p => ({ ...p, files: prevFiles.filter(f => f.step_id === p.id).map(({ ai_facts, ...f }) => ({ ...f, so_hieu: ai_facts?.so_hieu || '', ngay: ai_facts?.ngay_ban_hanh || '' })) })),
    similar: similarSteps, households: hh, deps_names: rows.filter(r => s.deps.includes(r.id)).map(r => ({ id: r.id, name: r.name, status: r.status })) };
});
const itemFields = b => ({ kind: oneOf(b.kind || 'dau_vao', ['dau_vao', 'soan', 'ket_qua'], 'Loại hồ sơ'), name: need(b.name, 'tên hồ sơ'), required: b.required !== false,
  basis: txt(b.basis), doc_kind: b.doc_kind ? oneOf(b.doc_kind, Object.keys(VB.LOAI), 'Loại văn bản') : null, note: txt(b.note) });
async function toTpl(user, step, f, source) {
  const proc = step.code; if (!proc) return;
  const dup = await one(`SELECT 1 FROM pl_tpl WHERE procedure_code = $1 AND lower(name) = lower($2)`, [proc, f.name]);
  if (!dup) await q(`INSERT INTO pl_tpl (procedure_code, kind, name, required, basis, source, doc_kind, ord, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,500,$8)`, [proc, f.kind, f.name, f.required, f.basis, source, f.doc_kind, user.id]);
}
route('POST', '/api/steps/:id/items', async ({ user, params, body }) => {
  const s = await stepOf(user, params.id, ...W);
  const list = Array.isArray(body.items) ? body.items : [body];
  const out = [];
  for (const b of list) {
    const f = itemFields(b), source = b.source === 'ai' ? 'ai' : 'nguoi_dung';
    out.push(await one(`INSERT INTO pl_item (step_id, kind, name, required, basis, source, doc_kind, note, ord, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,(SELECT coalesce(max(ord),0)+10 FROM pl_item WHERE step_id=$1),$9) RETURNING id`, [s.id, f.kind, f.name, f.required, f.basis, source, f.doc_kind, f.note, user.id]));
    if (b.save_tpl) await toTpl(user, s, f, source);
  }
  await log(user, s.project_id, 'item', s.id, 'add', String(out.length));
  return out;
});
route('PUT', '/api/items/:id', async ({ user, params, body }) => {
  const i = await itemOf(user, params.id, ...W);
  const f = itemFields({ ...i, ...body });
  await q(`UPDATE pl_item SET kind=$2, name=$3, required=$4, basis=$5, doc_kind=$6, note=$7, na=$8, ref_text=$9 WHERE id=$1`,
    [i.id, f.kind, f.name, f.required, f.basis, f.doc_kind, f.note, !!body.na, txt(body.ref_text)]);
  return { ok: true };
});
route('DELETE', '/api/items/:id', async ({ user, params }) => {
  const i = await itemOf(user, params.id, ...W);
  const files = await q(`SELECT stored FROM pl_file WHERE item_id = $1`, [i.id]);
  if (files.length && !(await perms(user, i.project_id)).duyet) bad('Mục đã có tệp — chỉ Người duyệt xóa được; hoặc đánh dấu «Không áp dụng»');
  await q(`DELETE FROM pl_item WHERE id = $1`, [i.id]);
  files.forEach(f => fs.rmSync(path.join(FILES, f.stored), { force: true }));
  return { ok: true };
});
// lấy checklist của cùng thủ tục ở dự án khác (hồ sơ tương tự đã thực hiện)
route('POST', '/api/steps/:id/copy-from', async ({ user, params, body }) => {
  const s = await stepOf(user, params.id, ...W);
  const src = await stepOf(user, uid(body.from_step_id) || bad('Chọn bước nguồn'));
  const have = new Set((await q(`SELECT lower(name) AS n FROM pl_item WHERE step_id = $1`, [s.id])).map(r => r.n));
  let n = 0;
  for (const i of await q(`SELECT * FROM pl_item WHERE step_id = $1 AND NOT na ORDER BY ord`, [src.id])) {
    if (have.has(i.name.toLowerCase())) continue;
    await q(`INSERT INTO pl_item (step_id, kind, name, required, basis, source, form_code, doc_kind, tag, note, ord, created_by) VALUES ($1,$2,$3,$4,$5,'du_an_khac',$6,$7,$8,$9,$10,$11)`,
      [s.id, i.kind, i.name, i.required, i.basis, i.form_code, i.doc_kind, i.tag, 'Lấy từ hồ sơ dự án khác', i.ord + 1000, user.id]); n++;
  }
  return { added: n };
});
route('POST', '/api/steps/:id/save-tpl', async ({ user, params }) => {
  const s = await stepOf(user, params.id, ...W); libEditor(user);
  let n = 0;
  for (const i of await q(`SELECT * FROM pl_item WHERE step_id = $1 AND tpl_id IS NULL AND NOT na`, [s.id])) {
    const before = await one(`SELECT count(*) AS n FROM pl_tpl WHERE procedure_code = $1`, [s.code]);
    await toTpl(user, s, i, 'du_an_khac');
    if ((await one(`SELECT count(*) AS n FROM pl_tpl WHERE procedure_code = $1`, [s.code])).n > before.n) n++;
  }
  return { added: n };
});

// ---------- checklist dạng ô đánh dấu: đã có / còn thiếu / hạn nộp / quá hạn ----------
route('GET', '/api/checklist', async ({ user, query }) => {
  await must(user, query.project);
  const rows = await q(`SELECT i.id, i.name, i.kind, i.required, i.done, i.done_at, i.ref_text, i.note, i.basis, coalesce(i.due_on, s.plan_end) AS due, i.supp, i.reason, i.req_by, i.start_on, i.created_at,
      i.issue_kind, i.issue_text, i.issue_at, iu.full_name AS issue_by_name,
      s.id AS step_id, s.name AS step, s.section, s.sheet, s.stt, s.status AS step_status, s.plan_start, s.plan_end, s.ord, d.full_name AS done_name,
      (SELECT count(*) FROM pl_file f WHERE f.item_id = i.id AND f.current) AS files,
      (SELECT json_agg(json_build_object('id', f.id, 'name', f.name) ORDER BY f.uploaded_at) FROM pl_file f WHERE f.item_id = i.id AND f.current) AS file_list,
      (SELECT json_build_object('id', e.id, 'status', e.status, 'new_due', e.new_due) FROM pl_extend e WHERE e.item_id = i.id AND e.status <> 'rut' ORDER BY e.created_at DESC LIMIT 1) AS ext
    FROM pl_item i JOIN pl_step s ON s.id = i.step_id LEFT JOIN app_user d ON d.id = i.done_by LEFT JOIN app_user iu ON iu.id = i.issue_by
    WHERE s.project_id = $1 AND NOT i.na AND s.status <> 'bo_qua' ORDER BY s.ord, s.created_at, i.ord, i.created_at`, [query.project]);
  const t = today(), in7 = addDays(t, 7);
  return { today: t, items: rows.map(r => { const ok = r.done || !!r.ref_text || r.files > 0;
    const state = ok ? 'da_co' : !r.due || !r.required ? 'thieu' : r.due < t ? 'qua_han' : r.due === t ? 'hom_nay' : r.due <= in7 ? 'sap_den' : 'thieu';
    return { ...r, ok, state, late: state === 'qua_han' ? diffDays(t, r.due) : 0 }; }) };
});
// hồ sơ bổ sung: mỗi dòng nội dung là một hồ sơ, cùng lý do, nơi yêu cầu và thời hạn
// cu = chỉ bổ sung hồ sơ cũ của bước trước (không tải tệp mới): không bắt lý do / hạn
const suppFields = (b, cu) => {
  const start_on = date(b.start_on, 'Làm từ ngày'), due_on = date(b.due_on, 'Hạn bổ sung', !cu);
  return { reason: cu ? txt(b.reason) || 'Bổ sung hồ sơ đã có ở bước trước' : need(b.reason, 'lý do bổ sung'), req_by: txt(b.req_by), start_on, due_on, note: txt(b.note) };
};
route('POST', '/api/supp', async ({ user, body }) => {
  // công việc: theo id (mở từ một bước) hoặc tên người dùng tự gõ — trùng tên công việc có sẵn thì gắn vào, không thì tạo công việc mới
  let s;
  if (uid(body.step_id)) s = await stepOf(user, body.step_id, ...W);
  else {
    const pid = body.project_id; await must(user, pid, ...W);
    const name = need(body.step_name, 'công việc cần bổ sung hồ sơ').replace(/^\s*[\dIVX.]+\s*[.)-]?\s+/, '').replace(/\s+/g, ' ').trim();
    const key = x => String(x || '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
    const all = await q(`SELECT * FROM pl_step WHERE project_id = $1 ORDER BY ord`, [pid]);
    s = all.find(x => key(x.name) === key(name)) || all.find(x => key(x.name).includes(key(name)) && key(name).length >= 6);
    if (!s) s = await one(`INSERT INTO pl_step (project_id, code, name, ord, prep_days, proc_days, status, act_start, owner_id, note)
      VALUES ($1,'BO-SUNG',$2,(SELECT coalesce(max(ord),0)+10 FROM pl_step WHERE project_id=$1),0,0,'dang',current_date,$3,'Tạo khi lập hồ sơ bổ sung') RETURNING *`, [pid, name, user.id]);
  }
  const names = (Array.isArray(body.names) ? body.names : String(body.names || '').split('\n')).map(x => String(x).replace(/^\s*[-–•+]\s*/, '').trim()).filter(Boolean);
  // hồ sơ đã có ở các bước trước (tra cứu rồi tick): chép sang công việc này cùng tệp, số văn bản, dấu «đã có»
  const from = (Array.isArray(body.from_items) ? body.from_items : []).filter(uid);
  const src = from.length ? await q(`SELECT i.*, s.name AS step FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE i.id = ANY($1) AND s.project_id = $2 AND i.step_id <> $3`, [from, s.project_id, s.id]) : [];
  if (!names.length && !src.length) bad('Tải lên hồ sơ cần bổ sung hoặc chọn hồ sơ của bước trước');
  const f = suppFields(body, !names.length);
  const ids = [];
  for (const n of names)
    ids.push((await one(`INSERT INTO pl_item (step_id, kind, name, required, source, supp, reason, req_by, start_on, due_on, note, ord, created_by)
      VALUES ($1,'dau_vao',$2,true,'nguoi_dung',true,$3,$4,$5,$6,$7,(SELECT coalesce(max(ord),0)+10 FROM pl_item WHERE step_id=$1),$8) RETURNING id`, [s.id, n, f.reason, f.req_by, f.start_on, f.due_on, f.note, user.id])).id);
  let copied = 0, missing = false;
  for (const o of from.map(id => src.find(x => x.id === id)).filter(Boolean)) await tx(async t => {
    const it = await t.one(`INSERT INTO pl_item (step_id, kind, name, required, source, supp, reason, req_by, start_on, due_on, note, ref_text, done, done_at, done_by, ord, created_by)
      VALUES ($1,'dau_vao',$2,true,'nguoi_dung',true,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $9 THEN now() END,CASE WHEN $9 THEN $10::uuid END,(SELECT coalesce(max(ord),0)+10 FROM pl_item WHERE step_id=$1),$10) RETURNING id`,
      [s.id, o.name, f.reason, f.req_by, f.start_on, f.due_on, f.note || `Lấy từ công việc «${o.step}»`, o.ref_text, !!o.done, user.id]);
    // chép tệp thật (không dùng chung) để xóa tệp ở một bên không mất bên kia; giữ kết quả AI đã đọc
    for (const x of await t.q(`SELECT * FROM pl_file WHERE item_id = $1 AND current ORDER BY uploaded_at`, [o.id])) {
      let buf; try { buf = fs.readFileSync(path.join(FILES, x.stored)); } catch { continue; }
      await t.q(`INSERT INTO pl_file (item_id, step_id, name, mime, size, stored, ai_status, ai_facts, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [it.id, s.id, x.name, x.mime, buf.length, store(buf), ['xong', 'tat', 'bo_qua'].includes(x.ai_status) ? x.ai_status : 'bo_qua', x.ai_facts, user.id]);
      copied++;
    }
    if (!o.done && !o.ref_text && !(await t.one(`SELECT count(*)::int AS n FROM pl_file WHERE item_id = $1`, [it.id])).n) missing = true;
    ids.push(it.id);
  });
  if (copied) syncDisk();
  // việc đã xong / đang chờ kết quả mà phải bổ sung → quay về «đang chuẩn bị hồ sơ»
  // chỉ chép hồ sơ đã có sang thì không mở lại công việc
  if (['xong', 'cho_kq'].includes(s.status) && body.reopen !== false && (names.length || missing)) await q(`UPDATE pl_step SET status = 'dang', act_end = NULL, updated_at = now() WHERE id = $1`, [s.id]);
  await log(user, s.project_id, 'supp', s.id, 'create', `${names.length + src.length} hồ sơ${src.length ? ` (${src.length} lấy từ bước trước)` : ''} · ${f.reason}`);
  await schedule(s.project_id, {});
  return { added: names.length + src.length, from: src.length, copied, ids, step_id: s.id };
});
route('PUT', '/api/supp/:id', async ({ user, params, body }) => {
  const i = await itemOf(user, params.id, ...W);
  if (!i.supp) bad('Không phải hồ sơ bổ sung');
  const f = suppFields(body);
  await q(`UPDATE pl_item SET name=$2, reason=$3, req_by=$4, start_on=$5, due_on=$6, note=$7 WHERE id=$1`, [i.id, need(body.name, 'nội dung hồ sơ'), f.reason, f.req_by, f.start_on, f.due_on, f.note]);
  return { ok: true };
});
route('POST', '/api/items/:id/done', async ({ user, params, body }) => {
  const i = await itemOf(user, params.id, ...W);
  const done = !!body.done;
  await q(`UPDATE pl_item SET done = $2, done_at = CASE WHEN $2 THEN now() END, done_by = CASE WHEN $2 THEN $3::uuid END WHERE id = $1`, [i.id, done, user.id]);
  // đủ toàn bộ hồ sơ bắt buộc của việc → gợi ý hoàn thành (không tự đổi trạng thái)
  const s = (await stepRows([i.project_id])).find(r => r.id === i.step_id);
  await log(user, i.project_id, 'item', i.id, done ? 'done' : 'undone', i.name);
  return { ok: true, step_complete: !!s && s.req_n > 0 && s.req_ok === s.req_n && s.kq_ok === s.kq_n, step_status: s?.status };
});
route('POST', '/api/plan/:id/import', async ({ user, params, req }) => {
  await must(user, params.id, ...W);
  const { files, fields } = await readUpload(req, 1); const f = files[0] || bad('Chưa chọn tệp Excel');
  if (!/\.xlsx$/i.test(f.name)) bad('Chọn tệp Excel .xlsx');
  const r = await tx(t => importPlan(t, params.id, f.buffer, user.id, { replace: fields.replace !== '0' }));
  await schedule(params.id, {});
  // việc không có ngày trong tệp: ngày hệ thống ước tính làm kế hoạch gốc
  await q(`UPDATE pl_step SET base_start = plan_start, base_end = plan_end WHERE project_id = $1 AND base_end IS NULL AND plan_end IS NOT NULL AND status NOT IN ('xong','bo_qua')`, [params.id]);
  await log(user, params.id, 'plan', null, 'import_xlsx', `${f.name}: ${r.steps} việc, ${r.items} hồ sơ`);
  return r;
}, { multipart: true });

// ---------- tệp ----------
route('POST', '/api/items/:id/files', async ({ user, params, req }) => {
  const i = await itemOf(user, params.id, ...W);
  const { files, fields } = await readUpload(req);
  if (!files.length) bad('Chưa chọn tệp');
  const replace = uid(fields.replace);
  const ids = [];
  await tx(async t => {
    if (replace) await t.q(`UPDATE pl_file SET current = false WHERE id = $1 AND item_id = $2`, [replace, i.id]);
    for (const f of files) {
      const r = await t.one(`INSERT INTO pl_file (item_id, step_id, name, mime, size, stored, ai_status, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [i.id, i.step_id, f.name, f.mime, f.buffer.length, store(f.buffer), AI.enabled() ? 'cho' : 'tat', user.id]);
      ids.push(r.id);
    }
  });
  await log(user, i.project_id, 'file', i.id, 'upload', files.map(f => f.name).join('; '));
  afterUpload(i, ids, user);
  syncDisk();
  return { ids, ai: AI.enabled() };
}, { multipart: true });
route('GET', '/api/file/:id', async ({ user, params, query, res }) => {
  const f = notFound(await one(`SELECT f.*, s.project_id FROM pl_file f JOIN pl_step s ON s.id = f.step_id WHERE f.id = $1`, [params.id]), 'tệp');
  await must(user, f.project_id);
  const p = path.join(FILES, f.stored);
  if (!fs.existsSync(p)) throw new HttpError(404, 'Tệp không còn trên máy chủ');
  const inline = !query.dl && /^(application\/pdf|image\/)/.test(f.mime || '');
  res.writeHead(200, { 'Content-Type': f.mime || 'application/octet-stream', 'Cache-Control': 'private, max-age=600',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(f.name)}"; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  fs.createReadStream(p).pipe(res);
}, { raw: true });
route('DELETE', '/api/files/:id', async ({ user, params }) => {
  const f = notFound(await one(`SELECT f.*, s.project_id FROM pl_file f JOIN pl_step s ON s.id = f.step_id WHERE f.id = $1`, [params.id]), 'tệp');
  await must(user, f.project_id, ...W);
  if (f.origin === 'du_thao' && f.current) bad('Tệp của văn bản đã chốt — mở lại văn bản ở tab Dự thảo để thay');
  await q(`DELETE FROM pl_file WHERE id = $1`, [f.id]);
  fs.rmSync(path.join(FILES, f.stored), { force: true });
  if (f.disk_path) {
    fs.rmSync(f.disk_path, { force: true });
    // thư mục hồ sơ trên máy không còn tệp nào thì xóa luôn thư mục trống
    try { const dir = path.dirname(f.disk_path); if (dir.startsWith(HOSO_DIR) && !fs.readdirSync(dir).length) fs.rmdirSync(dir); } catch {}
  }
  return { ok: true };
});
route('POST', '/api/files/:id/ai', async ({ user, params, body }) => {
  const f = notFound(await one(`SELECT f.*, s.project_id FROM pl_file f JOIN pl_step s ON s.id = f.step_id WHERE f.id = $1`, [params.id]), 'tệp');
  await must(user, f.project_id, ...W);
  if (!AI.enabled()) bad('AI đang tắt (chưa có ANTHROPIC_API_KEY)');
  if (body.what === 'check') { const i = await one(`SELECT * FROM pl_item WHERE id = $1`, [f.item_id]); return startCheck(user, { ...i, project_id: f.project_id }, i.kind === 'ket_qua' ? 'ket_qua' : 'tep', f.id); }
  await q(`UPDATE pl_file SET ai_status = 'cho', ai_error = NULL WHERE id = $1`, [f.id]);
  enqueue(() => extractFile(f.id));
  return { ok: true };
});

// ---------- hàng đợi AI (chạy nền, tối đa 2 việc cùng lúc) ----------
const jobs = []; let running = 0;
function enqueue(fn) { jobs.push(fn); pump(); }
function pump() {
  while (running < 2 && jobs.length) {
    const fn = jobs.shift(); running++;
    Promise.resolve().then(fn).catch(e => console.error('AI:', e.message)).finally(() => { running--; pump(); });
  }
}
async function extractFile(id) {
  const f = await one(`SELECT f.*, i.name AS item FROM pl_file f JOIN pl_item i ON i.id = f.item_id WHERE f.id = $1`, [id]);
  if (!f || !AI.enabled()) return;
  await q(`UPDATE pl_file SET ai_status = 'dang' WHERE id = $1`, [id]);
  try {
    const facts = await AI.extract(f, readStored(f.stored), f.item);
    await q(`UPDATE pl_file SET ai_status = 'xong', ai_facts = $2, ai_error = NULL WHERE id = $1`, [id, JSON.stringify(facts)]);
  } catch (e) { await q(`UPDATE pl_file SET ai_status = 'loi', ai_error = $2 WHERE id = $1`, [id, String(e.message).slice(0, 500)]); }
}
// sau khi tải lên: AI đọc từng tệp; tệp kết quả → AI đối chiếu với bước trước; đủ hồ sơ bắt buộc → AI kiểm tra cả bước
function afterUpload(item, ids, user) {
  if (!AI.enabled()) return;
  enqueue(async () => {
    await Promise.all(ids.map(extractFile));
    if (item.kind === 'ket_qua') { for (const id of ids) await runCheck(await newCheck(user, item.step_id, 'ket_qua', id)); return; }
    // hồ sơ đầu vào / văn bản tải lên: AI kiểm tra ngay từng tệp (đối chiếu hồ sơ cùng bước, bước trước, quy định hiện hành)
    for (const id of ids) await runCheck(await newCheck(user, item.step_id, 'tep', id));
    // chỉ việc đọc tệp cuối cùng của đợt tải mới kích hoạt kiểm tra (tránh kiểm tra trùng khi tải nhiều tệp liên tiếp)
    const pending = await one(`SELECT 1 FROM pl_file WHERE step_id = $1 AND current AND ai_status IN ('cho','dang')`, [item.step_id]);
    if (pending) return;
    const s = (await stepRows([item.project_id])).find(r => r.id === item.step_id);
    const recent = await one(`SELECT 1 FROM pl_check c WHERE c.step_id = $1 AND c.kind = 'ho_so' AND (c.status = 'dang' OR c.created_at > (SELECT max(uploaded_at) FROM pl_file WHERE step_id = $1 AND current))`, [item.step_id]);
    if (s && s.req_n && s.req_ok === s.req_n && !recent) await runCheck(await newCheck(user, item.step_id, 'ho_so', null));
  });
}
const newCheck = (user, stepId, kind, target) => one(`INSERT INTO pl_check (step_id, kind, target_id, created_by) VALUES ($1,$2,$3,$4) RETURNING id`, [stepId, kind, target, user?.id || null]).then(r => r.id);
async function startCheck(user, step, kind, target) {
  if (!AI.enabled()) bad('AI đang tắt (chưa có ANTHROPIC_API_KEY trong .env)');
  const id = await newCheck(user, step.step_id || step.id, kind, target);
  enqueue(() => runCheck(id));
  return { id };
}

// ngữ cảnh cho AI: dự án, bước, căn cứ, checklist, tóm tắt hồ sơ bước này và các bước trước, thư viện văn bản
const EFF = { 'Còn hiệu lực': 'còn hiệu lực', 'Hết hiệu lực': 'HẾT hiệu lực', 'Chưa có hiệu lực': 'chưa có hiệu lực', 'Còn hiệu lực một phần': 'còn hiệu lực một phần' };
const effText = d => (d.effective_to && d.effective_to < today()) ? 'HẾT hiệu lực' : (d.effective_from && d.effective_from > today()) ? 'chưa có hiệu lực' : EFF[d.src_status] || 'chưa xác định';
const factsText = f => f ? [f.loai_van_ban, f.so_hieu && 'số ' + f.so_hieu, f.ngay_ban_hanh && 'ngày ' + dmy(f.ngay_ban_hanh), f.co_quan_ban_hanh, f.trich_yeu && '«' + f.trich_yeu + '»'].filter(Boolean).join(', ')
  + (f.tom_tat ? `\n    Tóm tắt: ${f.tom_tat}` : '') + (f.thong_tin?.length ? `\n    Thông số: ${f.thong_tin.map(x => `${x.ten}: ${x.gia_tri}`).join('; ')}` : '') + (f.can_cu?.length ? `\n    Căn cứ viện dẫn: ${f.can_cu.join('; ')}` : '') + (f.chat_luong ? `\n    Chất lượng bản scan: ${f.chat_luong}` : '') : '(chưa trích được nội dung)';
const KIND_NAME = { dau_vao: 'Hồ sơ đầu vào', soan: 'Văn bản CĐT soạn', ket_qua: 'Kết quả' };
async function stepContext(step, { withLibrary = true } = {}) {
  const info = await projInfo(step.project_id), p = info.project;
  const proc = step.procedure_id ? await one(`SELECT * FROM pl_procedure WHERE id = $1`, [step.procedure_id]) : null;
  const items = await q(`SELECT * FROM pl_item WHERE step_id = $1 ORDER BY kind, ord`, [step.id]);
  const files = await q(`SELECT * FROM pl_file WHERE step_id = $1 AND current ORDER BY uploaded_at`, [step.id]);
  const prev = await ancestors(step);
  const pf = prev.length ? await q(`SELECT f.*, i.name AS item, s.name AS step FROM pl_file f JOIN pl_item i ON i.id = f.item_id JOIN pl_step s ON s.id = f.step_id WHERE f.step_id = ANY($1) AND f.current ORDER BY s.ord, f.uploaded_at`, [prev.map(x => x.id)]) : [];
  const prevRefs = prev.length ? await q(`SELECT i.name, i.ref_text, s.name AS step FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE i.step_id = ANY($1) AND i.ref_text IS NOT NULL`, [prev.map(x => x.id)]) : [];
  const basis = step.procedure_id ? await q(`SELECT d.*, b.article_text FROM pl_procedure_basis b JOIN pl_legal_doc d ON d.src_id = b.legal_src_id WHERE b.procedure_id = $1`, [step.procedure_id]) : [];
  const parts = [`Hôm nay: ${dmy(today())}`,
    `## DỰ ÁN\n${p.code} — ${p.name}\nĐịa điểm: ${p.location || ''}\nChủ đầu tư: ${info.cdt}${info.dia_chi ? '\nĐịa chỉ CĐT: ' + info.dia_chi : ''}${p.investor ? '\nNhà đầu tư: ' + p.investor : ''}${info.ubnd ? '\nUBND cấp xã nơi có dự án: ' + info.ubnd : ''}${info.don_vi_bt ? '\nĐơn vị làm nhiệm vụ BTHT: ' + info.don_vi_bt : ''}`,
    `## BƯỚC ĐANG XỬ LÝ\n${step.name}${proc ? `\nMã thủ tục: ${proc.code}\nCơ quan: ${proc.agency_text || ''}\nKết quả: ${proc.result_text || ''}\nThời hạn: ${proc.deadline_text || ''}\nCăn cứ (danh mục QLDA): ${proc.basis_text || ''}` : ''}`,
    '### Căn cứ pháp lý của thủ tục\n' + (basis.map(d => `- ${d.number_text || d.code} ${d.title}${d.article_text ? ' — ' + d.article_text : ''} (${effText(d)})`).join('\n') || '(chưa có)'),
    '### Checklist hồ sơ của bước\n' + items.map(i => `- [${KIND_NAME[i.kind]}] ${i.name}${i.required ? '' : ' (không bắt buộc)'}${i.na ? ' — KHÔNG ÁP DỤNG' : ''}${i.basis ? ' | căn cứ: ' + i.basis : ''} | ${files.some(f => f.item_id === i.id) ? 'ĐÃ CÓ TỆP: ' + files.filter(f => f.item_id === i.id).map(f => '«' + f.name + '»').join(', ') : i.ref_text ? 'đã có văn bản số ' + i.ref_text + ' (chưa có tệp)' : 'CHƯA CÓ'}`).join('\n'),
    '### Nội dung đã trích từ các tệp của bước này\n' + (files.map(f => `- «${f.name}» (mục: ${items.find(i => i.id === f.item_id)?.name || ''}): ${factsText(f.ai_facts)}`).join('\n') || '(chưa có tệp)'),
    '## HỒ SƠ CÁC BƯỚC TRƯỚC\n' + (prev.map(s => `### ${s.name} (${ST_NAME[s.status]}${s.act_end ? ', xong ' + dmy(s.act_end) : ''})\n` +
      ([...pf.filter(f => f.step_id === s.id).map(f => `- «${f.name}» (${f.item}): ${factsText(f.ai_facts)}`), ...prevRefs.filter(r => r.step === s.name).map(r => `- ${r.name}: văn bản số ${r.ref_text} (chưa có tệp)`)].join('\n') || '- (chưa có hồ sơ)')).join('\n') || '(không có bước trước)')];
  if (withLibrary) {
    const docs = await q(`SELECT * FROM pl_legal_doc ORDER BY issued_on DESC NULLS LAST`);
    parts.push('## THƯ VIỆN VĂN BẢN PHÁP LUẬT\n' + docs.map(d => `- ${d.number_text || d.code} | ${d.title} | ban hành ${dmy(d.issued_on)} | ${effText(d)}`).join('\n'));
  }
  return { text: parts.join('\n\n'), files, items, info };
}
async function runCheck(id) {
  const c = await one(`SELECT * FROM pl_check WHERE id = $1`, [id]); if (!c) return;
  const step = await one(`SELECT * FROM pl_step WHERE id = $1`, [c.step_id]);
  try {
    const ctx = await stepContext(step);
    const pack = (fs_) => fs_.map(f => ({ name: f.name, label: `${f.name} — ${ctx.items.find(i => i.id === f.item_id)?.name || ''}`, mime: f.mime, buffer: readStored(f.stored) }));
    let r;
    if (c.kind === 'ho_so') r = await AI.check(ctx.text, pack(ctx.files.filter(f => ctx.items.find(i => i.id === f.item_id)?.kind !== 'ket_qua')));
    else if (c.kind === 'tep') {
      const f = notFound(await one(`SELECT f.*, i.name AS item FROM pl_file f JOIN pl_item i ON i.id = f.item_id WHERE f.id = $1`, [c.target_id]), 'tệp');
      r = await AI.checkFile(ctx.text, f, readStored(f.stored));
    } else if (c.kind === 'ket_qua') {
      const f = notFound(await one(`SELECT * FROM pl_file WHERE id = $1`, [c.target_id]), 'tệp kết quả');
      r = await AI.checkResult(ctx.text, f, readStored(f.stored), pack(ctx.files.filter(x => x.id !== f.id && ctx.items.find(i => i.id === x.item_id)?.kind !== 'ket_qua')));
    } else {
      const d = notFound(await one(`SELECT * FROM pl_doc WHERE id = $1`, [c.target_id]), 'văn bản');
      r = await AI.checkDraft(ctx.text, docPlain(d), pack(ctx.files.filter(x => ctx.items.find(i => i.id === x.item_id)?.kind === 'dau_vao')));
    }
    const { _sent, _skipped, ...result } = r;
    await q(`UPDATE pl_check SET status = 'xong', result = $2, files = $3, done_at = now() WHERE id = $1`, [id, JSON.stringify(result), JSON.stringify({ sent: _sent || [], skipped: _skipped || [] })]);
  } catch (e) { await q(`UPDATE pl_check SET status = 'loi', error = $2, done_at = now() WHERE id = $1`, [id, String(e.message).slice(0, 500)]); }
}
route('POST', '/api/steps/:id/check', async ({ user, params }) => { const s = await stepOf(user, params.id, ...W); return startCheck(user, s, 'ho_so', null); });
route('PUT', '/api/checks/:id', async ({ user, params, body }) => {
  const c = notFound(await one(`SELECT c.*, s.project_id FROM pl_check c JOIN pl_step s ON s.id = c.step_id WHERE c.id = $1`, [params.id]), 'kết quả kiểm tra');
  await must(user, c.project_id, ...W);
  if (c.status === 'dang') bad('AI đang kiểm tra');
  const handled = body.handled !== false;
  await q(`UPDATE pl_check SET status = $2, handled_by = $3, handled_at = now(), handled_note = $4 WHERE id = $1`, [c.id, handled ? 'da_xu_ly' : 'xong', user.id, txt(body.note)]);
  return { ok: true };
});
// AI đề xuất bổ sung checklist từ văn bản luật mới / yêu cầu riêng của chuyên viên, cơ quan
route('POST', '/api/suggest', async ({ user, req }) => {
  const { files, fields } = await readUpload(req, 1);
  if (!AI.enabled()) bad('AI đang tắt (chưa có ANTHROPIC_API_KEY trong .env)');
  let list, title;
  if (uid(fields.step_id)) { const s = await stepOf(user, fields.step_id, ...W); list = await q(`SELECT kind, name, required, basis FROM pl_item WHERE step_id = $1 ORDER BY kind, ord`, [s.id]); title = s.name; }
  else { libEditor(user); const code = need(fields.procedure_code, 'thủ tục'); list = await q(`SELECT kind, name, required, basis FROM pl_tpl WHERE procedure_code = $1 ORDER BY kind, ord`, [code]); title = (await one(`SELECT name FROM pl_procedure WHERE code = $1`, [code]))?.name || code; }
  const text = txt(fields.text);
  if (!text && !files.length) bad('Dán nội dung văn bản / yêu cầu, hoặc chọn tệp văn bản luật');
  const ctx = `Thủ tục: ${title}\n` + list.map(i => `- [${KIND_NAME[i.kind]}] ${i.name}${i.required ? '' : ' (không bắt buộc)'}${i.basis ? ' | ' + i.basis : ''}`).join('\n');
  const r = await AI.suggest(ctx, text, files[0] || null, files[0]?.buffer);
  await log(user, null, 'suggest', null, 'ai', title);
  return r;
}, { multipart: true });

// ---------- xuất bộ hồ sơ để in / ký / nộp ----------
const PRINTABLE = f => /pdf/i.test(f.mime || '') || /\.pdf$/i.test(f.name) ? 'pdf' : /^image\/(jpe?g|png)$/i.test(f.mime || '') || /\.(jpe?g|png)$/i.test(f.name) ? 'image' : null;
route('POST', '/api/steps/:id/bundle', async ({ user, params, body, res }) => {
  const s = await stepOf(user, params.id);
  const info = await projInfo(s.project_id);
  const ids = (Array.isArray(body.file_ids) ? body.file_ids : []).filter(uid);
  if (!ids.length) bad('Chọn ít nhất một tệp để xuất');
  const rows = await q(`SELECT f.*, i.name AS item, i.kind FROM pl_file f JOIN pl_item i ON i.id = f.item_id WHERE f.step_id = $1 AND f.id = ANY($2)`, [s.id, ids]);
  const files = ids.map(id => rows.find(r => r.id === id)).filter(Boolean);
  const fmt = oneOf(body.format || 'pdf', ['pdf', 'zip'], 'Định dạng');
  const title = txt(body.title) || `HỒ SƠ ${s.name.toUpperCase()}`;
  const parts = files.map(f => ({ f, kind: PRINTABLE(f), buffer: readStored(f.stored), mime: f.mime }));
  for (const p of parts) p.pages = p.kind === 'pdf' ? await PDF.pageCount(p.buffer) : p.kind === 'image' ? 1 : 0;
  let page = 2;   // trang 1 = danh mục
  const T = 'border:1px solid #000;padding:3pt 5pt;vertical-align:top', td = (v, c = '') => `<td style="${T}${c ? ';' + c : ''}">${v}</td>`;
  const listRows = parts.map((p, i) => {
    const fr = page; if (p.kind) page += p.pages || 0; const fa = p.f.ai_facts || {};
    return `<tr>${td(i + 1, 'text-align:center')}${td(VB.esc(p.f.item) + (p.f.item !== p.f.name ? `<br><i style="font-size:11pt">${VB.esc(p.f.name)}</i>` : ''))}${td(VB.esc([fa.so_hieu, fa.ngay_ban_hanh && dmy(fa.ngay_ban_hanh)].filter(Boolean).join(' · ')))}${td(p.kind ? (p.pages > 1 ? `${fr}–${fr + p.pages - 1}` : fr) : 'kèm tệp gốc', 'text-align:center')}${td(VB.esc(body.notes?.[p.f.id] || ''))}</tr>`;
  }).join('');
  const cover = `<div style="font-family:'Times New Roman';font-size:13pt;color:#000"><table style="width:100%;border-collapse:collapse"><tr><td style="width:45%;text-align:center;vertical-align:top"><b>${VB.esc(String(info.cdt || '').toUpperCase())}</b><br><span style="display:inline-block;width:30%;border-top:1px solid #000"></span></td>
    <td style="text-align:center;vertical-align:top"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b><br><span style="display:inline-block;width:50%;border-top:1px solid #000"></span></td></tr></table>
    <p style="text-align:center;font-weight:bold;font-size:15pt;margin:26pt 0 4pt">${VB.esc(title)}</p><p style="text-align:center;margin:0">Dự án: ${VB.esc(info.project.name)}</p>
    ${body.recipient ? `<p style="text-align:center;margin:4pt 0 0">Kính gửi: ${VB.esc(body.recipient)}</p>` : ''}
    <p style="text-align:center;font-weight:bold;margin:18pt 0 6pt">DANH MỤC HỒ SƠ</p>
    <table style="width:100%;border-collapse:collapse;font-size:12pt"><thead><tr>${['STT', 'Tên tài liệu', 'Số, ngày văn bản', 'Trang', 'Ghi chú'].map(h => `<th style="${T};text-align:center">${h}</th>`).join('')}</tr></thead>
    <tbody>${listRows}</tbody></table>
    <p style="margin-top:10pt;font-size:12pt"><i>Tổng số: ${parts.length} tài liệu${parts.some(p => !p.kind) ? ' (tài liệu ghi «kèm tệp gốc» là tệp Word/Excel — in riêng hoặc dùng bản ZIP)' : ''}. Lập ngày ${dmy(today())}.</i></p></div>`;
  const coverPdf = await PDF.htmlToPdf(VB.page([cover], title));
  const fname = safeName(`${info.project.code} - ${s.name}`);
  if (fmt === 'pdf') {
    const m = await PDF.mergeParts([{ kind: 'pdf', buffer: coverPdf }, ...parts.filter(p => p.kind)]);
    await log(user, s.project_id, 'bundle', s.id, 'pdf', String(parts.length));
    return sendFile(res, m.buffer, fname + '.pdf', 'application/pdf');
  }
  const z = zip([['00 - Danh muc ho so.pdf', coverPdf], ...parts.map((p, i) => [`${String(i + 1).padStart(2, '0')} - ${safeName(p.f.item).slice(0, 70)}${extOf(p.f.name)}`, p.buffer])]);
  await log(user, s.project_id, 'bundle', s.id, 'zip', String(parts.length));
  sendFile(res, z, fname + '.zip', 'application/zip');
}, { raw: true });

// =====================================================================================
// 2) SOẠN DỰ THẢO VĂN BẢN
// =====================================================================================
const J = v => JSON.stringify(VB.lines(v));
const docPlain = d => [d.issuer, d.unit, d.number_text, `${d.place || ''}, ${d.date_text || ''}`, (VB.LOAI[d.kind]?.name || '').toUpperCase(), d.subject, d.authority,
  ...(d.bases || []), (d.recipients || []).length ? 'Kính gửi: ' + d.recipients.join('; ') : '', d.body, 'Nơi nhận: ' + (d.receivers || []).join('; '), ...(d.signers || []).map(s => `${s.title} ${s.name || ''}`)].filter(Boolean).join('\n');
function docDefaults(kind, info, step) {
  const yr = today().slice(0, 4), ab = info.viet_tat || '[CĐT]', sym = VB.LOAI[kind]?.sym;
  return { issuer: '', unit: info.cdt || '[TÊN CHỦ ĐẦU TƯ]', number_text: kind === 'don' ? '' : `Số:        /${yr}/${sym ? sym + '-' : ''}${ab}${sym ? '' : '-' + (info.don_vi_soan || 'BQLDA')}`,
    place: info.place || '[Địa danh]', date_text: `ngày      tháng      năm ${yr}`, recipients: step.agency_text ? [agencyName(step.agency_text)] : [], receivers: ['Như trên;', `Lưu: VT, ${info.don_vi_soan || 'BQLDA'}.`],
    signers: [{ title: kind === 'to_trinh' ? (info.don_vi_soan === 'BQLDA' ? 'TRƯỞNG BAN QUẢN LÝ DỰ ÁN' : info.chuc_vu_ky) : info.chuc_vu_ky, name: info.nguoi_ky }] };
}
let AGENCY = [];
const agencyName = s => String(s || '').replace(/CQ-[A-Z0-9-]+/g, c => { const a = AGENCY.find(x => x.code === c); return a ? a.name : c; }).split(/[;(]/)[0].trim();
function templateBody(kind, info, step, item, req) {
  const p = info.project, cdt = info.cdt || '[Tên chủ đầu tư]', to = agencyName(step.agency_text) || '[cơ quan có thẩm quyền]';
  const intro = `${cdt} là chủ đầu tư dự án ${p.name} tại ${info.dia_diem || '[địa điểm]'}.`;
  const R = req ? `\n${req}` : '';
  return {
    cong_van: `${intro}\nCăn cứ [các văn bản pháp lý của dự án đã có];\nĐể triển khai thủ tục «${step.name}» theo quy định, ${cdt} kính đề nghị ${to} xem xét, giải quyết nội dung sau:${R || '\n[Nội dung đề nghị cụ thể]'}\n(Hồ sơ kèm theo: theo danh mục đính kèm.)\n${cdt} trân trọng đề nghị ${to} xem xét, giải quyết./.`,
    to_trinh: `Căn cứ [quy định pháp luật, văn bản pháp lý của dự án];\nCăn cứ tình hình thực hiện dự án ${p.name}.\n1. Sự cần thiết\n[Nêu sự cần thiết của «${item?.name || step.name}»]\n2. Nội dung đề xuất${R || '\n[Nội dung trình cụ thể]'}\n3. Kiến nghị\nKính trình [cấp có thẩm quyền] xem xét, phê duyệt./.`,
    don: `Tên chủ đầu tư: ${cdt}\nĐịa chỉ: ${info.dia_chi || '[…]'}\nNgười đại diện: ${info.nguoi_ky || '[…]'}, chức vụ: ${info.chuc_vu_ky || '[…]'}\nTên dự án: ${p.name}\nĐịa điểm: ${info.dia_diem || '[…]'}\nNội dung đề nghị: ${item?.name || step.name}${R}\nChúng tôi cam kết chịu trách nhiệm về tính chính xác của hồ sơ và thực hiện đúng quy định./.`,
    quyet_dinh: `Điều 1. [Nội dung quyết định]${R}\nĐiều 2. [Tổ chức thực hiện]\nĐiều 3. Quyết định này có hiệu lực kể từ ngày ký. [Các đơn vị, cá nhân có liên quan] chịu trách nhiệm thi hành Quyết định này./.`,
    thong_bao: `${intro}\n[Nội dung thông báo]${R}\nTrân trọng thông báo./.`,
    bao_cao: `I. TÌNH HÌNH THỰC HIỆN\n[…]${R}\nII. KHÓ KHĂN, VƯỚNG MẮC\n[…]\nIII. KIẾN NGHỊ, ĐỀ XUẤT\n[…]`,
    ke_hoach: `I. MỤC ĐÍCH, YÊU CẦU\n[…]\nII. NỘI DUNG, TIẾN ĐỘ THỰC HIỆN\n[…]${R}\nIII. TỔ CHỨC THỰC HIỆN\n[…]`,
    bien_ban: `Hôm nay, ngày … tháng … năm …, tại […], chúng tôi gồm:\n1. Đại diện [bên A]: […]\n2. Đại diện [bên B]: […]\nCùng thống nhất nội dung sau:${R || '\n[…]'}\nBiên bản được lập thành … bản có giá trị pháp lý như nhau./.`,
    giay_uy_quyen: `Bên ủy quyền: ${cdt}\nBên được ủy quyền: […]\nNội dung ủy quyền: […]${R}\nThời hạn ủy quyền: […]`,
  }[kind];
}
const DOC_Q = `SELECT d.*, s.project_id, s.name AS step_name, p.code AS project_code, i.name AS item_name, u.full_name AS author, c.full_name AS chot_name
  FROM pl_doc d JOIN pl_step s ON s.id = d.step_id JOIN project p ON p.id = s.project_id LEFT JOIN pl_item i ON i.id = d.item_id
  LEFT JOIN app_user u ON u.id = d.created_by LEFT JOIN app_user c ON c.id = d.chot_by`;
const docOf = async (user, id, ...roles) => { const d = notFound(await one(`${DOC_Q} WHERE d.id = $1`, [id]), 'văn bản'); await must(user, d.project_id, ...roles); return d; };
route('GET', '/api/docs', async ({ user, query }) => {
  const list = await visibleProjects(user, query.project || null);
  return q(`SELECT d.id, d.step_id, d.item_id, d.kind, d.subject, d.status, d.by_ai, d.version, d.updated_at, d.chot_at, s.name AS step_name, p.code AS project_code, i.name AS item_name, u.full_name AS author,
    (SELECT result FROM pl_check c WHERE c.kind = 'du_thao' AND c.target_id = d.id AND c.status IN ('xong','da_xu_ly') ORDER BY c.created_at DESC LIMIT 1) AS last_check
    FROM pl_doc d JOIN pl_step s ON s.id = d.step_id JOIN project p ON p.id = s.project_id LEFT JOIN pl_item i ON i.id = d.item_id LEFT JOIN app_user u ON u.id = d.created_by
    WHERE s.project_id = ANY($1) ORDER BY d.updated_at DESC`, [list]);
});
route('GET', '/api/docs/:id', async ({ user, params }) => {
  const d = await docOf(user, params.id);
  const checks = await q(`SELECT * FROM pl_check WHERE kind = 'du_thao' AND target_id = $1 ORDER BY created_at DESC LIMIT 10`, [d.id]);
  return { ...d, checks, sources: await docSources(d.step_id) };
});
// nguồn soạn thảo: hồ sơ đã có của bước này và các bước trước (nội dung AI đã trích) + căn cứ pháp lý của thủ tục
async function docSources(stepId) {
  const step = await one(`SELECT * FROM pl_step WHERE id = $1`, [stepId]);
  const prev = await ancestors(step), ids = [step.id, ...prev.map(x => x.id)];
  const files = await q(`SELECT f.id, f.name, f.step_id, f.ai_facts, f.origin, i.name AS item, s.name AS step, s.stt FROM pl_file f JOIN pl_item i ON i.id = f.item_id JOIN pl_step s ON s.id = f.step_id
    WHERE f.step_id = ANY($1) AND f.current AND (f.origin IS DISTINCT FROM 'du_thao' OR f.step_id <> $2) ORDER BY (f.step_id = $2) DESC, s.ord DESC, f.uploaded_at`, [ids, step.id]);
  const refs = await q(`SELECT i.name, i.ref_text, s.name AS step FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE i.step_id = ANY($1) AND coalesce(trim(i.ref_text), '') <> ''`, [ids]);
  const basis = step.procedure_id ? await q(`SELECT d.number_text, d.code, d.title, d.issued_on, d.effective_from, d.effective_to, d.src_status, b.article_text FROM pl_procedure_basis b JOIN pl_legal_doc d ON d.src_id = b.legal_src_id WHERE b.procedure_id = $1`, [step.procedure_id]) : [];
  const f_ = x => x.ai_facts || {};
  return {
    files: files.map(x => ({ id: x.id, name: x.name, item: x.item, step: x.step, same: x.step_id === step.id, loai: f_(x).loai_van_ban || '', so: f_(x).so_hieu || '', ngay: f_(x).ngay_ban_hanh || '', co_quan: f_(x).co_quan_ban_hanh || '', trich_yeu: f_(x).trich_yeu || '', tom_tat: f_(x).tom_tat || '' })),
    refs, basis: basis.map(b => ({ so: b.number_text || b.code, title: b.title, ngay: b.issued_on, dieu: b.article_text, hieu_luc: effText(b) })),
  };
}
// AI soạn lại dự thảo đang có: lấy hồ sơ mới nhất + tra cứu quy định mới nhất; giữ loại, trích yếu, mục checklist
route('POST', '/api/docs/:id/redraft', async ({ user, params, body }) => {
  const d = await docOf(user, params.id, ...W);
  if (d.status === 'chot') bad('Văn bản đã chốt — bấm «Mở lại» trước');
  if (!AI.enabled()) bad('AI đang tắt (chưa có ANTHROPIC_API_KEY trong .env)');
  const s = await one(`SELECT * FROM pl_step WHERE id = $1`, [d.step_id]), item = d.item_id ? await one(`SELECT * FROM pl_item WHERE id = $1`, [d.item_id]) : null;
  const request = [txt(d.request), txt(body.request)].filter(Boolean).join('\n') || null;
  const { d: x } = await buildDoc(s, item, { kind: d.kind, subject: d.subject, request, use_ai: true });
  await q(`UPDATE pl_doc SET auto=false, by_ai=true, request=$2, unit=$3, number_text=$4, place=$5, date_text=$6, subject=$7, authority=$8, bases=$9, recipients=$10, body=$11, receivers=$12, signers=$13, cites=$14, to_check=$15, version=version+1, updated_at=now() WHERE id=$1`,
    [d.id, request, x.unit, x.number_text, x.place, x.date_text, x.subject, x.authority, J(x.bases), J(x.recipients), x.body, J(x.receivers), JSON.stringify(x.signers), JSON.stringify(x.cites), JSON.stringify(x.to_check)]);
  await log(user, d.project_id, 'doc', d.id, 'ai_redraft', x.subject);
  return docOf(user, d.id);
});
// dữ liệu điền mẫu: số liệu bồi thường và số hiệu văn bản kết quả đã có của dự án
async function mauCtx(s, info, item) {
  const [ho, kqs, items] = await Promise.all([
    one(`SELECT count(*) AS n, sum(dt_thu_hoi) AS dt, sum(tong) AS tong FROM pl_household WHERE project_id = $1`, [s.project_id]),
    q(`SELECT i.name, i.ref_text FROM pl_item i JOIN pl_step st ON st.id = i.step_id WHERE st.project_id = $1 AND i.kind = 'ket_qua' AND coalesce(trim(i.ref_text), '') <> ''`, [s.project_id]),
    q(`SELECT name, kind, na FROM pl_item WHERE step_id = $1 ORDER BY ord, created_at`, [s.id])]);
  return { info, item, step: { ...s, items }, ho: ho?.n ? ho : null, kq: re => kqs.find(k => re.test(k.name))?.ref_text.trim() || null };
}
async function buildDoc(s, item, body) {
  const info = await projInfo(s.project_id), mau = MAU.find(item, s);
  const kind = oneOf(body.kind || mau?.kind || item?.doc_kind || 'cong_van', Object.keys(VB.LOAI), 'Loại văn bản'), dv = docDefaults(kind, info, s);
  const subject = txt(body.subject) || item?.name || s.name, request = txt(body.request);
  const form = item?.form_code ? await one(`SELECT * FROM pl_form WHERE code = $1`, [item.form_code]) : null;
  const useAi = body.use_ai !== false && AI.enabled();
  let d = { ...dv, subject, authority: kind === 'quyet_dinh' ? '[THẨM QUYỀN BAN HÀNH]' : null, bases: [], body: templateBody(kind, info, s, item, request), cites: [], to_check: ['Mẫu soạn sẵn (không dùng AI): điền các chỗ […] và kiểm tra căn cứ trước khi trình ký.'] };
  // mẫu riêng của hồ sơ (đúng thủ tục, căn cứ mới nhất); trích yếu người dùng gõ khác tên mục thì giữ
  if (mau && kind === mau.kind) {
    const m = mau.make(await mauCtx(s, info, item));
    d = { ...d, ...m, subject: body.subject && body.subject !== item?.name ? subject : m.subject, body: m.body + (request ? '\n' + request : ''),
      // văn bản chủ đầu tư gửi cơ quan ngoài: người đại diện theo pháp luật ký
      signers: m.signers || [{ title: info.chuc_vu_ky, name: info.nguoi_ky }], receivers: m.receivers || (kind === 'don' ? [] : dv.receivers),
      to_check: [...(m.to_check || []), ...(kind !== 'don' && (!info.viet_tat || !info.nguoi_ky) ? ['Chưa có tên viết tắt / họ tên người ký của chủ đầu tư — cập nhật ở Kế hoạch pháp lý › Khác › Thông tin chủ đầu tư.'] : []), 'Điền các chỗ «[cần bổ sung: …]» trước khi chốt.'] };
  }
  if (useAi) {
    const ctx = await stepContext(s);
    const spec = [`Loại văn bản: ${VB.LOAI[kind].name.toUpperCase()}`, `Văn bản cho mục checklist: ${item?.name || subject}`, form && `Biểu mẫu áp dụng: ${form.name}${form.legal_number ? ' (kèm ' + form.legal_number + ')' : ''}`,
      `Đơn vị ban hành: ${dv.unit}`, `Kính gửi dự kiến: ${d.recipients.join('; ') || '(AI xác định theo thủ tục)'}`, `Người ký: ${d.signers[0].title} ${d.signers[0].name || ''}`,
      `Trích yếu dự kiến: ${d.subject}`, mau && `Khung mẫu bắt buộc giữ (căn cứ, đề mục, nội dung) — điền dữ liệu từ hồ sơ vào các chỗ [cần bổ sung]:\n${d.bases.join('\n')}\n${d.body}`, request && `Yêu cầu của người soạn:\n${request}`].filter(Boolean).join('\n');
    const inputs = ctx.files.filter(f => ctx.items.find(i => i.id === f.item_id)?.kind === 'dau_vao').map(f => ({ name: f.name, mime: f.mime, buffer: readStored(f.stored) }));
    const a = await AI.draft(ctx.text, spec, inputs);
    d = { ...d, subject: txt(a.trich_yeu) || d.subject, recipients: VB.lines(a.kinh_gui).length ? VB.lines(a.kinh_gui) : d.recipients, authority: txt(a.tham_quyen) || d.authority,
      bases: VB.lines(a.can_cu).length ? VB.lines(a.can_cu) : d.bases, body: a.noi_dung || d.body, receivers: VB.lines(a.noi_nhan).length ? VB.lines(a.noi_nhan) : d.receivers,
      signers: [{ title: txt(a.chuc_vu_ky) || d.signers[0].title, name: d.signers[0].name }], cites: [...new Set([...(d.cites || []), ...(a.nguon || [])])], to_check: a.can_kiem_tra || d.to_check };
  }
  return { kind, form, request, d, useAi, mau: !!mau };
}
// user = null: hệ thống tự soạn (auto = true, còn tự cập nhật tới khi có người sửa / chốt)
async function createDoc(user, s, item, body) {
  const { kind, form, request, d, useAi } = await buildDoc(s, item, body);
  const r = await one(`INSERT INTO pl_doc (step_id, item_id, kind, form_code, request, issuer, unit, number_text, place, date_text, subject, authority, bases, recipients, body, receivers, signers, cites, to_check, by_ai, created_by, auto)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id`,
    [s.id, item?.id || null, kind, form?.code || null, request, d.issuer, d.unit, d.number_text, d.place, d.date_text, d.subject, d.authority, J(d.bases), J(d.recipients), d.body, J(d.receivers),
      JSON.stringify(d.signers), JSON.stringify(d.cites), JSON.stringify(d.to_check), useAi, user?.id || null, !user]);
  await log(user, s.project_id, 'doc', r.id, !user ? 'auto_draft' : useAi ? 'ai_draft' : 'template', d.subject);
  return r.id;
}
// Tự động: bước tới kỳ xử lý theo ngày kế hoạch → tự soạn đủ hồ sơ phải soạn theo mẫu; dự thảo hệ thống soạn chưa ai sửa
// được soạn lại theo dữ liệu mới nhất (thông tin CĐT, số QĐ đã có trong checklist, bảng bồi thường, ngày kế hoạch).
const autoAt = {};
async function autoDocs(pid, force) {
  if (!force && autoAt[pid] > Date.now() - 120e3) return { made: 0, updated: 0 };
  autoAt[pid] = Date.now();
  const rows = await q(`SELECT i.id AS item_id, s.id AS step_id, (SELECT d.id FROM pl_doc d WHERE d.item_id = i.id ORDER BY d.updated_at DESC LIMIT 1) AS doc_id,
      (SELECT d.auto AND d.status = 'nhap' FROM pl_doc d WHERE d.item_id = i.id ORDER BY d.updated_at DESC LIMIT 1) AS refresh
    FROM pl_item i JOIN pl_step s ON s.id = i.step_id
    WHERE s.project_id = $1 AND i.kind = 'soan' AND NOT i.na AND NOT i.done AND coalesce(trim(i.ref_text), '') = '' AND ${OPEN_STEP} ORDER BY s.ord, i.ord`, [pid, today()]);
  let made = 0, updated = 0;
  for (const r of rows) {
    if (r.doc_id && !r.refresh) continue;
    const s = await one(`SELECT * FROM pl_step WHERE id = $1`, [r.step_id]), item = await one(`SELECT * FROM pl_item WHERE id = $1`, [r.item_id]);
    if (!r.doc_id) { await createDoc(null, s, item, { use_ai: false }); made++; continue; }
    const { kind, d } = await buildDoc(s, item, { use_ai: false });
    const u = await one(`UPDATE pl_doc SET kind=$2, unit=$3, number_text=$4, place=$5, date_text=$6, subject=$7, authority=$8, bases=$9, recipients=$10, body=$11, receivers=$12, signers=$13, cites=$14, to_check=$15, updated_at=now()
      WHERE id=$1 AND auto AND status='nhap' AND (body IS DISTINCT FROM $11 OR bases IS DISTINCT FROM $9 OR signers IS DISTINCT FROM $13 OR number_text IS DISTINCT FROM $4 OR recipients IS DISTINCT FROM $10 OR subject IS DISTINCT FROM $7) RETURNING id`,
      [r.doc_id, kind, d.unit, d.number_text, d.place, d.date_text, d.subject, d.authority, J(d.bases), J(d.recipients), d.body, J(d.receivers), JSON.stringify(d.signers), JSON.stringify(d.cites), JSON.stringify(d.to_check)]);
    if (u) updated++;
  }
  return { made, updated };
}
const autoAll = async () => { for (const p of await q(`SELECT id FROM project`)) await autoDocs(p.id, true).catch(e => console.error('Tự soạn văn bản:', e.message)); };
route('POST', '/api/docs', async ({ user, body }) => {
  const s = await stepOf(user, uid(body.step_id) || bad('Thiếu bước'), ...W);
  const item = uid(body.item_id) ? await one(`SELECT * FROM pl_item WHERE id = $1 AND step_id = $2`, [body.item_id, s.id]) : null;
  return docOf(user, await createDoc(user, s, item, body));
});
// bước đang xử lý theo ngày kế hoạch của dự án (cùng khung với màn Hôm nay): chưa xong và đã tới ngày bắt đầu kế hoạch, hoặc đang làm / chờ kết quả
const OPEN_STEP = `s.status NOT IN ('xong','bo_qua') AND (s.status IN ('dang','cho_kq') OR s.plan_start <= $2)`;
route('GET', '/api/docs-pending', async ({ user, query }) => {
  await must(user, query.project);
  await autoDocs(query.project);
  const t = today();
  const steps = await q(`SELECT s.id, s.name, s.status, s.plan_start, s.plan_submit, s.plan_end, ph.name AS phase, ph.ord AS phase_ord,
      (SELECT coalesce(json_agg(json_build_object('id', i.id, 'name', i.name, 'doc_kind', i.doc_kind, 'done', i.done OR coalesce(trim(i.ref_text), '') <> '',
         'doc', (SELECT json_build_object('id', d.id, 'status', d.status) FROM pl_doc d WHERE d.item_id = i.id ORDER BY d.updated_at DESC LIMIT 1)) ORDER BY i.ord), '[]')
       FROM pl_item i WHERE i.step_id = s.id AND i.kind = 'soan' AND NOT i.na) AS items
    FROM pl_step s LEFT JOIN pl_phase ph ON ph.code = s.phase_code WHERE s.project_id = $1 AND ${OPEN_STEP} ORDER BY ph.ord, s.plan_start NULLS LAST, s.ord`, [query.project, t]);
  return { today: t, steps: steps.map(s => ({ ...s, in_window: !!(s.plan_start && s.plan_start <= t && (!s.plan_end || s.plan_end >= t)), late: !!(s.plan_end && s.plan_end < t) })) };
});
// cập nhật ngay (không chờ lượt tự động)
route('POST', '/api/docs/auto', async ({ user, body }) => { await must(user, body.project, ...W); return autoDocs(body.project, true); });
route('PUT', '/api/docs/:id', async ({ user, params, body }) => {
  const d = await docOf(user, params.id, ...W);
  if (d.status === 'chot') bad('Văn bản đã chốt — bấm «Mở lại» để sửa');
  const signers = (Array.isArray(body.signers) ? body.signers : []).map(s => ({ title: String(s?.title || '').trim(), name: String(s?.name || '').trim() })).filter(s => s.title || s.name);
  await q(`UPDATE pl_doc SET auto=false, kind=$2, issuer=$3, unit=$4, number_text=$5, place=$6, date_text=$7, subject=$8, authority=$9, bases=$10, recipients=$11, body=$12, receivers=$13, signers=$14, updated_at=now() WHERE id=$1`,
    [d.id, oneOf(body.kind || d.kind, Object.keys(VB.LOAI), 'Loại văn bản'), txt(body.issuer), txt(body.unit), txt(body.number_text), txt(body.place), txt(body.date_text), need(body.subject, 'trích yếu'),
      txt(body.authority), J(body.bases), J(body.recipients), String(body.body ?? ''), J(body.receivers), JSON.stringify(signers)]);
  return docOf(user, d.id);
});
route('POST', '/api/docs/:id/check', async ({ user, params }) => {
  const d = await docOf(user, params.id, ...W);
  return startCheck(user, { id: d.step_id }, 'du_thao', d.id);
});
// bản in: PDF đúng thể thức do máy chủ dàn trang (không có dòng ngày giờ, tiêu đề, địa chỉ trang mà trình duyệt tự thêm khi in).
// Bản nháp đang mở in theo nội dung đang sửa (chưa lưu); máy chủ tự trình bày bằng VB.render — không nhận HTML từ trình duyệt.
route('POST', '/api/docs/:id/pdf', async ({ user, params, body, res }) => {
  const d = await docOf(user, params.id);
  const arr = v => VB.lines(v);
  const x = d.status === 'chot' || !body?.subject ? d : { ...d, kind: Object.keys(VB.LOAI).includes(body.kind) ? body.kind : d.kind,
    issuer: txt(body.issuer), unit: txt(body.unit), number_text: txt(body.number_text), place: txt(body.place), date_text: txt(body.date_text),
    subject: String(body.subject), authority: txt(body.authority), bases: arr(body.bases), recipients: arr(body.recipients), body: String(body.body ?? ''),
    receivers: arr(body.receivers), signers: (Array.isArray(body.signers) ? body.signers : []).map(s => ({ title: String(s?.title || ''), name: String(s?.name || '') })).filter(s => s.title || s.name) };
  const pdf = await PDF.htmlToPdf(VB.page([VB.render(x)], x.subject));
  sendFile(res, pdf, safeName(`${VB.LOAI[x.kind]?.name || 'Văn bản'} - ${x.subject}`).slice(0, 100) + '.pdf', 'application/pdf', true);
}, { raw: true });
// chốt: in PDF theo thể thức, gắn vào checklist (tạo mục «Văn bản CĐT soạn» nếu chưa gắn)
route('POST', '/api/docs/:id/chot', async ({ user, params }) => {
  const d = await docOf(user, params.id, ...W);
  if (d.status === 'chot') bad('Văn bản đã chốt');
  if (/\[[^\]\n]{1,200}\]/.test(docPlain(d))) bad('Văn bản còn chỗ trống dạng […] / [cần bổ sung …] — điền đủ trước khi chốt');
  const pdf = await PDF.htmlToPdf(VB.page([VB.render(d)], d.subject));
  const name = safeName(`${VB.LOAI[d.kind].name} - ${d.subject}`).slice(0, 100) + '.pdf';
  await tx(async t => {
    let itemId = d.item_id;
    if (!itemId) itemId = (await t.one(`INSERT INTO pl_item (step_id, kind, name, required, source, doc_kind, ord, created_by) VALUES ($1,'soan',$2,true,'nguoi_dung',$3,(SELECT coalesce(max(ord),0)+10 FROM pl_item WHERE step_id=$1),$4) RETURNING id`,
      [d.step_id, `${VB.LOAI[d.kind].name}: ${d.subject}`, d.kind, user.id])).id;
    await t.q(`UPDATE pl_file SET current = false WHERE item_id = $1 AND doc_id = $2`, [itemId, d.id]);
    await t.q(`INSERT INTO pl_file (item_id, step_id, name, mime, size, stored, origin, doc_id, ai_status, ai_facts, uploaded_by) VALUES ($1,$2,$3,'application/pdf',$4,$5,'du_thao',$6,'bo_qua',$7,$8)`,
      [itemId, d.step_id, name, pdf.length, store(pdf), d.id, JSON.stringify({ loai_van_ban: VB.LOAI[d.kind].name, so_hieu: d.number_text || '', ngay_ban_hanh: '', co_quan_ban_hanh: d.unit || '', nguoi_ky: (d.signers[0]?.title || '') + ' ' + (d.signers[0]?.name || ''),
        trich_yeu: d.subject, tom_tat: String(d.body).slice(0, 600), thong_tin: [], can_cu: d.bases, chat_luong: 'Văn bản dự thảo đã chốt trong hệ thống (chưa ký)' }), user.id]);
    await t.q(`UPDATE pl_doc SET status = 'chot', item_id = $2, chot_by = $3, chot_at = now() WHERE id = $1`, [d.id, itemId, user.id]);
  });
  await log(user, d.project_id, 'doc', d.id, 'chot', d.subject);
  return docOf(user, d.id);
});
route('POST', '/api/docs/:id/reopen', async ({ user, params }) => {
  const d = await docOf(user, params.id, ...W);
  if (d.status !== 'chot') bad('Văn bản chưa chốt');
  await q(`UPDATE pl_file SET current = false WHERE doc_id = $1`, [d.id]);
  await q(`UPDATE pl_doc SET status = 'nhap', version = version + 1, chot_by = NULL, chot_at = NULL WHERE id = $1`, [d.id]);
  return docOf(user, d.id);
});
route('DELETE', '/api/docs/:id', async ({ user, params }) => {
  const d = await docOf(user, params.id, ...W);
  if (d.status === 'chot') bad('Văn bản đã chốt — mở lại trước khi xóa');
  await q(`DELETE FROM pl_doc WHERE id = $1`, [d.id]);
  return { ok: true };
});
route('GET', '/api/docs/:id/pdf', async ({ user, params, res }) => {
  const d = await docOf(user, params.id);
  sendFile(res, await PDF.htmlToPdf(VB.page([VB.render(d)], d.subject)), safeName(d.subject) + '.pdf', 'application/pdf', true);
}, { raw: true });

// =====================================================================================
// 3) CHỨC NĂNG RIÊNG: bảng tổng hợp phương án bồi thường được duyệt → văn bản từng hộ
// =====================================================================================
const HO_FIELDS = { stt: 'STT', ma_ho: 'Mã hộ', ho_ten: 'Họ và tên chủ hộ', cccd: 'Số CCCD', dia_chi: 'Địa chỉ', thua: 'Thửa đất số', to_bd: 'Tờ bản đồ số', loai_dat: 'Loại đất',
  dt_thu_hoi: 'Diện tích thu hồi (m²)', tien_dat: 'Bồi thường đất (đ)', tien_ts: 'Bồi thường tài sản, cây cối (đ)', tien_ht: 'Hỗ trợ (đ)', tien_khac: 'Khác (đ)', tong: 'Tổng cộng (đ)' };
const HO_GUESS = [['stt', /^(stt|tt|số tt)$/], ['ma_ho', /mã hộ|mã số|^mã/], ['ho_ten', /họ.*tên|chủ hộ|chủ sử dụng|tên hộ/], ['cccd', /cccd|cmnd|căn cước|định danh/], ['dia_chi', /địa chỉ|nơi ở|thường trú/],
  ['thua', /thửa/], ['to_bd', /tờ/], ['loai_dat', /loại đất|mục đích/], ['dt_thu_hoi', /diện tích|dt thu hồi|m2|m²/], ['tien_dat', /(bồi thường|bt).*đất|tiền đất/],
  ['tien_ts', /tài sản|cây|hoa màu|công trình|vật kiến trúc/], ['tien_ht', /hỗ trợ/], ['tien_khac', /khác|thưởng/], ['tong', /tổng|cộng|thành tiền|tổng số tiền/]];
function guessMap(rows) {
  let best = { row: 0, score: -1, map: {} };
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const map = {}, used = new Set();
    (rows[r] || []).forEach((c, ci) => { const h = String(c || '').toLowerCase().trim(); if (!h) return;
      for (const [k, re] of HO_GUESS) if (!used.has(k) && re.test(h)) { map[k] = ci; used.add(k); break; } });
    const score = Object.keys(map).length + (map.ho_ten != null ? 3 : 0);
    if (score > best.score) best = { row: r, score, map };
  }
  return { header_row: best.row, map: best.map };
}
route('POST', '/api/households/parse', async ({ user, req }) => {
  const { files } = await readUpload(req, 1); const f = files[0] || bad('Chưa chọn tệp Excel');
  if (!/\.xlsx$/i.test(f.name)) bad('Chọn tệp Excel .xlsx (nếu là .xls, mở bằng Excel và lưu lại dạng .xlsx)');
  void user;
  const sheets = readXlsx(f.buffer).map(s => ({ name: s.name, rows: s.rows.slice(0, 2000), guess: guessMap(s.rows) }));
  return { file: f.name, sheets, fields: HO_FIELDS };
}, { multipart: true });
route('POST', '/api/households/import', async ({ user, body }) => {
  await must(user, body.project_id, ...W);
  const batch = need(body.batch, 'đợt'), rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) bad('Không có dòng dữ liệu');
  let n = 0;
  await tx(async t => {
    if (body.replace !== false) await t.q(`DELETE FROM pl_household WHERE project_id = $1 AND batch = $2`, [body.project_id, batch]);
    for (const [i, r] of rows.entries()) {
      const ten = txt(r.ho_ten); if (!ten) continue;
      if (/^(tổng|cộng)/i.test(ten)) continue;
      await t.q(`INSERT INTO pl_household (project_id, batch, stt, ma_ho, ho_ten, cccd, dia_chi, thua, to_bd, loai_dat, dt_thu_hoi, tien_dat, tien_ts, tien_ht, tien_khac, tong, extra, src_file, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [body.project_id, batch, int(r.stt, 'STT', 0, 1e6) ?? i + 1, txt(r.ma_ho), ten, txt(r.cccd), txt(r.dia_chi), txt(r.thua), txt(r.to_bd), txt(r.loai_dat), num(r.dt_thu_hoi),
          num(r.tien_dat), num(r.tien_ts), num(r.tien_ht), num(r.tien_khac), num(r.tong), JSON.stringify(r.extra || {}), txt(body.file), user.id]);
      n++;
    }
  });
  await log(user, body.project_id, 'household', null, 'import', `${batch}: ${n}`);
  return { imported: n };
});
// kiểm tra số liệu bảng tổng hợp (không cần AI): thiếu thông tin, cộng sai, trùng
function hoIssues(rows) {
  const out = [], seen = {};
  for (const h of rows) {
    const p = [];
    if (!h.dia_chi) p.push('thiếu địa chỉ'); if (!h.thua || !h.to_bd) p.push('thiếu số thửa / tờ bản đồ'); if (h.dt_thu_hoi == null) p.push('thiếu diện tích thu hồi');
    if (h.tong == null) p.push('thiếu tổng tiền');
    const parts = [h.tien_dat, h.tien_ts, h.tien_ht, h.tien_khac].filter(v => v != null);
    if (parts.length && h.tong != null) { const sum = parts.reduce((a, b) => a + Number(b), 0); if (Math.abs(sum - Number(h.tong)) > 1) p.push(`tổng ${VB.tien(h.tong)} ≠ cộng các khoản ${VB.tien(sum)}`); }
    const key = (h.thua || '') + '/' + (h.to_bd || ''); if (h.thua && h.to_bd) { if (seen[key]) p.push(`trùng thửa ${key} với hộ ${seen[key]}`); else seen[key] = h.ho_ten; }
    if (p.length) out.push({ id: h.id, ho_ten: h.ho_ten, issues: p });
  }
  return out;
}
route('GET', '/api/households', async ({ user, query }) => {
  await must(user, query.project);
  const rows = await q(`SELECT * FROM pl_household WHERE project_id = $1 ORDER BY batch, stt, ho_ten`, [query.project]);
  const batches = [...new Set(rows.map(r => r.batch))];
  const cfg = await getSetting('pl_ho_cfg:' + query.project, null);
  const info = await projInfo(query.project);
  const tagSteps = await q(`SELECT i.tag, s.id AS step_id, s.name AS step, i.id AS item_id, i.name AS item FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE s.project_id = $1 AND i.tag IS NOT NULL`, [query.project]);
  return { rows, batches, issues: hoIssues(rows), cfg, info, loai: VB.HO_LOAI, mau: VB.HO_MAU, bases: VB.HO_BASES, targets: tagSteps,
    total: rows.reduce((a, r) => a + Number(r.tong || 0), 0) };
});
route('PUT', '/api/households/:id', async ({ user, params, body }) => {
  const h = notFound(await one(`SELECT * FROM pl_household WHERE id = $1`, [params.id]), 'hộ'); await must(user, h.project_id, ...W);
  await q(`UPDATE pl_household SET stt=$2, ma_ho=$3, ho_ten=$4, cccd=$5, dia_chi=$6, thua=$7, to_bd=$8, loai_dat=$9, dt_thu_hoi=$10, tien_dat=$11, tien_ts=$12, tien_ht=$13, tien_khac=$14, tong=$15 WHERE id=$1`,
    [h.id, int(body.stt, 'STT', 0, 1e6), txt(body.ma_ho), need(body.ho_ten, 'họ tên'), txt(body.cccd), txt(body.dia_chi), txt(body.thua), txt(body.to_bd), txt(body.loai_dat), num(body.dt_thu_hoi),
      num(body.tien_dat), num(body.tien_ts), num(body.tien_ht), num(body.tien_khac), num(body.tong)]);
  return { ok: true };
});
route('DELETE', '/api/households/:id', async ({ user, params }) => {
  const h = notFound(await one(`SELECT * FROM pl_household WHERE id = $1`, [params.id]), 'hộ'); await must(user, h.project_id, ...W);
  await q(`DELETE FROM pl_household WHERE id = $1`, [h.id]); return { ok: true };
});
route('PUT', '/api/households-cfg/:id', async ({ user, params, body }) => {
  await must(user, params.id, ...W);
  await putSetting('pl_ho_cfg:' + params.id, body.cfg || {});
  return { ok: true };
});
route('POST', '/api/households/export', async ({ user, body, res }) => {
  const pid = body.project_id; await must(user, pid);
  const loai = oneOf(body.loai, Object.keys(VB.HO_LOAI), 'Loại văn bản');
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter(uid);
  const rows = await q(`SELECT * FROM pl_household WHERE project_id = $1 AND ($2::text IS NULL OR batch = $2) AND (cardinality($3::uuid[]) = 0 OR id = ANY($3)) ORDER BY batch, stt, ho_ten`, [pid, txt(body.batch), ids]);
  if (!rows.length) bad('Không có hộ nào để xuất');
  const cfg = body.cfg || {};
  await putSetting('pl_ho_cfg:' + pid, cfg);
  const html = VB.page(rows.map((h, i) => VB.hoHtml(loai, h, cfg, i)), VB.HO_LOAI[loai]);
  const pdf = await PDF.htmlToPdf(html);
  const name = safeName(`${VB.HO_LOAI[loai]}${body.batch ? ' - ' + body.batch : ''} (${rows.length} hộ)`) + '.pdf';
  const item = uid(body.save_item) ? await one(`SELECT i.*, s.project_id FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE i.id = $1`, [body.save_item]) : null;
  if (item) {
    await must(user, item.project_id, ...W);
    if (item.project_id !== pid) bad('Mục checklist không thuộc dự án');
    await q(`INSERT INTO pl_file (item_id, step_id, name, mime, size, stored, origin, ai_status, ai_facts, uploaded_by) VALUES ($1,$2,$3,'application/pdf',$4,$5,'xuat_ho','bo_qua',$6,$7)`,
      [item.id, item.step_id, name, pdf.length, store(pdf), JSON.stringify({ loai_van_ban: VB.HO_LOAI[loai], so_hieu: '', ngay_ban_hanh: '', co_quan_ban_hanh: cfg.unit || '', nguoi_ky: '', trich_yeu: `${rows.length} hộ${body.batch ? ', ' + body.batch : ''}`,
        tom_tat: `Xuất từ bảng tổng hợp phương án bồi thường: ${rows.length} hộ, tổng ${VB.tien(rows.reduce((a, r) => a + Number(r.tong || 0), 0))} đồng.`, thong_tin: [{ ten: 'Số hộ', gia_tri: String(rows.length) }, { ten: 'Tổng tiền', gia_tri: VB.tien(rows.reduce((a, r) => a + Number(r.tong || 0), 0)) }], can_cu: [], chat_luong: '' }), user.id]);
  }
  await log(user, pid, 'household', null, 'export_' + loai, String(rows.length));
  sendFile(res, pdf, name, 'application/pdf');
}, { raw: true });

// =====================================================================================
// Thư viện checklist mẫu theo thủ tục
// =====================================================================================
route('GET', '/api/tpl', async () => {
  const [procs, tpl] = await Promise.all([
    q(`SELECT p.code, p.name, p.phase_code, p.agency_text, p.basis_text, ph.ord FROM pl_procedure p LEFT JOIN pl_phase ph ON ph.code = p.phase_code ORDER BY ph.ord, p.ord, p.code`),
    q(`SELECT t.*, u.full_name AS creator FROM pl_tpl t LEFT JOIN app_user u ON u.id = t.created_by ORDER BY t.procedure_code, CASE t.kind WHEN 'soan' THEN 0 WHEN 'dau_vao' THEN 1 ELSE 2 END, t.ord, t.created_at`)]);
  return procs.map(p => ({ ...p, items: tpl.filter(t => t.procedure_code === p.code) }));
});
const tplFields = b => ({ ...itemFields(b), form_code: txt(b.form_code) });
route('POST', '/api/tpl', async ({ user, body }) => {
  libEditor(user);
  const code = need(body.procedure_code, 'thủ tục');
  const list = Array.isArray(body.items) ? body.items : [body];
  for (const b of list) {
    const f = tplFields(b);
    await q(`INSERT INTO pl_tpl (procedure_code, kind, name, required, basis, source, form_code, doc_kind, ord, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,(SELECT coalesce(max(ord),0)+10 FROM pl_tpl WHERE procedure_code=$1),$9)`,
      [code, f.kind, f.name, f.required, f.basis, b.source === 'ai' ? 'ai' : 'nguoi_dung', f.form_code, f.doc_kind, user.id]);
  }
  return { added: list.length };
});
route('PUT', '/api/tpl/:id', async ({ user, params, body }) => {
  libEditor(user);
  const t = notFound(await one(`SELECT * FROM pl_tpl WHERE id = $1`, [params.id]), 'mục mẫu');
  const f = tplFields({ ...t, ...body });
  await q(`UPDATE pl_tpl SET kind=$2, name=$3, required=$4, basis=$5, doc_kind=$6, form_code=$7 WHERE id=$1`, [t.id, f.kind, f.name, f.required, f.basis, f.doc_kind, f.form_code]);
  return { ok: true };
});
route('DELETE', '/api/tpl/:id', async ({ user, params }) => {
  libEditor(user);
  await q(`DELETE FROM pl_tpl WHERE id = $1`, [params.id]);
  return { ok: true };
});
// áp dụng mục mẫu mới vào các bước đang có của thủ tục (bổ sung mục chưa có)
route('POST', '/api/tpl/apply', async ({ user, body }) => {
  libEditor(user);
  const code = need(body.procedure_code, 'thủ tục');
  const steps = await q(`SELECT s.* FROM pl_step s WHERE s.code = $1 AND s.status <> 'bo_qua'`, [code]);
  let n = 0;
  for (const s of steps) {
    await must(user, s.project_id, ...W);
    for (const t of await q(`SELECT * FROM pl_tpl t WHERE t.procedure_code = $1 AND NOT EXISTS (SELECT 1 FROM pl_item i WHERE i.step_id = $2 AND (i.tpl_id = t.id OR lower(i.name) = lower(t.name)))`, [code, s.id])) {
      await q(`INSERT INTO pl_item (step_id, tpl_id, kind, name, required, basis, source, form_code, doc_kind, tag, ord) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [s.id, t.id, t.kind, t.name, t.required, t.basis, t.source, t.form_code, t.doc_kind, t.tag, t.ord]); n++;
    }
  }
  return { steps: steps.length, added: n };
});

// =====================================================================================
// Trợ lý AI — hội thoại tự do về pháp lý dự án, có đính kèm tệp / chọn hồ sơ trong phần mềm
// =====================================================================================
const EFFORT = { nhanh: 'low', chuan: 'medium', ky: 'high' };
// ngữ cảnh: tình hình pháp lý các dự án người dùng được xem (bước, tiến độ, hồ sơ thiếu, cảnh báo, dự thảo, bồi thường, thư viện văn bản)
async function aiProjectContext(list) {
  const t = today(), parts = [`Hôm nay: ${dmy(t)}`];
  const steps = await stepRows(list);
  for (const pid of list) {
    const info = await projInfo(pid), p = info.project, ss = steps.filter(s => s.project_id === pid);
    const cnt = k => ss.filter(s => s.status === k).length, open = ss.filter(s => s.open);
    const lines = ss.map(s => `- ${s.stt ? s.stt + ' ' : ''}${s.name}${s.sheet ? ' [' + s.sheet + (s.section ? ' › ' + s.section : '') + ']' : ''} | ${ST_NAME[s.status]}`
      + (s.plan_start || s.plan_submit || s.plan_end ? ` | KH: ${dmy(s.plan_start) || '?'} → nộp ${dmy(s.plan_submit) || '?'} → xong ${dmy(s.plan_end) || '?'}${s.base_end && s.base_end !== s.plan_end ? ' (gốc ' + dmy(s.base_end) + ')' : ''}` : '')
      + `${s.act_start || s.act_submit || s.act_end ? ` | TT: ${[s.act_start && 'bắt đầu ' + dmy(s.act_start), s.act_submit && 'nộp ' + dmy(s.act_submit), s.act_end && 'xong ' + dmy(s.act_end)].filter(Boolean).join(', ')}` : ''}`
      + `${s.agency_text ? ' | Cơ quan: ' + s.agency_text : ''}${s.owner ? ' | Phụ trách: ' + s.owner : ''}`
      + `${Number(s.req_n) ? ` | Hồ sơ bắt buộc ${s.req_ok}/${s.req_n}` : ''}${s.late ? ` | ${s.late_kind === 'qua_han_tra' ? 'CƠ QUAN QUÁ HẠN TRẢ' : s.late_kind === 'cham_ke_hoach' ? 'CHẬM so kế hoạch gốc' : 'QUÁ HẠN kế hoạch'} ${s.late} ngày` : ''}`
      + `${s.issue_text || s.issue_kind ? ` | VƯỚNG MẮC: ${ISSUE[s.issue_kind] || ''}${s.issue_text ? ' — ' + s.issue_text : ''}${s.issue_since ? ' (từ ' + dmy(s.issue_since) + ')' : ''}` : ''}`);
    const miss = open.length ? await q(`SELECT i.name, i.kind, i.supp, i.reason, s.name AS step, coalesce(i.due_on, s.plan_end) AS due FROM pl_item i JOIN pl_step s ON s.id = i.step_id
        WHERE s.id = ANY($1) AND NOT i.na AND i.required AND NOT i.done AND i.ref_text IS NULL AND NOT EXISTS (SELECT 1 FROM pl_file f WHERE f.item_id = i.id AND f.current)
        ORDER BY coalesce(i.due_on, s.plan_end) NULLS LAST, s.ord`, [open.map(s => s.id)]) : [];
    const warns = await q(`SELECT DISTINCT ON (c.step_id, c.kind, c.target_id) c.*, s.name AS step FROM pl_check c JOIN pl_step s ON s.id = c.step_id WHERE s.project_id = $1 AND c.status = 'xong' ORDER BY c.step_id, c.kind, c.target_id, c.created_at DESC`, [pid]);
    const docs = await q(`SELECT d.subject, d.kind, d.status, s.name AS step FROM pl_doc d JOIN pl_step s ON s.id = d.step_id WHERE s.project_id = $1 ORDER BY d.updated_at DESC LIMIT 40`, [pid]);
    const files = await q(`SELECT f.name, f.ai_facts, i.name AS item, s.name AS step FROM pl_file f JOIN pl_item i ON i.id = f.item_id JOIN pl_step s ON s.id = f.step_id WHERE s.project_id = $1 AND f.current ORDER BY s.ord, f.uploaded_at LIMIT 300`, [pid]);
    const ho = await one(`SELECT count(*)::int AS n, coalesce(sum(tong),0) AS tong, string_agg(DISTINCT batch, ', ') AS dot FROM pl_household WHERE project_id = $1`, [pid]);
    parts.push(`# DỰ ÁN ${p.code} — ${p.name}\nĐịa điểm: ${p.location || ''}\nChủ đầu tư: ${info.cdt}${p.investor ? '\nNhà đầu tư: ' + p.investor : ''}${info.ubnd ? '\nUBND cấp xã: ' + info.ubnd : ''}${info.don_vi_bt ? '\nĐơn vị làm nhiệm vụ BTHT: ' + info.don_vi_bt : ''}`,
      `## Tổng hợp\n${ss.length} bước: ${cnt('xong')} hoàn thành, ${cnt('dang')} đang chuẩn bị hồ sơ, ${cnt('cho_kq')} đã nộp chờ kết quả, ${cnt('chua')} chưa làm, ${cnt('bo_qua')} không thực hiện; ${open.filter(s => s.late).length} bước trễ/quá hạn; ${miss.length} hồ sơ bắt buộc còn thiếu.`,
      '## Các bước pháp lý (kế hoạch, thực tế, tình trạng)\n' + (lines.join('\n') || '(chưa lập kế hoạch)'),
      '## Hồ sơ bắt buộc còn thiếu của các bước chưa xong\n' + (miss.map(m => { const due = m.due ? (m.due instanceof Date ? m.due.toISOString().slice(0, 10) : String(m.due)) : null; return `- ${m.name} (${KIND_NAME[m.kind]}) — bước «${m.step}»${due ? ' — hạn ' + dmy(due) + (due < t ? ' (QUÁ HẠN)' : '') : ''}${m.supp ? ' — hồ sơ bổ sung' + (m.reason ? ': ' + m.reason : '') : ''}`; }).join('\n') || '(không có)'),
      '## Cảnh báo AI về hồ sơ\n' + (warns.flatMap(c => (c.result?.canh_bao || []).map(w => `- [${w.muc_do}] bước «${c.step}»: ${w.noi_dung}${w.de_xuat ? ' → ' + w.de_xuat : ''}`)).join('\n') || '(không có)'),
      '## Tệp hồ sơ đã có trong phần mềm\n' + (files.map(f => `- «${f.name}» (bước «${f.step}», mục «${f.item}»): ${factsText(f.ai_facts)}`).join('\n') || '(chưa có tệp)'),
      '## Dự thảo văn bản\n' + (docs.map(d => `- ${d.subject} (${d.kind}, ${d.status === 'chot' ? 'đã chốt' : 'bản nháp'}) — bước «${d.step}»`).join('\n') || '(chưa có)'),
      `## Bồi thường từng hộ\n${ho.n ? `${ho.n} hộ, tổng ${VB.tien(Number(ho.tong))} đồng (đợt: ${ho.dot})` : '(chưa nhập bảng tổng hợp phương án bồi thường)'}`);
  }
  const lib = await q(`SELECT * FROM pl_legal_doc ORDER BY issued_on DESC NULLS LAST`);
  parts.push('# THƯ VIỆN VĂN BẢN PHÁP LUẬT\n' + lib.map(d => `- ${d.number_text || d.code} | ${d.title} | ban hành ${dmy(d.issued_on)} | ${effText(d)}`).join('\n'));
  return parts.join('\n\n');
}
const chatOf = async (user, id) => { const c = notFound(await one(`SELECT * FROM pl_ai_chat WHERE id = $1`, [id]), 'cuộc trò chuyện'); if (c.user_id !== user.id) deny('Không phải cuộc trò chuyện của bạn'); return c; };
route('GET', '/api/ai-chats', async ({ user }) => q(`SELECT c.id, c.title, c.project_id, c.updated_at, p.code AS project_code FROM pl_ai_chat c LEFT JOIN project p ON p.id = c.project_id WHERE c.user_id = $1 ORDER BY c.updated_at DESC LIMIT 200`, [user.id]));
route('GET', '/api/ai-chats/:id', async ({ user, params }) => {
  const c = await chatOf(user, params.id);
  const msgs = await q(`SELECT id, role, content, files, mode, model, error, created_at FROM pl_ai_msg WHERE chat_id = $1 ORDER BY created_at`, [c.id]);
  return { ...c, msgs: msgs.map(m => ({ ...m, files: m.files.map(f => ({ name: f.name, size: f.size, src: f.src })) })) };
});
route('PUT', '/api/ai-chats/:id', async ({ user, params, body }) => {
  const c = await chatOf(user, params.id);
  await q(`UPDATE pl_ai_chat SET title = $2 WHERE id = $1`, [c.id, need(body.title, 'tên cuộc trò chuyện').slice(0, 120)]);
  return { ok: true };
});
route('DELETE', '/api/ai-chats/:id', async ({ user, params }) => {
  const c = await chatOf(user, params.id);
  const up = (await q(`SELECT files FROM pl_ai_msg WHERE chat_id = $1`, [c.id])).flatMap(m => m.files).filter(f => f.src === 'tai_len');
  await q(`DELETE FROM pl_ai_chat WHERE id = $1`, [c.id]);
  for (const f of up) try { fs.unlinkSync(path.join(FILES, f.stored)); } catch {}
  return { ok: true };
});
// hồ sơ trong phần mềm để đưa vào câu hỏi
route('GET', '/api/ai-files', async ({ user, query }) => {
  const list = await visibleProjects(user, query.project || null);
  return q(`SELECT f.id, f.name, f.size, f.uploaded_at, i.name AS item, s.name AS step, p.code AS project_code FROM pl_file f JOIN pl_item i ON i.id = f.item_id JOIN pl_step s ON s.id = f.step_id JOIN project p ON p.id = s.project_id
    WHERE s.project_id = ANY($1) AND f.current ORDER BY s.ord, f.uploaded_at DESC LIMIT 500`, [list]);
});
// kết nối AI: quản trị dán khóa API → kiểm tra, ghi vào .env, bật ngay không cần khởi động lại
route('POST', '/api/ai-key', async ({ user, body }) => {
  if (!user.is_admin && !isLegal(user) && !isLeader(user)) deny('Chỉ quản trị, lãnh đạo hoặc Pháp chế được kết nối Trợ lý AI');
  const key = need(body.key, 'khóa API');
  if (!/^sk-ant-[\w-]{20,}$/.test(key)) bad('Khóa API không đúng định dạng (bắt đầu bằng sk-ant-)');
  const old = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = key; AI.setClient(null);
  try { await new (require('@anthropic-ai/sdk').default)().models.retrieve(AI.CLAUDE_DEFAULT); }
  catch (e) {
    if (old) process.env.ANTHROPIC_API_KEY = old; else delete process.env.ANTHROPIC_API_KEY;
    AI.setClient(null);
    bad('Không kết nối được bằng khóa này: ' + (e.status === 401 ? 'khóa không hợp lệ' : e.message));
  }
  const envFile = path.join(__dirname, '..', '.env');
  let env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  env = /^ANTHROPIC_API_KEY=.*$/m.test(env) ? env.replace(/^ANTHROPIC_API_KEY=.*$/m, 'ANTHROPIC_API_KEY=' + key) : env + `\nANTHROPIC_API_KEY=${key}\n`;
  fs.writeFileSync(envFile, env);
  await log(user, null, 'ai', null, 'connect');
  return { ok: true, model: AI.CLAUDE_DEFAULT };
});
// gửi câu hỏi (multipart: text, mode, chat_id, project_id, picks = JSON [pl_file.id], file…) → trả lời stream (text/event-stream)
route('POST', '/api/ai-chat/send', async ({ req, res, user }) => {
  const { files, fields } = await readUpload(req, 10);
  const text = String(fields.text || '').trim();
  const pid = uid(fields.project_id);
  const list = await visibleProjects(user, pid);
  let picks = []; try { picks = JSON.parse(fields.picks || '[]').filter(uid).slice(0, 10); } catch {}
  const picked = picks.length ? await q(`SELECT f.* FROM pl_file f JOIN pl_step s ON s.id = f.step_id WHERE f.id = ANY($1) AND s.project_id = ANY($2)`, [picks, list]) : [];
  if (!text && !files.length && !picked.length) bad('Nhập câu hỏi hoặc đính kèm tệp');
  const mode = EFFORT[fields.mode] ? fields.mode : 'chuan';
  const model = AI.canChat(fields.model) ? fields.model : AI.chatDefault();   // chỉ nhận mô hình trong danh sách và đã có khóa
  if (!AI.canChat(model)) bad('Chưa kết nối Trợ lý AI — quản trị bấm «Kết nối Trợ lý AI» và dán khóa API.');
  let chat = uid(fields.chat_id) ? await chatOf(user, fields.chat_id) : null;
  if (!chat) chat = await one(`INSERT INTO pl_ai_chat (user_id, project_id, title) VALUES ($1,$2,$3) RETURNING *`,
    [user.id, pid, (text || files[0]?.name || picked[0]?.name || 'Cuộc trò chuyện mới').replace(/\s+/g, ' ').slice(0, 70)]);
  const att = [...files.map(f => ({ name: f.name, mime: f.mime, size: f.buffer.length, stored: store(f.buffer), src: 'tai_len' })),
    ...picked.map(f => ({ name: f.name, mime: f.mime, size: Number(f.size), stored: f.stored, src: 'ho_so' }))];
  await q(`INSERT INTO pl_ai_msg (chat_id, role, content, files, mode) VALUES ($1,'user',$2,$3,$4)`, [chat.id, text, JSON.stringify(att), mode]);
  await q(`UPDATE pl_ai_chat SET updated_at = now() WHERE id = $1`, [chat.id]);

  // lịch sử → messages: lượt trả lời lỗi bị bỏ (kèm câu hỏi của lượt đó); tệp gửi lại theo hạn mức dung lượng, ưu tiên lượt mới nhất
  const rows = await q(`SELECT role, content, files, error FROM pl_ai_msg WHERE chat_id = $1 ORDER BY created_at`, [chat.id]);
  const turns = [];
  for (const m of rows) {
    if (m.role === 'assistant' && (m.error || !m.content)) { if (turns.at(-1)?.role === 'user') turns.pop(); continue; }
    if (turns.at(-1)?.role === m.role) turns.pop();
    turns.push(m);
  }
  let budget = 24e6;
  const history = new Array(turns.length);
  for (let i = turns.length - 1; i >= 0; i--) {
    const m = turns[i];
    if (m.role === 'assistant') { history[i] = { role: 'assistant', content: [{ type: 'text', text: m.content }] }; continue; }
    const blocks = [];
    for (const f of m.files || []) {
      let buf = null; try { buf = readStored(f.stored); } catch {}
      if (buf && budget - buf.length * 1.37 > 0) { budget -= buf.length * 1.37; blocks.push(...AI.fileBlocks(f, buf)); }
      else blocks.push({ type: 'text', text: `--- TỆP: «${f.name}» — ${buf ? 'quá dung lượng, không gửi lại' : 'không còn trên máy chủ'} ---` });
    }
    history[i] = { role: 'user', content: [...blocks, { type: 'text', text: m.content || 'Hãy đọc các tệp đính kèm.' }] };
  }

  AI_PENDING.delete(chat.id);   // câu hỏi mới thì bỏ thao tác đang chờ của lượt trước
  const act = 'tu';   // chỉ một chế độ: AI tự làm thao tác dữ liệu, không hỏi lại
  await aiStream(res, chat, user, { list, act, mode, model }, async cb => {
    const ctx = await aiProjectContext(list);
    return AI.chat(ctx, history, EFFORT[mode], cb.onText, model, cb.onStatus, { app: aiApp(user, list), act });
  });
}, { multipart: true, raw: true });

// =====================================================================================
// Giải trình quá hạn, đề xuất hạn mới → duyệt → tự cập nhật hạn hồ sơ / công việc / kế hoạch
//   chuyên viên (Người lập / Người kiểm): giải trình lý do + đề xuất hạn mới cho hồ sơ hoặc cả công việc
//   sếp (Người duyệt, lãnh đạo, quản trị): duyệt hoặc từ chối; duyệt thì hạn mới được áp dụng ngay
// =====================================================================================
const canApprove = async (user, pid) => { const p = await perms(user, pid); return p.admin || p.duyet || isLeader(user); };
const EXT_SQL = `SELECT e.*, s.name AS step, s.stt, i.name AS item, ru.full_name AS requester, du.full_name AS decider
  FROM pl_extend e JOIN pl_step s ON s.id = e.step_id LEFT JOIN pl_item i ON i.id = e.item_id
  LEFT JOIN app_user ru ON ru.id = e.requested_by LEFT JOIN app_user du ON du.id = e.decided_by`;
route('GET', '/api/extensions', async ({ user, query }) => {
  const p = await must(user, query.project);
  const list = await q(`${EXT_SQL} WHERE e.project_id = $1 AND (e.status <> 'rut') ORDER BY e.created_at DESC LIMIT 500`, [query.project]);
  return { list, can_request: p.lap || p.kiem || p.duyet, can_approve: await canApprove(user, query.project), me: user.id };
});
route('POST', '/api/extensions', async ({ user, body }) => {
  const s = await stepOf(user, body.step_id, ...W);
  const item = uid(body.item_id) ? await one(`SELECT * FROM pl_item WHERE id = $1 AND step_id = $2`, [body.item_id, s.id]) : null;
  if (body.item_id && !item) bad('Hồ sơ không thuộc công việc này');
  const reason = need(body.reason, 'lý do giải trình');
  if (reason.length < 10) bad('Giải trình lý do cụ thể hơn (ít nhất 10 ký tự)');
  const new_due = date(body.new_due, 'Hạn mới đề xuất', true);
  if (new_due < today()) bad('Hạn mới phải từ hôm nay trở đi');
  const old_due = item ? (item.due_on || s.plan_end) : s.plan_end;
  if (old_due && new_due <= old_due) bad(`Hạn mới phải sau hạn hiện tại (${dmy(old_due)})`);
  // mỗi hồ sơ / công việc chỉ có một đề xuất đang chờ: gửi lại thì thay đề xuất cũ
  await q(`UPDATE pl_extend SET status = 'rut', decided_at = now(), decided_by = $3, decision_note = 'Thay bằng đề xuất mới'
    WHERE step_id = $1 AND item_id IS NOT DISTINCT FROM $2 AND status = 'cho'`, [s.id, item?.id || null, user.id]);
  const r = await one(`INSERT INTO pl_extend (project_id, step_id, item_id, old_due, new_due, reason, requested_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [s.project_id, s.id, item?.id || null, old_due, new_due, reason, user.id]);
  await log(user, s.project_id, 'extend', r.id, 'request', `${item ? item.name : s.name}: ${dmy(old_due)} → ${dmy(new_due)} · ${reason}`);
  return { id: r.id };
});
// ===== Lịch sự kiện (họp, việc, nhắc việc) — như app lịch điện thoại; nhắc giờ chạy ở trình duyệt =====
const EV_KIND = ['hop', 'viec', 'nhac', 'khac'], EV_REP = ['', 'ngay', 'ngay_lv', 'tuan', 'thang', 'nam'];
const hhmm = (v, label) => { if (!v) return null; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) bad(`${label}: giờ không hợp lệ`); return v; };
function evVal(b) {
  const all_day = !!b.all_day, start_date = date(b.start_date, 'Ngày bắt đầu', true), end_date = date(b.end_date, 'Ngày kết thúc') || start_date;
  const start_time = all_day ? null : hhmm(b.start_time, 'Giờ bắt đầu') || bad('Thiếu giờ bắt đầu'), end_time = all_day ? null : hhmm(b.end_time, 'Giờ kết thúc');
  if (end_date < start_date || (!all_day && end_date === start_date && end_time && end_time < start_time)) bad('Kết thúc phải sau bắt đầu');
  const remind = [...new Set((Array.isArray(b.remind) ? b.remind : []).filter(x => x !== '' && x != null).map(x => int(x, 'Nhắc trước', 0, 40320)))].sort((a, c) => a - c).slice(0, 3);
  const repeat = oneOf(b.repeat || '', EV_REP, 'Lặp lại');
  return { title: need(b.title, 'tiêu đề').slice(0, 200), kind: oneOf(b.kind || 'hop', EV_KIND, 'Loại'), all_day, start_date, start_time, end_date, end_time,
    repeat, rep_until: repeat ? date(b.rep_until, 'Lặp đến ngày') : null, remind, location: txt(b.location), attendees: txt(b.attendees), note: txt(b.note), shared: b.shared !== false };
}
const EV_COLS = ['title', 'kind', 'all_day', 'start_date', 'start_time', 'end_date', 'end_time', 'repeat', 'rep_until', 'remind', 'location', 'attendees', 'note', 'shared', 'attendee_ids'];
const EV_SQL = `SELECT e.id, e.project_id, ${EV_COLS.filter(c => !/date|until/.test(c)).map(c => 'e.' + c).join(', ')}, to_char(e.start_date,'YYYY-MM-DD') AS start_date, to_char(e.end_date,'YYYY-MM-DD') AS end_date,
  to_char(e.rep_until,'YYYY-MM-DD') AS rep_until, e.created_by, u.full_name AS creator, p.code AS project_code,
  coalesce((SELECT json_agg(json_build_object('id', a.id, 'name', a.full_name, 'title', a.job_title)) FROM app_user a WHERE a.id = ANY(e.attendee_ids)), '[]') AS people
  FROM pl_event e LEFT JOIN app_user u ON u.id = e.created_by LEFT JOIN project p ON p.id = e.project_id`;
// không có ?project → mọi dự án được xem (để nhắc giờ ở mọi màn hình); người được mời luôn thấy sự kiện, kể cả «chỉ mình tôi»
route('GET', '/api/events', async ({ user, query }) => {
  const pid = uid(query.project), ids = await visibleProjects(user, pid);
  return q(`SELECT x.*, $2 = ANY(x.attendee_ids) AS invited FROM (${EV_SQL}) x
    WHERE (x.project_id = ANY($1) AND (x.shared OR x.created_by = $2)) OR ($2 = ANY(x.attendee_ids) AND ($3::uuid IS NULL OR x.project_id = $3))
    ORDER BY x.start_date, x.start_time NULLS FIRST LIMIT 5000`, [ids, user.id, pid]);
});
// người tham dự trong hệ thống: chỉ nhận tài khoản đang hoạt động
const attIds = async v => { const ids = [...new Set((Array.isArray(v) ? v : []).filter(uid))]; return ids.length ? (await q(`SELECT id FROM app_user WHERE id = ANY($1) AND active`, [ids])).map(r => r.id) : []; };
// lời mời: người mới được mời (hoặc sự kiện đổi giờ) → thẻ mời hiện trên màn hình của họ lần tới mở app
async function inviteSync(user, eventId, ids, changed) {
  const others = ids.filter(id => id !== user.id);
  await q(`DELETE FROM pl_event_invite WHERE event_id = $1 AND NOT (user_id = ANY($2))`, [eventId, others]);
  for (const id of others) await q(`INSERT INTO pl_event_invite (event_id, user_id) VALUES ($1,$2) ON CONFLICT (event_id, user_id) DO UPDATE SET seen_at = CASE WHEN $3 THEN NULL ELSE pl_event_invite.seen_at END, changed = pl_event_invite.changed OR $3`, [eventId, id, changed]);
}
route('GET', '/api/invites', async ({ user }) => q(`SELECT x.*, i.changed FROM pl_event_invite i JOIN (${EV_SQL}) x ON x.id = i.event_id
  WHERE i.user_id = $1 AND i.seen_at IS NULL AND (x.end_date >= to_char(current_date, 'YYYY-MM-DD') OR x.repeat <> '') ORDER BY x.start_date, x.start_time NULLS FIRST LIMIT 50`, [user.id]));
route('POST', '/api/invites/:id/seen', async ({ user, params }) => { await q(`UPDATE pl_event_invite SET seen_at = now(), changed = false WHERE event_id = $1 AND user_id = $2`, [params.id, user.id]); return { ok: true }; });
const evOf = async (user, id) => {
  const e = notFound(await one(`SELECT * FROM pl_event WHERE id = $1`, [id]), 'sự kiện'); await must(user, e.project_id);
  if (e.created_by !== user.id && !user.is_admin) deny('Chỉ người tạo được sửa / xóa sự kiện');
  return e;
};
route('POST', '/api/events', async ({ user, body }) => {
  await must(user, body.project_id); const v = { ...evVal(body), attendee_ids: await attIds(body.attendee_ids) };
  const r = await one(`INSERT INTO pl_event (project_id, created_by, ${EV_COLS.join(', ')}) VALUES ($1,$2,${EV_COLS.map((_, i) => '$' + (i + 3)).join(',')}) RETURNING id`,
    [body.project_id, user.id, ...EV_COLS.map(c => v[c])]);
  await inviteSync(user, r.id, v.attendee_ids, false);
  await log(user, body.project_id, 'event', r.id, 'create', `${v.title} · ${dmy(v.start_date)}${v.start_time ? ' ' + v.start_time : ''}`);
  return { id: r.id };
});
route('PUT', '/api/events/:id', async ({ user, params, body }) => {
  const e = await evOf(user, params.id), v = { ...evVal(body), attendee_ids: await attIds(body.attendee_ids) };
  await q(`UPDATE pl_event SET ${EV_COLS.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`, [e.id, ...EV_COLS.map(c => v[c])]);
  // đổi ngày / giờ / địa điểm → báo lại người đã được mời
  const iso = x => x instanceof Date ? x.toISOString().slice(0, 10) : x;
  const changed = iso(e.start_date) !== v.start_date || (e.start_time || null) !== v.start_time || (e.location || null) !== v.location || e.repeat !== v.repeat;
  await inviteSync(user, e.id, v.attendee_ids, changed);
  await log(user, e.project_id, 'event', e.id, 'update', v.title);
  return { ok: true };
});
route('DELETE', '/api/events/:id', async ({ user, params }) => {
  const e = await evOf(user, params.id);
  await q(`DELETE FROM pl_event WHERE id = $1`, [e.id]);
  await log(user, e.project_id, 'event', e.id, 'delete', e.title);
  return { ok: true };
});

route('DELETE', '/api/extensions/:id', async ({ user, params }) => {
  const e = notFound(await one(`SELECT * FROM pl_extend WHERE id = $1`, [params.id]), 'đề xuất');
  await must(user, e.project_id);
  if (e.status !== 'cho') bad('Đề xuất đã được xử lý');
  if (e.requested_by !== user.id && !user.is_admin) deny('Chỉ người gửi được rút đề xuất');
  await q(`UPDATE pl_extend SET status = 'rut', decided_at = now(), decided_by = $2 WHERE id = $1`, [e.id, user.id]);
  return { ok: true };
});
route('POST', '/api/extensions/:id/decide', async ({ user, params, body }) => {
  const e = notFound(await one(`SELECT * FROM pl_extend WHERE id = $1`, [params.id]), 'đề xuất');
  await must(user, e.project_id);
  if (!(await canApprove(user, e.project_id))) deny('Chỉ Người duyệt hoặc lãnh đạo được duyệt gia hạn');
  if (e.status !== 'cho') bad('Đề xuất đã được xử lý');
  const ok = !!body.ok, note = txt(body.note);
  if (!ok && !note) bad('Nhập lý do từ chối để chuyên viên biết cần làm gì');
  const new_due = ok && body.new_due ? date(body.new_due, 'Hạn mới') : e.new_due;   // sếp có thể chỉnh hạn khi duyệt
  if (ok && new_due < today()) bad('Hạn mới phải từ hôm nay trở đi');
  const s = await one(`SELECT * FROM pl_step WHERE id = $1`, [e.step_id]);
  await tx(async x => {
    await x.q(`UPDATE pl_extend SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4, new_due = $5 WHERE id = $1`, [e.id, ok ? 'duyet' : 'tu_choi', user.id, note, new_due]);
    if (!ok) return;
    if (e.item_id) {
      await x.q(`UPDATE pl_item SET due_on = $2 WHERE id = $1`, [e.item_id, new_due]);
      // hạn hồ sơ vượt ngày hoàn thành của công việc → công việc lùi theo
      if (!s.plan_end || new_due > s.plan_end) await x.q(`UPDATE pl_step SET plan_end = $2, fixed = true, updated_at = now() WHERE id = $1`, [s.id, new_due]);
    } else {
      await x.q(`UPDATE pl_step SET plan_end = $2, fixed = true, plan_submit = CASE WHEN plan_submit > $2 THEN $2 ELSE plan_submit END, updated_at = now() WHERE id = $1`, [s.id, new_due]);
      // hồ sơ còn thiếu đang theo hạn cũ của công việc → theo hạn mới
      await x.q(`UPDATE pl_item i SET due_on = $3 WHERE i.step_id = $1 AND NOT i.done AND i.ref_text IS NULL AND (i.due_on IS NULL OR i.due_on <= $2)
        AND NOT EXISTS (SELECT 1 FROM pl_file f WHERE f.item_id = i.id AND f.current)`, [s.id, s.plan_end || new_due, new_due]);
    }
  });
  let finish = null;
  if (ok) finish = (await schedule(e.project_id, {})).finish;   // các bước phụ thuộc tự dời theo
  await log(user, e.project_id, 'extend', e.id, ok ? 'approve' : 'reject', note);
  return { ok: true, finish };
});

// =====================================================================================
// Thư mục hồ sơ trên máy tính: mọi tệp hồ sơ (bản scan, PDF…) được chép thêm ra thư mục trên ổ đĩa,
// xếp theo  <mã dự án>/<GPMB | DTXD>/<số. tên công việc>/<tên hồ sơ>/<tệp>  để mở bằng File Explorer.
// Mặc định Desktop\Pháp lý dự án\Hồ sơ dự án; đổi ổ / thư mục bằng HOSO_DIR trong .env.
// =====================================================================================
const HOSO_DIR = process.env.HOSO_DIR || path.join(require('os').homedir(), 'Desktop', 'Pháp lý dự án', 'Hồ sơ dự án');
const seg = (s, n = 60) => safeName(s).replace(/[. ]+$/, '').slice(0, n).trim() || '_';
async function itemDir(itemId) {
  const r = await one(`SELECT i.name AS item, s.name AS step, s.stt, s.sheet, p.code FROM pl_item i JOIN pl_step s ON s.id = i.step_id JOIN project p ON p.id = s.project_id WHERE i.id = $1`, [itemId]);
  if (!r) return null;
  const top = String(r.sheet || 'Khác').split(' · ')[0];
  return path.join(HOSO_DIR, seg(r.code, 30), seg(top, 30), seg(`${r.stt ? r.stt + '. ' : ''}${r.step}`), seg(r.item));
}
// chép các tệp hiện hành chưa có bản trên ổ đĩa (tải lên, dự thảo đã chốt, văn bản xuất từ bảng bồi thường…)
let diskBusy = false;
async function syncDisk() {
  if (diskBusy) return; diskBusy = true;
  try {
    for (const f of await q(`SELECT id, item_id, name, stored FROM pl_file WHERE current AND disk_path IS NULL ORDER BY uploaded_at LIMIT 500`)) {
      try {
        const dir = await itemDir(f.item_id); if (!dir) continue;
        fs.mkdirSync(dir, { recursive: true });
        const ext = path.extname(f.name), base = seg(path.basename(f.name, ext), 80);
        let p = path.join(dir, base + ext);
        for (let k = 2; fs.existsSync(p); k++) p = path.join(dir, `${base} (${k})${ext}`);
        fs.copyFileSync(path.join(FILES, f.stored), p);
        await q(`UPDATE pl_file SET disk_path = $2 WHERE id = $1`, [f.id, p]);
      } catch (e) { console.error('Chép hồ sơ ra thư mục:', f.name, e.message); }
    }
  } finally { diskBusy = false; }
}
// mở thư mục hồ sơ bằng File Explorer (chỉ khi app chạy trên chính máy này)
route('POST', '/api/open-folder', async ({ user, body, req }) => {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (!local) bad(`Thư mục hồ sơ nằm trên máy chủ: ${HOSO_DIR}`);
  let dir = HOSO_DIR;
  if (uid(body.item_id)) { await itemOf(user, body.item_id); dir = await itemDir(body.item_id); }
  fs.mkdirSync(dir, { recursive: true });
  require('child_process').spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref();
  return { ok: true, dir };
});

// =====================================================================================
// Trợ lý AI làm tác vụ: công cụ thao tác dữ liệu phần mềm. Mỗi công cụ gọi lại đúng API của app
// (cùng kiểm tra quyền, kiểm tra dữ liệu, ghi nhật ký như khi người dùng bấm nút).
// =====================================================================================
async function callRoute(user, method, url, body = {}) {
  const u = new URL(url, 'http://x');
  const r = routes.find(x => x.method === method && x.re.test(u.pathname) && (() => { const k = x.keys.indexOf('id'); return k < 0 || uuidRe.test(x.re.exec(u.pathname)[k + 1]); })());
  if (!r) throw new Error('Không có chức năng ' + method + ' ' + u.pathname);
  const mm = r.re.exec(u.pathname);
  return r.handler({ user, body, query: Object.fromEntries(u.searchParams), params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(mm[i + 1])])), req: null, res: null });
}
const S_ = (d, extra = {}) => ({ type: 'string', description: d, ...extra });
const DATE = d => S_(d + ' (YYYY-MM-DD)');
const AI_TOOLS = [
  { name: 'tim_cong_viec', description: 'Tìm công việc (bước pháp lý) và hồ sơ của nó theo từ khóa (tên việc, số thứ tự, GPMB/DTXD, tên hồ sơ). Trả về id công việc, id hồ sơ, trạng thái, ngày kế hoạch / thực tế, hồ sơ đã có / còn thiếu / quá hạn. Gọi trước mọi thao tác để lấy id.',
    input_schema: { type: 'object', properties: { tu_khoa: S_('từ khóa; để trống = các việc chưa xong đang đến kỳ'), chi_chua_xong: { type: 'boolean', description: 'chỉ lấy việc chưa xong' } }, additionalProperties: false } },
  { name: 'danh_dau_ho_so', description: 'Đánh dấu một hồ sơ trong checklist là ĐÃ CÓ (hoặc bỏ đánh dấu).',
    input_schema: { type: 'object', properties: { item_id: S_('id hồ sơ'), da_co: { type: 'boolean' } }, required: ['item_id', 'da_co'], additionalProperties: false } },
  { name: 'cap_nhat_cong_viec', description: 'Cập nhật công việc: trạng thái (chua = chưa làm, dang = đang chuẩn bị hồ sơ, cho_kq = đã nộp chờ kết quả, xong = hoàn thành, bo_qua = không thực hiện), ngày thực tế, ghi chú, vướng mắc. Chỉ truyền trường cần đổi. Kế hoạch các bước sau tự dời theo.',
    input_schema: { type: 'object', properties: { step_id: S_('id công việc'), trang_thai: S_('trạng thái mới', { enum: ['chua', 'dang', 'cho_kq', 'xong', 'bo_qua'] }), ngay_bat_dau: DATE('ngày bắt đầu thực tế'), ngay_nop: DATE('ngày nộp hồ sơ'), ngay_ket_qua: DATE('ngày có kết quả'),
      ghi_chu: S_('ghi chú tình trạng'), vuong_mac_loai: S_('loại vướng mắc; "" để xóa vướng mắc', { enum: ['', ...Object.keys(ISSUE)] }), vuong_mac_noi_dung: S_('mô tả vướng mắc') }, required: ['step_id'], additionalProperties: false } },
  { name: 'them_ho_so', description: 'Thêm hồ sơ vào checklist của một công việc.',
    input_schema: { type: 'object', properties: { step_id: S_('id công việc'), ten: { type: 'array', items: { type: 'string' }, description: 'tên từng hồ sơ' }, loai: S_('dau_vao = hồ sơ đầu vào, soan = văn bản chủ đầu tư soạn, ket_qua = kết quả', { enum: ['dau_vao', 'soan', 'ket_qua'] }), bat_buoc: { type: 'boolean' } }, required: ['step_id', 'ten'], additionalProperties: false } },
  { name: 'lap_ho_so_bo_sung', description: 'Lập hồ sơ bổ sung theo yêu cầu của cơ quan / chuyên viên (có lý do và hạn). Công việc đã nộp / đã xong sẽ chuyển lại «đang chuẩn bị hồ sơ».',
    input_schema: { type: 'object', properties: { step_id: S_('id công việc'), ten: { type: 'array', items: { type: 'string' } }, ly_do: S_('lý do bổ sung'), han: DATE('hạn bổ sung'), tu_ngay: DATE('làm từ ngày'), co_quan: S_('cơ quan / người yêu cầu') }, required: ['step_id', 'ten', 'ly_do', 'han'], additionalProperties: false } },
  { name: 'de_xuat_gia_han', description: 'Gửi đề xuất gia hạn (giải trình lý do quá hạn + hạn mới) cho một hồ sơ hoặc cả công việc; Người duyệt / lãnh đạo sẽ duyệt.',
    input_schema: { type: 'object', properties: { step_id: S_('id công việc'), item_id: S_('id hồ sơ; bỏ trống = gia hạn cả công việc'), han_moi: DATE('hạn mới đề xuất'), ly_do: S_('giải trình lý do') }, required: ['step_id', 'han_moi', 'ly_do'], additionalProperties: false } },
  { name: 'soan_du_thao', description: 'Tạo dự thảo văn bản (thể thức NĐ 30/2020) vào màn Dự thảo văn bản để người dùng sửa, chốt, in. Có thể truyền nội dung đã soạn.',
    input_schema: { type: 'object', properties: { step_id: S_('id công việc'), item_id: S_('id hồ sơ «văn bản cần soạn» (nếu có)'), loai: S_('loại văn bản', { enum: Object.keys(VB.LOAI) }), trich_yeu: S_('trích yếu'),
      kinh_gui: { type: 'array', items: { type: 'string' } }, can_cu: { type: 'array', items: { type: 'string' } }, noi_dung: S_('nội dung, mỗi đoạn một dòng'), noi_nhan: { type: 'array', items: { type: 'string' } } }, required: ['step_id', 'loai', 'trich_yeu'], additionalProperties: false } },
];
const AI_WRITE = new Set(['danh_dau_ho_so', 'cap_nhat_cong_viec', 'them_ho_so', 'lap_ho_so_bo_sung', 'de_xuat_gia_han', 'soan_du_thao']);
const AI_LABEL = { tim_cong_viec: 'tìm công việc', danh_dau_ho_so: 'đánh dấu hồ sơ', cap_nhat_cong_viec: 'cập nhật công việc', them_ho_so: 'thêm hồ sơ', lap_ho_so_bo_sung: 'lập hồ sơ bổ sung', de_xuat_gia_han: 'đề xuất gia hạn', soan_du_thao: 'soạn dự thảo' };
const stepName = async id => { const s = uid(id) ? await one(`SELECT stt, name FROM pl_step WHERE id = $1`, [id]) : null; return s ? `«${s.stt ? s.stt + '. ' : ''}${s.name}»` : '(không rõ công việc)'; };
async function aiDescribe(name, x) {
  if (name === 'danh_dau_ho_so') { const i = uid(x.item_id) ? await one(`SELECT i.name, s.name AS step FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE i.id = $1`, [x.item_id]) : null; return `${x.da_co ? 'Đánh dấu ĐÃ CÓ' : 'Bỏ đánh dấu đã có'} hồ sơ «${i?.name || '?'}» (việc «${i?.step || '?'}»)`; }
  if (name === 'cap_nhat_cong_viec') return `Cập nhật công việc ${await stepName(x.step_id)}: ` + [x.trang_thai && 'trạng thái → ' + ST_NAME[x.trang_thai], x.ngay_bat_dau && 'bắt đầu ' + dmy(x.ngay_bat_dau), x.ngay_nop && 'nộp ' + dmy(x.ngay_nop), x.ngay_ket_qua && 'có kết quả ' + dmy(x.ngay_ket_qua), x.ghi_chu && 'ghi chú «' + x.ghi_chu + '»', x.vuong_mac_loai === '' ? 'xóa vướng mắc' : x.vuong_mac_loai && 'vướng mắc: ' + ISSUE[x.vuong_mac_loai] + (x.vuong_mac_noi_dung ? ' — ' + x.vuong_mac_noi_dung : '')].filter(Boolean).join(', ');
  if (name === 'them_ho_so') return `Thêm ${x.ten?.length || 0} hồ sơ vào ${await stepName(x.step_id)}: ${(x.ten || []).join('; ')}`;
  if (name === 'lap_ho_so_bo_sung') return `Lập ${x.ten?.length || 0} hồ sơ bổ sung cho ${await stepName(x.step_id)} (hạn ${dmy(x.han)}): ${(x.ten || []).join('; ')} — lý do: ${x.ly_do}`;
  if (name === 'de_xuat_gia_han') { const i = uid(x.item_id) ? await one(`SELECT name FROM pl_item WHERE id = $1`, [x.item_id]) : null; return `Gửi đề xuất gia hạn ${i ? 'hồ sơ «' + i.name + '»' : 'cả công việc'} ${await stepName(x.step_id)} đến ${dmy(x.han_moi)} — lý do: ${x.ly_do}`; }
  if (name === 'soan_du_thao') return `Tạo dự thảo ${VB.LOAI[x.loai]?.name || 'văn bản'} «${x.trich_yeu}» cho ${await stepName(x.step_id)}`;
  return AI_LABEL[name] || name;
}
async function aiRunTool(user, list, name, x) {
  if (name === 'tim_cong_viec') {
    const steps = (await stepRows(list)).filter(s => s.status !== 'bo_qua');
    const kw = String(x.tu_khoa || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
    const t = today(), fold = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
    const items = await q(`SELECT i.id, i.step_id, i.name, i.kind, i.required, i.done, i.ref_text, i.supp, coalesce(i.due_on, s.plan_end) AS due, (SELECT count(*) FROM pl_file f WHERE f.item_id = i.id AND f.current) AS files
      FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE s.project_id = ANY($1) AND NOT i.na ORDER BY i.ord`, [list]);
    let hit = steps.filter(s => !kw ? s.open && (['dang', 'cho_kq'].includes(s.status) || (s.plan_start && s.plan_start <= t)) : kw.split(/\s+/).every(w => fold([s.stt, s.name, s.sheet, s.section, ...items.filter(i => i.step_id === s.id).map(i => i.name)].join(' ')).includes(w)));
    if (x.chi_chua_xong) hit = hit.filter(s => s.open);
    return { so_viec: hit.length, cong_viec: hit.slice(0, 25).map(s => ({ step_id: s.id, stt: s.stt, ten: s.name, phan: s.sheet, muc: s.section, trang_thai: s.status, ke_hoach: [s.plan_start, s.plan_submit, s.plan_end], thuc_te: [s.act_start, s.act_submit, s.act_end],
      qua_han_ngay: s.open && s.late > 0 ? s.late : 0, vuong_mac: s.issue_kind ? ISSUE[s.issue_kind] + (s.issue_text ? ' — ' + s.issue_text : '') : null, ghi_chu: s.note,
      ho_so: items.filter(i => i.step_id === s.id).map(i => { const ok = i.done || !!i.ref_text || i.files > 0; return { item_id: i.id, ten: i.name, loai: i.kind, bat_buoc: i.required, bo_sung: i.supp, da_co: ok, so_tep: i.files, han: i.due, qua_han: !ok && i.required && i.due && i.due < t }; }) })) };
  }
  if (name === 'danh_dau_ho_so') return callRoute(user, 'POST', `/api/items/${x.item_id}/done`, { done: !!x.da_co });
  if (name === 'cap_nhat_cong_viec') {
    const s = notFound(uid(x.step_id) && await one(`SELECT * FROM pl_step WHERE id = $1`, [x.step_id]), 'công việc');
    const body = { name: s.name, phase_code: s.phase_code, agency_text: s.agency_text, prep_days: s.prep_days, proc_days: s.proc_days, workdays: s.workdays, deps: s.deps, owner_id: s.owner_id, note: s.note, status: s.status,
      act_start: s.act_start, act_submit: s.act_submit, act_end: s.act_end, issue_kind: s.issue_kind, issue_text: s.issue_text, issue_since: s.issue_since };
    if (x.trang_thai) body.status = x.trang_thai;
    if (x.ngay_bat_dau) body.act_start = x.ngay_bat_dau;
    if (x.ngay_nop) body.act_submit = x.ngay_nop;
    if (x.ngay_ket_qua) body.act_end = x.ngay_ket_qua;
    if (x.ghi_chu != null) body.note = x.ghi_chu;
    if (x.vuong_mac_loai != null) { body.issue_kind = x.vuong_mac_loai || null; body.issue_text = x.vuong_mac_loai ? (x.vuong_mac_noi_dung ?? s.issue_text) : null; }
    const r = await callRoute(user, 'PUT', `/api/steps/${s.id}`, body);
    return { ok: true, du_kien_xong_du_an: r?.finish };
  }
  if (name === 'them_ho_so') return callRoute(user, 'POST', `/api/steps/${x.step_id}/items`, { items: (x.ten || []).map(n => ({ name: n, kind: x.loai || 'dau_vao', required: x.bat_buoc !== false })) });
  if (name === 'lap_ho_so_bo_sung') { const r = await callRoute(user, 'POST', '/api/supp', { step_id: x.step_id, names: x.ten, reason: x.ly_do, due_on: x.han, start_on: x.tu_ngay || null, req_by: x.co_quan || null }); return { ...r, link: '#screen-09-03' }; }
  if (name === 'de_xuat_gia_han') return callRoute(user, 'POST', '/api/extensions', { step_id: x.step_id, item_id: x.item_id || null, new_due: x.han_moi, reason: x.ly_do });
  if (name === 'soan_du_thao') {
    const d = await callRoute(user, 'POST', '/api/docs', { step_id: x.step_id, item_id: x.item_id || null, kind: x.loai, subject: x.trich_yeu, use_ai: false });
    if (x.noi_dung || x.kinh_gui || x.can_cu || x.noi_nhan) await callRoute(user, 'PUT', `/api/docs/${d.id}`, { kind: d.kind, issuer: d.issuer, unit: d.unit, number_text: d.number_text, place: d.place, date_text: d.date_text, subject: x.trich_yeu, authority: d.authority,
      bases: x.can_cu || d.bases, recipients: x.kinh_gui || d.recipients, body: x.noi_dung ?? d.body, receivers: x.noi_nhan || d.receivers, signers: d.signers });
    return { doc_id: d.id, link: '#screen-09-04/' + d.id };
  }
  throw new Error('Công cụ không có: ' + name);
}
const aiApp = (user, list) => ({ tools: AI_TOOLS, isWrite: n => AI_WRITE.has(n), label: n => AI_LABEL[n] || n, describe: aiDescribe, run: (n, x) => aiRunTool(user, list, n, x) });
// lượt đang chờ người dùng xác nhận thao tác (giữ trong bộ nhớ 30 phút)
const AI_PENDING = new Map();
setInterval(() => { for (const [k, v] of AI_PENDING) if (Date.now() - v.at > 30 * 60e3) AI_PENDING.delete(k); }, 5 * 60e3).unref();
// chạy một lượt (gửi câu hỏi hoặc tiếp tục sau xác nhận) và trả kết quả dạng SSE
async function aiStream(res, chat, user, meta, runner) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const ev = o => { try { res.write(`data: ${JSON.stringify(o)}\n\n`); } catch {} };
  ev({ t: 'meta', chat_id: chat.id, title: chat.title });
  let out = meta.prefix || '';
  const cb = { onText: d => { out += d; ev({ t: 'd', v: d }); }, onStatus: st => ev({ t: 's', v: st }) };
  try {
    const r = await runner(cb);
    if (r.paused) {
      AI_PENDING.set(chat.id, { st: r.state, user: user.id, list: meta.list, act: meta.act, mode: meta.mode, model: meta.model, at: Date.now() });
      ev({ t: 'confirm', actions: r.state.ask });
    } else {
      const mid = crypto.randomUUID(), files = [];
      for (const f of r.files || []) { const k = files.length; files.push({ name: f.name, mime: f.mime, size: f.buffer.length, stored: store(f.buffer), src: 'ai' }); cb.onText(`\n\n📎 [${f.name}](/api/ai-out/${mid}/${k})`); }
      out = (r.state?.text ?? r.text) + files.map((f, k) => `\n\n📎 [${f.name}](/api/ai-out/${mid}/${k})`).join('') + (r.cut ? '\n\n_(Câu trả lời quá dài nên bị cắt — hỏi tiếp «viết tiếp».)_' : '');
      await q(`INSERT INTO pl_ai_msg (id, chat_id, role, content, files, mode, model) VALUES ($1,$2,'assistant',$3,$4,$5,$6)`, [mid, chat.id, out, JSON.stringify(files), meta.mode, meta.model]);
      ev({ t: 'done', cut: r.cut, acted: !!r.acted });
    }
  } catch (e) {
    console.error('AI chat:', e.message);
    const msg = e.status === 401 ? 'Khóa API không hợp lệ hoặc đã bị thu hồi' : e.status === 429 && !/Gemini/.test(e.message) ? 'AI đang quá tải, thử lại sau ít phút' : e.message;
    await q(`INSERT INTO pl_ai_msg (chat_id, role, content, error, mode, model) VALUES ($1,'assistant',$2,$3,$4,$5)`, [chat.id, out, msg, meta.mode, meta.model]);
    ev({ t: 'err', v: msg });
  }
  await q(`UPDATE pl_ai_chat SET updated_at = now() WHERE id = $1`, [chat.id]);
  res.end();
}
// người dùng bấm «Đồng ý» / «Không» cho thao tác AI đề xuất
route('POST', '/api/ai-chat/confirm', async ({ res, user, body }) => {
  const chat = await chatOf(user, body.chat_id);
  const p = AI_PENDING.get(chat.id);
  if (!p || p.user !== user.id) bad('Không còn thao tác nào đang chờ (đã quá 30 phút hoặc máy chủ khởi động lại) — hỏi lại AI.');
  AI_PENDING.delete(chat.id);
  await aiStream(res, chat, user, { ...p, prefix: p.st.text }, cb => AI.agentResume(p.st, !!body.ok, { ...cb, app: aiApp(user, p.list), act: p.act }));
}, { raw: true });
// tệp do AI tạo (Excel, Word, biểu đồ…)
route('GET', '/api/ai-out/:id/:k', async ({ user, params, res }) => {
  const m = notFound(await one(`SELECT m.files, c.user_id FROM pl_ai_msg m JOIN pl_ai_chat c ON c.id = m.chat_id WHERE m.id = $1`, [params.id]), 'tệp');
  if (m.user_id !== user.id) deny('Không phải tệp của bạn');
  const f = notFound(m.files[+params.k], 'tệp');
  sendFile(res, readStored(f.stored), f.name, f.mime || 'application/octet-stream');
}, { raw: true });

// ---------- máy chủ ----------
// NO_LOGIN=1 (chạy thử): bỏ đăng nhập, mọi yêu cầu không có phiên dùng tài khoản admin
const NO_LOGIN = /^(1|true|yes)$/i.test(process.env.NO_LOGIN || '');
async function userFromReq(req) {
  const sid = cookies(req).qlda_sid;
  const u = sid && await one(`SELECT u.* FROM session s JOIN app_user u ON u.id = s.user_id WHERE s.sid = $1 AND s.expires_at > now() AND u.active`, [sid]);
  if (u || !NO_LOGIN) return u || null;
  const a = await one(`SELECT * FROM app_user WHERE is_admin AND active ORDER BY username LIMIT 1`);
  return a && { ...a, pw_hash: a.pw_hash || 'no-login' };   // không bắt đổi mật khẩu
}
function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  try {
    // tham số :id phải là uuid — nhờ vậy /api/plan/export.xlsx, /api/steps/init… không bị nhầm thành :id
    const idOk = r => { const i = r.keys.indexOf('id'); return i < 0 || uuidRe.test(r.re.exec(url.pathname)[i + 1]); };
    const r = routes.find(r => r.method === req.method && r.re.test(url.pathname) && idOk(r));
    if (!r) throw new HttpError(404, 'Không tìm thấy');
    const m = r.re.exec(url.pathname); const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const user = await userFromReq(req);
    if (!r.public && !user) throw new HttpError(401, 'Phiên đăng nhập đã hết, đăng nhập lại');
    const isMultipart = /multipart\/form-data/.test(req.headers['content-type'] || '');
    if (isMultipart && !r.multipart) bad('Không nhận tệp ở API này');
    const body = ['POST', 'PUT'].includes(req.method) && !isMultipart ? await readJson(req) : {};
    const query = Object.fromEntries(url.searchParams);
    if (query.project && !uuidRe.test(query.project)) bad('Tham số không hợp lệ');
    if (body.project_id && !uuidRe.test(body.project_id)) bad('Dự án không hợp lệ');
    const out = await r.handler({ req, res, user, body, query, params });
    if (!r.raw && !res.headersSent) send(res, 200, out ?? null);
  } catch (e) {
    const status = e.status || (e.code === '23514' || e.code === '23505' ? 400 : 500);
    if (status === 500) console.error(e);
    const msg = e.code === '23505' ? 'Bản ghi bị trùng' : e.code === '23514' ? 'Dữ liệu vi phạm ràng buộc' : status === 500 ? 'Lỗi máy chủ: ' + e.message : e.message;
    if (!res.headersSent) send(res, status, { error: msg });
  }
});
server.requestTimeout = 15 * 60e3;   // AI soạn / kiểm tra có thể mất vài phút
server.headersTimeout = 60e3;
(async () => {
  AGENCY = await q(`SELECT code, name, short_name FROM pl_agency`);
  // việc AI dở dang khi máy chủ tắt
  await q(`UPDATE pl_check SET status = 'loi', error = 'Máy chủ khởi động lại khi đang kiểm tra — bấm kiểm tra lại', done_at = now() WHERE status = 'dang'`);
  if (AI.enabled()) for (const f of await q(`SELECT id FROM pl_file WHERE ai_status IN ('cho','dang') AND current`)) enqueue(() => extractFile(f.id));
  else await q(`UPDATE pl_file SET ai_status = 'tat' WHERE ai_status IN ('cho','dang')`);
  await q(`ALTER TABLE pl_doc ADD COLUMN IF NOT EXISTS auto boolean NOT NULL DEFAULT false`);
  await q(`ALTER TABLE pl_check DROP CONSTRAINT IF EXISTS pl_check_kind_check; ALTER TABLE pl_check ADD CONSTRAINT pl_check_kind_check CHECK (kind IN ('ho_so','ket_qua','du_thao','tep'))`);
  await q(`ALTER TABLE pl_item ADD COLUMN IF NOT EXISTS issue_kind text, ADD COLUMN IF NOT EXISTS issue_text text, ADD COLUMN IF NOT EXISTS issue_by uuid REFERENCES app_user(id), ADD COLUMN IF NOT EXISTS issue_at timestamptz`);
  await q(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').match(/CREATE TABLE IF NOT EXISTS pl_event[\s\S]*?\);\s*CREATE INDEX[^;]*;/)[0]);
  await q(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').match(/-- người tham dự[\s\S]*?pl_event_invite_user[^;]*;/)[0]);
  // mục «phải soạn» có mẫu riêng mà chưa ghi loại văn bản → ghi theo mẫu
  for (const i of await q(`SELECT i.id, i.name, i.kind, s.name AS step FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE i.kind = 'soan' AND i.doc_kind IS NULL`)) {
    const m = MAU.find(i, { name: i.step }); if (m) await q(`UPDATE pl_item SET doc_kind = $2 WHERE id = $1`, [i.id, m.kind]);
  }
  // tự soạn / cập nhật văn bản các bước đang xử lý: lúc khởi động và mỗi 30 phút (sang ngày mới thì bước mới tới kỳ được soạn)
  // bản phụ (NO_JOBS=1) không chạy việc nền — bản chính đã chạy
  if (!process.env.NO_JOBS) { autoAll(); setInterval(autoAll, 30 * 60e3); }
  // chép hồ sơ ra thư mục trên máy: lúc khởi động và 5 phút một lần (bắt cả tệp dự thảo đã chốt, văn bản xuất từ bảng bồi thường)
  if (!process.env.NO_JOBS) { syncDisk(); setInterval(syncDisk, 5 * 60e3); }
  server.listen(PORT, HOST, () => console.log(`Module Pháp lý dự án: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${AI.enabled() ? '' : '  (AI tắt — chưa có ANTHROPIC_API_KEY)'}${PDF.canPrint() ? '' : '  (không tìm thấy Edge — chưa in PDF được)'}`));
})().catch(e => { console.error(e); process.exit(1); });
