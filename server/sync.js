// Đồng bộ CHỈ ĐỌC danh mục từ DB QLDA (duan_noxh_ct) sang các bảng pl_* trong ctg_qlda:
// giai đoạn, cơ quan, thủ tục (+ thời hạn), văn bản pháp luật (+ quan hệ, căn cứ thủ tục), mốc chuẩn + tiền đề, biểu mẫu.
// Sau đó nạp checklist mẫu khởi tạo (seed.js). Không đụng tới dữ liệu dự án người dùng đã nhập.
//   node server/sync.js
const path = require('path');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
const { Client } = require('pg');
const { pool } = require('./db');
const { seedTemplates, QLDA_RESULT } = require('./seed');

const VN = c => `(${c} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
const tvplSearch = num => num ? 'https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=' + encodeURIComponent(num) + '&match=True' : null;

async function syncPhapLy() {
  const src = new Client({ connectionString: process.env.QLDA_URL });
  await src.connect();
  const get = (sql, p) => src.query(sql, p).then(r => r.rows);
  const out = {};
  const db = await pool.connect();
  const x = (sql, p) => db.query(sql, p);
  try {
    await x('BEGIN');
    for (const p of await get(`SELECT code, name, phase_order FROM md.phase WHERE deleted_at IS NULL`))
      await x(`INSERT INTO pl_phase VALUES ($1,$2,$3) ON CONFLICT (code) DO UPDATE SET name=$2, ord=$3`, [p.code, p.name, p.phase_order]);

    const agencies = await get(`SELECT id, code, name, short_name FROM md.agency WHERE deleted_at IS NULL`);
    for (const a of agencies)
      await x(`INSERT INTO pl_agency VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET code=$2, name=$3, short_name=$4`, [a.id, a.code, a.name, a.short_name]);
    out.co_quan = agencies.length;

    const procs = await get(`
      SELECT p.id, p.code, p.name, ph.code AS phase_code, p.agency_text, p.basis_text, p.result_text, p.deadline_param_text, p.display_order,
             (SELECT CASE WHEN par.value ~ '^\\d+$' THEN par.value::int END FROM md.parameter par WHERE par.code = p.deadline_param_codes[1] AND par.deleted_at IS NULL LIMIT 1) AS days,
             (SELECT par.duration_unit = 'NGAY_LAM_VIEC' FROM md.parameter par WHERE par.code = p.deadline_param_codes[1] AND par.deleted_at IS NULL LIMIT 1) AS workdays
      FROM md.procedure p LEFT JOIN md.phase ph ON ph.id = p.phase_id WHERE p.deleted_at IS NULL`);
    for (const p of procs)
      await x(`INSERT INTO pl_procedure VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET code=$2, name=$3, phase_code=$4,
        agency_text=$5, basis_text=$6, result_text=$7, deadline_text=$8, deadline_days=$9, workdays=$10, ord=$11`,
        [p.id, p.code, p.name, p.phase_code, p.agency_text, p.basis_text, p.result_text, p.deadline_param_text, p.days, p.workdays, p.display_order]);
    out.thu_tuc = procs.length;

    const docs = await get(`
      SELECT l.id, l.code, l.number_text, l.title, t.name AS doc_type, coalesce(a.name, l.issuer_note) AS issuer, l.issued_on,
             ${VN('l.valid_from')} AS eff_from, ${VN('l.valid_to')} AS eff_to, l.scope_note, l.source_url, s.name AS status
      FROM md.legal_document l LEFT JOIN md.code_item t ON t.id = l.legal_doc_type_item_id LEFT JOIN md.code_item s ON s.id = l.status_item_id
      LEFT JOIN md.agency a ON a.id = l.issuer_agency_id WHERE l.deleted_at IS NULL`);
    for (const d of docs)
      await x(`INSERT INTO pl_legal_doc (src_id, code, number_text, title, doc_type, issuer, issued_on, effective_from, effective_to, src_status, url, note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (src_id) DO UPDATE SET code=$2, number_text=$3, title=$4, doc_type=$5, issuer=$6, issued_on=$7, effective_from=$8, effective_to=$9, src_status=$10,
          url=coalesce(pl_legal_doc.url, $11)`,
        [d.id, d.code, d.number_text, d.title, d.doc_type, d.issuer, d.issued_on, d.eff_from > '2000-01-01' ? d.eff_from : null, d.eff_to, d.status, d.source_url || tvplSearch(d.number_text), d.scope_note]);
    out.van_ban_phap_luat = docs.length;

    const rels = await get(`SELECT r.id, r.target_document_id, r.acting_document_id, ci.name AS rel, r.scope_text, ${VN('r.valid_from')} AS vf
      FROM md.legal_document_relation r LEFT JOIN md.code_item ci ON ci.id = r.relation_type_item_id WHERE r.deleted_at IS NULL`);
    await x(`DELETE FROM pl_legal_rel`);
    for (const r of rels) await x(`INSERT INTO pl_legal_rel VALUES ($1,$2,$3,$4,$5,$6)`, [r.id, r.target_document_id, r.acting_document_id, r.rel, r.scope_text, r.vf]);
    await x(`DELETE FROM pl_procedure_basis`);
    for (const b of await get(`SELECT procedure_id, legal_document_id, string_agg(article_text, '; ') AS art FROM md.procedure_legal_basis WHERE deleted_at IS NULL GROUP BY 1,2`))
      await x(`INSERT INTO pl_procedure_basis VALUES ($1,$2,$3)`, [b.procedure_id, b.legal_document_id, b.art]);

    // mốc chuẩn, thủ tục của mốc, tiền đề giữa các mốc
    const mocs = await get(`SELECT m.code, m.name, ph.code AS phase_code, m.display_order FROM md.milestone m LEFT JOIN md.phase ph ON ph.id = m.phase_id WHERE m.deleted_at IS NULL`);
    for (const m of mocs) await x(`INSERT INTO pl_mmoc VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO UPDATE SET name=$2, phase_code=$3, ord=$4`, [m.code, m.name, m.phase_code, m.display_order]);
    await x(`DELETE FROM pl_mmoc_proc`); await x(`DELETE FROM pl_mmoc_pre`);
    for (const r of await get(`SELECT DISTINCT m.code AS m, p.code AS p FROM md.milestone_procedure mp JOIN md.milestone m ON m.id = mp.milestone_id JOIN md.procedure p ON p.id = mp.procedure_id WHERE mp.deleted_at IS NULL`))
      await x(`INSERT INTO pl_mmoc_proc VALUES ($1,$2)`, [r.m, r.p]);
    for (const r of await get(`SELECT DISTINCT a.code AS m, b.code AS p FROM md.milestone_prerequisite q JOIN md.milestone a ON a.id = q.milestone_id JOIN md.milestone b ON b.id = q.prerequisite_id WHERE q.deleted_at IS NULL`))
      await x(`INSERT INTO pl_mmoc_pre VALUES ($1,$2)`, [r.m, r.p]);
    out.moc = mocs.length;

    // biểu mẫu → thủ tục (qua công việc)
    const forms = await get(`
      SELECT f.code, f.name, l.number_text, f.is_usable, f.usage_note,
             coalesce((SELECT array_agg(DISTINCT pr.code) FROM md.form_task ft JOIN md.procedure_task pt ON pt.task_id = ft.task_id AND pt.deleted_at IS NULL
                        JOIN md.procedure pr ON pr.id = pt.procedure_id WHERE ft.form_id = f.id AND ft.deleted_at IS NULL), '{}') AS procs
      FROM md.form f LEFT JOIN md.legal_document l ON l.id = f.legal_document_id WHERE f.deleted_at IS NULL`);
    for (const f of forms)
      await x(`INSERT INTO pl_form VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO UPDATE SET name=$2, legal_number=$3, usable=$4, procedure_codes=$5, note=$6`,
        [f.code, f.name, f.number_text, f.is_usable !== false, f.procs, f.usage_note]);
    out.bieu_mau = forms.length;

    // danh mục hồ sơ bắt buộc của dự án + văn bản chứng minh
    const projMap = Object.fromEntries((await x(`SELECT id, src_id FROM project WHERE src_id IS NOT NULL`)).rows.map(r => [r.src_id, r.id]));
    const lines = await get(`
      SELECT l.id, rl.project_id, l.line_code, l.description, l.applicable, pr.code AS proc_code,
             (SELECT string_agg(coalesce(pd.number_text, pd.code), ', ') FROM doc.document_link k JOIN doc.project_document pd ON pd.id = k.document_id AND pd.deleted_at IS NULL
               WHERE k.target_table = 'doc.required_doc_line' AND k.target_id = l.id AND k.deleted_at IS NULL) AS evidence
      FROM doc.required_doc_line l JOIN doc.required_doc_list rl ON rl.id = l.list_id AND rl.is_effective AND rl.deleted_at IS NULL
      LEFT JOIN md.procedure pr ON pr.id = l.procedure_id WHERE l.deleted_at IS NULL`);
    let nl = 0;
    for (const l of lines) {
      const pid = projMap[l.project_id]; if (!pid) continue;
      await x(`INSERT INTO pl_qlda_line VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (src_id) DO UPDATE SET line_code=$3, procedure_code=$4, description=$5, evidence=$6, applicable=$7`,
        [l.id, pid, l.line_code, l.proc_code || QLDA_RESULT[l.line_code] || null, l.description, l.evidence, l.applicable !== false]);
      nl++;
    }
    out.ho_so_bat_buoc_qlda = nl;

    out.checklist_mau = await seedTemplates(x);
    await x(`INSERT INTO setting VALUES ('pl_last_sync', now()::text) ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
    await x('COMMIT');
  } catch (e) { await x('ROLLBACK'); throw e; } finally { db.release(); await src.end(); }
  return out;
}

module.exports = { syncPhapLy };
if (require.main === module) syncPhapLy().then(r => { console.log('Đồng bộ xong:', r); return pool.end(); }).catch(e => { console.error(e.message); process.exit(1); });
