// Áp schema Module Pháp lý dự án vào CSDL ctg_qlda (dùng chung với Module Quản lý dự án). Chạy lại an toàn.
//   node server/init-db.js
const path = require('path');
const fs = require('fs');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const base = await c.query(`SELECT to_regclass('public.project') AS p`);
  if (!base.rows[0].p) throw new Error('CSDL chưa có bảng project — chạy "npm run init-db" và "npm run sync" của Module Quản lý dự án trước.');
  await c.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await c.end();
  console.log('OK: bảng pl_* sẵn sàng trong CSDL ' + new URL(process.env.DATABASE_URL).pathname.slice(1));
})().catch(e => { console.error(e.message); process.exit(1); });
