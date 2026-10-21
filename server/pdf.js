// In HTML → PDF bằng Microsoft Edge chạy ẩn (có sẵn trên Windows) và ghép nhiều PDF / ảnh thành một bộ hồ sơ (pdf-lib).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { PDFDocument } = require('pdf-lib');

const EDGE = [process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const TMP = path.join(os.tmpdir(), 'ctg-phap-ly-pdf');
fs.mkdirSync(TMP, { recursive: true });
const canPrint = () => !!EDGE;
const wait = ms => new Promise(r => setTimeout(r, ms));
let chain = Promise.resolve();   // in lần lượt, tránh nhiều tiến trình Edge cùng lúc

// Trình khởi chạy Edge có thể thoát trước khi ghi xong tệp → chờ tệp xuất hiện và kích thước ổn định.
function htmlToPdf(html) {
  const run = async () => {
    if (!EDGE) throw new Error('Không tìm thấy Microsoft Edge / Chrome để in PDF (đặt EDGE_PATH trong .env)');
    const id = crypto.randomUUID(), src = path.join(TMP, id + '.html'), out = path.join(TMP, id + '.pdf');
    fs.writeFileSync(src, html);
    try {
      await new Promise(resolve => execFile(EDGE, ['--headless', '--disable-gpu', '--no-pdf-header-footer', '--no-first-run', '--disable-extensions',
        '--user-data-dir=' + path.join(TMP, 'profile'), '--print-to-pdf=' + out, pathToFileURL(src).href], { timeout: 90000, windowsHide: true }, () => resolve()));
      let last = -1;
      for (let i = 0; i < 120; i++) {
        if (fs.existsSync(out)) { const n = fs.statSync(out).size; if (n > 0 && n === last) break; last = n; }
        await wait(250);
      }
      if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error('In PDF không thành công (Edge không tạo được tệp)');
      return fs.readFileSync(out);
    } finally { fs.rmSync(src, { force: true }); fs.rmSync(out, { force: true }); }
  };
  const p = chain.then(run, run); chain = p.catch(() => {}); return p;
}

// parts: [{kind:'pdf'|'image', buffer, mime}] → { buffer, pages:[số trang từng phần] }
async function mergeParts(parts) {
  const doc = await PDFDocument.create(), pages = [];
  for (const p of parts) {
    const before = doc.getPageCount();
    try {
      if (p.kind === 'pdf') {
        const src = await PDFDocument.load(p.buffer, { ignoreEncryption: true });
        (await doc.copyPages(src, src.getPageIndices())).forEach(pg => doc.addPage(pg));
      } else if (p.kind === 'image') {
        const img = /png/i.test(p.mime) ? await doc.embedPng(p.buffer) : await doc.embedJpg(p.buffer);
        const W = 595.28, H = 841.89, m = 28, s = Math.min((W - 2 * m) / img.width, (H - 2 * m) / img.height, 1.5);
        const pg = doc.addPage([W, H]); pg.drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, width: img.width * s, height: img.height * s });
      }
    } catch (e) { p.error = e.message; }
    pages.push(doc.getPageCount() - before);
  }
  return { buffer: Buffer.from(await doc.save()), pages };
}
const pageCount = async buf => { try { return (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount(); } catch { return 0; } };

module.exports = { htmlToPdf, mergeParts, pageCount, canPrint };
