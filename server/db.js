// Kết nối PostgreSQL dùng chung cho server và các script.
const path = require('path');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
const { Pool, types } = require('pg');

types.setTypeParser(1082, v => v);                        // date → 'YYYY-MM-DD' (không lệch múi giờ)
types.setTypeParser(1700, v => v === null ? null : +v);   // numeric → number
types.setTypeParser(20, v => v === null ? null : +v);     // bigint (count) → number

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const q = (sql, params) => pool.query(sql, params).then(r => r.rows);
const one = (sql, params) => q(sql, params).then(r => r[0] || null);
async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn({ q: (s, p) => c.query(s, p).then(r => r.rows), one: (s, p) => c.query(s, p).then(r => r.rows[0] || null) });
    await c.query('COMMIT');
    return out;
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

module.exports = { pool, q, one, tx };
