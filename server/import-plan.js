// Nhập «Trình tự thủ tục pháp lý dự án» (Excel do người dùng lập) làm kế hoạch + checklist hồ sơ của dự án.
// Mỗi trang tính (GPMB, DTXD…): cột STT | Trình tự công việc | Danh mục hồ sơ | Ghi chú | Dự kiến bắt đầu | Tiến độ (ngày) | Dự kiến hoàn thành | Tình trạng.
// Dòng STT «I» = phần, «I.1» = mục, số hoặc trống = công việc (= một bước); mỗi dòng «- …» trong Danh mục hồ sơ = một mục checklist.
// Nhập lại: giữ dấu tick «đã có» và tệp của mục trùng tên.
//   node server/import-plan.js <mã dự án> <tệp.xlsx>
const path = require('path');
const { readXlsx } = require('./xlsx');

const xlDate = v => typeof v === 'number' && v > 30000 && v < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10)
  : /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.test(String(v || '').trim()) ? String(v).trim().replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, (_, d, m, y) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`) : null;
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const docLines = v => String(v ?? '').split(/\r?\n/).map(x => x.replace(/^\s*[-–•+]\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
// tình trạng ghi trong Excel → trạng thái bước
function statusOf(t) {
  const s = clean(t).toLowerCase();
  if (!s) return 'chua';
  if (/^không thực hiện/.test(s)) return 'bo_qua';
  if (/^(đã )?hoàn thành/.test(s) && !/còn/.test(s)) return 'xong';
  if (/còn|đang|chưa xong|một phần/.test(s)) return 'dang';
  return 'chua';
}
// giai đoạn chuẩn theo phần / mục
function phaseOf(sheet, part, sec) {
  if (/gpmb|đất|giao đất/i.test(sheet)) return 'GD2';
  if (part === 'III') return 'GD6';
  if (part === 'II') { if (/^II\.(5|6)$/.test(sec)) return 'GD5'; if (/^II\.7$/.test(sec)) return 'GD6'; if (/^II\.4$/.test(sec)) return 'GD4'; return 'GD3'; }
  if (/^I\.(1|3|4)$/.test(sec)) return 'GD1';
  return 'GD3';
}
function parsePlan(buf) {
  const out = [];
  readXlsx(buf).forEach((sh, si) => {
    const R = sh.rows; let h = R.findIndex(r => r.some(c => /trình tự công việc/i.test(String(c))));
    if (h < 0) return;
    const H = R[h].map(c => clean(c).toLowerCase()), col = re => H.findIndex(c => re.test(c));
    const C = { stt: col(/^stt$/), name: col(/trình tự/), docs: col(/danh mục hồ sơ/), note: col(/ghi chú/), start: col(/bắt đầu/), days: col(/tiến độ/), end: col(/hoàn thành/), st: col(/tình trạng/) };
    let part = '', partName = '', partNote = '', sec = '', secName = '', secNote = '', seq = 0;
    for (let i = h + 1; i < R.length; i++) {
      const r = R[i] || [], g = k => C[k] >= 0 ? r[C[k]] : '';
      const stt = clean(g('stt')), name = clean(g('name')).replace(/^-\s*/, ''), docs = docLines(g('docs'));
      if (!name && !docs.length) continue;
      if (/^[IVX]+$/.test(stt)) { part = stt; partName = name; partNote = clean(g('note')); sec = ''; secName = ''; secNote = ''; continue; }
      if (/^[IVX]+\.\d+$/.test(stt)) { sec = stt; secName = name; secNote = clean(g('note')); continue; }
      if (!name) continue;
      seq++;
      const note = clean(g('note')), days = Number(g('days')) || 0, st = clean(g('st'));
      out.push({
        key: `${sh.name}:${sec || part}:${name.toLowerCase()}`, sheet: `${sh.name} · ${part}. ${partName}`, section: sec ? `${sec}. ${secName}` : `${part}. ${partName}`,
        stt: stt || null, name, phase: phaseOf(sh.name, part, sec), docs, basis: note || secNote || partNote || null, extra_note: secNote && note ? secNote : null,
        start: xlDate(g('start')), end: xlDate(g('end')), days, status: statusOf(st), status_text: st || null, ord: (si + 1) * 100000 + i, sheetIdx: si, seq,
      });
    }
  });
  return out;
}

// t: {q, one} trong giao dịch. replace: xóa các bước không có trong tệp (kể cả bước tạo tự động trước đó)
async function importPlan(t, pid, buf, userId, { replace = true } = {}) {
  const tasks = parsePlan(buf);
  if (!tasks.length) throw Object.assign(new Error('Không đọc được công việc nào — cần cột «Trình tự công việc» và «Danh mục hồ sơ»'), { status: 400 });
  const old = await t.q(`SELECT * FROM pl_step WHERE project_id = $1`, [pid]);
  const oldItems = await t.q(`SELECT i.*, (SELECT count(*) FROM pl_file f WHERE f.item_id = i.id) AS nf FROM pl_item i JOIN pl_step s ON s.id = i.step_id WHERE s.project_id = $1`, [pid]);
  const keep = new Set(), ids = {};
  let nSteps = 0, nItems = 0;
  for (const x of tasks) {
    const fixed = !!(x.start || x.end);
    const end = x.end || (x.start && x.days ? new Date(Date.parse(x.start) + x.days * 864e5).toISOString().slice(0, 10) : null);
    const start = x.start || (end && x.days ? new Date(Date.parse(end) - x.days * 864e5).toISOString().slice(0, 10) : null);
    const ex = old.find(s => s.src_key === x.key);
    const note = [x.status_text && x.status !== 'xong' ? 'Tình trạng: ' + x.status_text : null, x.status === 'xong' && x.status_text && !/^hoàn thành$/i.test(x.status_text) ? x.status_text : null].filter(Boolean).join(' · ') || null;
    const vals = [x.name, x.phase, x.ord, x.days, x.status, start, end, x.status === 'xong' ? end : null, note, x.sheet, x.section, x.stt, fixed];
    let id;
    if (ex) {
      id = ex.id;
      await t.q(`UPDATE pl_step SET name=$2, phase_code=$3, ord=$4, proc_days=$5, prep_days=0, workdays=false, status=$6, plan_start=$7, plan_end=$8, base_start=coalesce(base_start,$7), base_end=coalesce(base_end,$8),
        act_end=coalesce(act_end,$9), note=$10, sheet=$11, section=$12, stt=$13, fixed=$14, updated_at=now() WHERE id=$1`, [id, ...vals.slice(0, 7), vals[7], ...vals.slice(8)]);
    } else {
      id = (await t.one(`INSERT INTO pl_step (project_id, src_key, code, name, phase_code, ord, proc_days, prep_days, status, plan_start, plan_end, base_start, base_end, act_end, note, sheet, section, stt, fixed, owner_id)
        VALUES ($1,$2,'EXCEL',$3,$4,$5,$6,0,$7,$8,$9,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`, [pid, x.key, ...vals, userId])).id;
    }
    ids[x.key] = id; keep.add(id); nSteps++;
    // checklist: mỗi dòng hồ sơ một mục; giữ tick / tệp của mục trùng tên
    const mine = oldItems.filter(i => i.step_id === id);
    const seen = new Set();
    for (const [k, d] of x.docs.entries()) {
      const optional = /\(nếu có\)/i.test(d), kind = /^(qđ|quyết định|giấy phép|giấy chứng nhận|thông báo kết quả|vb (chấp thuận|thông báo|xác nhận|tham gia ý kiến|cung cấp|tiếp nhận))/i.test(d) && !/dự thảo/i.test(d) ? 'ket_qua' : /^(vb|văn bản|tờ trình|đơn|công văn|dự thảo)/i.test(d) && /cđt|chủ đầu tư|đề nghị|của nhà đầu tư|tờ trình|đơn|dự thảo/i.test(d) ? 'soan' : 'dau_vao';
      const hit = mine.find(i => !seen.has(i.id) && i.name.toLowerCase() === d.toLowerCase());
      if (hit) {
        seen.add(hit.id);
        await t.q(`UPDATE pl_item SET ord=$2, required=$3, basis=$4, due_on=$5, done = done OR $6 WHERE id=$1`, [hit.id, k * 10, !optional, x.basis, end, x.status === 'xong']);
      } else {
        await t.q(`INSERT INTO pl_item (step_id, kind, name, required, basis, source, ord, due_on, done, done_at, created_by) VALUES ($1,$2,$3,$4,$5,'nguoi_dung',$6,$7,$8,$9,$10)`,
          [id, kind, d, !optional, x.basis, k * 10, end, x.status === 'xong', x.status === 'xong' ? new Date() : null, userId]);
      }
      nItems++;
    }
    // mục cũ không còn trong tệp: xóa nếu chưa có tệp
    for (const i of mine) if (!seen.has(i.id) && !Number(i.nf)) await t.q(`DELETE FROM pl_item WHERE id = $1`, [i.id]);
  }
  // việc không có ngày: nối tiếp việc trước trong cùng trang tính để hệ thống dự tính ngày
  for (const x of tasks) {
    if (x.start || x.end) continue;
    const prev = tasks.filter(y => y.sheetIdx === x.sheetIdx && y.seq < x.seq && y.status !== 'bo_qua').at(-1);
    await t.q(`UPDATE pl_step SET deps = $2 WHERE id = $1`, [ids[x.key], prev ? [ids[prev.key]] : []]);
  }
  let removed = 0;
  if (replace) for (const s of old) if (!keep.has(s.id)) {
    const nf = await t.one(`SELECT count(*) AS n FROM pl_file WHERE step_id = $1`, [s.id]);
    if (Number(nf.n)) continue;   // bước đã có tệp: giữ lại, không xóa
    await t.q(`UPDATE pl_step SET deps = array_remove(deps, $1) WHERE project_id = $2`, [s.id, pid]);
    await t.q(`DELETE FROM pl_step WHERE id = $1`, [s.id]); removed++;
  }
  return { steps: nSteps, items: nItems, removed };
}

module.exports = { parsePlan, importPlan };

if (require.main === module) {
  try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
  const { tx, one, pool } = require('./db');
  const [code, file] = process.argv.slice(2);
  (async () => {
    const p = await one(`SELECT id FROM project WHERE code = $1`, [code]); if (!p) throw new Error('Không có dự án ' + code);
    const u = await one(`SELECT id FROM app_user WHERE is_admin ORDER BY created_at LIMIT 1`);
    const r = await tx(t => importPlan(t, p.id, require('fs').readFileSync(file), u?.id || null));
    console.log('Đã nhập:', r); await pool.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
}
