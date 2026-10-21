/* Trình bày văn bản hành chính — dùng chung cho trình duyệt (xem trước, in) và máy chủ (in PDF bằng Edge).
   Thể thức, kỹ thuật trình bày theo Nghị định 30/2020/NĐ-CP: khổ A4, lề trên/dưới 2 cm, trái 3 cm, phải 1,5 cm; Times New Roman;
   quốc hiệu 13 đậm, tiêu ngữ 14 đậm có gạch dưới; tên loại 14 đậm in hoa; nội dung 14 căn đều, thụt đầu dòng 1 cm, cách đoạn 6 pt; nơi nhận 12/11. */
(function (root, factory) { const m = factory(); if (typeof module === 'object' && module.exports) module.exports = m; else root.VB = m; })(typeof self !== 'undefined' ? self : this, function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const br = s => esc(s).replace(/\n/g, '<br>');
  const LOAI = {
    cong_van: { name: 'Công văn', sym: '' }, to_trinh: { name: 'Tờ trình', sym: 'TTr' }, don: { name: 'Đơn đề nghị', sym: '' },
    quyet_dinh: { name: 'Quyết định', sym: 'QĐ' }, thong_bao: { name: 'Thông báo', sym: 'TB' }, bao_cao: { name: 'Báo cáo', sym: 'BC' },
    ke_hoach: { name: 'Kế hoạch', sym: 'KH' }, bien_ban: { name: 'Biên bản', sym: 'BB' }, giay_uy_quyen: { name: 'Giấy ủy quyền', sym: 'GUQ' },
  };
  const lc1 = s => { s = String(s || '').trim(); return s ? s[0].toLowerCase() + s.slice(1) : s; };
  const uc1 = s => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const lines = v => (Array.isArray(v) ? v : String(v || '').split('\n')).map(x => String(x).trim()).filter(Boolean);
  const F = "font-family:'Times New Roman',Times,serif;color:#000";
  const P = 'margin:0 0 6pt;text-indent:1cm;text-align:justify;line-height:1.35';

  // sửa trực tiếp trên bản xem trước (chỉ trình duyệt dùng): mỗi phần bọc trong vùng contenteditable gắn tên trường; «[cần bổ sung: …]» tô nổi
  let ED = false;
  const mk = h => h.replace(/\[[^\]\n]{1,200}\]/g, m => `<mark>${m}</mark>`);   // mọi chỗ […] (mẫu, AI) đều là chỗ cần bổ sung
  const E = (f, html, block) => ED ? `<${block ? 'div' : 'span'} class="ed" contenteditable="true" spellcheck="false" data-f="${f}">${mk(html)}</${block ? 'div' : 'span'}>` : html;
  function bodyHtml(body) {
    return E('body', lines(body).map(l => {
      const m = /^(Điều\s+\d+[a-z]?\.)(.*)$/.exec(l);
      if (m) return `<p style="${P}"><b>${esc(m[1])}</b>${esc(m[2])}</p>`;
      if (/^[IVX]+\.\s/.test(l) || /^(QUYẾT ĐỊNH|QUYẾT NGHỊ):?$/.test(l)) return `<p style="${P};text-indent:0;font-weight:bold">${esc(l)}</p>`;
      return `<p style="${P}">${esc(l)}</p>`;
    }).join(''), true);
  }
  const sp = s => esc(s).replace(/ {2,}/g, m => '&nbsp;'.repeat(m.length));
  const dateLine = d => `${E('place', esc(d.place || '[Địa danh]'))}, ${E('date_text', sp(d.date_text || `ngày      tháng      năm ${new Date().getFullYear()}`))}`;
  const signBlock = (s, hint, i = 1) => `<b>${E(`s${i}t`, br((s?.title || '').toUpperCase()))}</b>${hint ? `<br><i style="font-size:12pt">${esc(hint)}</i>` : ''}<br><br><br><br><br><b>${E(`s${i}n`, br(s?.name || ''))}</b>`;
  const quocHieu = (w = '60%') => `<b style="font-size:13pt">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b style="font-size:14pt">Độc lập - Tự do - Hạnh phúc</b><br><span style="display:inline-block;width:${w};border-top:1px solid #000;margin:1pt 0 6pt"></span>`;

  // d: {kind, issuer, unit, number_text, place, date_text, subject, authority, bases[], recipients[], body, receivers[], signers[{title,name}]}
  function render(d, o) {
    ED = !!(o && o.edit);
    try { return draw(d); } finally { ED = false; }
  }
  function draw(d) {
    const k = d.kind || 'cong_van', L = LOAI[k] || LOAI.cong_van, kg = lines(d.recipients), signers = (d.signers || []).filter(s => s && (s.title || s.name));
    let h = `<div class="vb" style="${F};font-size:14pt;line-height:1.3">`;
    if (k === 'don') {
      h += `<div style="text-align:center">${quocHieu('38%')}</div>
        <p style="text-align:right;margin:0 0 12pt"><i>${dateLine(d)}</i></p>
        <p style="text-align:center;margin:12pt 0 0;font-weight:bold;font-size:14pt">${E('subject', br(String(d.subject || 'ĐƠN ĐỀ NGHỊ').toUpperCase().startsWith('ĐƠN') ? String(d.subject).toUpperCase() : 'ĐƠN ĐỀ NGHỊ ' + String(d.subject || '').toUpperCase()))}</p>
        ${kg.length > 1 ? `<table style="border-collapse:collapse;margin:10pt auto 12pt"><tr><td style="vertical-align:top;padding:0 6pt 0 0;white-space:nowrap">Kính gửi:</td><td style="padding:0">${E('recipients', kg.map(x => `- ${br(x)};`).join('<br>'))}</td></tr></table>` : `<p style="text-align:center;margin:10pt 0 12pt">Kính gửi: ${E('recipients', br(kg[0] || '[…]'))}.</p>`}`;
    } else {
      h += `<table style="width:100%;border-collapse:collapse"><tr>
        <td style="width:40%;text-align:center;vertical-align:top;padding:0;font-size:13pt">${d.issuer ? E('issuer', br(String(d.issuer).toUpperCase())) + '<br>' : ''}<b>${E('unit', br(String(d.unit || '').toUpperCase()))}</b><br><span style="display:inline-block;width:32%;border-top:1px solid #000;margin:1pt 0 4pt"></span><br>${E('number_text', sp(d.number_text || 'Số:'))}${k === 'cong_van' && d.subject ? `<br><span style="font-size:12pt">V/v ${E('subject', br(lc1(d.subject)))}</span>` : ''}</td>
        <td style="text-align:center;vertical-align:top;padding:0">${quocHieu()}<br><i>${dateLine(d)}</i></td></tr></table>`;
      if (k !== 'cong_van') {
        const sub = k === 'quyet_dinh' || k === 'to_trinh' ? (/^về\s/i.test(d.subject || '') ? uc1(d.subject) : 'Về việc ' + lc1(d.subject)) : uc1(d.subject);
        h += `<p style="text-align:center;margin:18pt 0 0;font-weight:bold">${esc(L.name.toUpperCase())}</p><p style="text-align:center;margin:0 0 4pt;font-weight:bold">${E('subject', br(sub))}</p>
          <p style="text-align:center;margin:0 0 12pt"><span style="display:inline-block;width:22%;border-top:1px solid #000"></span></p>`;
      } else h += `<p style="margin:0 0 10pt">&nbsp;</p>`;
      if (k === 'quyet_dinh') {
        if (d.authority) h += `<p style="text-align:center;margin:0 0 10pt;font-weight:bold">${E('authority', br(String(d.authority).toUpperCase()))}</p>`;
        h += E('bases', lines(d.bases).map((b, i, a) => `<p style="${P}"><i>${esc(i === a.length - 1 && k !== 'quyet_dinh' ? b.replace(/;$/, '.') : b)}</i></p>`).join(''), true);
        h += `<p style="text-align:center;margin:10pt 0 8pt;font-weight:bold">QUYẾT ĐỊNH:</p>`;
      } else {
        if (['cong_van', 'to_trinh', 'giay_uy_quyen'].includes(k) || kg.length)
          h += kg.length > 1 ? `<table style="border-collapse:collapse;margin:0 auto 10pt"><tr><td style="vertical-align:top;padding:0 6pt 0 0;white-space:nowrap">Kính gửi:</td><td style="padding:0">${E('recipients', kg.map(x => `- ${br(x)};`).join('<br>'))}</td></tr></table>`
            : kg.length ? `<p style="text-align:center;margin:0 0 10pt">Kính gửi: ${E('recipients', br(kg[0]))}.</p>` : '';
        h += E('bases', lines(d.bases).map((b, i, a) => `<p style="${P}"><i>${esc(i === a.length - 1 && k !== 'quyet_dinh' ? b.replace(/;$/, '.') : b)}</i></p>`).join(''), true);
      }
    }
    h += bodyHtml(d.body);
    if (k === 'bien_ban' && signers.length > 1) {
      h += `<table class="vb-sign" style="width:100%;border-collapse:collapse;margin-top:14pt"><tr>${signers.map((s, i) => `<td style="text-align:center;vertical-align:top;padding:0 4pt">${signBlock(s, '', i + 1)}</td>`).join('')}</tr></table>`;
    } else if (k === 'don') {
      h += `<table class="vb-sign" style="width:100%;border-collapse:collapse;margin-top:14pt"><tr><td style="width:45%"></td><td style="text-align:center;vertical-align:top;padding:0">${signBlock(signers[0] || { title: 'ĐẠI DIỆN CHỦ ĐẦU TƯ' }, /NGƯỜI|ĐƠN/i.test(signers[0]?.title || '') ? '(Ký, ghi rõ họ tên)' : '(Ký, ghi rõ họ tên, đóng dấu)')}</td></tr></table>`;
    } else {
      h += `<table class="vb-sign" style="width:100%;border-collapse:collapse;margin-top:12pt"><tr>
        <td style="width:50%;vertical-align:top;padding:0;font-size:12pt"><b><i>Nơi nhận:</i></b><br><span style="font-size:11pt">${E('receivers', lines(d.receivers).map(x => `- ${br(x)}`).join('<br>'))}</span></td>
        <td style="text-align:center;vertical-align:top;padding:0">${signBlock(signers[0])}</td></tr></table>`;
    }
    return h + '</div>';
  }

  // trang in hoàn chỉnh (nhiều văn bản, mỗi văn bản sang trang mới).
  // NĐ 30/2020: A4, lề trên/dưới 2 cm, trái 3 cm, phải 1,5 cm; số trang cỡ 13 giữa lề trên, không đánh số trang đầu.
  // Tự căn: văn bản chỉ tràn ít dòng sang trang cuối thì lần lượt giãn dòng 1,15 → bớt khoảng ký → cỡ chữ 13 (vẫn trong khung NĐ 30).
  const FIT = `(function(){var H=257*96/25.4,T=0.4;function fit(){[].forEach.call(document.querySelectorAll('.pg'),function(pg){var v=pg.querySelector('.vb');if(!v)return;
    for(var k=1;k<=3;k++){var h=pg.scrollHeight,n=Math.ceil(h/H-0.005),r=h/H-(n-1);if(n<2||r>T)break;v.classList.add('fit'+k)}})}
    if(document.readyState!=='loading')fit();else document.addEventListener('DOMContentLoaded',fit);window.__vbFit=fit})();`;
  function page(parts, title = 'Văn bản') {
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4;margin:2cm 1.5cm 2cm 3cm;@top-center{content:counter(page);font-family:'Times New Roman',Times,serif;font-size:13pt;vertical-align:bottom;padding-bottom:6mm}}
      @page:first{@top-center{content:none}}
      html,body{margin:0;background:#fff}body{width:165mm}
      .pg{page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}
      table{page-break-inside:auto}tr{page-break-inside:avoid;break-inside:avoid}p{orphans:3;widows:3}
      .vb-sign{page-break-inside:avoid;break-inside:avoid}
      .vb.fit1 p{line-height:1.15!important}.vb.fit2 .vb-sign br+br+br+br{display:none}.vb.fit3{font-size:13pt!important}
      @media screen{body{margin:12px auto}}</style></head>
      <body>${parts.map(p => `<div class="pg">${p}</div>`).join('')}<script>${FIT}<\/script></body></html>`;
  }

  // ---------- số tiền bằng chữ ----------
  const DV = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function ba(n, full) {
    const t = Math.floor(n / 100), c = Math.floor(n % 100 / 10), d = n % 10, o = [];
    if (full || t) o.push(DV[t] + ' trăm');
    if (c > 1) o.push(DV[c] + ' mươi'); else if (c === 1) o.push('mười'); else if (d && (full || t)) o.push('lẻ');
    if (d) o.push(c > 1 && d === 1 ? 'mốt' : c >= 1 && d === 5 ? 'lăm' : c > 1 && d === 4 ? 'tư' : DV[d]);
    return o.join(' ');
  }
  function soChu(v) {
    let n = Math.round(Math.abs(Number(v) || 0)); if (!n) return 'Không đồng';
    const U = ['', ' nghìn', ' triệu', ' tỷ'], g = [];
    while (n > 0) { g.push(n % 1000); n = Math.floor(n / 1000); }
    const o = [];
    for (let i = g.length - 1; i >= 0; i--) {
      if (!g[i]) { if (i % 3 === 0 && i > 0 && o.length) o.push(U[3].trim()); continue; }
      const s = ba(g[i], i < g.length - 1) + (i % 3 === 0 && i > 0 ? U[3] : U[i % 3]);
      o.push(s.trim());
    }
    const s = o.join(' ').replace(/\s+/g, ' ').trim() + ' đồng';
    return (v < 0 ? 'Âm ' : '') + s[0].toUpperCase() + s.slice(1) + (Math.round(Math.abs(v)) % 1000 === 0 ? ' chẵn' : '');
  }
  const tien = n => n == null || n === '' || isNaN(n) ? '' : Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const so = n => n == null || n === '' || isNaN(n) ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ',');

  // ---------- văn bản từng hộ (từ bảng tổng hợp phương án bồi thường được duyệt) ----------
  const HO_LOAI = {
    qd_pa_ho: 'Quyết định phê duyệt phương án BTHT từng hộ',
    qd_thu_hoi_ho: 'Quyết định thu hồi đất từng hộ',
    phieu_chi_ho: 'Phiếu chi tiền bồi thường từng hộ',
  };
  const HO_MAU = {
    qd_pa_ho: {
      subject: 'phê duyệt phương án bồi thường, hỗ trợ, tái định cư cho hộ {xung_ho} {ho_ten} khi Nhà nước thu hồi đất để thực hiện dự án {du_an}',
      body: `Điều 1. Phê duyệt phương án bồi thường, hỗ trợ, tái định cư cho hộ {xung_ho} {ho_ten} (CCCD số {cccd}), địa chỉ: {dia_chi}, có đất bị thu hồi để thực hiện dự án {du_an} tại {dia_diem}, cụ thể như sau:
1. Diện tích đất thu hồi: {dt_thu_hoi} m², thuộc thửa đất số {thua}, tờ bản đồ số {to_bd}, loại đất: {loai_dat}.
2. Tổng kinh phí bồi thường, hỗ trợ: {tong} đồng (Bằng chữ: {tong_chu}), trong đó:
a) Bồi thường về đất: {tien_dat} đồng;
b) Bồi thường tài sản, cây trồng, vật nuôi trên đất: {tien_ts} đồng;
c) Các khoản hỗ trợ: {tien_ht} đồng;
d) Khoản khác (nếu có): {tien_khac} đồng.
(Chi tiết theo phương án bồi thường, hỗ trợ, tái định cư được phê duyệt tại Quyết định số {so_qd_pa}.)
Điều 2. Giao {don_vi_bt} có trách nhiệm thông báo, chi trả tiền bồi thường, hỗ trợ cho hộ {xung_ho} {ho_ten} theo đúng quy định. Hộ {xung_ho} {ho_ten} có trách nhiệm nhận tiền và bàn giao mặt bằng theo quy định.
Điều 3. Quyết định này có hiệu lực kể từ ngày ký. {thi_hanh}, {don_vi_bt}, hộ {xung_ho} {ho_ten} và các cơ quan, đơn vị có liên quan chịu trách nhiệm thi hành Quyết định này./.`,
    },
    qd_thu_hoi_ho: {
      subject: 'thu hồi đất của hộ {xung_ho} {ho_ten} để thực hiện dự án {du_an}',
      body: `Điều 1. Thu hồi {dt_thu_hoi} m² đất {loai_dat} của hộ {xung_ho} {ho_ten} (CCCD số {cccd}), địa chỉ: {dia_chi}, thuộc thửa đất số {thua}, tờ bản đồ số {to_bd}, tại {dia_diem}.
Lý do thu hồi đất: để thực hiện dự án {du_an}.
Thời gian bồi thường, hỗ trợ, tái định cư và bàn giao đất theo phương án đã được phê duyệt tại Quyết định số {so_qd_pa}.
Điều 2. Tổ chức thực hiện:
1. Giao {don_vi_bt} có trách nhiệm giao Quyết định này cho hộ {xung_ho} {ho_ten}; trường hợp hộ {xung_ho} {ho_ten} không nhận Quyết định thì lập biên bản theo quy định.
2. Niêm yết công khai Quyết định này tại trụ sở Ủy ban nhân dân và điểm sinh hoạt chung của khu dân cư nơi có đất thu hồi; đăng tải trên cổng thông tin điện tử theo quy định.
3. Tổ chức chi trả tiền bồi thường, hỗ trợ và quản lý diện tích đất đã thu hồi theo quy định.
Điều 3. Quyết định này có hiệu lực kể từ ngày ký. {thi_hanh}, {don_vi_bt}, hộ {xung_ho} {ho_ten} và các cơ quan, đơn vị có liên quan chịu trách nhiệm thi hành Quyết định này./.`,
    },
    phieu_chi_ho: { subject: 'Chi tiền bồi thường, hỗ trợ GPMB dự án {du_an}', body: '' },
  };
  const HO_BASES = [
    'Căn cứ Luật Tổ chức chính quyền địa phương [số, ngày — kiểm tra văn bản hiện hành];',
    'Căn cứ Luật Đất đai số 31/2024/QH15 [và các văn bản sửa đổi, bổ sung — kiểm tra hiệu lực];',
    'Căn cứ Nghị định số 88/2024/NĐ-CP ngày 15 tháng 7 năm 2024 của Chính phủ quy định về bồi thường, hỗ trợ, tái định cư khi Nhà nước thu hồi đất [kiểm tra văn bản sửa đổi];',
    'Căn cứ Quyết định số {so_qd_pa} phê duyệt phương án bồi thường, hỗ trợ, tái định cư dự án {du_an};',
    'Theo đề nghị của {don_vi_bt}.',
  ];
  const fill = (tpl, v) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => v[k] == null || v[k] === '' ? `[${k}]` : String(v[k]));
  function hoVars(h, cfg, i) {
    return {
      ...cfg, ...(h.extra || {}), stt: h.stt ?? i + 1, ma_ho: h.ma_ho, ho_ten: h.ho_ten, cccd: h.cccd || '…', dia_chi: h.dia_chi || '…', thua: h.thua || '…', to_bd: h.to_bd || '…',
      loai_dat: h.loai_dat || '…', dt_thu_hoi: so(h.dt_thu_hoi) || '…', tien_dat: tien(h.tien_dat) || '0', tien_ts: tien(h.tien_ts) || '0', tien_ht: tien(h.tien_ht) || '0',
      tien_khac: tien(h.tien_khac) || '0', tong: tien(h.tong) || '0', tong_chu: soChu(h.tong), batch: h.batch, xung_ho: cfg.xung_ho || 'ông/bà',
    };
  }
  // cfg: {authority, unit, issuer, place, date_text, so_mau ('{n}/QĐ-UBND'), so_bat_dau, bases[], receivers[], signer_title, signer_name, body?, subject?, du_an, dia_diem, don_vi_bt, so_qd_pa, thi_hanh}
  function hoDoc(loai, h, cfg, i) {
    const v = hoVars(h, cfg, i), M = HO_MAU[loai];
    const n = cfg.so_bat_dau ? Number(cfg.so_bat_dau) + i : null;
    return {
      kind: 'quyet_dinh', issuer: cfg.issuer, unit: cfg.unit || 'ỦY BAN NHÂN DÂN [XÃ …]', place: cfg.place, date_text: cfg.date_text,
      number_text: 'Số: ' + (n ? fill(cfg.so_mau || '{n}/QĐ-UBND', { n }) : '      /QĐ-UBND'), authority: cfg.authority || 'CHỦ TỊCH ỦY BAN NHÂN DÂN [XÃ …]',
      subject: fill(cfg['subject_' + loai] || M.subject, v), bases: lines(cfg['bases_' + loai] || cfg.bases || HO_BASES).map(b => fill(b, v)),
      body: fill(cfg['body_' + loai] || M.body, v), receivers: lines(cfg.receivers || ['Như Điều 3;', 'Lưu: VT.']).map(b => fill(b, v)),
      signers: [{ title: cfg.signer_title || 'CHỦ TỊCH', name: cfg.signer_name || '' }],
    };
  }
  function phieuChi(h, cfg, i) {
    const v = hoVars(h, cfg, i), n = cfg.so_bat_dau ? Number(cfg.so_bat_dau) + i : '……';
    const sig = ['Giám đốc', 'Kế toán trưởng', 'Thủ quỹ', 'Người lập phiếu', 'Người nhận tiền'];
    return `<div class="vb" style="${F};font-size:13pt;line-height:1.45">
      <table style="width:100%;border-collapse:collapse"><tr><td style="vertical-align:top;padding:0;width:58%"><b>Đơn vị: ${esc(cfg.don_vi_chi || cfg.chu_dau_tu || '……')}</b><br>Địa chỉ: ${esc(cfg.dia_chi_dv || '……')}</td>
      <td style="text-align:center;vertical-align:top;padding:0;font-size:11.5pt"><b>${esc(cfg.mau_phieu_chi || 'Mẫu số 02-TT')}</b><br><i>${esc(cfg.mau_phieu_chi_cc || '(Theo chế độ kế toán doanh nghiệp đang áp dụng)')}</i></td></tr></table>
      <table style="width:100%;border-collapse:collapse;margin-top:12pt"><tr><td style="width:62%;text-align:center;padding:0"><b style="font-size:17pt">PHIẾU CHI</b><br><i>${esc(cfg.date_text || 'Ngày … tháng … năm ……')}</i></td>
      <td style="vertical-align:top;padding:0;font-size:12pt">Quyển số: ${esc(cfg.quyen_so || '……')}<br>Số: ${esc(String(n))}<br>Nợ: ${esc(cfg.tk_no || '……')}<br>Có: ${esc(cfg.tk_co || '……')}</td></tr></table>
      <p style="margin:12pt 0 3pt">Họ và tên người nhận tiền: <b>${esc(h.ho_ten)}</b>${h.cccd ? ` &nbsp; CCCD: ${esc(h.cccd)}` : ''}</p>
      <p style="margin:0 0 3pt">Địa chỉ: ${esc(h.dia_chi || '……')}</p>
      <p style="margin:0 0 3pt">Lý do chi: ${esc(fill(cfg.ly_do_chi || 'Chi trả tiền bồi thường, hỗ trợ GPMB dự án {du_an} theo Quyết định số {so_qd_pa} (thửa {thua}, tờ bản đồ {to_bd}, diện tích {dt_thu_hoi} m²)', v))}</p>
      <p style="margin:0 0 3pt">Số tiền: <b>${esc(v.tong)} đồng</b></p>
      <p style="margin:0 0 3pt">Viết bằng chữ: <i>${esc(v.tong_chu)}</i></p>
      <p style="margin:0 0 12pt">Kèm theo: ${esc(cfg.kem_theo || '……')} chứng từ gốc.</p>
      <p style="text-align:right;margin:0 0 4pt"><i>${esc(cfg.date_text ? cfg.date_text : 'Ngày … tháng … năm ……')}</i></p>
      <table style="width:100%;border-collapse:collapse;font-size:12pt"><tr>${sig.map(s => `<td style="text-align:center;vertical-align:top;padding:0 2pt;width:20%"><b>${s}</b><br><i style="font-size:10.5pt">(Ký, họ tên${s === 'Giám đốc' ? ', đóng dấu' : ''})</i></td>`).join('')}</tr>
      <tr><td colspan="5" style="height:62pt"></td></tr><tr>${sig.map((s, j) => `<td style="text-align:center;padding:0">${j === 4 ? `<b>${esc(h.ho_ten)}</b>` : ''}</td>`).join('')}</tr></table>
      <p style="margin:12pt 0 0;font-size:12pt">Đã nhận đủ số tiền (viết bằng chữ): ……………………………………………………………</p></div>`;
  }
  function hoHtml(loai, h, cfg, i) { return loai === 'phieu_chi_ho' ? phieuChi(h, cfg, i) : render(hoDoc(loai, h, cfg, i)); }

  return { LOAI, render, page, soChu, tien, so, lines, lc1, uc1, HO_LOAI, HO_MAU, HO_BASES, hoDoc, hoHtml, fill, esc };
});
