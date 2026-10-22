/* CTG ERP V2 · Module Pháp lý dự án (app-09 · MOD-09) v2 — checklist hồ sơ theo bước, soạn dự thảo, bồi thường từng hộ, kế hoạch pháp lý.
   Giao diện CTG Executive Premium V1; phần dùng chung (bảng, modal, API) chép từ Module Quản lý dự án. Trình bày văn bản: vanban.js (dùng chung với máy chủ). */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ICON={
 crane:'<path d="M5 21V5l10-2v3M5 7h15M15 7v5M13 12h4v3h-4zM3 21h8"/>',
 file:'<path d="M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h5"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v5h1"/>',
 warn:'<path d="M12 3l10 18H2zM12 10v5M12 18v.01"/>',
 home:'<path d="M3 11l9-7 9 7v9H3z"/>', inbox:'<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5"/>', bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4"/>', menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 empty:'<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>', copy:'<path d="M8 8h12v12H8zM4 16V4h12"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
 print:'<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>', sheet:'<path d="M4 3h16v18H4zM4 9h16M4 15h16M10 3v18"/>', check:'<path d="M4 4h16v16H4zM8 12l3 3 5-6"/>',
 db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'
};
const ico=(k,cls="")=>`<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${ICON[k]||""}</svg>`;
function pill(v){const m=/^~([a-z]):(.*)$/s.exec(String(v));return m?`<span class="pill p-${m[1]}">${esc(m[2])}</span>`:esc(v)}
const isNum=v=>/^[+\-−]?[\d.,]+( ?(tỷ|tr|đ|%|ngày|m³|m²|tấn|người))?$/.test(String(v).trim());
const vnd=n=>n==null||n===""||isNaN(n)?"—":(n<0?"-":"")+Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,".");
const pnum=s=>{s=String(s??"").trim().replace(/\s/g,"").replace(/\./g,"").replace(",",".");return s===""?NaN:Number(s)};
const fq=n=>{const r=Math.round(n*100)/100;let [a,b]=r.toFixed(2).split(".");a=a.replace(/\B(?=(\d{3})+(?!\d))/g,".");b=b.replace(/0+$/,"");return b?a+","+b:a};
const ty=n=>n==null?"—":Math.abs(n)>=1e9?fq(Math.round(n/1e7)/100)+" tỷ":Math.abs(n)>=1e6?fq(Math.round(n/1e5)/10)+" tr":vnd(n)+" đ";
const sty=n=>(n>0?"+":"")+ty(n);
const dmy=s=>s?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:"—";
const dm=s=>s?`${s.slice(8,10)}/${s.slice(5,7)}`:"";
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const dtLocal=v=>{const d=v?new Date(v):new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,16)};
const hm=v=>{const d=new Date(v);return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
const daysLate=s=>s?Math.floor((new Date(today())-new Date(s))/864e5):0;
let toastT;function toast(m){let t=$(".toast");if(!t){t=document.createElement("div");t.className="toast";t.setAttribute("role","status");document.body.append(t)}t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200)}

/* ---------- API ---------- */
async function api(method,url,body){
  const opt={method,headers:{}};
  if(body instanceof FormData)opt.body=body;else if(body!==undefined){opt.headers["Content-Type"]="application/json";opt.body=JSON.stringify(body)}
  let r;try{r=await fetch(url,opt)}catch(e){throw new Error("Máy chủ không phản hồi. Kiểm tra app đã chạy (Chay app Phap ly du an.bat) rồi bấm Thử lại.")}
  if(r.status===401&&!url.endsWith("/login")){showLogin();throw new Error("Phiên đăng nhập đã hết")}
  const j=r.headers.get("content-type")?.includes("json")?await r.json():null;
  if(!r.ok)throw new Error(j?.error||`Lỗi ${r.status}`);
  return j;
}
const qs=o=>"?"+new URLSearchParams(Object.entries(o).filter(([,v])=>v!=null&&v!=="")).toString();


/* ---------- shared pieces (giữ nguyên từ prototype, bổ sung rowAttr) ---------- */
function table(cols,rows,{stack=true,cls="",numCols,rowAttr}={}){
  const nc=numCols||cols.map((c,i)=>rows.length&&rows.every(r=>{const v=String(r[i]??"").replace(/^~[a-z]:/,"");return v===""||v==="—"||isNum(v)})&&rows.some(r=>isNum(String(r[i]??"")))&&!/^~/.test(String(rows[0][i])));
  return `<div class="tw ${stack?"stack":""}" tabindex="0" role="region" aria-label="Bảng dữ liệu (cuộn ngang nếu cần)"><table class="tb ${cls}"><thead><tr>${cols.map((c,i)=>`<th class="${nc[i]?"r":""}" scope="col">${esc(c)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r,ri)=>`<tr ${rowAttr?rowAttr(ri):""}>${r.map((v,i)=>`<td data-l="${esc(cols[i])}" class="${nc[i]?"r":""}">${pill(v??"")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function kpis(k){return `<div class="grid g4">${k.map(x=>`<div class="kpi"><div class="l">${esc(x[0])}</div><div class="v">${esc(x[1])}</div><div class="s"><i class="dot-${x[3]}"></i>${esc(x[2])}</div></div>`).join("")}</div>`}
function banner(t,txt){return `<div class="banner b-${t}">${ico(t==="b"||t==="t"?"info":"warn")}<span>${esc(txt)}</span></div>`}
function steps(arr,cur){return `<ol class="steps">${arr.map((x,i)=>`<li class="${i<cur?"done":i===cur?"cur":""}">${esc(x)}</li>`).join("")}</ol>`}
const SER=["var(--s1)","var(--s2)","var(--orange)"];let GID=0;
function chart(c){
  const W=640,H=240,pl=40,pr=10,pt=10,pb=28,iw=W-pl-pr,ih=H-pt-pb;
  const all=c.series.flatMap(s=>s[1]);let mx=Math.max(...all,0),mn=Math.min(...all,0);
  const step=niceStep((mx-mn)/4);mx=Math.ceil(mx/step)*step;mn=Math.floor(mn/step)*step;if(mx===mn)mx=mn+step;
  const gid="g"+(++GID);const defs=`<defs><linearGradient id="${gid}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCB0A7"/><stop offset="1" stop-color="#755F7C"/></linearGradient><linearGradient id="${gid}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#73BDD3"/><stop offset="1" stop-color="#395B85"/></linearGradient></defs>`;const BF=[`url(#${gid}a)`,`url(#${gid}b)`,"var(--orange)"];
  const lg=`<div class="legend">${c.series.map((s,i)=>`<span><i style="background:${i===0?"linear-gradient(#DCB0A7,#755F7C)":i===1?"linear-gradient(#73BDD3,#395B85)":SER[i]}"></i>${esc(s[0])}</span>`).join("")}</div>`;
  const y=v=>pt+ih-(v-mn)/(mx-mn)*ih;let g="";
  for(let v=mn;v<=mx+1e-9;v+=step)g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="${v===0?1.5:1}"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${+v.toFixed(1)}</text>`;
  const n=c.labels.length,bw=iw/n;
  g+=c.labels.map((l,i)=>`<text x="${pl+bw*i+bw/2}" y="${H-8}" text-anchor="middle">${esc(l)}</text>`).join("");
  const k=c.series.length,w=Math.min(26,(bw-14)/k);
  c.series.forEach((s,j)=>s[1].forEach((v,i)=>{const x=pl+bw*i+bw/2-(k*w)/2+j*w;const col=v<0?"var(--red)":BF[j];g+=`<rect x="${x+1}" y="${Math.min(y(v),y(0))}" width="${w-2}" height="${Math.max(1,Math.abs(y(v)-y(0)))}" rx="5" fill="${col}"><title>${esc(s[0])} ${esc(c.labels[i])}: ${String(v).replace(".",",")}</title></rect>`}));
  return `<div class="chart">${lg}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title)}">${defs}${g}</svg></div>`;
}
function niceStep(r){const p=Math.pow(10,Math.floor(Math.log10(r||1)));const f=r/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p}
const btn=(id,label,{pri,dis,icon,cls="",title}={})=>`<button class="btn sm ${pri?"pri":""} ${cls}" type="button" id="${id}" ${dis?"disabled":""} ${title?`title="${esc(title)}"`:""}>${icon?ico(icon):""}${esc(label)}</button>`;
// thanh tìm kiếm + bộ lọc chip như mẫu "list" của prototype
function listBar(k,{filters,primary,placeholder="Tìm theo mã, tên, dự án…"}){
  const ac=ST.chip[k]??0;
  return `<div class="toolbar"><div class="grow"><label class="skip" for="q-${k}">Tìm kiếm</label><input class="search" id="q-${k}" placeholder="${esc(placeholder)}" value="${esc(ST.q[k]||"")}"></div>${primary||""}</div>
  ${filters?`<div class="chips" style="margin-bottom:12px">${filters.map((f,i)=>`<button type="button" class="chip" data-chip="${k}:${i}" aria-pressed="${i===ac}">${esc(f)}</button>`).join("")}</div>`:""}`;
}
function bindListBar(k){
  const q=$("#q-"+k);q&&q.addEventListener("input",()=>{ST.q[k]=q.value;const p=q.selectionStart;render();const n=$("#q-"+k);n.focus();n.setSelectionRange(p,p)});
  $$(`[data-chip^="${k}:"]`).forEach(b=>b.onclick=()=>{ST.chip[k]=+b.dataset.chip.split(":")[1];render()});
}
// tìm không phân biệt dấu: «kinh phi» khớp «kinh phí», «dat» khớp «đất»; nhiều từ thì phải có đủ các từ
const fold=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
const match=(k,txt)=>{const q=fold(ST.q[k]).trim();if(!q)return true;const t=fold(txt);return q.split(/\s+/).every(w=>t.includes(w))};
const noHit=k=>`<div class="state"><h3>Không có kết quả cho “${esc(ST.q[k]||"")}”</h3><p>Thử từ khóa khác hoặc xóa bộ lọc.</p></div>`;

/* ---------- modal ---------- */
function trap(ov,close){
  ov.addEventListener("keydown",e=>{if(e.key==="Escape"&&close){e.preventDefault();close()}if(e.key==="Tab"){const f=$$("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])",ov);const a=f[0],z=f.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}});
}
function confirmBox(title,msg,okLabel,danger,onOk,needReason){
  const last=document.activeElement;const ov=document.createElement("div");ov.className="ov";const key=ST.screen+title;
  ov.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><h3 id="mt">${esc(title)}</h3><p>${esc(msg)}${needReason?" Bấm Esc để đóng; nội dung đã nhập được giữ lại.":""}</p>
  ${needReason?`<div class="fld" style="margin-bottom:12px"><label for="why">${esc(needReason===true?"Lý do":needReason)} <span class="rq">*</span></label><textarea id="why">${esc(ST.why[key]||"")}</textarea><span class="err" id="whyE" hidden>Nhập nội dung trước khi xác nhận.</span></div>`:""}
  <div class="banner b-r" id="cbE" hidden></div>
  <div class="foot" style="border:0;margin:0;padding:0"><button class="btn" type="button" data-x>Hủy</button><button class="btn ${danger?"dan solid":"pri"}" type="button" data-ok>${esc(okLabel)}</button></div></div>`;
  document.body.append(ov);(needReason?$("#why",ov):$("[data-ok]",ov)).focus();
  const close=()=>{ov.remove();last&&last.focus&&last.focus()};trap(ov,close);
  const wy=$("#why",ov);wy&&wy.addEventListener("input",()=>ST.why[key]=wy.value);
  ov.addEventListener("click",async e=>{if(e.target===ov||e.target.closest("[data-x]"))close();
    const ok=e.target.closest("[data-ok]");if(!ok)return;let why="";
    if(needReason){why=$("#why",ov).value.trim();if(!why){$("#whyE",ov).hidden=false;$("#why",ov).focus();return}}
    ok.disabled=true;try{await onOk(why);ST.why[key]="";ov.remove()}catch(x){const be=$("#cbE",ov);be.innerHTML=`${ico("warn")}<span>${esc(x.message)}</span>`;be.hidden=false;ok.disabled=false}});
}
/* form trong modal: fields [{k,label,type,options,req,full,hint,dis,list,value,ph}] */
function formModal({title,intro,fields,values={},okLabel="Lưu",onSubmit,extra=[],noCancel,readOnly}){
  const last=document.activeElement;const ov=document.createElement("div");ov.className="ov";
  const ctl=f=>{const v=values[f.k]??f.value??"",id="fm-"+f.k,dis=readOnly||f.dis?"disabled":"";
    if(f.type==="textarea")return `<textarea id="${id}" ${dis} placeholder="${esc(f.ph||"")}">${esc(v)}</textarea>`;
    if(f.type==="select")return `<select id="${id}" ${dis}>${f.options.map(o=>`<option value="${esc(o[0])}" ${String(o[0])===String(v)?"selected":""}>${esc(o[1])}</option>`).join("")}</select>`;
    if(f.type==="items")return `<div id="${id}"></div><button class="btn sm" type="button" id="${id}-add" ${dis} style="margin-top:4px">${ico("plus")}Thêm dòng</button>`;
    if(f.type==="date")return dateInput(id,v,{dis:!!dis});
    if(f.type==="files")return `<label class="fdrop"><input id="${id}" type="file" multiple accept="${esc(f.accept||"")}" ${dis}><span class="fdrop-t">${ico("upload")}<b>Bấm để chọn tệp trên máy tính</b> hoặc kéo thả vào đây<small>Bản scan (JPG, PNG, TIF) hoặc PDF · chọn được nhiều tệp</small></span><ul class="fsel"></ul></label>`;
    const t=f.type==="date"?"date":f.type==="datetime"?"datetime-local":f.type==="password"?"password":"text";
    const val=f.type==="money"&&v!==""&&v!=null?vnd(v):v;
    return `<input id="${id}" type="${t}" ${f.type==="money"||f.type==="number"?'inputmode="decimal"':""} value="${esc(val)}" ${dis} ${f.list?`list="${id}-l"`:""} placeholder="${esc(f.ph||"")}">${f.list?`<datalist id="${id}-l">${f.list.map(o=>`<option value="${esc(o)}">`).join("")}</datalist>`:""}`};
  ov.innerHTML=`<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="fmt"><h3 id="fmt">${esc(title)}</h3>
  <div class="banner b-r" id="fmE" hidden></div>
  <form id="fmF" novalidate><div class="fgrid">${fields.map(f=>`<div class="fld ${f.full||f.type==="textarea"||f.type==="items"?"full":""}" data-f="${f.k}"><label for="fm-${f.k}">${esc(f.label)} ${f.req?'<span class="rq" aria-hidden="true">*</span>':""}</label>${ctl(f)}<span class="err" hidden></span></div>`).join("")}</div>
  <div class="foot" style="margin-top:10px">${extra.map((x,i)=>`<button class="btn ${x.cls||""}" type="button" data-ex="${i}" ${x.dis?"disabled":""} ${x.title?`title="${esc(x.title)}"`:""}>${esc(x.label)}</button>`).join("")}<span style="flex:1"></span>${noCancel?"":`<button class="btn" type="button" data-x>${readOnly?"Đóng":"Hủy"}</button>`}${readOnly?"":`<button class="btn pri" type="submit">${esc(okLabel)}</button>`}</div></form></div>`;
  document.body.append(ov);
  const close=()=>{ov.remove();last&&last.focus&&last.focus()};trap(ov,noCancel?null:close);
  const first=$("input:not([disabled]),select:not([disabled]),textarea:not([disabled])",ov);(first||$("button",ov)).focus();
  const vals=()=>{const o={};fields.forEach(f=>{const el=$("#fm-"+f.k,ov);if(!el)return;if(f.type==="items")o[f.k]=f.read(el);else if(f.type==="files")o[f.k]=[...el.files];else if(f.type==="date"){const r=dmyIso(el.value);o[f.k]=r===null?NaN:r}else if(f.type==="money"||f.type==="number"){const n=pnum(el.value);o[f.k]=el.value.trim()===""?null:n}else o[f.k]=el.value});return o};
  const showErr=m=>{const be=$("#fmE",ov);be.innerHTML=`${ico("warn")}<span>${esc(m)}</span>`;be.hidden=false;be.scrollIntoView({block:"nearest"})};
  fields.filter(f=>f.type==="items").forEach(f=>f.init($("#fm-"+f.k,ov),$(`#fm-${f.k}-add`,ov),values[f.k]||[]));
  ov.addEventListener("click",async e=>{
    if(e.target.closest("[data-x]")||(e.target===ov&&!noCancel))return close();
    const ex=e.target.closest("[data-ex]");if(ex){try{await extra[+ex.dataset.ex].onClick(vals(),close)}catch(x){showErr(x.message)}}});
  $("#fmF",ov).onsubmit=async e=>{e.preventDefault();if(readOnly)return;
    let bad=0;$$(".fld",ov).forEach(x=>{x.classList.remove("bad");$(".err",x).hidden=true});
    const v=vals();
    fields.forEach(f=>{const el=$("#fm-"+f.k,ov),box=$(`[data-f="${f.k}"]`,ov);let m="";
      if(f.req&&(v[f.k]==null||String(v[f.k]).trim()===""))m="Bắt buộc nhập";
      else if(f.type==="date"&&Number.isNaN(v[f.k]))m="Ngày không hợp lệ — nhập ngày/tháng/năm, vd 12/10/2026";
      else if((f.type==="money"||f.type==="number")&&v[f.k]!=null&&isNaN(v[f.k]))m="Nhập số hợp lệ (vd 1.250.000)";
      else if((f.type==="money"||f.type==="number")&&f.min!=null&&v[f.k]!=null&&v[f.k]<f.min)m=`Không nhận số nhỏ hơn ${f.min}`;
      else if(f.max!=null&&v[f.k]!=null&&v[f.k]>f.max)m=`Không vượt ${f.max}`;
      if(m){bad++;box.classList.add("bad");const er=$(".err",box);er.textContent=m;er.hidden=false;el&&el.setAttribute("aria-invalid","true")}else el&&el.removeAttribute("aria-invalid")});
    if(bad){$(".fld.bad input,.fld.bad select,.fld.bad textarea",ov)?.focus();return}
    const sb=$("button[type=submit]",ov);sb.disabled=true;
    try{await onSubmit(v);ov.remove();last&&last.focus&&last.focus()}catch(x){showErr(x.message);sb.disabled=false}};
}
function lightbox(src){const ov=document.createElement("div");ov.className="lightbox";ov.innerHTML=`<img src="${esc(src)}" alt="Ảnh hiện trường">`;ov.tabIndex=-1;document.body.append(ov);ov.focus();const c=()=>ov.remove();ov.onclick=c;ov.onkeydown=e=>e.key==="Escape"&&c()}
const userOpts=(blank="— Chọn —")=>[["",blank],...ST.ref.users.map(u=>[u.id,`${u.full_name} (${u.username})`])];
const projOpts=()=>ST.ref.projects.map(p=>[p.id,`${p.code} ${p.name}`]);

/* =================== Module Pháp lý dự án v2 (app-09 · MOD-09) =================== */
Object.assign(ICON,{
 spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
 scale:'<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>', back:'<path d="M15 5l-7 7 7 7"/>',
 cal:'<path d="M4 6h16v15H4zM4 10h16M8 3v5M16 3v5"/>', upload:'<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>', ruler:'<path d="M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>',
 users:'<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6"/>', book:'<path d="M4 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3"/>',
 up:'<path d="M12 19V5M6 11l6-6 6 6"/>', down:'<path d="M12 5v14M6 13l6 6 6-6"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>', eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
});
const MOD="MOD-09";
const SC=[
 {id:"screen-09-00",name:"Tổng quan dự án",purpose:"Khu nhà ở xã hội Đại Hưng Phát: đang ở bước nào, tiến độ so với kế hoạch gốc, cảnh báo chậm trễ, tình trạng và nguyên nhân vướng mắc.",roles:"Ban TGĐ, Ban QLDA, Pháp chế"},
 {id:"screen-09-01",name:"Hôm nay",purpose:"Nhắc việc pháp lý: việc phải làm hôm nay, sắp tới, chậm trễ, hồ sơ còn thiếu, cảnh báo AI chưa xử lý.",roles:"Ban QLDA, Pháp chế"},
 {id:"screen-09-02",name:"Kế hoạch pháp lý",purpose:"Lập tiến độ pháp lý từng bước (dự kiến ngày bắt đầu, nộp hồ sơ, có kết quả) theo thủ tục và phụ thuộc giữa các bước; tự điều chỉnh theo kết quả thực tế.",roles:"Ban QLDA, Pháp chế"},
 {id:"screen-09-03",name:"Checklist hồ sơ",purpose:"Checklist hồ sơ từng bước theo quy định; đối chiếu tệp đã tải lên, cảnh báo thiếu; AI kiểm tra sai sót, mâu thuẫn; xuất bộ hồ sơ để in, ký, nộp.",roles:"Ban QLDA, Pháp chế"},
 {id:"screen-09-04",name:"Dự thảo văn bản",purpose:"Soạn văn bản của bước đang xử lý đúng mẫu, đúng thể thức; lấy thông tin từ hồ sơ các bước trước; AI kiểm tra sau khi sửa; chốt văn bản vào checklist.",roles:"Ban QLDA, Pháp chế"},
 {id:"screen-09-05",name:"Bồi thường từng hộ",purpose:"Từ bảng tổng hợp phương án bồi thường được duyệt: xuất quyết định phê duyệt phương án, phiếu chi, quyết định thu hồi đất tới từng hộ.",roles:"Ban QLDA, Pháp chế"},
 {id:"screen-09-06",name:"Thư viện checklist mẫu",purpose:"Checklist hồ sơ mẫu theo từng thủ tục (quy định hiện hành, hồ sơ dự án khác); bổ sung theo yêu cầu riêng hoặc cho AI đọc văn bản luật mới.",roles:"Pháp chế"},
];
// màn đã bỏ khỏi menu (mã giữ lại): Hôm nay
const HIDDEN=["screen-09-01"];for(let i=SC.length-1;i>=0;i--)if(HIDDEN.includes(SC[i].id))SC.splice(i,1);
const BY=Object.fromEntries(SC.map(s=>[s.id,s]));
// màn đang hoàn thiện: hiện «Sắp ra mắt» (bỏ id khỏi đây là mở lại chức năng)
const SOON=new Set(["screen-09-05","screen-09-06"]);
const HOME="screen-09-00";
const ST={screen:HOME,proj:"",role:"xem",me:null,ref:null,data:{},err:{},tab:{},chip:{},q:{},sel:{},why:{}};
const ROLE={lap:"Người lập",kiem:"Người kiểm",duyet:"Người duyệt",xem:"Chỉ xem"};
const W=["lap","kiem","duyet"];
const STEP_ST={chua:["n","Chưa làm"],dang:["b","Đang chuẩn bị hồ sơ"],cho_kq:["a","Đã nộp, chờ kết quả"],xong:["g","Hoàn thành"],bo_qua:["n","Không thực hiện"]};
const KIND={soan:"Văn bản cần soạn",dau_vao:"Hồ sơ đầu vào",ket_qua:"Kết quả"};
const SRC={quy_dinh:"Theo quy định",qlda:"Danh mục QLDA",du_an_khac:"Hồ sơ dự án khác",nguoi_dung:"Người dùng thêm",ai:"AI đề xuất"};
const AIS={cho:["n","AI chờ đọc"],dang:["b","AI đang đọc…"],xong:["g","AI đã đọc"],loi:["r","AI lỗi"],tat:["n","AI tắt"],bo_qua:["n","Văn bản hệ thống"]};
const MUC={cao:["r","Cao"],trung_binh:["a","Trung bình"],thap:["b","Thấp"]};
const WL={thieu_ho_so:"Thiếu hồ sơ",sai_sot:"Sai sót",mau_thuan:"Mâu thuẫn",sai_lech_buoc_truoc:"Lệch bước trước",het_hieu_luc:"Hết hiệu lực",the_thuc:"Thể thức",khac:"Khác"};
const KL={dat:["g","Đạt"],can_sua:["r","Cần sửa"],khong_du_du_lieu:["a","Chưa đủ dữ liệu"]};
const CK_KIND={ho_so:"Kiểm tra hồ sơ của bước",ket_qua:"Đối chiếu kết quả scan",du_thao:"Kiểm tra dự thảo",tep:"Kiểm tra tệp vừa tải"};
// kết quả AI kiểm tra của từng tệp (tự chạy ngay sau khi tải lên): bấm → sang thẻ AI kiểm tra để xem chi tiết
function fileCheck(f,checks){
  const c=checks.find(c=>c.target_id===f.id&&(c.kind==="tep"||c.kind==="ket_qua"));if(!c)return "";
  const n=c.result?.canh_bao?.length||0,t=c.status==="dang"?"~b:AI đang kiểm tra tệp…":c.status==="loi"?"~r:AI kiểm tra lỗi":c.status==="da_xu_ly"?"~g:Đã xử lý cảnh báo":n?`~r:⚠ ${n} cảnh báo`:"~g:✓ AI không thấy vấn đề";
  return `<button type="button" class="fchkp" data-fck="${c.id}" title="${esc(c.result?.tom_tat||"Xem chi tiết kết quả AI kiểm tra")}">${pill(t)}</button>`;
}

const curProj=()=>ST.proj||ST.ref?.projects[0]?.id||null;
const projOf=id=>ST.ref?.projects.find(p=>p.id===id);
const held=(r,pid=curProj())=>!!ST.ref?.roles[pid]?.includes(r);
const act=(...rs)=>rs.includes(ST.role)&&held(ST.role);
const needMsg=(...rs)=>`Cần vai trò ${rs.map(r=>ROLE[r]).join(" hoặc ")}. Bạn đang xem với vai trò ${ROLE[ST.role]}${rs.some(r=>held(r))?" — đổi vai trò ở thanh trên":""}.`;
const P=(m,t)=>`~${m[0]}:${t||m[1]}`;
const app=(port,h)=>`${location.protocol}//${location.hostname}:${port}/${h?"#"+h:""}`;
const phaseName=c=>ST.ref.phases.find(p=>p.code===c)?.name||c||"Khác";
const kb=n=>n>=1e6?(n/1e6).toFixed(1).replace(".",",")+" MB":Math.max(1,Math.round(n/1e3))+" KB";
const wbtn=(id,label,o={})=>btn(id,label,{...o,dis:o.dis||!act(...W),title:act(...W)?o.title:needMsg(...W)});
const aiOff=()=>ST.ref.ai?"":"AI đang tắt — điền ANTHROPIC_API_KEY trong .env của module rồi khởi động lại.";
const VBK=Object.entries(VB.LOAI).map(([k,v])=>[k,v.name]);
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
async function postDownload(url,body,fallback){
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok){const j=await r.json().catch(()=>null);throw new Error(j?.error||"Lỗi "+r.status)}
  const cd=r.headers.get("content-disposition")||"",m=/filename\*=UTF-8''([^;]+)/.exec(cd);
  download(await r.blob(),m?decodeURIComponent(m[1]):fallback);
}
function pickFiles(multiple=true,accept=""){return new Promise(res=>{const i=document.createElement("input");i.type="file";i.multiple=multiple;if(accept)i.accept=accept;i.onchange=()=>res([...i.files]);i.click()})}
async function upload(url,files,fields={}){const fd=new FormData();files.forEach(f=>fd.append("file",f,f.name));Object.entries(fields).forEach(([k,v])=>v!=null&&fd.append(k,v));return api("POST",url,fd)}
const wordFile=(html,name)=>download(new Blob(["﻿",`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>@page WordSection1{size:21cm 29.7cm;margin:2cm 1.5cm 2cm 3cm}div.WordSection1{page:WordSection1}body{font-family:"Times New Roman"}.pg{page-break-after:always}</style></head><body><div class="WordSection1">${html}</div></body></html>`],{type:"application/msword"}),name);
// in văn bản: máy chủ dàn trang thành PDF đúng thể thức (không có dòng ngày giờ / tiêu đề / địa chỉ trang của trình duyệt), rồi mở hộp thoại in của PDF
async function printDoc(id,cur){
  toast("Đang chuẩn bị bản in…");
  try{
    const r=await fetch(`/api/docs/${id}/pdf`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(cur||{})});
    if(!r.ok){const j=await r.json().catch(()=>null);throw new Error(j?.error||"Lỗi "+r.status)}
    const url=URL.createObjectURL(await r.blob());
    $("#vbPrint")?.remove();const fr=document.createElement("iframe");fr.id="vbPrint";fr.title="In văn bản";
    fr.style.cssText="position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    fr.onload=()=>setTimeout(()=>{try{fr.contentWindow.focus();fr.contentWindow.print()}catch(e){window.open(url,"_blank")}},400);
    fr.src=url;document.body.appendChild(fr);setTimeout(()=>URL.revokeObjectURL(url),10*60e3);
  }catch(x){toast(x.message)}
}

/* ---------- đăng nhập ---------- */
function showLogin(){
  $("#appView").hidden=true;$("#mdock").hidden=true;const v=$("#loginView");v.hidden=false;
  v.innerHTML=`<div class="login"><form class="card" id="lf" novalidate><div class="brand"><img class="logo" src="logo-gold.png" alt="Logo Cát Tường"><div><b>CÁT TƯỜNG GROUP</b><small>Pháp lý dự án · ${MOD}</small></div></div>
  <h1>Đăng nhập</h1><p>Dùng chung tài khoản với app Quản lý dự án (tên đăng nhập QLDA). Lần đầu dùng mật khẩu <b>123456</b>, hệ thống sẽ yêu cầu đổi ngay.</p>
  <div class="fld"><label for="lu">Tên đăng nhập</label><input id="lu" autocomplete="username" required></div>
  <div class="fld"><label for="lp">Mật khẩu</label><input id="lp" type="password" autocomplete="current-password" required></div>
  <div class="banner b-r" id="le" hidden></div>
  <div class="foot" style="border:0;padding-top:4px"><button class="btn pri" style="flex:1;justify-content:center" type="submit">Đăng nhập</button></div></form></div>`;
  $("#lu").focus();
  $("#lf").onsubmit=async e=>{e.preventDefault();const le=$("#le");le.hidden=true;
    try{const r=await api("POST","/api/login",{username:$("#lu").value,password:$("#lp").value});await boot();if(r.must_change)changePw(true)}
    catch(x){le.innerHTML=`${ico("warn")}<span>${esc(x.message)}</span>`;le.hidden=false}};
}
function changePw(forced){
  formModal({title:forced?"Đổi mật khẩu lần đầu":"Đổi mật khẩu",intro:(forced?"Bạn đang dùng mật khẩu mặc định. Đặt mật khẩu riêng (tối thiểu 6 ký tự) để tiếp tục. ":"")+"Mật khẩu dùng chung với các app CTG ERP.",noCancel:forced,
    fields:[{k:"old",label:"Mật khẩu hiện tại",type:"password",req:1,value:forced?"123456":""},{k:"new",label:"Mật khẩu mới",type:"password",req:1},{k:"new2",label:"Nhập lại mật khẩu mới",type:"password",req:1}],
    okLabel:"Đổi mật khẩu",onSubmit:async v=>{if(v.new!==v.new2)throw new Error("Hai lần nhập mật khẩu mới không khớp");await api("POST","/api/password",{old:v.old,new:v.new});toast("Đã đổi mật khẩu")}});
}

/* ---------- khởi động ---------- */
async function boot(){
  try{ST.me=await api("GET","/api/me")}catch(e){return}
  ST.ref=await api("GET","/api/ref");
  try{const p=localStorage.getItem("qlda-proj");if(p!=null&&(p===""||projOf(p)))ST.proj=p}catch(e){}
  if(!ST.proj&&ST.ref.projects.length===1)ST.proj=ST.ref.projects[0].id;
  $("#loginView").hidden=true;$("#appView").hidden=false;$("#mdock").hidden=false;
  if(window.__SNAP){ST.ref.ai=false;document.body.classList.add("snap")}
  fillTop();const [h,sel]=(location.hash||"").slice(1).split("/");ST.screen=BY[h]?h:HOME;if(sel)ST.sel[ST.screen]=sel;render();remStart();
}
function fillTop(){
  const R=ST.ref,ls=R.last_sync?new Date(R.last_sync).toLocaleString("vi-VN"):"chưa đồng bộ";
  $("#proj").innerHTML=(R.projects.length>1?`<option value="">Tất cả dự án (${R.projects.length})</option>`:"")+R.projects.map(p=>`<option value="${p.id}">${esc(p.code)} ${esc(p.name)}</option>`).join("");
  $("#proj").value=ST.proj;syncRole();
  $("#miniops").innerHTML=`<b><i></i>Kết nối CSDL</b>PostgreSQL · ctg_qlda<br>Đồng bộ QLDA: ${esc(ls)}<br>AI: ${R.ai?"đang bật ("+esc(R.model)+")":"đang tắt (chưa có khóa API)"}<br>In PDF: ${R.print?"Edge":"chưa có"}${ST.me.is_admin?`<br><button class="btn sm" type="button" id="syncBtn">${ico("refresh")}Đồng bộ ngay</button>`:""}`;
  $("#railFoot").innerHTML=`<span class="who">${esc(ST.me.full_name)}</span>${esc(ST.me.job_title||ST.me.username)}<div class="act"><button type="button" id="pwBtn">Đổi mật khẩu</button><button type="button" id="outBtn">Đăng xuất</button></div><div style="margin-top:8px">1 app · ${SC.length} màn hình</div>`;
  $("#pwBtn").onclick=()=>changePw(false);
  $("#outBtn").onclick=async()=>{await api("POST","/api/logout").catch(()=>{});ST.data={};showLogin()};
  const sb=$("#syncBtn");sb&&(sb.onclick=async()=>{sb.disabled=true;try{const s=await api("POST","/api/sync");ST.ref=await api("GET","/api/ref");ST.data={};fillTop();render();toast(`Đã đồng bộ: ${s.thu_tuc} thủ tục, ${s.bieu_mau} biểu mẫu, ${s.van_ban_phap_luat} văn bản; thêm ${s.checklist_mau} mục checklist mẫu`)}catch(e){toast(e.message);sb.disabled=false}});
}
function syncRole(){
  const pid=curProj(),rs=ST.ref.roles[pid]||["xem"];
  $$("#role option").forEach(o=>o.disabled=!rs.includes(o.value));
  if(!rs.includes(ST.role)||(ST.role==="xem"&&!ST.roleManual))ST.role=["lap","duyet","kiem","xem"].find(r=>rs.includes(r))||"xem";
  $("#role").value=ST.role;
}

/* ---------- điều hướng ---------- */
function renderNav(){
  $("#nav").innerHTML=`<button class="navbtn navai" type="button" data-go="${AI_ID}" aria-current="${ST.screen===AI_ID}">${ico("spark")}<span>Trợ lý AI</span>${ST.ref.ai?"":`<span class="cnt">chưa kết nối</span>`}</button>`+
    `<button class="navbtn" type="button" data-go="${HOME}" aria-current="${ST.screen!==AI_ID}" aria-expanded="true">${ico("scale")}<span>Pháp lý dự án</span><span class="cnt">${SC.length}</span></button>`+
    `<div class="sublist">${SC.map(s=>`<button type="button" data-go="${s.id}" aria-current="${s.id===ST.screen}" class="${SOON.has(s.id)?"soon":""}">${esc(s.name)}${SOON.has(s.id)?`<span class="soonb">Sắp ra mắt</span>`:""}</button>`).join("")}</div>`+
    `<h6>Ứng dụng khác</h6><a class="navbtn" href="${esc(app(3200))}">${ico("crane")}<span>Quản lý dự án</span><span class="cnt">↗</span></a><a class="navbtn" href="${esc(app(3300))}">${ico("ruler")}<span>Quản lý thiết kế</span><span class="cnt">↗</span></a>`;
  const d=[["home","Tổng quan","screen-09-00"],["spark","Trợ lý AI",AI_ID],["cal","Kế hoạch","screen-09-02"],["check","Checklist","screen-09-03"],["menu","Menu","menu"]];
  $("#mdock").innerHTML=d.map(x=>`<button type="button" data-go="${x[2]}" class="${x[2]===ST.screen?"on":""}">${ico(x[0])}${x[1]}</button>`).join("");
}
function go(id,selId){
  if(id==="menu"){$("#rail").classList.add("open");return}
  const to=BY[id]?id:HOME;
  if(selId!==undefined){ST.sel[to]=selId||null;delete ST.data[to]}
  ST.screen=to;try{history.replaceState(null,"","#"+ST.screen+(ST.sel[to]?"/"+ST.sel[to]:""))}catch(e){}
  $("#rail").classList.remove("open");render();$("#page").focus({preventScroll:true});window.scrollTo(0,0);
}
document.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");if(g){e.preventDefault();go(g.dataset.go,g.dataset.sel);return}
  if(e.target.closest("#menuBtn"))$("#rail").classList.toggle("open");
  else if($("#rail").classList.contains("open")&&!e.target.closest("#rail"))$("#rail").classList.remove("open");
});

/* ---------- khung màn hình ---------- */
let pollT=null;
function render(){
  if(!ST.ref)return;renderNav();clearTimeout(pollT);
  const s=BY[ST.screen],V=VIEW[s.id];
  $("#page").classList.toggle("chatpage",s.id===AI_ID);$("#aiTop").hidden=s.id===AI_ID;
  if(SOON.has(s.id)){$("#crumb").innerHTML=`<span>Pháp lý dự án</span><span aria-hidden="true">›</span><b>${esc(s.name)}</b>`;
    $("#page").innerHTML=`<section class="sh"><div class="t"><h1>${esc(s.name)}</h1></div></section><div class="soonpg"><div class="soonic">${ico("spark")}</div><span class="soonb lg">Sắp ra mắt</span><h2>Tính năng đang được hoàn thiện</h2><p>${esc(s.name)} sẽ sớm có trong phần mềm. Trong lúc chờ, anh/chị dùng các chức năng khác ở menu bên trái.</p><button class="btn pri" type="button" data-go="${HOME}">Về Tổng quan dự án</button></div>`;return}
  if(s.id===AI_ID){$("#crumb").innerHTML=`<span>Pháp lý dự án</span><span aria-hidden="true">›</span><b>Trợ lý AI</b>`;return renderChat()}
  $("#crumb").innerHTML=`<span>Pháp lý dự án</span><span aria-hidden="true">›</span><b>${esc(s.name)}</b>`;
  const d=ST.data[s.id],err=ST.err[s.id];
  $("#page").innerHTML=`
  <section class="sh"><div class="t"><h1>${esc(s.name)}</h1></div>
    <div class="ctl"><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${d&&!err&&V.actions?V.actions(d):""}<button class="btn sm" type="button" id="rfBtn">${ico("refresh")}Làm mới</button></div></div></section>
  <section class="stage" id="stage"><div class="cv" id="cv">${err?errState(err):d===undefined?loading():V.view(d,s)}</div></section>`;
  $("#rfBtn").onclick=()=>reload();$$("[data-retry]").forEach(b=>b.onclick=()=>reload());
  if(d!==undefined&&!err)V.after&&V.after(d,s);else if(d===undefined&&!err)load(s.id);
}
async function load(id){const V=VIEW[id];if(V._busy)return;V._busy=true;try{ST.data[id]=await V.load();delete ST.err[id]}catch(e){ST.err[id]=e.message}V._busy=false;if(ST.screen===id)render()}
function reload(id=ST.screen){delete ST.data[id];delete ST.err[id];if(ST.screen===id)render();else load(id);document.dispatchEvent(new Event("pl:refresh"))}
// làm mới ngầm (không nháy trang) — dùng khi chờ AI
async function refreshQuiet(id=ST.screen){const V=VIEW[id];try{const d=await V.load();if(ST.screen!==id)return;ST.data[id]=d;const y=scrollY;render();scrollTo(0,y)}catch(e){}document.dispatchEvent(new Event("pl:refresh"))}
// lịch hạn (07) lấy ngày từ cả kế hoạch lẫn checklist: dữ liệu nào đổi cũng tải lại
const dirty=(...ns)=>{ns.forEach(n=>delete ST.data["screen-09-"+n]);delete ST.data["screen-09-02"]};   // lịch hạn ở Kế hoạch pháp lý lấy cả checklist → luôn tải lại
const loading=()=>`<div class="grid g4">${"<div class='sk' style='height:92px'></div>".repeat(4)}</div><div class="sk" style="height:46px;margin:14px 0 8px"></div>${"<div class='sk' style='height:40px;margin-bottom:6px'></div>".repeat(5)}<p class="skip" role="status">Đang tải dữ liệu</p>`;
const errState=m=>`<div class="state err">${ico("warn")}<h3>Không tải được dữ liệu</h3><p>${esc(m)}</p><button class="btn pri" type="button" data-retry>Thử lại</button></div>`;
const emptyState=(title,msg,b)=>`<div class="state">${ico("empty")}<h3>${esc(title)}</h3><p>${esc(msg)}</p>${b||""}</div>`;
const noProject=()=>emptyState("Chưa có dự án","Bạn chưa được gán vào dự án nào. Nhờ Giám đốc dự án hoặc quản trị thêm bạn ở app Quản lý dự án › Thành viên và vai trò.");
const pickProject=what=>emptyState("Chọn một dự án",`Chọn dự án ở thanh trên để ${what}.`);
function setProj(id){ST.proj=id;try{localStorage.setItem("qlda-proj",id)}catch(e){}$("#proj").value=id;syncRole()}
const note=()=>"";
function panelModal({title,intro,html,bind,wide}){
  const last=document.activeElement,ov=document.createElement("div");ov.className="ov";
  ov.innerHTML=`<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="pmt" ${wide?`style="width:min(${wide}px,100%)"`:""}><h3 id="pmt">${esc(title)}</h3><div class="banner b-r" id="pmE" hidden></div><div class="pmb">${html}</div></div>`;
  document.body.append(ov);const close=()=>{ov.remove();last&&last.focus&&last.focus()};trap(ov,close);
  ov.addEventListener("click",e=>{if(e.target===ov||e.target.closest("[data-x]"))close()});
  const err=m=>{const b=$("#pmE",ov);b.innerHTML=`${ico("warn")}<span>${esc(m)}</span>`;b.hidden=false;b.scrollIntoView({block:"nearest"})};
  (ov.querySelector("input,select,textarea,button:not([data-x])")||ov.querySelector("button"))?.focus();
  bind&&bind(ov,close,err);return {ov,close,err};
}
const busy=async(b,label,fn)=>{const t=b.innerHTML;b.disabled=true;b.textContent=label;try{return await fn()}finally{b.disabled=false;b.innerHTML=t}};
const stepPill=s=>P(STEP_ST[s.status]);
const lateTxt=s=>s.late_kind==="qua_han_tra"?`~r:Cơ quan quá hạn ${s.late} ngày`:s.late_kind==="qua_han_ke_hoach"&&s.open?`~r:Quá hạn ${s.late} ngày`:s.slip>0&&s.open?`~${s.slip>14?"r":"a"}:Chậm ${s.slip} ngày`:s.slip<0&&s.open?`~g:Sớm ${-s.slip} ngày`:"";

/* =================== các màn hình =================== */
const VIEW={};


/* ---------- 09-00 Tổng quan dự án ---------- */
// màu trạng thái (dùng kèm nhãn chữ + ký hiệu, không chỉ dựa vào màu)
const OVC={xong:["var(--green)","Hoàn thành","✓"],dang:["var(--blue)","Đang thực hiện","●"],cham:["var(--red)","Chậm tiến độ","!"],chua:["var(--grey-line)","Chưa bắt đầu","○"]};
const PST={dung:["g","Đúng tiến độ","✓"],canh_bao:["a","Cần theo dõi","!"],cham:["r","Chậm tiến độ","!!"],chua_lap:["n","Chưa lập kế hoạch","○"]};
// vòng tròn tiến độ: các cung theo trạng thái bước, giữa là % hoàn thành
function donut(c,total,pct,size=150){
  const r=size/2-12,C=2*Math.PI*r,keys=["xong","dang","cham","chua"];let off=0;
  const segs=total?keys.filter(k=>c[k]).map(k=>{const len=c[k]/total*C,gap=keys.filter(x=>c[x]).length>1?2:0;const s=`<circle r="${r}" cx="${size/2}" cy="${size/2}" fill="none" stroke="${OVC[k][0]}" stroke-width="16" stroke-dasharray="${Math.max(0,len-gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size/2} ${size/2})"><title>${OVC[k][1]}: ${c[k]} bước</title></circle>`;off+=len;return s}).join(""):"";
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Hoàn thành ${pct}%: ${keys.map(k=>OVC[k][1]+" "+c[k]).join(", ")}"><circle r="${r}" cx="${size/2}" cy="${size/2}" fill="none" stroke="var(--surface-2)" stroke-width="16"/>${segs}
    <text x="50%" y="47%" text-anchor="middle" style="font-size:${size/5}px;font-weight:700;fill:var(--fg)">${pct}%</text><text x="50%" y="62%" text-anchor="middle" style="font-size:11px;fill:var(--muted)">hoàn thành</text></svg>`;
}
const legendC=c=>`<div class="ovleg">${Object.keys(OVC).map(k=>`<span><i style="background:${OVC[k][0]}"></i>${OVC[k][2]} ${OVC[k][1]} <b>${c[k]}</b></span>`).join("")}</div>`;
// trục giai đoạn: mỗi giai đoạn một nút, tô theo tỷ lệ bước xong; nút hiện tại có vòng sáng
function phaseAxis(p){
  const n=p.phases.length;if(!n)return "";
  return `<div class="pax" style="--n:${n}">${p.phases.map((x,i)=>{const done=x.done===x.total,cur=x.code===p.current_phase,fr=x.total?x.done/x.total:0,col=x.late?"var(--red)":done?"var(--green)":cur?"var(--blue)":"var(--muted)";
    return `<div class="paxn ${cur?"cur":""}" title="${esc(x.name)}: ${x.done}/${x.total} bước xong${x.active?`, ${x.active} đang làm`:""}${x.late?`, ${x.late} chậm`:""}">
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true"><circle cx="18" cy="18" r="14" fill="var(--surface)" stroke="var(--line)" stroke-width="4"/><circle cx="18" cy="18" r="14" fill="none" stroke="${col}" stroke-width="4" stroke-dasharray="${fr*88} 88" transform="rotate(-90 18 18)"/>
      <text x="18" y="22" text-anchor="middle" style="font-size:11px;font-weight:700;fill:${done?"var(--green)":"var(--fg)"}">${done?"✓":i+1}</text></svg>
      <b>${esc(x.name)}</b><small>${x.done}/${x.total}${x.late?` · <span style="color:var(--red)">${x.late} chậm</span>`:x.active?` · ${x.active} đang làm`:""}</small>${cur?`<em>▲ đang ở đây</em>`:""}</div>`}).join("")}</div>`;
}
// trục thời gian: bắt đầu → hôm nay → hoàn thành theo kế hoạch gốc ◆ và dự kiến ●
function timeAxis(p,t){
  if(!p.start||!p.finish)return "";
  const a=p.start<t?p.start:t,ends=[p.finish,p.base,t].filter(Boolean).sort(),b=ends.at(-1),span=Math.max(1,(new Date(b)-new Date(a))/864e5),x=d=>((new Date(d)-new Date(a))/864e5/span*100).toFixed(2);
  const late=p.slip>0,col=late?"var(--red)":"var(--green)";
  return `<div class="tax" role="img" aria-label="Bắt đầu ${dmy(a)}, hoàn thành theo kế hoạch gốc ${dmy(p.base)}, dự kiến ${dmy(p.finish)}">
    <div class="taxl"><span style="left:0;width:${x(t)}%" class="taxdone"></span>${p.base&&p.base!==p.finish?`<span class="taxgap" style="left:${x(p.base<p.finish?p.base:p.finish)}%;width:${Math.abs(x(p.finish)-x(p.base))}%;background:${col}"></span>`:""}</div>
    <i class="taxm today" style="left:${x(t)}%" title="Hôm nay ${dmy(t)}"></i>${p.base?`<i class="taxm base" style="left:${x(p.base)}%" title="Hoàn thành theo kế hoạch gốc ${dmy(p.base)}"></i>`:""}<i class="taxm fc" style="left:${x(p.finish)}%;background:${col}" title="Dự kiến hoàn thành ${dmy(p.finish)}"></i>
    <div class="taxt"><span>${dmy(a)}</span><span>${dmy(b)}</span></div></div>
    <div class="ovleg sm"><span><i class="lk today"></i>Hôm nay ${dmy(t)}</span>${p.base?`<span><i class="lk base"></i>Kế hoạch gốc ${dmy(p.base)}</span>`:""}<span><i class="lk fc" style="background:${col}"></i>Dự kiến ${dmy(p.finish)}${p.slip?` (${late?"chậm":"sớm"} ${Math.abs(p.slip)} ngày)`:""}</span></div>`;
}
// nguyên nhân vướng mắc: thanh ngang, số trên đầu thanh
function causeChart(cs,sel){
  if(!cs.length)return `<p class="muted">Không có vướng mắc nào đang mở.</p>`;
  const m=Math.max(...cs.map(c=>c.n)),W=640,lw=230,rh=30,H=cs.length*rh+6;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Số vướng mắc theo nguyên nhân">${cs.map((c,i)=>{const w=c.n/m*(W-lw-50),y=i*rh+3;
    return `<g data-cause="${esc(c.label)}" role="button" tabindex="0" style="cursor:pointer;opacity:${sel&&sel!==c.label?.4:1}"><title>${esc(c.label)}: ${c.n} — bấm để xem chi tiết</title><text x="${lw-8}" y="${y+17}" text-anchor="end" style="font-size:12px;fill:var(--fg);font-weight:${sel===c.label?700:400}">${esc(c.label)}</text><rect x="${lw}" y="${y+5}" width="${Math.max(3,w)}" height="16" rx="4" fill="var(${c.none?"--red":"--orange"})"/><text x="${lw+w+6}" y="${y+17}" style="font-size:12px;font-weight:600;fill:var(--fg)">${c.n}</text></g>`}).join("")}</svg>`;
}
// dự án hiển thị trên tổng quan: Khu NOXH Đại Hưng Phát
const ovProj=()=>ST.ref.projects.find(p=>/DHP|Đại Hưng Phát/i.test(p.code+" "+p.name))||projOf(curProj());
// các bước chậm so với kế hoạch gốc: thanh ngang, số ngày ở đầu thanh
function lateChart(L){
  if(!L.length)return `<p class="muted">✓ Không có bước nào chậm so với kế hoạch gốc.</p>`;
  const m=Math.max(...L.map(a=>Math.max(a.slip,a.late))),W=640,lw=260,rh=30,H=L.length*rh+6;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Số ngày chậm của từng bước">${L.map((a,i)=>{const v=Math.max(a.slip,a.late),w=v/m*(W-lw-70),y=i*rh+3,nm=a.name.length>40?a.name.slice(0,39)+"…":a.name;
    return `<g data-step="${a.id}" style="cursor:pointer"><title>${esc(a.name)}: ${a.late_kind==="qua_han_tra"?"cơ quan quá hạn "+a.late:"chậm "+a.slip} ngày</title><text x="${lw-8}" y="${y+17}" text-anchor="end" style="font-size:12px;fill:var(--fg)">${esc(nm)}</text>
      <rect x="${lw}" y="${y+5}" width="${Math.max(3,w)}" height="16" rx="4" fill="var(--red)"/><text x="${lw+w+6}" y="${y+17}" style="font-size:12px;font-weight:600;fill:var(--fg)">${v} ngày</text></g>`}).join("")}</svg>`;
}
VIEW["screen-09-00"]={
  actions:()=>"",
  load:async()=>{const p=ovProj();if(!p)return null;const Q=qs({project:p.id});
    const [ov,ins,ev]=await Promise.all([api("GET","/api/overview"+Q),api("GET","/api/insight"+Q).catch(()=>null),api("GET","/api/events"+Q).catch(()=>[])]);return {...ov,ins,ev}},
  view(d){
    if(!d||!d.projects.length)return noProject();
    const p=d.projects[0];
    if(!p.total)return projCard(p,d.today);
    const st=PST[p.status],act=p.active.length,ovc=d.causes.some(c=>c.label===ST.tab.ovc)?ST.tab.ovc:null,PB=ovc?p.problems.filter(x=>x.label===ovc):p.problems;
    ST.ovPB=PB;ST.ovPid=p.id;
    // 4 thẻ số liệu đã có ở Kế hoạch pháp lý — Tổng quan bỏ (user 22/10)
    return `${p.no_base?`<div style="margin-bottom:14px">${banner("a",`${p.no_base}/${p.total} bước chưa có kế hoạch gốc nên chưa so được chậm / sớm. Vào Kế hoạch pháp lý › «Chốt kế hoạch gốc» khi đã thống nhất tiến độ.`)}</div>`:""}
    ${insightView(d)}<div style="margin-top:14px">${projCard(p,d.today)}</div>
    <div class="grid g2e" style="margin-top:14px"><div class="card"><h3>Các bước chậm so với kế hoạch gốc</h3>${lateChart(p.late_steps.slice(0,10))}${note("Độ dài thanh = số ngày chậm (dự kiến hoàn thành trừ kế hoạch gốc, hoặc số ngày cơ quan quá hạn trả kết quả). Bấm vào thanh để mở bước.")}</div>
      <div class="card"><h3>Nguyên nhân vướng mắc</h3>${causeChart(d.causes,ovc)}${note("Nguyên nhân do người phụ trách ghi khi bấm vào hồ sơ / công việc quá hạn. «Chưa ghi nguyên nhân» = đã quá hạn mà chưa ai giải trình. Bấm vào thanh để xem từng hồ sơ, bấm hồ sơ để xem hoặc ghi lý do.")}</div></div>
    ${PB.length?`<div class="card" id="ovProb" style="margin-top:14px"><div class="plh"><h3 style="margin:0">${ovc?esc(ovc):"Tình trạng và nguyên nhân vướng mắc"} <small class="muted" style="font-weight:400">${PB.length} mục</small></h3><span style="flex:1"></span>${ovc?`<button class="btn sm" type="button" data-cause="">${ico("x")}Bỏ lọc</button>`:""}</div>
      ${table(["Công việc","Nguyên nhân","Vướng ở đâu / tình trạng","Từ ngày","Ảnh hưởng","Phụ trách"],PB.map(x=>[x.step,x.manual?`~a:${x.label}`:`~r:${x.label}`,x.text||"",dmy(x.since),x.late_kind==="qua_han_tra"?`~r:quá hạn ${x.late} ngày`:x.slip>0?`~r:chậm ${x.slip} ngày`:"—",x.owner||""]),{rowAttr:i=>`data-prob="${i}" tabindex="0" style="cursor:pointer" title="Bấm để xem / ghi nguyên nhân"`})}</div>`:""}`},
  after(d){
    // bấm bước → sổ ngay nội dung (hồ sơ, quá hạn thì giải trình / đề xuất hạn mới); bấm thẻ số liệu → danh sách tương ứng ở Kế hoạch
    $$("[data-step]").forEach(el=>{const f=()=>stepPanel(el.dataset.step);el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter")f()}});
    $$("[data-ovk]").forEach(el=>{const f=()=>{const y=scrollY;ST.tab.ovk=ST.tab.ovk===el.dataset.ovk?null:el.dataset.ovk;render();scrollTo(0,y);$(`[data-ovk="${el.dataset.ovk}"]`)?.focus({preventScroll:true})};el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f()}}});
    $$("[data-ovev]").forEach(el=>{const f=()=>{const ev=(d.ev||[]).find(x=>x.id===el.dataset.ovev);ev&&editEvent(ev,{pid:ev.project_id,ev:d.ev})};el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter")f()}});
    // bấm thanh nguyên nhân → lọc bảng; bấm dòng → xem / ghi nguyên nhân của hồ sơ (hoặc cả công việc)
    $$("[data-cause]").forEach(el=>{const f=()=>{const c=el.dataset.cause;ST.tab.ovc=!c||ST.tab.ovc===c?null:c;render();$("#ovProb")?.scrollIntoView({block:"nearest",behavior:"smooth"})};el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f()}}});
    $$("[data-prob]").forEach(el=>{const x=ST.ovPB[+el.dataset.prob],f=()=>extModal(x.step_id,x.item_id||null,ST.ovPid);el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter")f()}});
    $$("[data-plan]").forEach(b=>b.onclick=()=>{setProj(b.dataset.plan);ST.data={};go("screen-09-02")});
    $("#rpHtml")&&($("#rpHtml").onclick=e=>exportFullHtml(e.currentTarget));
  }};
/* 4 khối cho pháp chế: Tuần này cần làm · Hồ sơ đang ở cơ quan · Nghẽn tiến độ · Rủi ro pháp lý sắp tới — bấm dòng → mở việc (stepPanel) */
const WK={qua_han:["r","!","Quá hạn"],tra:["a","⏳","Cơ quan trả"],han:["b","◷","Hạn xong"],ho_so:["a","▤","Hạn hồ sơ"],bat_dau:["g","▶","Bắt đầu"],du_thao:["b","✎","Dự thảo"],ev:["p","●","Lịch"]};
function insightView(d){
  const I=d.ins;if(!I)return "";
  const t=I.today,in7=isoAdd(t,7),dayName=x=>x===t?"Hôm nay":x===isoAdd(t,1)?"Ngày mai":`${WD[new Date(x+"T00:00:00").getDay()]} ${dm(x)}`;
  // tuần này: việc + lịch họp / sự kiện của tôi (cả sự kiện được mời); dự thảo chờ chốt gom một dòng
  const evs=evItems(d.ev,t,in7).filter(e=>e.d===e.occ).map(e=>({d:e.d,k:"ev",t:(e.tm?e.tm+" ":"")+e.t,sub:e.sub,col:e.col,ev:e.ev.id}));
  const drafts=I.week.filter(w=>w.k==="du_thao"),W=[...I.week.filter(w=>w.k!=="du_thao"),...evs].sort((a,b)=>a.d.localeCompare(b.d)||(a.k==="ev"?-1:0)-(b.k==="ev"?-1:0));
  const days=[...new Set(W.map(w=>w.d))];
  const wrow=w=>{const [c,ic]=WK[w.k];return `<li class="wkr" ${w.step?`data-step="${w.step}" tabindex="0" role="button"`:w.ev?`data-ovev="${w.ev}" tabindex="0" role="button"`:""}><span class="wki k-${c}" ${w.col?`style="--k:${w.col}"`:""} aria-hidden="true">${ic}</span><div><b>${esc(w.t)}</b><small>${esc([w.sub,w.owner].filter(Boolean).join(" · "))}</small></div></li>`};
  const week=`<div class="card"><h3>Tuần này cần làm <small class="muted" style="font-weight:400">${dmy(t)} → ${dmy(in7)}</small></h3>
    ${W.length||drafts.length?`${days.map(x=>`<div class="wkd"><div class="wkh ${x===t?"now":""}">${dayName(x)}</div><ul class="wkl">${W.filter(w=>w.d===x).map(wrow).join("")}</ul></div>`).join("")}
      ${drafts.length?`<a class="wkdr" href="#" data-go="screen-09-04"><span class="wki k-b" aria-hidden="true">✎</span><span><b>${drafts.length} dự thảo văn bản chờ kiểm tra và chốt</b><small>${esc(drafts.slice(0,3).map(x=>x.t.replace(/^Dự thảo chờ chốt: /,"")).join(" · "))}${drafts.length>3?" …":""}</small></span><span class="muted">›</span></a>`:""}`
      :`<p class="muted">Tuần này không có việc tới hạn.</p>`}</div>`;
  const ag=`<div class="card"><h3>Hồ sơ đang ở cơ quan <small class="muted" style="font-weight:400">${I.agency.length} hồ sơ chờ kết quả</small></h3>
    ${I.agency.length?`<ul class="agl">${I.agency.map(a=>`<li data-step="${a.id}" tabindex="0" role="button"><div><b>${esc(a.name)}</b><small>${esc(a.agency||"chưa ghi cơ quan")} · nộp ${dmy(a.submit)}${a.proc_days?` · thời hạn ${a.proc_days} ngày${a.workdays?" làm việc":""}`:""}${a.owner?" · "+esc(a.owner):""}</small></div>
      ${a.left==null?pill("~b:Chưa có thời hạn giải quyết"):a.left<0?pill(`~r:⚠ Quá hạn trả ${-a.left} ngày`):a.left===0?pill("~a:Hạn trả hôm nay"):pill(`~${a.left<=3?"a":"g"}:Còn ${a.left} ngày (hạn ${dm(a.due)})`)}</li>`).join("")}</ul>`
      :`<p class="muted">Chưa có hồ sơ nào đang chờ cơ quan trả kết quả.</p><p class="muted" style="font-size:12.5px">Khi nộp hồ sơ, mở việc → chọn trạng thái «Đã nộp, chờ kết quả», ghi <b>ngày nộp</b> và <b>thời hạn cơ quan giải quyết</b>; hồ sơ sẽ hiện ở đây kèm số ngày còn lại / quá hạn trả.</p>`}</div>`;
  const B=I.block;
  const bl=`<div class="card"><h3>Nghẽn tiến độ ${B.slip?`<small class="err-t" style="font-weight:400">dự án chậm ${B.slip} ngày · dự kiến xong ${dmy(B.finish)}</small>`:""}</h3>
    ${B.list.length?`<ul class="agl">${B.list.map(x=>`<li data-step="${x.id}" tabindex="0" role="button"><div><b>${esc(x.name)}</b><small><span class="${x.reason.none?"err-t":""}">${esc(x.reason.label)}</span>${x.reason.text?" — "+esc(x.reason.text):""}${x.owner?" · "+esc(x.owner):""}</small>${x.down?`<small>${x.down} việc phía sau đang chờ việc này</small>`:""}</div>
      ${pill(x.late_kind==="qua_han_tra"?`~r:Cơ quan quá hạn ${x.late} ngày`:x.late_kind==="qua_han_ke_hoach"?`~r:Quá hạn ${x.late} ngày`:`~a:Chậm ${Math.max(x.late,x.slip)} ngày so với gốc`)}</li>`).join("")}</ul><p class="muted" style="font-size:12.5px;margin:8px 0 0">Xếp theo số việc phía sau phải chờ. Bấm một việc để ghi nguyên nhân / vướng ở đâu.</p>`
      :`<p class="muted">✓ Không có việc nào đang chậm.</p>`}</div>`;
  const RK={tre_han:"Nguy cơ trễ hạn",co_quan:"Cơ quan",het_hieu_luc:"Căn cứ hết hiệu lực",quy_dinh_moi:"Quy định mới",ai:"Cảnh báo AI",gia_han:"Gia hạn"};
  const rk=`<div class="card"><h3>Rủi ro pháp lý sắp tới <small class="muted" style="font-weight:400">14 ngày tới · quy định mới 90 ngày tới</small></h3>
    ${I.risk.length?`<ul class="agl">${I.risk.map(x=>`<li ${x.step?`data-step="${x.step}" tabindex="0" role="button"`:""}><span class="pill p-${x.lv==="cao"?"r":"a"}" style="flex:none">${esc(RK[x.k]||"Rủi ro")}</span><div><small style="color:var(--fg);font-size:13px">${esc(x.text.replace(/^Nguy cơ trễ hạn /,""))}</small></div></li>`).join("")}</ul>`
      :`<p class="muted">✓ Chưa thấy rủi ro pháp lý nào trong 14 ngày tới.</p>`}</div>`;
  // 4 thẻ số liệu (như Checklist): bấm thẻ → sổ chi tiết ngay bên dưới, bấm lại để thu
  const nOver=W.filter(w=>w.k==="qua_han").length,nTask=W.filter(w=>w.k!=="ev").length,agOver=I.agency.filter(a=>a.left!=null&&a.left<0).length;
  const C=[["tuan","Tuần này cần làm",String(nTask+drafts.length),[nOver&&`${nOver} quá hạn`,drafts.length&&`${drafts.length} dự thảo chờ chốt`,evs.length&&`${evs.length} lịch họp`].filter(Boolean).join(" · ")||"không có việc tới hạn",nOver?"r":"b",week],
    ["co_quan","Hồ sơ đang ở cơ quan",String(I.agency.length),I.agency.length?(agOver?`${agOver} hồ sơ quá hạn trả`:"chưa có hồ sơ quá hạn trả"):"chưa có hồ sơ chờ kết quả",agOver?"r":"g",ag],
    ["nghen","Nghẽn tiến độ",String(B.list.length),B.slip?`dự án chậm ${B.slip} ngày`:"không có việc chậm",B.list.length?"r":"g",bl]];
  const sel=C.find(c=>c[0]===ST.tab.ovk);let ci=0;
  // user 22/10: bỏ thẻ «Rủi ro pháp lý sắp tới» — còn 3 thẻ
  return kpis(C.map(c=>c.slice(1,5))).replace('class="grid g4"','class="grid g4 ov3"').replace(/<div class="kpi">/g,()=>{const c=C[ci++];return `<div class="kpi plkpi" data-ovk="${c[0]}" role="button" tabindex="0" aria-pressed="${sel===c}" title="Bấm để xem chi tiết">`})
    +(sel?`<div class="ovsel" style="margin-top:14px">${sel[5]}</div>`:"");
}
function projCard(p,t){
  const s=PST[p.status];
  if(!p.total)return `<div class="card ovp"><div class="ovh"><div><b class="ovt">${esc(p.code)} · ${esc(p.name)}</b><small class="muted">${esc(p.location||"")}</small></div>${pill(`~${s[0]}:${s[2]} ${s[1]}`)}</div><p class="muted">Chưa khởi tạo các bước pháp lý.</p><button class="btn sm pri" type="button" data-plan="${p.id}">${ico("cal")}Lập kế hoạch pháp lý</button></div>`;
  return `<div class="card ovp"><div class="ovh"><div style="min-width:0"><b class="ovt">${esc(p.code)} · ${esc(p.name)}</b><small class="muted">${esc(String(p.location||"").split(/[(\[]/)[0])}</small></div>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${pill(`~${s[0]}:${s[2]} ${s[1]}${p.slip>0?` ${p.slip} ngày`:""}`)}<button class="btn sm" type="button" data-plan="${p.id}">${ico("cal")}Kế hoạch</button></div></div>
    <div class="ovb"><div class="ovd">${donut(p.counts,p.total,p.pct)}${legendC(p.counts)}</div>
      <div class="ovr"><h4>Tiến trình theo giai đoạn</h4>${phaseAxis(p)}<h4>Thời gian</h4>${timeAxis(p,t)}</div></div>
    <div class="grid g2e" style="margin-top:6px"><div><h4>Đang ở bước</h4>${p.active.length?`<ul class="alist">${p.active.map(a=>`<li data-step="${a.id}" tabindex="0" role="button"><i class="dot-${a.late>0||a.slip>0?"r":"b"}"></i><div><b>${esc(a.name)}</b><small>${esc(a.state_name)} · nộp ${dmy(a.plan_submit)} · kết quả ${dmy(a.plan_end)} · hồ sơ ${a.req_ok}/${a.req_n}${a.slip>0?` · <span style="color:var(--red)">chậm ${a.slip} ngày</span>`:""}${a.owner?" · "+esc(a.owner):""}</small></div></li>`).join("")}</ul>`:`<p class="muted">Không có bước đang làm.${p.next.length?" Bước kế tiếp:":""}</p>`}
      ${p.next.length?`<ul class="alist">${p.next.map(a=>`<li data-step="${a.id}" tabindex="0" role="button"><i class="dot-g" style="background:var(--muted)"></i><div><b>${esc(a.name)}</b><small>Sắp tới · bắt đầu ${dmy(a.plan_start)} · kết quả ${dmy(a.plan_end)}</small></div></li>`).join("")}</ul>`:""}</div>
      <div><h4>Cảnh báo & vướng mắc</h4>${p.late_steps.length||p.problems.length?`<ul class="alist">${p.late_steps.slice(0,4).map(a=>`<li data-step="${a.id}" tabindex="0" role="button"><i class="dot-r"></i><div><b>${esc(a.name)}</b><small style="color:var(--red)">${a.late_kind==="qua_han_tra"?`Cơ quan quá hạn ${a.late} ngày`:a.late_kind==="qua_han_ke_hoach"?`Quá hạn ${a.late} ngày`:`Chậm ${a.slip} ngày`} · dự kiến ${dmy(a.plan_end)} (gốc ${dmy(a.base_end)})</small></div></li>`).join("")}
        ${p.problems.filter(x=>!p.late_steps.slice(0,4).some(l=>l.id===x.step_id)||x.manual).slice(0,5).map(x=>`<li data-step="${x.step_id}" tabindex="0" role="button"><i class="dot-a"></i><div><b>${esc(x.label)}</b><small>${esc(x.step)}${x.text?" — "+esc(x.text):""}</small></div></li>`).join("")}</ul>`:`<p class="muted">✓ Không có cảnh báo.</p>`}</div></div></div>`;
}

/* ---------- 09-01 Hôm nay ---------- */
VIEW["screen-09-01"]={
  // cùng khung dự án với Tổng quan: thẻ dự án + trục giai đoạn, việc trong ngày xếp theo giai đoạn
  load:async()=>{const p=ST.proj?projOf(ST.proj):ovProj(),Q=qs({project:p?.id||ST.proj});const [t,ov,all]=await Promise.all([api("GET","/api/today"+Q),p?api("GET","/api/overview"+Q):null,api("GET","/api/steps"+Q)]);return {...t,proj:ov?.projects[0]||null,all}},
  view(d){
    if(!ST.ref.projects.length)return noProject();
    if(!d.steps)return emptyState("Chưa có kế hoạch pháp lý","Khởi tạo các bước pháp lý của dự án ở màn Kế hoạch pháp lý — hệ thống lập tiến độ dự kiến và bắt đầu nhắc việc.",`<button class="btn pri" type="button" data-go="screen-09-02">${ico("cal")}Mở Kế hoạch pháp lý</button>`);
    const A=d.alerts,G=k=>A.filter(a=>a.kind===k),slip=d.finish&&d.base_finish?Math.round((new Date(d.finish)-new Date(d.base_finish))/864e5):0;
    const t=d.today,p=d.proj,W=d.work||[],nT=W.filter(w=>w.today).length,nR=W.filter(w=>w.tone==="r").length;
    const curPh=p?.phases.find(x=>x.code===p.current_phase);
    const head=p?`<div class="card ovp tdh"><div class="ovh"><div style="min-width:0"><b class="ovt">${WD[new Date(t).getDay()]}, ${dmy(t)}</b><small class="muted">${esc(p.code)} · ${esc(p.name)}${curPh?` · đang ở giai đoạn <b>${esc(curPh.name)}</b>`:""}</small></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${pill(`~a:${nT} việc có mốc hôm nay`)}${nR?pill(`~r:${nR} việc tồn đọng / quá hạn`):""}${pill(`~b:${W.length} việc trong ngày`)}</div></div>${phaseAxis(p)}</div>`:"";
    const miss=w=>w.missing.length?`<ul class="tdm">${w.missing.slice(0,6).map(i=>`<li class="${i.due&&i.due<t?"r":i.due===t?"a":""}">${i.kq?"Kết quả: ":""}${esc(i.name)}${i.due?` <small>· ${i.due<t?`quá hạn ${dmy(i.due)}`:i.due===t?"hạn hôm nay":"hạn "+dmy(i.due)}</small>`:""}</li>`).join("")}${w.missing.length>6?`<li><small>… và ${w.missing.length-6} hồ sơ khác</small></li>`:""}</ul>`:"";
    const wRow=w=>`<li data-step="${w.id}" tabindex="0" role="button"><i class="dot-${w.tone}"></i><div style="min-width:0;flex:1"><b>${esc(w.name)}</b>${w.today?` ${pill("~a:Hôm nay")}`:""}
      <div class="tdt t-${w.tone}">${esc(w.task)}</div>
      <small>${esc(w.state_name)} · KH ${dmy(w.plan_start)} → ${dmy(w.plan_end)}${w.req_n?` · hồ sơ ${w.req_ok}/${w.req_n}`:""}${w.slip>0?` · <span style="color:var(--red)">chậm ${w.slip} ngày</span>`:""}${w.owner?" · "+esc(w.owner):""}</small>
      ${w.issue?`<small style="color:var(--orange)">Vướng: ${esc(w.issue)}</small>`:""}${w.warn_n?`<small style="color:var(--orange)">${w.warn_n} cảnh báo AI chưa xử lý</small>`:""}${miss(w)}</div></li>`;
    const phI=c=>{const k=p?p.phases.findIndex(x=>x.code===c):-1;return k<0?99:k},byPh=[...new Set(W.map(w=>w.phase_code))].sort((a,b)=>phI(a)-phI(b)).map(c=>({c,L:W.filter(w=>w.phase_code===c)}));
    const work=`<div class="card" style="margin-top:14px"><h3>Việc hôm nay theo giai đoạn dự án <small style="color:var(--muted);font-weight:400">${W.length}</small></h3>
      ${W.length?byPh.map(g=>{const ph=p?.phases.find(x=>x.code===g.c),i=p?p.phases.findIndex(x=>x.code===g.c):-1;
        return `<div class="tdg${g.c===p?.current_phase?" cur":""}"><h4><span class="tdn">${i>=0?i+1:"•"}</span>${esc(g.L[0].phase||"Chưa xếp giai đoạn")}${ph?` <small>${ph.done}/${ph.total} bước xong</small>`:""}${g.c===p?.current_phase?` ${pill("~b:Giai đoạn hiện tại")}`:""}</h4><ul class="alist">${g.L.map(wRow).join("")}</ul></div>`}).join("")
      :`<p class="muted">✓ Hôm nay không có bước nào đến kỳ thực hiện.</p>`}</div>`;
    const box=(title,list,emptyMsg)=>`<div class="card"><h3>${esc(title)} <small style="color:var(--muted);font-weight:400">${list.length}</small></h3>${list.length?`<ul class="alist">${list.map(a=>`<li data-step="${a.step_id}" tabindex="0" role="button"><i class="dot-${a.tone==="r"?"r":a.tone==="a"?"a":"b"}"></i><div><b>${esc(a.step)}</b><small>${esc(a.project_code)} · ${esc(a.text)}${a.due?" · "+dmy(a.due):""}${a.owner?" · "+esc(a.owner):""}</small></div></li>`).join("")}</ul>`:`<p class="muted">${esc(emptyMsg)}</p>`}</div>`;
    return `${tdKpis([["Đang thực hiện",String(d.active),"bước đang chuẩn bị / chờ kết quả","b"],["Chậm trễ",String(d.late),"bước chậm so với kế hoạch gốc","r"],["Hoàn thành",`${d.done}/${d.steps}`,"bước pháp lý","g"],["Dự kiến xong",dmy(d.finish),slip>0?`chậm ${slip} ngày so với gốc`:slip<0?`sớm ${-slip} ngày`:"đúng kế hoạch gốc",slip>0?"a":"g"]],d)}
    ${tdList(d)}
    ${head}${work}
    <div class="grid g2e" style="margin-top:14px">${box("Sắp tới (14 ngày)",G("sap_toi"),"Không có bước nào sắp bắt đầu.")}${box("Chậm so với kế hoạch gốc",G("cham"),"Không có bước nào chậm so với kế hoạch gốc.")}</div>`},
  after(){$$("[data-step]").forEach(el=>{const f=()=>stepPanel(el.dataset.step);el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter")f()}});
    $$("[data-tdf]").forEach(k=>{const f=()=>{ST.tab.tdf=ST.tab.tdf===k.dataset.tdf?null:k.dataset.tdf;const y=scrollY;render();scrollTo(0,y);if(ST.tab.tdf)$("#tdList")?.scrollIntoView({behavior:"smooth",block:"start"})};k.onclick=f;k.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f()}}})}};

/* ---------- 09-02 Kế hoạch pháp lý ---------- */
VIEW["screen-09-02"]={
  load:async()=>{const pid=curProj();if(!pid)return null;const [steps,info,ck,ext,ev]=await Promise.all([api("GET","/api/steps"+qs({project:pid})),api("GET",`/api/projects/${pid}/info`),api("GET","/api/checklist"+qs({project:pid})),api("GET","/api/extensions"+qs({project:pid})),api("GET","/api/events"+qs({project:pid}))]);return {steps,info,pid,items:ck.items,ext,ev}},
  actions:d=>d&&!d.steps.length?wbtn("plXlsx","Nhập từ Excel",{icon:"upload",pri:1})+wbtn("plInit","Khởi tạo các bước",{icon:"plus"})+wbtn("plInfo","Thông tin chủ đầu tư",{}):"",
  view(d){
    if(!ST.ref.projects.length)return noProject();
    if(!d)return pickProject("xem kế hoạch pháp lý");
    if(!d.steps.length)return emptyState("Chưa có bước pháp lý","Bấm «Khởi tạo các bước»: chọn các thủ tục áp dụng cho dự án, hệ thống tự lập phụ thuộc theo mốc QLDA, thời hạn giải quyết theo quy định và đánh dấu bước đã xong theo mốc tiến độ.",wbtn("plInit2","Khởi tạo các bước",{pri:1,icon:"plus"}));
    return `<div class="plsplit"><aside class="plcal" aria-label="Lịch">${calView(d)}</aside><section aria-label="Kế hoạch pháp lý">${planView(d)}</section></div>`;},
  after(d){
    if(!d)return;
    const pid=d.pid,re=()=>{reload();dirty("01","03")};
    calAfter(id=>viewStep(d.steps.find(s=>s.id===id),d),d);
    [$("#plInit"),$("#plInit2")].forEach(b=>b&&(b.onclick=()=>initSteps(pid,d.steps.length>0)));
    $("#plUpd")&&($("#plUpd").onclick=e=>busy(e.target,"Đang tính…",async()=>{const r=await api("POST",`/api/plan/${pid}/schedule`,{mode:"cap_nhat"});re();toast("Đã cập nhật kế hoạch theo thực tế — dự kiến xong "+dmy(r.finish))}).catch(x=>toast(x.message)));
    $("#plRe")&&($("#plRe").onclick=()=>formModal({title:"Lập lại kế hoạch pháp lý",intro:"Tính lại toàn bộ ngày dự kiến từ ngày bắt đầu và ghi đè kế hoạch gốc. Bước đã xong giữ ngày thực tế.",values:{start:ST.ref.today},
      fields:[{k:"start",label:"Bắt đầu các bước chưa làm từ ngày",type:"date",req:1}],okLabel:"Lập kế hoạch",onSubmit:async v=>{const r=await api("POST",`/api/plan/${pid}/schedule`,{mode:"lap",start:v.start});re();toast("Đã lập kế hoạch — dự kiến xong "+dmy(r.finish))}}));
    $("#plBase")&&($("#plBase").onclick=()=>confirmBox("Chốt kế hoạch gốc?","Kế hoạch hiện hành trở thành kế hoạch gốc để so sánh chậm / sớm từ nay.","Chốt",false,async()=>{await api("POST",`/api/plan/${pid}/schedule`,{mode:"chot_goc"});re();toast("Đã chốt kế hoạch gốc")}));
    $("#plAdd")&&($("#plAdd").onclick=()=>editStep(null,d));
    $("#plXls")&&($("#plXls").onclick=()=>location.href="/api/plan/export.xlsx"+qs({project:pid}));
    $("#plHtml")&&($("#plHtml").onclick=e=>exportFullHtml(e.currentTarget));
    $("#plInfo")&&($("#plInfo").onclick=()=>editInfo(pid));
    $("#plXlsx")&&($("#plXlsx").onclick=()=>importPlanXlsx(pid));
    const pa=$("#plAll");pa&&(pa.onchange=()=>{ST.q.plAll=pa.checked;render()});
    $$("[data-plv]").forEach(b=>b.onclick=()=>{ST.tab.plv=b.dataset.plv;ST.tab.plf=null;render()});
    $$("[data-plf]").forEach(b=>{const f=()=>{ST.tab.plf=ST.tab.plf===b.dataset.plf?null:b.dataset.plf;const y=scrollY;render();scrollTo(0,y);$(`[data-plf="${b.dataset.plf}"]`)?.focus({preventScroll:true})};
      b.onclick=f;if(b.tagName!=="BUTTON")b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f()}}});
    $$("[data-ed]").forEach(el=>{const f=()=>editStep(d.steps.find(s=>s.id===el.dataset.ed),d);el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter")f()}});
  }};
// kế hoạch pháp lý: thẻ theo mục (thanh tiến độ + danh sách việc) hoặc theo tháng
const isOver=s=>s.open&&s.late>0&&s.late_kind!=="cham_ke_hoach";
// quá hạn theo nghĩa rộng: công việc quá hạn hoặc còn hồ sơ bắt buộc quá hạn
const hasOver=s=>isOver(s)||(s.open&&+s.overdue_n>0);
const stIcon=s=>s.status==="xong"?["ok","✓"]:s.status==="bo_qua"?["na","–"]:hasOver(s)?["bad","!"]:["dang","cho_kq"].includes(s.status)?["act","●"]:["wait","○"];
const spanTxt=s=>s.plan_start||s.plan_end?`${dmy(s.plan_start)} → ${dmy(s.plan_end)}${s.plan_start&&s.plan_end?` · ${Math.round((new Date(s.plan_end)-new Date(s.plan_start))/864e5)} ngày`:""}`:"chưa có ngày";
function planRow(s){
  const [c,ic]=stIcon(s),late=isOver(s);
  return `<li class="plr ${c}" data-ed="${s.id}" tabindex="0" role="button"><span class="pli ${c}" aria-hidden="true">${ic}</span>
    <div class="plb"><b>${s.stt?esc(s.stt)+". ":""}${esc(s.name)}</b><small>${esc(spanTxt(s))}${s.req_n?` · hồ sơ ${s.req_ok}/${s.req_n}`:""}${s.owner?" · "+esc(s.owner):""}${s.note&&s.open?" · "+esc(s.note):""}</small></div>
    <span class="plst">${extPill(s.ext,s.ext_wait)}${late?`<span class="pill p-r">⚠ Quá hạn ${s.late} ngày</span>`:s.open&&+s.overdue_n>0?`<span class="pill p-r">⚠ ${s.overdue_n} hồ sơ quá hạn</span>`:s.open&&s.late_kind==="cham_ke_hoach"&&s.late>0?`<span class="pill p-a">Chậm ${s.late} ngày so với gốc</span>`:pill(P(STEP_ST[s.status]))}</span></li>`;
}
// bấm việc trên lịch: chỉ XEM việc (hạn, tình trạng, hồ sơ còn thiếu, vướng mắc) — sửa việc làm ở danh sách bên dưới
function viewStep(s,d){
  if(!s)return;
  const t=ST.ref.today,L=(d.items||[]).filter(i=>i.step_id===s.id&&i.required),miss=L.filter(i=>!i.ok),late=s.status!=="xong"&&s.plan_end&&s.plan_end<t?daysLate(s.plan_end):0;
  const row=(k,v)=>v?`<div><small>${k}</small><b>${v}</b></div>`:"";
  panelModal({title:`${s.stt?s.stt+". ":""}${s.name}`,wide:620,html:`<p style="margin:0 0 12px;display:flex;gap:6px;flex-wrap:wrap">${pill(P(STEP_ST[s.status]))}${late?pill(`~r:⚠ Quá hạn ${late} ngày — nhắc lại mỗi ngày tới khi xong`):""}</p>
    <div class="exinfo">${row("Kế hoạch",s.plan_start||s.plan_end?`${dmy(s.plan_start)} → ${dmy(s.plan_end)}`:"chưa có ngày")}${row("Hạn hoàn thành",dmy(s.plan_end))}${row("Người phụ trách",esc(s.owner||"chưa giao"))}${row("Cơ quan",esc(s.agency_text||""))}${row("Thực tế",s.act_end?"xong "+dmy(s.act_end):s.act_submit?"đã nộp "+dmy(s.act_submit):s.act_start?"bắt đầu "+dmy(s.act_start):"")}</div>
    ${s.issue_kind?`<div class="exbox isbox" style="margin-top:12px"><div class="exh"><b>Vướng mắc</b></div><p class="isv">${esc(ST.ref.issue_kinds[s.issue_kind]||"")}${s.issue_text?" — "+esc(s.issue_text):""}</p></div>`:""}
    <h4 style="margin:14px 0 6px">Hồ sơ ${L.length?`<small class="muted" style="font-weight:400">${L.length-miss.length}/${L.length} đã có</small>`:""}</h4>
    ${L.length?`<ul class="vslist">${[...miss,...L.filter(i=>i.ok)].map(i=>`<li class="${i.ok?"ok":i.state}"><span>${i.ok?"✓":i.state==="qua_han"?"!":"○"}</span><div><b>${esc(i.name)}</b><small>${i.ok?"Đã có":i.due?(i.state==="qua_han"?`Quá hạn ${i.late} ngày (hạn ${dmy(i.due)})`:"Hạn "+dmy(i.due)):"Chưa có"}${i.issue_text?" · Vướng: "+esc(i.issue_text):""}</small></div></li>`).join("")}</ul>`:`<p class="muted">Việc này không có hồ sơ bắt buộc.</p>`}
    <div class="foot" style="margin-top:14px"><a class="btn" href="#" data-go="screen-09-03" data-sel="${s.id}" data-x>${ico("check")}Xem hồ sơ của việc</a><span style="flex:1"></span><button class="btn pri" type="button" data-x>Đóng</button></div>`});
}
function planView(d){
  const t=ST.ref.today,all=d.steps.filter(s=>ST.q.plAll||s.status!=="bo_qua"),act_=all.filter(s=>s.status!=="bo_qua");
  const done=act_.filter(s=>s.status==="xong").length,over=act_.filter(hasOver),doing=act_.filter(s=>["dang","cho_kq"].includes(s.status));
  const fin=act_.map(s=>s.plan_end).filter(Boolean).sort().at(-1),view=ST.tab.plv||"muc";
  // bấm thẻ số liệu / chú giải → sổ ngay danh sách việc tương ứng
  const FIL={xong:["Hoàn thành",act_.filter(s=>s.status==="xong")],dang:["Đang làm",doing],qua:["Quá hạn",over],cuoi:["Dự kiến xong "+dmy(fin)+" — công việc cuối cùng",act_.filter(s=>s.plan_end&&s.plan_end===fin)],
    chua:["Chưa làm",act_.filter(s=>s.status==="chua"&&!hasOver(s))]},fk=FIL[ST.tab.plf]?ST.tab.plf:null;
  let body="";
  if(fk){const [h,L]=FIL[fk];
    body=`<div class="card plsec plfil ${fk==="qua"?"bad":""}"><div class="plh"><b>${esc(h)}</b><small class="muted">${L.length} việc</small><span style="flex:1"></span><button class="btn sm" type="button" data-plf="${fk}">${ico("x")}Bỏ lọc</button></div>
      ${L.length?`<ul class="pllist">${[...L].sort((a,b)=>fk==="xong"?(b.act_end||b.plan_end||"").localeCompare(a.act_end||a.plan_end||""):(a.plan_end||"9").localeCompare(b.plan_end||"9")).map(x=>planRow(x)+(fk==="qua"?overItems(x,d):"")).join("")}</ul>${fk==="qua"?`<p class="muted" style="margin:10px 2px 0;font-size:12.5px">Bấm vào hồ sơ để giải trình lý do và đề xuất hạn mới; Người duyệt / lãnh đạo duyệt thì hạn hồ sơ, công việc và kế hoạch tự cập nhật.</p>`:""}`:`<p class="muted" style="margin:8px 0 0">Không có việc nào.</p>`}</div>`;
  }else if(view==="thang"){
    const open=all.filter(s=>s.open),grp=[["Quá hạn",open.filter(hasOver)]];
    const dated=open.filter(s=>!hasOver(s)&&s.plan_end),last=dated.map(s=>s.plan_end).sort().at(-1);
    if(last){let y=+t.slice(0,4),mo=+t.slice(5,7);for(;;){const a=`${y}-${String(mo).padStart(2,"0")}`;if(a>last.slice(0,7))break;
      grp.push([`Tháng ${a.slice(5)}/${a.slice(0,4)}${a===t.slice(0,7)?" (tháng này)":""}`,dated.filter(s=>(s.plan_start||s.plan_end).slice(0,7)<=a&&s.plan_end.slice(0,7)>=a)]);if(++mo>12){mo=1;y++}}}
    grp.push(["Chưa có ngày",open.filter(s=>!s.plan_end)]);
    body=grp.filter(g=>g[1].length).map(([h,L])=>`<div class="card plsec ${h==="Quá hạn"?"bad":""}"><h3>${esc(h)} <small class="muted" style="font-weight:400">${L.length} việc</small></h3><ul class="pllist">${L.sort((a,b)=>(a.plan_end||"9").localeCompare(b.plan_end||"9")).map(planRow).join("")}</ul></div>`).join("")||emptyState("Không còn việc nào","Tất cả công việc đã hoàn thành.");
  }else{
    const secs=[];all.forEach(s=>{const key=(s.sheet||phaseName(s.phase_code))+"|"+(s.section||"");let g=secs.find(x=>x.key===key);if(!g)secs.push(g={key,sheet:s.sheet||phaseName(s.phase_code),section:s.section||"",L:[]});g.L.push(s)});
    let lastSheet="";
    body=secs.map(g=>{const L=g.L.filter(s=>s.status!=="bo_qua"),ok=L.filter(s=>s.status==="xong").length,od=L.filter(hasOver).length,dg=L.filter(s=>["dang","cho_kq"].includes(s.status)).length;
      const ds=L.map(s=>s.plan_start||s.plan_end).filter(Boolean).sort()[0],de=L.map(s=>s.plan_end).filter(Boolean).sort().at(-1),pc=L.length?Math.round(ok/L.length*100):100;
      const allDone=L.length&&ok===L.length,hd=g.sheet!==lastSheet?`<h2 class="cksheet">${esc(g.sheet)}</h2>`:"";lastSheet=g.sheet;
      return `${hd}<details class="card plsec ${od?"bad":""}" ${allDone?"":"open"}><summary><div class="plh"><b>${esc(g.section||"Công việc")}</b>
        <span class="plbadges">${od?`<span class="pill p-r">⚠ ${od} quá hạn</span>`:""}${dg?`<span class="pill p-b">● ${dg} đang làm</span>`:""}${allDone?`<span class="pill p-g">✓ Hoàn thành</span>`:""}</span></div>
        <div class="plp"><div class="prog"><i style="width:${pc}%"></i></div><small><b>${ok}/${L.length}</b> việc xong${ds||de?` · ${dmy(ds)} → ${dmy(de)}`:""}</small></div></summary>
        <ul class="pllist">${g.L.map(planRow).join("")}</ul></details>`}).join("");
  }
  const KK=["xong","dang","qua","cuoi"];let ki=0;
  const cards=kpis([["Hoàn thành",`${done}/${act_.length}`,`${act_.length?Math.round(done/act_.length*100):0}% công việc`,"g"],["Đang làm",String(doing.length),doing[0]?.name||"—","b"],["Quá hạn",String(over.length),over.length?"việc quá hạn hoặc còn hồ sơ quá hạn":"không có việc quá hạn",over.length?"r":"g"],["Dự kiến xong",dmy(fin),"công việc cuối cùng","b"]])
    .replace(/<div class="kpi">/g,()=>{const k=KK[ki++];return `<div class="kpi plkpi" data-plf="${k}" role="button" tabindex="0" aria-pressed="${fk===k}" title="Bấm để xem danh sách">`});
  const lg=(k,c,ic,t)=>`<button type="button" class="pllg" data-plf="${k}" aria-pressed="${fk===k}"><span class="pli ${c}">${ic}</span>${t}</button>`;
  return `${cards}${extBanner(d)}
    <div class="toolbar" style="margin-top:14px"><div class="seg" role="group" aria-label="Cách xem"><button type="button" data-plv="muc" aria-pressed="${view==="muc"&&!fk}">Theo giai đoạn</button><button type="button" data-plv="thang" aria-pressed="${view==="thang"&&!fk}">Theo tháng</button></div>
      <span class="pllegend">${lg("xong","ok","✓","Hoàn thành")}${lg("dang","act","●","Đang làm")}${lg("qua","bad","!","Quá hạn")}${lg("chua","wait","○","Chưa làm")}</span><span style="flex:1"></span>
      <label class="muted" style="font-size:12.5px"><input type="checkbox" id="plAll" ${ST.q.plAll?"checked":""}> Hiện việc không thực hiện</label></div>
    ${body}`;
}

/* ---------- lịch hạn pháp lý (nửa trên Kế hoạch pháp lý): lịch tháng + danh sách sắp tới ---------- */
// sự kiện: hạn xong công việc (kèm số hồ sơ còn thiếu cùng hạn), hạn riêng của hồ sơ còn thiếu, hạn bổ sung hồ sơ
// màu: r quá hạn · a hạn hồ sơ / bổ sung · b hạn công việc đang làm · n công việc chưa làm · g đã xong
function calEvents(steps,items,t){
  const E=[],SS=Object.fromEntries(steps.map(s=>[s.id,s]));
  const miss=items.filter(i=>!i.ok&&i.required&&i.due&&SS[i.step_id]),same={},own={};
  miss.forEach(i=>{const s=SS[i.step_id];if(!i.supp&&i.due===s.plan_end&&s.status!=="xong")(same[s.id]=same[s.id]||[]).push(i);else{const k=i.step_id+"|"+i.due+"|"+(i.supp?1:0);(own[k]=own[k]||[]).push(i)}});
  steps.filter(s=>s.status!=="bo_qua"&&(s.status==="xong"?s.act_end||s.plan_end:s.plan_end)).forEach(s=>{const done=s.status==="xong",m=same[s.id]||[];
    E.push({d:done?s.act_end||s.plan_end:s.plan_end,k:done?"g":hasOver(s)||s.plan_end<t?"r":["dang","cho_kq"].includes(s.status)?"b":"n",
      t:(done?"Xong: ":"Hạn xong: ")+s.name,sub:[s.stt?"Bước "+s.stt:"",ckTop(s.sheet),m.length?`còn thiếu ${m.length} hồ sơ`:""].filter(Boolean).join(" · "),step:s.id})});
  Object.values(own).forEach(L=>{const i=L[0],s=SS[i.step_id];
    E.push({d:i.due,k:i.due<t?"r":"a",t:(i.supp?"Hạn bổ sung: ":"Hạn nộp: ")+(L.length>1?`${L.length} hồ sơ`:i.name),sub:s.name,step:s.id})});
  return E.sort((a,b)=>a.d.localeCompare(b.d)||"rabng".indexOf(a.k)-"rabng".indexOf(b.k));
}
/* sự kiện tự thêm (họp, công việc, nhắc việc) — như app lịch điện thoại; lặp lại mở rộng ở đây, nhắc giờ chạy ở trình duyệt */
const EVK={hop:["Họp","#3b7dd8"],viec:["Công việc","#1f9d6b"],nhac:["Nhắc việc","#d4891c"],khac:["Khác","#8b5cd6"]};
const EVREP={"":"Không lặp lại",ngay:"Hằng ngày",ngay_lv:"Ngày làm việc (T2–T6)",tuan:"Hằng tuần",thang:"Hằng tháng",nam:"Hằng năm"};
const EVREM=[[0,"Lúc diễn ra"],[5,"Trước 5 phút"],[10,"Trước 10 phút"],[15,"Trước 15 phút"],[30,"Trước 30 phút"],[60,"Trước 1 giờ"],[120,"Trước 2 giờ"],[1440,"Trước 1 ngày"],[2880,"Trước 2 ngày"],[10080,"Trước 1 tuần"]];
const isoAdd=(s,n)=>{const x=new Date(s+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const isoDiff=(a,b)=>Math.round((new Date(a+"T00:00:00Z")-new Date(b+"T00:00:00Z"))/864e5);
const tmAdd=(t,n)=>{const [h,m]=t.split(":").map(Number),x=Math.max(0,Math.min(h*60+m+n,1439));return `${String(x/60|0).padStart(2,"0")}:${String(x%60).padStart(2,"0")}`};
const evTime=x=>x.all_day?"Cả ngày":x.start_time+(x.end_time&&x.end_date===x.start_date?"–"+x.end_time:"");
// các lần diễn ra giao với [from, to]: [{d: ngày bắt đầu lần đó, e: ngày kết thúc}]
function evOcc(x,from,to){
  const span=isoDiff(x.end_date,x.start_date),out=[],push=d=>{const z=isoAdd(d,span);if(d<=to&&z>=from)out.push({d,e:z})};
  if(!x.repeat){push(x.start_date);return out}
  const stop=x.rep_until&&x.rep_until<to?x.rep_until:to,[y0,m0,d0]=x.start_date.split("-").map(Number);
  const step={ngay:1,ngay_lv:1,tuan:7}[x.repeat],i0=step?Math.max(0,Math.floor((isoDiff(from,x.start_date)-span)/step)):0;
  for(let i=i0;i<i0+3000;i++){
    let d;
    if(step)d=isoAdd(x.start_date,i*step);
    else{const v=new Date(Date.UTC(x.repeat==="nam"?y0+i:y0,x.repeat==="thang"?m0-1+i:m0-1,d0));if(v.getUTCDate()!==d0)continue;d=v.toISOString().slice(0,10)}   // 31/x, 29/2: tháng không có ngày đó thì bỏ qua
    if(d>stop)break;
    if(x.repeat==="ngay_lv"&&[0,6].includes(new Date(d+"T00:00:00Z").getUTCDay()))continue;
    push(d);
  }
  return out;
}
// mỗi ngày một dòng (sự kiện nhiều ngày hiện ở mọi ngày nó kéo qua)
function evItems(list,from,to){
  const out=[];
  (list||[]).forEach(x=>evOcc(x,from,to).forEach(o=>{for(let d=o.d<from?from:o.d;d<=o.e&&d<=to;d=isoAdd(d,1))
    out.push({d,occ:o.d,ev:x,t:x.title,tm:!x.all_day&&d===o.d?x.start_time:"",col:(EVK[x.kind]||EVK.khac)[1],
      sub:[x.all_day?"Cả ngày":d===o.d?evTime(x):"tiếp tục",x.location,x.repeat?EVREP[x.repeat]:"",x.remind?.length?"🔔":"",x.invited?"mời bạn · "+(x.creator||""):x.people?.length?x.people.length+" người được mời":"",x.shared?"":"chỉ mình tôi"].filter(Boolean).join(" · ")})}));
  return out.sort((a,b)=>a.d.localeCompare(b.d)||(a.tm||"").localeCompare(b.tm||""));
}

// lịch tháng + cột phải (ngày đang chọn / Sắp tới) — nửa trên Kế hoạch pháp lý
function calView(d){
    const t=ST.ref.today,E=calEvents(d.steps,d.items,t),ym=ST.tab.calM||t.slice(0,7),[y,m]=ym.split("-").map(Number);
    const first=new Date(y,m-1,1),nDays=new Date(y,m,0).getDate(),lead=(first.getDay()+6)%7,iso=n=>`${ym}-${String(n).padStart(2,"0")}`;
    const by={},U=evItems(d.ev,iso(1),iso(nDays));U.concat(E).forEach(e=>(by[e.d]=by[e.d]||[]).push(e));
    // việc quá hạn chưa xong: nhắc tiếp ở ô hôm nay (mỗi ngày tới khi xong), ghi «từ dd/mm»
    const carry=E.filter(e=>e.k==="r"&&e.d<t).map(e=>({...e,carry:1,sub:`Quá hạn từ ${dm(e.d)}${e.sub?" · "+e.sub:""}`}));
    // ô hôm nay: lịch họp / sự kiện lên đầu, rồi việc quá hạn nhắc lại, rồi hạn của hôm nay
    if(carry.length){const L=by[t]||[];by[t]=[...L.filter(e=>e.ev),...carry,...L.filter(e=>!e.ev)]}
    const pick=ST.tab.calD&&ST.tab.calD.startsWith(ym)?ST.tab.calD:null;
    const chip=e=>e.ev?`<span class="cale" style="--k:${e.col}" data-ev="${e.ev.id}">${e.tm?`<em>${e.tm}</em> `:""}${esc(e.t)}</span>`:`<span class="cale k-${e.k}" data-calstep="${e.step}">${esc(e.t.replace(/^(Hạn xong|Xong|Hạn nộp|Hạn bổ sung): /,""))}</span>`;   // ô ngày: 2 mục đầu (bỏ tiền tố «Hạn xong:» cho gọn), chi tiết ở cột dưới
    const cells=[...Array(lead)].map(()=>`<div class="calc pad" aria-hidden="true"></div>`).concat([...Array(nDays)].map((_,k)=>{const dd=iso(k+1),L=by[dd]||[];
      return `<div role="button" tabindex="0" class="calc ${dd===t?"today":""} ${dd===pick?"sel":""} ${L.some(e=>e.k==="r")?"has-r":""}" data-cald="${dd}" aria-label="${dmy(dd)}: ${L.length} mục" aria-pressed="${dd===pick}" title="${esc(L.map(e=>(e.tm?e.tm+" ":"")+e.t).join("\n")||(dd===pick?"Bấm để thêm sự kiện":"Bấm để chọn ngày · bấm đúp để thêm sự kiện"))}"><b>${k+1}</b>${L.slice(0,2).map(chip).join("")}${L.length>2?`<small class="calm">+${L.length-2}</small>`:""}</div>`})).join("");
    const inMonth=E.filter(e=>e.d.startsWith(ym)),cnt=k=>inMonth.filter(e=>e.k===k).length,nEv=U.filter(e=>e.d===e.occ).length;
    // cột phải: ngày đang chọn, hoặc quá hạn chưa xử lý + sắp tới (sự kiện 30 ngày tới + hạn pháp lý)
    const over=E.filter(e=>e.k==="r"&&e.d<t);
    const soon=evItems(d.ev,t,isoAdd(t,30)).filter(e=>e.d===e.occ).concat(E.filter(e=>e.d>=t&&e.k!=="g")).sort((a,b)=>a.d.localeCompare(b.d)||(b.ev?1:0)-(a.ev?1:0)||(a.tm||"").localeCompare(b.tm||"")).slice(0,16);
    const li=(e,day)=>e.ev?`<li class="calu" style="--k:${e.col}"><span class="calud">${day?"":dm(e.d)+"<br>"}<small>${e.tm||(e.ev.all_day?"Cả ngày":"")}</small></span><i aria-hidden="true"></i><a href="#" data-ev="${e.ev.id}"><b>${esc(e.t)}</b><small>${esc(e.sub)}</small></a></li>`
      :`<li class="calu k-${e.k}"><span class="calud">${day?"":dm(e.d)}</span><i aria-hidden="true"></i><a href="#" data-calstep="${e.step}"><b>${esc(e.t)}</b><small>${esc(e.sub)}</small></a></li>`;
    const side=pick?`<h3>${WD[new Date(pick+"T00:00:00").getDay()]}, ${dmy(pick)}<span style="flex:1"></span><button type="button" class="btn sm pri" data-evnew="${pick}">${ico("plus")}Thêm</button><button type="button" class="btn sm" data-cald="${pick}" aria-label="Bỏ chọn ngày">${ico("x")}</button></h3>${(by[pick]||[]).length?`<ul class="calul">${by[pick].map(e=>li(e,1)).join("")}</ul>`:`<p class="muted">Không có sự kiện nào. Bấm «Thêm» để đặt lịch họp, việc cần làm hoặc nhắc việc.</p>`}`
      :`${over.length?`<h3>Quá hạn <span class="pill p-r">${over.length}</span></h3><ul class="calul">${over.slice(-8).reverse().map(e=>li(e)).join("")}</ul>${over.length>8?`<p class="muted" style="font-size:12.5px">… và ${over.length-8} hạn quá hạn khác</p>`:""}`:""}
        <h3 ${over.length?'style="margin-top:16px"':""}>Sắp tới</h3>${soon.length?`<ul class="calul">${soon.map(e=>li(e)).join("")}</ul>`:`<p class="muted">Không có gì sắp tới.</p>`}`;
    return `<div class="calwrap"><div class="card calcard">
        <div class="calhd"><h3 title="${nEv?nEv+" sự kiện · ":""}${inMonth.length} hạn trong tháng${cnt("r")?` · ${cnt("r")} quá hạn`:""}">Tháng ${m}/${y}</h3><span style="flex:1"></span>
          <button type="button" class="btn sm pri ic" data-evnew="${pick||t}" aria-label="Thêm sự kiện" title="Thêm sự kiện">${ico("plus")}</button><button type="button" class="btn sm" data-calm="0" ${ym===t.slice(0,7)&&!pick?"disabled":""}>Hôm nay</button><button type="button" class="btn sm ic" data-calm="-1" aria-label="Tháng trước" title="Tháng trước (←)">‹</button><button type="button" class="btn sm ic" data-calm="1" aria-label="Tháng sau" title="Tháng sau (→)">›</button></div>
        <div class="calg" role="grid">${["T2","T3","T4","T5","T6","T7","CN"].map(x=>`<div class="calw">${x}</div>`).join("")}${cells}</div></div>
      <div class="card calside">${side}</div></div>`;
}
// openStep: bấm vào một hạn pháp lý (ô lịch hoặc cột phải) → mở công việc; bấm sự kiện → sửa sự kiện
function calAfter(openStep,d){
  const keep=f=>{const y=scrollY;f();render();scrollTo(0,y)};
  const mv=n=>keep(()=>{const t=ST.ref.today;if(!n)ST.tab.calM=t.slice(0,7);else{const [y,m]=(ST.tab.calM||t.slice(0,7)).split("-").map(Number),x=new Date(y,m-1+n,1);ST.tab.calM=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`}ST.tab.calD=null});
  $$("[data-calm]").forEach(b=>b.onclick=()=>mv(+b.dataset.calm));
  // bấm ngày → chọn ngày; bấm lại ngày đang chọn (hoặc bấm đúp) → thêm sự kiện vào ngày đó
  $$("[data-cald]").forEach(b=>{const k=b.dataset.cald,f=()=>b.classList.contains("calc")&&ST.tab.calD===k?editEvent(null,d,k):keep(()=>ST.tab.calD=ST.tab.calD===k?null:k);b.onclick=f;
    if(b.tagName!=="BUTTON")b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f()}}});
  $$("[data-calstep]").forEach(a=>a.onclick=e=>{e.preventDefault();e.stopPropagation();openStep(a.dataset.calstep)});
  $$("[data-ev]").forEach(a=>a.onclick=e=>{e.preventDefault();e.stopPropagation();editEvent(d.ev.find(x=>x.id===a.dataset.ev),d)});
  $$("[data-evnew]").forEach(b=>b.onclick=()=>editEvent(null,d,b.dataset.evnew));
  // ← / → đổi tháng khi đang ở lịch (không gõ trong ô nhập)
  const g=$(".calcard");g&&(g.onkeydown=e=>{if(e.target.closest("input,textarea,select"))return;if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();mv(e.key==="ArrowLeft"?-1:1);$(".calcard [data-calm]")?.focus()}});
}
function editEvent(x,d,day){
  const own=!x||x.created_by===ST.me.id||ST.me.is_admin,dis=own?"":"disabled";
  const st=(()=>{const n=new Date();return `${String(Math.min(n.getHours()+1,23)).padStart(2,"0")}:00`})();
  const v=x?{...x}:{kind:"hop",all_day:false,start_date:day||ST.ref.today,end_date:day||ST.ref.today,start_time:st,end_time:tmAdd(st,60),repeat:"",remind:[15],shared:true};
  const remSel=(id,val)=>`<select id="${id}" ${dis} aria-label="Nhắc"><option value="">Không nhắc</option>${EVREM.map(([n,l])=>`<option value="${n}" ${val===n?"selected":""}>${l}</option>`).join("")}</select>`;
  panelModal({title:x?(own?"Sửa sự kiện":x.title):"Sự kiện mới",wide:620,
    html:`${x&&!own?`<p class="muted" style="margin:0 0 10px">Do ${esc(x.creator||"người khác")} tạo — chỉ người tạo được sửa.</p>`:""}<div class="evf">
      <input id="ev-title" class="evtitle" placeholder="Tiêu đề, vd: Họp với Sở Xây dựng" value="${esc(v.title||"")}" ${dis} aria-label="Tiêu đề">
      <div class="evkinds" role="radiogroup" aria-label="Loại">${Object.entries(EVK).map(([k,[n,c]])=>`<label style="--k:${c}"><input type="radio" name="ev-kind" value="${k}" ${v.kind===k?"checked":""} ${dis}><span>${n}</span></label>`).join("")}</div>
      <div class="evrow"><span class="evl">Cả ngày</span><label class="evsw"><input type="checkbox" id="ev-ad" ${v.all_day?"checked":""} ${dis}><i aria-hidden="true"></i></label></div>
      <div class="evrow"><span class="evl">Bắt đầu</span>${dateInput("ev-sd",v.start_date,{dis:!own})}<input type="time" id="ev-st" class="evtm" value="${v.start_time||st}" ${dis} aria-label="Giờ bắt đầu"></div>
      <div class="evrow"><span class="evl">Kết thúc</span>${dateInput("ev-ed",v.end_date,{dis:!own})}<input type="time" id="ev-et" class="evtm" value="${v.end_time||tmAdd(v.start_time||st,60)}" ${dis} aria-label="Giờ kết thúc"></div>
      <div class="evrow"><span class="evl">Lặp lại</span><select id="ev-rep" ${dis}>${Object.entries(EVREP).map(([k,l])=>`<option value="${k}" ${v.repeat===k?"selected":""}>${l}</option>`).join("")}</select><span id="ev-ruw" class="evru">đến ${dateInput("ev-ru",v.rep_until,{dis:!own})}</span></div>
      <div class="evrow"><span class="evl">Nhắc</span>${remSel("ev-r1",v.remind?.[0])}${remSel("ev-r2",v.remind?.[1])}</div>
      <div class="fld"><label for="ev-loc">Địa điểm</label><input id="ev-loc" value="${esc(v.location||"")}" placeholder="vd: Phòng họp tầng 3 / Sở Xây dựng" ${dis}></div>
      <div class="fld"><label for="ev-att">Người tham dự</label><div class="attbox" id="ev-attbox"><input id="ev-att" autocomplete="off" placeholder="${own?"Gõ tên để mời, vd: Cường, Huyền… (Enter để thêm tên ngoài hệ thống)":""}" ${dis} role="combobox" aria-expanded="false" aria-controls="ev-attsug"></div>
        <div class="attsug" id="ev-attsug" role="listbox" hidden></div><small class="muted" style="font-size:12px">Người trong hệ thống được mời sẽ thấy sự kiện trên lịch của mình, nhận thẻ mời trên màn hình và được nhắc giờ.</small></div>
      <div class="fld"><label for="ev-note">Ghi chú</label><textarea id="ev-note" ${dis}>${esc(v.note||"")}</textarea></div>
      <label class="muted" style="font-size:13px"><input type="checkbox" id="ev-sh" ${v.shared?"checked":""} ${dis}> Hiện cho mọi người trong dự án (bỏ chọn = chỉ mình tôi thấy)</label></div>
      <div class="foot" style="margin-top:14px">${x&&own?`<button class="btn dan" type="button" id="evDel">Xóa sự kiện</button>`:""}<span style="flex:1"></span><button class="btn" type="button" data-x>${own?"Hủy":"Đóng"}</button>${own?`<button class="btn pri" type="button" id="evOk">Lưu</button>`:""}</div>`,
    bind(ov,close,err){
      const ad=$("#ev-ad",ov),rep=$("#ev-rep",ov),stI=$("#ev-st",ov),etI=$("#ev-et",ov);
      const sync=()=>{$$(".evtm",ov).forEach(i=>i.hidden=ad.checked);$("#ev-ruw",ov).hidden=!rep.value};sync();ad.onchange=sync;rep.onchange=sync;
      // đổi giờ bắt đầu → giờ kết thúc dời theo, giữ nguyên thời lượng (như điện thoại)
      let prev=stI.value;stI.onchange=()=>{if(prev&&etI.value&&stI.value){const [a,b]=[prev,etI.value].map(s=>s.split(":").reduce((h,m)=>h*60+ +m));etI.value=tmAdd(stI.value,Math.max(b-a,15))}prev=stI.value};
      $("#ev-sd",ov).addEventListener("change",()=>{const s=dval($("#ev-sd",ov)),e=$("#ev-ed",ov);if(s&&(!dval(e)||dval(e)<s))e.value=isoDmy(s)});
      $("#ev-title",ov).focus();
      // người tham dự: thẻ tên — người trong hệ thống (có id, được mời) hoặc tên tự gõ (chỉ ghi chú)
      const nm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/gi,"d").toLowerCase();
      const ppl=(v.people||[]).map(p=>({id:p.id,name:p.name,title:p.title})),pn=new Set(ppl.map(p=>p.name));
      String(v.attendees||"").split(/[,;\n]/).map(s=>s.trim()).filter(s=>s&&!pn.has(s)).forEach(name=>ppl.push({name}));
      const box=$("#ev-attbox",ov),inp=$("#ev-att",ov),sug=$("#ev-attsug",ov);let hi=0,opts=[];
      const drawChips=()=>{box.querySelectorAll(".attc").forEach(c=>c.remove());ppl.forEach((p,k)=>inp.insertAdjacentHTML("beforebegin",`<span class="attc ${p.id?"u":""}" title="${esc(p.id?(p.title||"")+" — sẽ nhận lời mời":"Tên ngoài hệ thống (chỉ ghi chú)")}">${esc(p.name)}${own?`<button type="button" data-rm="${k}" aria-label="Bỏ ${esc(p.name)}">×</button>`:""}</span>`));
        box.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{ppl.splice(+b.dataset.rm,1);drawChips();inp.focus()})};
      const pick=p=>{if(p.id?!ppl.some(x=>x.id===p.id):!ppl.some(x=>x.name===p.name))ppl.push(p);inp.value="";sug.hidden=true;inp.setAttribute("aria-expanded","false");drawChips();inp.focus()};
      const drawSug=()=>{const k=nm(inp.value.trim());if(!k){sug.hidden=true;return}
        opts=ST.ref.users.filter(u=>!ppl.some(p=>p.id===u.id)&&(nm(u.full_name).includes(k)||nm(u.username).includes(k))).slice(0,8);hi=Math.min(hi,Math.max(0,opts.length-1));
        sug.innerHTML=opts.length?opts.map((u,i)=>`<div role="option" class="${i===hi?"on":""}" data-u="${i}" aria-selected="${i===hi}"><b>${esc(u.full_name)}</b><small>${esc(u.job_title||u.username)}</small></div>`).join(""):`<div class="muted" style="padding:8px 10px;font-size:12.5px">Không có người dùng «${esc(inp.value.trim())}» — Enter để ghi tên này (không gửi lời mời)</div>`;
        sug.hidden=false;inp.setAttribute("aria-expanded","true");sug.querySelectorAll("[data-u]").forEach(el=>el.onmousedown=e=>{e.preventDefault();const u=opts[+el.dataset.u];pick({id:u.id,name:u.full_name,title:u.job_title})})};
      drawChips();
      if(own){inp.oninput=()=>{hi=0;drawSug()};inp.onblur=()=>setTimeout(()=>sug.hidden=true,120);
        inp.onkeydown=e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(sug.hidden||!opts.length)return;e.preventDefault();hi=(hi+(e.key==="ArrowDown"?1:opts.length-1))%opts.length;drawSug()}
          else if(e.key==="Enter"){e.preventDefault();const t=inp.value.trim();if(!t)return;const u=!sug.hidden&&opts[hi];u?pick({id:u.id,name:u.full_name,title:u.job_title}):pick({name:t})}
          else if(e.key==="Backspace"&&!inp.value&&ppl.length){ppl.pop();drawChips()}
          else if(e.key==="Escape"&&!sug.hidden){e.stopPropagation();sug.hidden=true}};
        box.onclick=e=>{if(e.target===box)inp.focus()}}
      const val=()=>({project_id:x?x.project_id:d.pid,title:$("#ev-title",ov).value,kind:$("[name=ev-kind]:checked",ov)?.value||"hop",all_day:ad.checked,
        start_date:dval($("#ev-sd",ov)),end_date:dval($("#ev-ed",ov)),start_time:ad.checked?null:stI.value,end_time:ad.checked?null:etI.value,
        repeat:rep.value,rep_until:rep.value?dval($("#ev-ru",ov)):null,remind:[$("#ev-r1",ov).value,$("#ev-r2",ov).value].filter(s=>s!==""),
        location:$("#ev-loc",ov).value,attendees:[...ppl.map(p=>p.name),inp.value.trim()].filter(Boolean).join(", "),attendee_ids:ppl.filter(p=>p.id).map(p=>p.id),note:$("#ev-note",ov).value,shared:$("#ev-sh",ov).checked});
      const done=async m=>{close();await remLoad();reload();toast(m)};
      $("#evOk",ov)&&($("#evOk",ov).onclick=e=>busy(e.target,"Đang lưu…",async()=>{try{const b=val();
        if(x)await api("PUT","/api/events/"+x.id,b);else await api("POST","/api/events",b);
        if(b.remind.length&&"Notification" in window&&Notification.permission==="default")Notification.requestPermission().catch(()=>{});
        await done((x?"Đã lưu sự kiện":`Đã thêm «${b.title.trim()}» vào lịch ${dmy(b.start_date)}`)+(b.attendee_ids.filter(i=>i!==ST.me.id).length?` — đã mời ${b.attendee_ids.filter(i=>i!==ST.me.id).length} người`:""))}catch(m){err(m.message)}}));
      $("#evDel",ov)&&($("#evDel",ov).onclick=()=>{close();confirmBox("Xóa sự kiện?",`Xóa «${x.title}»${x.repeat?" và mọi lần lặp lại":""}. Không hoàn tác được.`,"Xóa",true,async()=>{await api("DELETE","/api/events/"+x.id);await remLoad();reload();toast("Đã xóa sự kiện")})});
    }});
}

/* nhắc giờ: kiểm tra 20 giây một lần ở mọi màn hình — thông báo của trình duyệt (nếu cho phép) + thẻ nhắc góc màn hình + tiếng chuông */
const REM={list:[],on:false,fired:new Set()};
try{JSON.parse(localStorage.getItem("pl-rem")||"[]").forEach(k=>REM.fired.add(k))}catch(e){}
async function remLoad(){try{REM.list=await api("GET","/api/events")}catch(e){}invLoad()}
// thẻ mời: ai được mời (hoặc sự kiện đổi giờ) thấy thẻ trên màn hình tới khi bấm «Đã biết» / «Xem lịch»
const INV=new Set();
async function invLoad(){let L;try{L=await api("GET","/api/invites")}catch(e){return}
  L.filter(x=>!INV.has(x.id)).forEach(x=>{INV.add(x.id);
    remShow(x,x.start_date,{head:x.changed?"Sự kiện được mời đã thay đổi":"Bạn được mời tham dự",by:x.creator,onDone:()=>api("POST",`/api/invites/${x.id}/seen`).catch(()=>{})})})}
function remStart(){if(REM.on)return;REM.on=true;remLoad().then(remTick);setInterval(remTick,20e3);setInterval(remLoad,5*60e3)}
function remTick(){
  const now=Date.now(),t=today(),L=[];
  REM.list.filter(x=>x.remind?.length).forEach(x=>evOcc(x,t,isoAdd(t,8)).filter(o=>o.d>=t).forEach(o=>{
    const base=new Date(`${o.d}T${x.all_day?"09:00":x.start_time}:00`).getTime();   // cả ngày: tính từ 9 giờ sáng
    x.remind.forEach(r=>{const at=base-r*6e4,k=`${x.id}|${o.d}|${r}`;if(at<=now&&now-at<6*36e5&&!REM.fired.has(k)){REM.fired.add(k);L.push([x,o.d])}})}));
  if(!L.length)return;
  try{localStorage.setItem("pl-rem",JSON.stringify([...REM.fired].slice(-500)))}catch(e){}
  L.forEach(([x,d])=>remShow(x,d));
}
function beep(){try{const a=new (window.AudioContext||window.webkitAudioContext)();[0,.25].forEach(s=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=880;g.gain.setValueAtTime(.18,a.currentTime+s);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+s+.22);o.connect(g).connect(a.destination);o.start(a.currentTime+s);o.stop(a.currentTime+s+.22)})}catch(e){}}
// o (thẻ mời): head = dòng tiêu đề, by = người mời, onDone = khi bấm Xem lịch / Đã biết
function remShow(x,d,o={}){
  const when=`${d===today()?"Hôm nay":WD[new Date(d+"T00:00:00").getDay()]+" "+dmy(d)} · ${evTime(x)}`,open=()=>{
    if(ST.proj&&ST.proj!==x.project_id&&projOf(x.project_id)){setProj(x.project_id);$("#proj").value=x.project_id;ST.data={}}
    ST.tab.calM=d.slice(0,7);ST.tab.calD=d;delete ST.data["screen-09-02"];go("screen-09-02")};
  if("Notification" in window&&Notification.permission==="granted")try{const n=new Notification((o.head?"📅 "+o.head+": ":"🔔 ")+x.title,{body:[when,x.location,o.by&&"Người mời: "+o.by].filter(Boolean).join(" · "),tag:x.id+d+(o.head||"")});n.onclick=()=>{focus();open();n.close()}}catch(e){}
  let box=$(".rembox");if(!box){box=document.createElement("div");box.className="rembox";box.setAttribute("role","alert");document.body.append(box)}
  const el=document.createElement("div");el.className="remc";el.style.setProperty("--k",(EVK[x.kind]||EVK.khac)[1]);
  el.innerHTML=`<span class="remi" aria-hidden="true">${o.head?"📅":"🔔"}</span><div>${o.head?`<small class="remh">${esc(o.head)}${o.by?" · "+esc(o.by)+" mời":""}</small>`:""}<b>${esc(x.title)}</b><small>${esc(when)}${x.location?" · "+esc(x.location):""}</small><div class="rema"><button class="btn sm" type="button" data-o>Xem lịch</button><button class="btn sm" type="button" data-c>Đã biết</button></div></div>`;
  $("[data-o]",el).onclick=()=>{el.remove();o.onDone?.();open()};$("[data-c]",el).onclick=()=>{el.remove();o.onDone?.()};box.append(el);beep();
}

/* xuất báo cáo HTML độc lập: Tổng quan + Kế hoạch + Checklist hồ sơ, số liệu tại thời điểm xuất (chỉ xem) */
async function buildReportHtml(){
  const keep={role:ST.role,tab:{...ST.tab},chip:{...ST.chip},q:{...ST.q}};
  ST.role="xem";ST.tab.plv="muc";ST.tab.plf=null;ST.tab.ckv="viec";ST.chip.ck=0;ST.q.ck="";ST.q.plAll=false;   // chỉ xem: không hiện nút sửa
  try{
    const p=ovProj(),pid=p?.id||curProj();
    const [ov,steps,ck]=await Promise.all([api("GET","/api/overview"+qs({project:pid})),api("GET","/api/steps"+qs({project:pid})),api("GET","/api/checklist"+qs({project:pid}))]);
    const parts=[["tong-quan","Tổng quan dự án",VIEW["screen-09-00"].view(ov)],["ke-hoach","Kế hoạch pháp lý",planView({steps,pid})],["checklist","Checklist hồ sơ",checklistAll(ck,{all:true})]];
    let css="";try{css=await (await fetch("app.css")).text()}catch(e){}
    // bỏ phần thao tác (thanh lọc, nút) — báo cáo chỉ để xem
    const strip=h=>{const t=document.createElement("template");t.innerHTML=h;t.content.querySelectorAll("details[data-ck]").forEach(x=>x.setAttribute("open",""));t.content.querySelectorAll(".plkpi").forEach(k=>{["data-plf","data-ckf","role","tabindex","aria-pressed","title"].forEach(a=>k.removeAttribute(a));k.classList.remove("plkpi")});t.content.querySelectorAll(".toolbar,.chips,.more,button,.seg").forEach(e=>e.remove());
      t.content.querySelectorAll("[data-step],[data-go],[data-sel],[data-ed],[data-sedit]").forEach(e=>{["data-step","data-go","data-sel","data-ed","data-sedit","tabindex","role"].forEach(a=>e.removeAttribute(a))});
      t.content.querySelectorAll("a[href='#']").forEach(a=>a.replaceWith(...a.childNodes));return t.innerHTML};
    const now=new Date().toLocaleString("vi-VN"),name=p?`${p.code} ${p.name}`:"";
    return `<!doctype html><html lang="vi" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Báo cáo pháp lý · ${esc(name)}</title>
<style>${css}
body{background:var(--bg);margin:0}body::before{display:none}.rp{max-width:1200px;margin:0 auto;padding:24px 16px 48px;container-type:inline-size;container-name:cv}
.rph{display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:6px}.rph h1{margin:0;font-size:22px}.rph small{color:var(--muted)}
.rpn{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0}.rpn a{font-size:13px;padding:5px 12px;border:1px solid var(--line);border-radius:99px;color:var(--fg);text-decoration:none;background:var(--surface)}
.rps{margin-top:30px}.rps>h2{font-size:19px;margin:0 0 12px;padding-top:6px}.ckr input{pointer-events:none}a{color:inherit}
@media print{.rpn{display:none}.rps{break-before:page}.rps:first-of-type{break-before:auto}details{open:true}}</style></head>
<body><div class="rp"><div class="rph"><div><h1>Báo cáo pháp lý dự án</h1><small>${esc(name)} · xuất lúc ${esc(now)}</small></div></div>
<nav class="rpn">${parts.map(x=>`<a href="#${x[0]}">${x[1]}</a>`).join("")}</nav>
${parts.map(x=>`<section class="rps" id="${x[0]}"><h2>${x[1]}</h2>${strip(x[2])}</section>`).join("")}</div>
<script>document.querySelectorAll("input[type=checkbox]").forEach(i=>i.disabled=true);addEventListener("beforeprint",()=>document.querySelectorAll("details").forEach(d=>d.open=true))<\/script></body></html>`;
  }finally{Object.assign(ST,{role:keep.role,tab:keep.tab,chip:keep.chip,q:keep.q})}
}
async function exportReportHtml(b){
  await busy(b,"Đang xuất…",async()=>{try{const h=await buildReportHtml(),p=ovProj();
    download(new Blob([h],{type:"text/html;charset=utf-8"}),`Bao-cao-phap-ly-${p?.code||"du-an"}-${ST.ref.today}.html`);toast("Đã xuất tệp HTML")}catch(x){toast(x.message)}});
}

/* xuất bản HTML y hệt app: toàn bộ giao diện + số liệu tại thời điểm xuất, một tệp duy nhất, chỉ xem */
async function buildFullHtml(){
  const pid=ovProj()?.id||curProj(),Q=qs({project:pid}),snap={};
  const get=async u=>{snap[u]=await api("GET",u);return snap[u]};
  const steps=await get("/api/steps"+Q);
  await Promise.all(["/api/me","/api/ref","/api/overview"+Q,"/api/today"+Q,"/api/checklist"+Q,`/api/projects/${pid}/info`,"/api/docs"+Q,"/api/households"+Q,"/api/docs-pending"+Q,"/api/tpl","/api/events"+Q,"/api/events","/api/extensions"+Q,"/api/insight"+Q].map(get));
  for(let i=0;i<steps.length;i+=12)await Promise.all(steps.slice(i,i+12).map(s=>get("/api/steps/"+s.id)));
  for(const d of snap["/api/docs"+Q])await get("/api/docs/"+d.id);
  snap["/api/ai-chats"]=[];   // bản xem không có hội thoại AI — tránh báo «không có dữ liệu» ở màn Trợ lý AI
  snap["/api/invites"]=[];    // bản xem không hiện thẻ mời của người xuất
  const txt=async u=>(await fetch(u,{cache:"no-store"})).text();
  const dataUrl=async u=>{const b=await (await fetch(u)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})};
  let [html,css,vb,js,gold,gpmb,dtxd,pdflib]=await Promise.all([txt("index.html"),txt("app.css"),txt("vanban.js"),txt("app.js"),dataUrl("logo-gold.png"),dataUrl("gpmb.jpg"),dataUrl("dtxd.jpg"),txt("vendor/pdf-lib.min.js")]);
  // tệp hồ sơ nhúng vào bản xuất để mở / in được khi gửi qua Zalo (không có máy chủ)
  const files={};for(const i of snap["/api/checklist"+Q].items)for(const f of i.file_list||[])files[f.id]=await dataUrl("/api/file/"+f.id);
  // ảnh thẻ GPMB / DTXD nhúng vào tệp (gửi một tệp qua Zalo / email vẫn có ảnh)
  js=js.replace(/,CK_IMG=\{GPMB:"gpmb\.jpg",DTXD:"dtxd\.jpg"\}/,()=>`,CK_IMG={GPMB:${JSON.stringify(gpmb)},DTXD:${JSON.stringify(dtxd)}}`);
  // api() trả số liệu đã chụp; thao tác ghi báo «chỉ xem»
  // thay bằng hàm (không dùng chuỗi thay thế: mã nguồn có «$'», «$&» sẽ bị hiểu là ký hiệu đặc biệt)
  js=js.replace("async function api(method,url,body){",()=>"async function api(method,url,body){if(window.__SNAP)return __snapApi(method,url,body);");
  const shim=`window.__SNAP=${JSON.stringify(snap).replace(/</g,"\\u003c")};window.__SNAP_AT=${JSON.stringify(new Date().toLocaleString("vi-VN"))};
function __snapApi(m,u){if(m!=="GET")return Promise.reject(new Error("Bản HTML xuất lúc "+__SNAP_AT+" chỉ để xem — mở app tại localhost:3400 để cập nhật"));
  const k=u in __SNAP?u:Object.keys(__SNAP).find(x=>x.split("?")[0]===u.split("?")[0]);if(k)return Promise.resolve(JSON.parse(JSON.stringify(__SNAP[k])));
  return Promise.reject(new Error("Bản HTML xuất ra không có dữ liệu này — mở app tại localhost:3400"))}`;
  const esc_=s=>s.replace(/<\/script/gi,"<\\/script");
  html=html.replace('<link rel="stylesheet" href="app.css">',()=>`<style>${css}</style>`)
    .replace('<script src="vanban.js"></script>',()=>`<script>${esc_(vb)}</script>`)
    .replace(/(src|href)="logo-gold\.png"/g,(m,a)=>`${a}="${gold}"`)
    .replace("<title>Cát Tường · Pháp lý dự án</title>",()=>`<title>Cát Tường · Pháp lý dự án (bản xuất ${new Date().toLocaleDateString("vi-VN")})</title>`)
    .replace('<script src="app.js"></script>',()=>`<script>${esc_(shim)};window.__SNAPF=${JSON.stringify(files)}</script><script>${esc_(pdflib)}</script><script>${esc_(js)}</script>`);
  return html;
}
async function exportFullHtml(b){
  await busy(b,"Đang xuất…",async()=>{try{const h=await buildFullHtml(),p=ovProj();
    download(new Blob([h],{type:"text/html;charset=utf-8"}),`Phap-ly-${p?.code||"du-an"}-${ST.ref.today}.html`);toast("Đã xuất tệp HTML")}catch(x){toast(x.message)}});
}
async function initSteps(pid,adding){
  const opts=await api("GET","/api/init-options"+qs({project:pid}));
  const grp=[];opts.forEach(o=>{let g=grp.find(x=>x[0]===o.phase_code);if(!g)grp.push(g=[o.phase_code,o.phase_name,[]]);g[2].push(o)});
  panelModal({title:adding?"Thêm thủ tục vào kế hoạch":"Khởi tạo các bước pháp lý",intro:"Chọn thủ tục áp dụng cho dự án. Mặc định bỏ chọn nhánh thay thế (vd CĐT tự thẩm định BCNCKT, GPMT/ĐTM), thủ tục điều chỉnh và báo cáo định kỳ. Bước có mốc tiến độ QLDA đã hoàn thành được đánh dấu xong.",wide:820,
    html:`<div class="fgrid"><div class="fld"><label for="isStart">Bắt đầu các bước chưa làm từ ngày</label>${dateInput("isStart",ST.ref.today)}</div></div>
    <div class="cklist dl" style="margin-top:10px">${grp.map(g=>`<b style="margin-top:6px">${esc(g[1]||g[0]||"Khác")}</b>${g[2].map(o=>`<label><input type="checkbox" value="${o.id}" ${o.exists?"checked disabled":o.suggested?"checked":""}> ${esc(o.name)} <small class="muted">${esc(o.code)}${o.deadline_days?` · ${o.deadline_days} ${o.workdays?"ngày làm việc":"ngày"}`:""}${o.done_on?" · đã xong "+dmy(o.done_on):""}${o.exists?" · đã có":""}</small></label>`).join("")}`).join("")}</div>
    <div class="foot" style="margin-top:12px"><span style="flex:1"></span><button class="btn" type="button" data-x>Hủy</button><button class="btn pri" type="button" id="isOk">${adding?"Thêm":"Khởi tạo"}</button></div>`,
    bind(ov,close,err){$("#isOk",ov).onclick=e=>busy(e.target,"Đang tạo…",async()=>{const ids=$$("input[type=checkbox]:checked:not(:disabled)",ov).map(i=>i.value);if(!ids.length)return err("Chọn ít nhất một thủ tục");
      try{const r=await api("POST","/api/steps/init",{project_id:pid,procedure_ids:ids,start:dval($("#isStart",ov))});close();reload();dirty("01","03");toast(`Đã tạo ${r.made} bước — dự kiến hoàn thành ${dmy(r.finish)}`)}catch(x){err(x.message)}})}});
}
function editStep(s,d){
  const others=d.steps.filter(x=>!s||x.id!==s.id);
  const v=s?{...s,deps:s.deps}:{prep_days:15,proc_days:0,deps:[],phase_code:"",status:"chua"};
  panelModal({title:s?s.name:"Thêm bước riêng",intro:s?`${s.state_name} · KH: ${dmy(s.plan_start)} → nộp ${dmy(s.plan_submit)} → kết quả ${dmy(s.plan_end)}${s.base_end?" · gốc "+dmy(s.base_end):""}`:"Bước không có trong danh mục thủ tục (vd làm việc với cơ quan, xin ý kiến riêng).",wide:760,
    html:`<div class="fgrid">
      <div class="fld full"><label for="es-name">Tên bước <span class="rq">*</span></label><input id="es-name" value="${esc(v.name||"")}"></div>
      <div class="fld"><label for="es-status">Trạng thái</label><select id="es-status">${Object.entries(STEP_ST).map(([k,x])=>`<option value="${k}" ${v.status===k?"selected":""}>${x[1]}</option>`).join("")}</select></div>
      <div class="fld"><label for="es-phase">Giai đoạn</label><select id="es-phase"><option value="">—</option>${ST.ref.phases.map(p=>`<option value="${p.code}" ${v.phase_code===p.code?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>
      <div class="fld"><label for="es-as">Ngày bắt đầu thực tế</label>${dateInput("es-as",v.act_start)}</div>
      <div class="fld"><label for="es-asub">Ngày nộp hồ sơ</label>${dateInput("es-asub",v.act_submit)}</div>
      <div class="fld"><label for="es-ae">Ngày có kết quả</label>${dateInput("es-ae",v.act_end)}</div>
      <div class="fld"><label for="es-owner">Người phụ trách</label><select id="es-owner">${userOpts("— Chưa giao —").map(o=>`<option value="${o[0]}" ${v.owner_id===o[0]?"selected":""}>${esc(o[1])}</option>`).join("")}</select></div>
      <div class="fld"><label for="es-prep">Chuẩn bị hồ sơ (ngày)</label><input id="es-prep" inputmode="numeric" value="${v.prep_days??15}"></div>
      <div class="fld"><label for="es-proc">Thời hạn cơ quan giải quyết</label><input id="es-proc" inputmode="numeric" value="${v.proc_days??0}"></div>
      <div class="fld"><label><input type="checkbox" id="es-wd" ${v.workdays?"checked":""}> Tính ngày làm việc</label></div>
      <div class="fld full"><label for="es-ag">Cơ quan</label><input id="es-ag" value="${esc(v.agency_text||"")}"></div>
      <div class="fld full"><label>Phải xong trước (bước phụ thuộc)</label><div class="cklist">${others.map(o=>`<label><input type="checkbox" value="${o.id}" ${v.deps.includes(o.id)?"checked":""}> ${esc(o.name)} <small class="muted">${pill(P(STEP_ST[o.status]))}</small></label>`).join("")}</div></div>
      <div class="fld full"><label for="es-ik">Vướng mắc (hiện trên Tổng quan)</label><select id="es-ik"><option value="">— Không vướng mắc —</option>${Object.entries(ST.ref.issue_kinds).map(([k,x])=>`<option value="${k}" ${v.issue_kind===k?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
      <div class="fld full"><label for="es-it">Tình trạng, nguyên nhân vướng mắc</label><textarea id="es-it" placeholder="vd: Sở XD yêu cầu bổ sung văn bản thỏa thuận PCCC; đang chờ Công an tỉnh trả lời">${esc(v.issue_text||"")}</textarea></div>
      <div class="fld"><label for="es-is">Vướng từ ngày</label>${dateInput("es-is",v.issue_since)}</div>
      <div class="fld full"><label for="es-note">Ghi chú</label><textarea id="es-note">${esc(v.note||"")}</textarea></div></div>
      <div class="foot" style="margin-top:12px">${s?`<button class="btn" type="button" id="esOpen">${ico("check")}Mở hồ sơ của bước</button>`:""}${s?`<button class="btn dan" type="button" id="esDel">Xóa bước</button>`:""}<span style="flex:1"></span><button class="btn" type="button" data-x>Hủy</button><button class="btn pri" type="button" id="esOk" ${act(...W)?"":"disabled"}>Lưu</button></div>`,
    bind(ov,close,err){
      const val=()=>({name:$("#es-name",ov).value,status:$("#es-status",ov).value,phase_code:$("#es-phase",ov).value,act_start:dval($("#es-as",ov)),act_submit:dval($("#es-asub",ov)),act_end:dval($("#es-ae",ov)),
        owner_id:$("#es-owner",ov).value,prep_days:$("#es-prep",ov).value,proc_days:$("#es-proc",ov).value,workdays:$("#es-wd",ov).checked,agency_text:$("#es-ag",ov).value,note:$("#es-note",ov).value,issue_kind:$("#es-ik",ov).value,issue_text:$("#es-it",ov).value,issue_since:dval($("#es-is",ov)),
        deps:$$(".cklist input:checked",ov).map(i=>i.value),project_id:d.pid});
      $("#esOk",ov).onclick=e=>busy(e.target,"Đang lưu…",async()=>{try{const r=s?await api("PUT","/api/steps/"+s.id,val()):await api("POST","/api/steps",val());close();reload();dirty("01","03");toast(s?`Đã cập nhật — kế hoạch tính lại, dự kiến xong ${dmy(r.finish)}`:"Đã thêm bước")}catch(x){err(x.message)}});
      $("#esOpen",ov)&&($("#esOpen",ov).onclick=()=>{close();go("screen-09-03",s.id)});
      $("#esDel",ov)&&($("#esDel",ov).onclick=()=>{close();confirmBox("Xóa bước?",`Xóa «${s.name}» cùng checklist, tệp và dự thảo của bước. Không hoàn tác được. Nếu chỉ không làm, chọn trạng thái «Không thực hiện».`,"Xóa",true,async()=>{await api("DELETE","/api/steps/"+s.id);reload();dirty("01","03")})});
    }});
}
async function editInfo(pid){
  const v=await api("GET",`/api/projects/${pid}/info`);
  formModal({title:"Thông tin chủ đầu tư dùng khi soạn văn bản",intro:"Điền một lần, dùng cho mọi dự thảo, danh mục hồ sơ, văn bản từng hộ của dự án.",values:v,
    fields:[{k:"cdt",label:"Tên chủ đầu tư (pháp nhân)",req:1,full:1},{k:"viet_tat",label:"Tên viết tắt (ký hiệu văn bản)",ph:"ĐHP"},{k:"don_vi_soan",label:"Đơn vị soạn thảo (viết tắt)",ph:"BQLDA"},{k:"dia_chi",label:"Địa chỉ trụ sở",full:1},
      {k:"dia_diem",label:"Địa điểm dự án",full:1},{k:"place",label:"Địa danh ghi ngày tháng",ph:"Bắc Ninh"},{k:"nguoi_ky",label:"Người ký"},{k:"chuc_vu_ky",label:"Chức vụ người ký",ph:"TỔNG GIÁM ĐỐC"},
      {k:"ubnd",label:"UBND cấp xã nơi có dự án",ph:"Ủy ban nhân dân xã Tam Đa"},{k:"don_vi_bt",label:"Đơn vị làm nhiệm vụ bồi thường, GPMB",full:1}],
    onSubmit:async x=>{await api("PUT",`/api/projects/${pid}/info`,x);toast("Đã lưu thông tin chủ đầu tư")}});
}


/* checklist hồ sơ dạng ô đánh dấu: đã có / còn thiếu / hạn nộp / quá hạn */
const CKS={da_co:["g","Đã có"],qua_han:["r","Quá hạn"],hom_nay:["a","Hạn hôm nay"],sap_den:["a","Sắp đến hạn"],thieu:["n","Còn thiếu"]};
const WD=["Chủ nhật","Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy"];
const dueTxt=i=>i.supp&&!i.ok&&i.due?(i.state==="qua_han"?`quá hạn bổ sung ${i.late} ngày`:i.state==="hom_nay"?"hạn bổ sung hôm nay":`hạn bổ sung ${dmy(i.due)}`):!i.ok&&!i.required?(i.due?`nếu có · hạn ${dmy(i.due)}`:"nếu có"):i.ok?(i.done_at?`đã có · ${hm(i.done_at)}${i.done_name?" · "+i.done_name:""}`:i.files?`${i.files} tệp`:i.ref_text?"có số văn bản":"đã có"):!i.due?"chưa có hạn":i.state==="qua_han"?`quá hạn ${i.late} ngày (hạn ${dmy(i.due)})`:i.state==="hom_nay"?"hạn hôm nay":`hạn ${dmy(i.due)}`;
/* ---------- nút In hồ sơ: ghép tệp PDF / ảnh rồi mở hộp thoại in của Windows (chọn máy in ở đó) ----------
   chưa có mẫu in riêng (trang bìa, danh mục) — in đúng các tệp đang có. Bản HTML xuất ra: tệp nhúng sẵn trong __SNAPF */
const fileUrl=id=>window.__SNAPB?.[id]||window.__SNAPF?.[id]||`/api/file/${id}`;
// bản HTML: đổi tệp nhúng sang đường dẫn blob (khung xem PDF không mở được dạng data:)
if(window.__SNAPF){window.__SNAPB={};Object.entries(window.__SNAPF).forEach(([k,v])=>fetch(v).then(r=>r.blob()).then(b=>window.__SNAPB[k]=URL.createObjectURL(b)))}
let pdfLibP;
const pdfLib=()=>pdfLibP||(pdfLibP=window.PDFLib?Promise.resolve(window.PDFLib):new Promise((ok,no)=>{const s=document.createElement("script");s.src="vendor/pdf-lib.min.js";s.onload=()=>ok(window.PDFLib);s.onerror=()=>{pdfLibP=null;no(new Error("Không tải được thư viện in"))};document.head.append(s)}));
function printBlob(b){
  const u=URL.createObjectURL(b),f=document.createElement("iframe");f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0";f.src=u;document.body.append(f);
  f.onload=()=>setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){open(u,"_blank")}},400);
  setTimeout(()=>{f.remove();URL.revokeObjectURL(u)},10*60e3);
}
// ghép: PDF giữ nguyên trang; ảnh đặt vừa khổ A4; tệp khác (Word, Excel…) bỏ qua
async function toPdf(L){
  const {PDFDocument}=await pdfLib(),out=await PDFDocument.create(),skipped=[];
  for(const {b,name} of L){try{
    if(b.type==="application/pdf"||/\.pdf$/i.test(name)){const src=await PDFDocument.load(await b.arrayBuffer(),{ignoreEncryption:true});(await out.copyPages(src,src.getPageIndices())).forEach(p=>out.addPage(p))}
    else if(/^image\//.test(b.type)||/\.(jpe?g|png|webp|gif|bmp)$/i.test(name)){
      let bytes,png=b.type==="image/png";
      if(b.type==="image/jpeg"||png)bytes=await b.arrayBuffer();
      else{const bm=await createImageBitmap(b),c=document.createElement("canvas");c.width=bm.width;c.height=bm.height;c.getContext("2d").drawImage(bm,0,0);bytes=await (await new Promise(r=>c.toBlob(r,"image/png"))).arrayBuffer();png=true}
      const img=png?await out.embedPng(bytes):await out.embedJpg(bytes),W=595.28,H=841.89,m=28,k=Math.min((W-2*m)/img.width,(H-2*m)/img.height,1),pg=out.addPage([W,H]);
      pg.drawImage(img,{x:(W-img.width*k)/2,y:(H-img.height*k)/2,width:img.width*k,height:img.height*k});
    }else skipped.push(name);
  }catch(e){skipped.push(name)}}
  return {pdf:new Blob([await out.save()],{type:"application/pdf"}),pages:out.getPageCount(),skipped};
}
async function printFiles(files,label){
  if(!files.length)return toast("Chưa có tệp hồ sơ nào để in");
  toast(`Đang chuẩn bị in ${label}…`);
  try{
    const L=[];for(const f of files)L.push({b:await (await fetch(fileUrl(f.id))).blob(),name:f.name});
    if(L.length===1&&L[0].b.type==="application/pdf"){printBlob(L[0].b);return toast("Đã mở hộp thoại in — chọn máy in rồi bấm In")}
    const r=await toPdf(L);if(!r.pages)return toast("Không có tệp in được — chỉ in được tệp PDF và ảnh");
    printBlob(r.pdf);toast(`Đã mở hộp thoại in: ${r.pages} trang${r.skipped.length?` · bỏ qua ${r.skipped.length} tệp không phải PDF / ảnh (${r.skipped.join(", ")})`:""}`);
  }catch(e){toast("Không in được: "+e.message)}
}
const stepFiles=(items,sid)=>items.filter(i=>i.step_id===sid).flatMap(i=>i.file_list||[]);
const printStepBtn=(items,s)=>{const F=stepFiles(items,s.id);return F.length?`<button type="button" class="btn sm ckprint" data-prints="${esc(JSON.stringify(F))}" data-plabel="${esc(s.name)}" title="In tất cả ${F.length} tệp hồ sơ của việc này">${ico("print")}In hồ sơ (${F.length} tệp)</button>`:""};
// bản HTML xuất ra: liên kết /api/file/… mở tệp nhúng sẵn
document.addEventListener("click",e=>{const a=e.target.closest?.('a[href^="/api/file/"]');if(!a||!window.__SNAPF||a.dataset.pvo)return;const id=a.getAttribute("href").split("/")[3];if(!window.__SNAPF[id])return;
  e.preventDefault();fetch(window.__SNAPF[id]).then(r=>r.blob()).then(b=>open(URL.createObjectURL(b),"_blank"))});
document.addEventListener("click",e=>{const b=e.target.closest?.("[data-printf],[data-prints]");if(!b)return;e.preventDefault();e.stopPropagation();
  if(b.dataset.printf)printFiles([{id:b.dataset.printf,name:b.dataset.fname||""}],"tệp «"+(b.dataset.fname||"")+"»");else printFiles(JSON.parse(b.dataset.prints),"hồ sơ «"+b.dataset.plabel+"»")},true);
// sửa / xóa một văn bản (mục hồ sơ) trong checklist: tên, bắt buộc, số ký hiệu, ghi chú; xóa luôn tệp đã tải (mục có tệp: chỉ Người duyệt)
function itemEdit(i){
  formModal({title:"Sửa văn bản trong checklist",intro:`${i.step||""}${i.file_list?.length?` · đã có ${i.file_list.length} tệp`:""}`,
    values:{name:i.name,required:i.required?"1":"0",ref_text:i.ref_text||"",note:i.note||"",basis:i.basis||""},
    fields:[{k:"name",label:"Tên văn bản",req:1,full:1},{k:"required",label:"Loại",type:"select",options:[["1","Bắt buộc"],["0","Không bắt buộc (nếu có)"]]},
      {k:"ref_text",label:"Số, ký hiệu văn bản (nếu đã có)",ph:"vd: 123/QĐ-UBND ngày 15/10/2026"},{k:"basis",label:"Căn cứ",full:1,ph:"vd: Khoản 2 Điều 87 Luật Đất đai 2024"},{k:"note",label:"Ghi chú",type:"textarea"}],
    okLabel:"Lưu",
    extra:[{label:"Xóa văn bản",cls:"dan",onClick:(v,close)=>{close();confirmBox("Xóa văn bản này?",`Xóa «${i.name}» khỏi checklist${i.file_list?.length?` cùng ${i.file_list.length} tệp đã tải`:""}. Không hoàn tác được. Nếu chỉ không cần nộp, chọn «Không bắt buộc» thay vì xóa.`,"Xóa",true,
      async()=>{try{await api("DELETE","/api/items/"+i.id);dirty("00","01","02");toast("Đã xóa văn bản");await refreshQuiet()}catch(x){toast(x.message)}})}}],
    onSubmit:async v=>{await api("PUT","/api/items/"+i.id,{name:v.name,required:v.required==="1",ref_text:v.ref_text,note:v.note,basis:v.basis,na:false});dirty("00","01","02");toast("Đã lưu văn bản");await refreshQuiet()}});
}
document.addEventListener("click",e=>{const b=e.target.closest?.("[data-iedit]");if(!b)return;e.preventDefault();const it=ckItem(b.dataset.iedit);it?itemEdit(it):toast("Không tìm thấy văn bản — bấm Làm mới")});
function ckRow(i,showStep){
  const can=act(...W);
  return `<li class="ckr ${i.ok?"ok":i.state}"><label class="tick"><input type="checkbox" data-tick="${i.id}" ${i.ok?"checked":""} ${can&&!(i.files||i.ref_text)?"":"disabled"} aria-label="Đã có: ${esc(i.name)}"><span aria-hidden="true">✓</span></label>
    <div class="ckb"><span class="ckn">${i.supp?`<span class="pill p-t">Bổ sung</span> `:""}<button type="button" class="ckname ${i.file_list?.length?"has":""}" data-pv="${i.id}" aria-expanded="${!!ST.ckPv?.has(i.id)}" title="${i.file_list?.length?"Bấm để xem hồ sơ":"Bấm để xem / tải hồ sơ"}">${esc(i.name)}</button>${i.required?"":` <small class="muted">(nếu có)</small>`}</span>${i.supp?`<small class="supl">Lý do: ${esc(i.reason||"")}${i.req_by?` · Yêu cầu: ${esc(i.req_by)}`:""} · Làm ${i.start_on?`từ ${dmy(i.start_on)} `:""}đến hạn ${dmy(i.due)}${act(...W)?` · <a href="#" data-sedit="${i.id}">Sửa</a>`:""}</small>`:""}${showStep?`<small class="muted"><a href="#" data-go="screen-09-03" data-sel="${i.step_id}">${esc(i.step)}</a></small>`:""}
      ${i.file_list?.length?`<span class="ckfiles">${i.file_list.map((f,j)=>`<span class="ckf"><a href="/api/file/${f.id}" target="_blank" rel="noopener" data-pvo="${i.id}:${j}" title="Bấm để xem và in">${ico("file")}${esc(f.name)}</a><button type="button" class="ckfx ckfp" data-printf="${f.id}" data-fname="${esc(f.name)}" title="In tệp này" aria-label="In tệp ${esc(f.name)}">${ico("print")}</button>${can?`<button type="button" class="ckfx" data-delf="${f.id}" data-fname="${esc(f.name)}" title="Xóa tệp tải nhầm" aria-label="Xóa tệp ${esc(f.name)}">${ico("x")}</button>`:""}</span>`).join("")}</span>`:""}</div>
    ${can?`<span class="ckact"><button type="button" class="ckbtn" data-up="${i.id}" title="Tải lên bản scan / PDF">${ico("upload")}${i.file_list?.length?"Thêm tệp":"Tải hồ sơ"}</button><button type="button" class="ckbtn ic" data-dir="${i.id}" title="Mở thư mục hồ sơ trên máy tính" aria-label="Mở thư mục hồ sơ trên máy tính">${ico("folder")}</button><button type="button" class="ckbtn ic" data-iedit="${i.id}" title="Sửa hoặc xóa văn bản này" aria-label="Sửa hoặc xóa: ${esc(i.name)}">${ico("edit")}</button></span>`:""}
    <span class="pill p-${(CKS[i.state]||CKS.thieu)[0]} ckd">${i.state==="qua_han"?"⚠ ":i.ok?"✓ ":""}${esc(dueTxt(i))}</span>${!i.ok&&(i.state==="qua_han"||i.ext?.status==="cho")?`<button type="button" class="lnk ckext" data-ext-step="${i.step_id}" data-ext-item="${i.id}">${i.ext?.status==="cho"?`⏳ Chờ duyệt gia hạn → ${dm(i.ext.new_due)}`:"Giải trình · gia hạn"}</button>`:i.ext?.status==="duyet"&&!i.ok?`<span class="ckext muted" title="Đã được duyệt gia hạn">✓ đã gia hạn</span>`:""}${ST.ckPv?.has(i.id)?pvHtml(i):""}</li>`;
}
// phần dự án theo sheet kế hoạch: «GPMB · I. …» → GPMB; ảnh bìa từng phần
const ckTop=x=>String(x||"Khác").split(" · ")[0],ckSub=x=>String(x||"").split(" · ").slice(1).join(" · ");
const CK_TOPN={GPMB:"Giải phóng mặt bằng",DTXD:"Đầu tư xây dựng"},CK_STAGEN={"III. Kết thúc xây dựng":"III. Kết thúc dự án xây dựng"},CK_IMG={GPMB:"gpmb.jpg",DTXD:"dtxd.jpg"};
// o.all: báo cáo xuất HTML — hiện đủ cây, không dùng trang riêng từng phần
function checklistAll(d,o={}){
  const sel=String(ST.sel["screen-09-03"]||""),part=!o.all&&sel.startsWith("p-")?sel.slice(2):null;
  if(!o.all)ST.ckPart=part;
  const t=d.today,I=part?d.items.filter(i=>ckTop(i.sheet)===part):d.items,req=I.filter(i=>i.required);
  const n=k=>req.filter(i=>i.state===k).length,ok=req.filter(i=>i.ok).length;
  const F=["Tất cả","Còn thiếu","Quá hạn","Đến hạn 7 ngày","Hồ sơ bổ sung","Đã có","Hạn hôm nay"],c=ST.chip.ck??0,view=ST.tab.ckv||"viec";
  // hồ sơ vừa tick / bỏ tick trong lúc xem vẫn giữ nguyên chỗ (không biến khỏi danh sách đang lọc)
  const kept=ST.ckKept||(ST.ckKept=new Set());
  const pick=i=>([true,!i.ok&&i.required,i.state==="qua_han",["hom_nay","sap_den","qua_han"].includes(i.state),i.supp,i.ok,!i.ok&&i.due===t][c]||kept.has(i.id))&&match("ck",[i.name,i.step,i.section,i.sheet,i.reason,i.req_by,...(i.file_list||[]).map(f=>f.name)].filter(Boolean).join(" "));
  const rows=I.filter(pick);
  const over=req.filter(i=>i.state==="qua_han").sort((a,b)=>b.late-a.late),today_=I.filter(i=>!i.ok&&i.due===t),soon=req.filter(i=>i.state==="sap_den");
  let body="";
  if(!rows.length)body=ST.q.ck?noHit("ck"):emptyState(`Không có hồ sơ nào: ${F[c]}`,c===6?`Hôm nay ${dmy(t)} không có hồ sơ nào đến hạn.`:"Bấm lại thẻ số liệu hoặc chọn «Tất cả» để xem toàn bộ.");
  else if(view==="ngay"){
    const by={};rows.forEach(i=>{const k=i.due||"9999";(by[k]=by[k]||[]).push(i)});
    body=Object.keys(by).sort().map(k=>{const L=by[k],dd=k==="9999"?null:new Date(k+"T00:00:00");
      return `<div class="card ckday ${k<t?"past":k===t?"today":""}"><h3>${dd?`${WD[dd.getDay()]}, ${dmy(k)}`:"Chưa có hạn"}${k===t?` <span class="pill p-a">Hôm nay</span>`:k<t&&k!=="9999"?` <span class="pill p-r">Đã qua</span>`:""}<small class="muted" style="font-weight:400;margin-left:auto">${L.filter(i=>!i.ok).length} còn thiếu / ${L.length} hồ sơ</small></h3><ul class="cklist2">${L.map(i=>ckRow(i,true)).join("")}</ul></div>`}).join("");
  }else{
    const steps=[];rows.forEach(i=>{let s=steps.find(x=>x.id===i.step_id);if(!s)steps.push(s={id:i.step_id,name:i.step,section:i.section,sheet:i.sheet,stt:i.stt,start:i.plan_start,end:i.plan_end,status:i.step_status,items:[]});s.items.push(i)});
    // cây 3 cấp: phần dự án (GPMB, DTXD) → trình tự công việc → hồ sơ của công việc; bấm để sổ ra / thu vào.
    // Đang lọc hoặc tìm kiếm thì tự sổ hết để thấy kết quả; không lọc thì giữ nguyên chỗ người dùng đã mở.
    const open=ST.ckOpen||(ST.ckOpen=new Set()),auto=c!==0||!!String(ST.q.ck||"").trim();
    const topOf=ckTop,partOf=ckSub,TOPN=CK_TOPN;
    const tops=[];steps.forEach(s=>{const k=topOf(s.sheet);let g=tops.find(x=>x.k===k);if(!g)tops.push(g={k,steps:[]});g.steps.push(s)});
    const prog=(ok,n)=>`<span class="ckprog" aria-hidden="true"><i style="width:${n?Math.round(ok/n*100):0}%"></i></span>`;
    const stat=k=>{const IA=d.items.filter(i=>topOf(i.sheet)===k);return {IA,okA:IA.filter(i=>i.ok).length,odA:IA.filter(i=>i.state==="qua_han").length,nS:new Set(IA.map(i=>i.step_id)).size}};
    // trang chính: thẻ ảnh từng phần dự án (GPMB, DTXD); bấm → trang riêng của phần đó
    const cards=()=>{const ks=[];d.items.forEach(i=>{const k=topOf(i.sheet);if(!ks.includes(k))ks.push(k)});
      return `<div class="ckparts">${ks.map(k=>{const {IA,okA,odA,nS}=stat(k),hit=rows.filter(i=>topOf(i.sheet)===k).length;
        return `<button type="button" class="ckpc" data-go="screen-09-03" data-sel="p-${esc(k)}" style="${CK_IMG[k]?`--img:url('${CK_IMG[k]}')`:""}" aria-label="${esc(k)} ${esc(TOPN[k]||"")}: xem trình tự công việc và hồ sơ">
          <span class="ckpc-in"><span class="ckpc-t"><b>${esc(k)}</b><small>${esc(TOPN[k]||"")}</small></span>
          <span class="ckpc-m">${nS} công việc · <b>${okA}/${IA.length}</b> hồ sơ đã có ${prog(okA,IA.length)}</span>
          <span class="ckpc-b">${odA?`<span class="pill p-r">⚠ ${odA} hồ sơ quá hạn</span>`:`<span class="pill p-g">✓ Không có hồ sơ quá hạn</span>`}${auto?`<span class="pill p-b">${hit} hồ sơ khớp bộ lọc</span>`:""}</span>
          <span class="ckpc-go">Xem trình tự công việc ›</span></span></button>`}).join("")}</div>`};
    // trang chính: không lọc → thẻ ảnh; đang lọc / tìm → sổ ngay hồ sơ khớp (gom theo GPMB / DTXD, mở sẵn)
    if(!part&&!auto)body=cards();
    else if(!part){let lastSheet="",lastSec="";
      body=steps.map(s=>{const all=I.filter(i=>i.step_id===s.id),okN=all.filter(i=>i.ok).length,bad=all.some(i=>i.state==="qua_han");
        const hd=(s.sheet!==lastSheet?`<h2 class="cksheet">${esc(s.sheet||"")}</h2>`:"")+(s.section!==lastSec?`<h4 class="cksec">${esc(s.section||"")}</h4>`:"");lastSheet=s.sheet;lastSec=s.section;
        return `${hd}<div class="card ckstep ${bad?"bad":""}"><div class="ckh"><a href="#" data-go="screen-09-03" data-sel="${s.id}"><b>${s.stt?esc(s.stt)+". ":""}${esc(s.name)}</b></a>${pill(P(STEP_ST[s.status]))}<small class="muted">${s.start||s.end?`${dmy(s.start)} → ${dmy(s.end)}`:"chưa có ngày"}</small><span style="flex:1"></span>${printStepBtn(d.items,s)}<small><b>${okN}/${all.length}</b> hồ sơ</small></div><ul class="cklist2">${s.items.map(i=>ckRow(i,false)).join("")}</ul>${act(...W)?`<button type="button" class="ckadd" data-supp="${s.id}"><span aria-hidden="true">+</span>Lập hồ sơ bổ sung cho công việc này</button>`:""}</div>`}).join("")}
    else
    body=tops.map(g=>{const {IA,okA,odA,nS}=stat(g.k);
      let lastPart="",lastSec="";
      const inner=g.steps.map(s=>{const all=I.filter(i=>i.step_id===s.id),okN=all.filter(i=>i.ok).length,od=all.filter(i=>i.state==="qua_han").length,pt=partOf(s.sheet);
        const hd=(!part&&pt!==lastPart?`<h4 class="ckpart">${esc(pt)}</h4>`:"")+(s.section&&s.section!==lastSec?`<div class="cksec2">${esc(s.section)}</div>`:"");lastPart=pt;lastSec=s.section;
        return `${hd}<details class="ckt2 ${od?"bad":okN===all.length?"done":""}" data-ck="s:${s.id}" ${auto||open.has("s:"+s.id)?"open":""}><summary><span class="ckcar" aria-hidden="true"></span>
          <span class="ckt2n"><b>${s.stt?esc(s.stt)+". ":""}${esc(s.name)}</b><small>${s.start||s.end?`${dmy(s.start)} → ${dmy(s.end)}`:"chưa có ngày"}</small></span>
          ${od?`<span class="pill p-r">⚠ ${od} quá hạn</span>`:""}${pill(P(STEP_ST[s.status]))}<span class="ckcnt"><b>${okN}/${all.length}</b> hồ sơ</span></summary>
          <div class="ckt2b">${printStepBtn(d.items,s)?`<div class="ckpr">${printStepBtn(d.items,s)}</div>`:""}<ul class="cklist2">${s.items.map(i=>ckRow(i,false)).join("")}</ul>${act(...W)?`<button type="button" class="ckadd" data-supp="${s.id}"><span aria-hidden="true">+</span>Lập hồ sơ bổ sung cho công việc này</button>`:""}</div></details>`});
      // trang riêng một phần (vd DTXD): chỉ hiện các giai đoạn lớn (I. Chuẩn bị dự án · II. Thực hiện dự án · III. Kết thúc dự án xây dựng), bấm để sổ công việc
      if(part){const G=[];g.steps.forEach((s,k)=>{const pt=partOf(s.sheet)||"Công việc khác";let x=G.find(y=>y.pt===pt);if(!x)G.push(x={pt,ids:new Set(),html:[]});x.ids.add(s.id);x.html.push(inner[k])});
        return G.map(x=>{const IA=I.filter(i=>x.ids.has(i.step_id)),okA=IA.filter(i=>i.ok).length,odA=IA.filter(i=>i.state==="qua_han").length;
          return `<details class="card ckt1 ckstage ${odA?"bad":""}" data-ck="p:${esc(g.k)}:${esc(x.pt)}" ${auto||open.has(`p:${g.k}:${x.pt}`)?"open":""}><summary><span class="ckcar" aria-hidden="true"></span>
            <span class="ckt1n"><b>${esc(CK_STAGEN[x.pt]||x.pt)}</b></span>${odA?`<span class="pill p-r">⚠ ${odA} hồ sơ quá hạn</span>`:okA===IA.length?`<span class="pill p-g">✓ Đủ hồ sơ</span>`:""}
            <span class="ckt1m">${x.ids.size} công việc · <b>${okA}/${IA.length}</b> hồ sơ ${prog(okA,IA.length)}</span></summary><div class="ckt1b">${x.html.join("")}</div></details>`}).join("")}
      return `<details class="card ckt1 ${odA?"bad":""}" data-ck="t:${esc(g.k)}" ${o.all||auto||open.has("t:"+g.k)?"open":""}><summary><span class="ckcar" aria-hidden="true"></span>
        <span class="ckt1n"><b>${esc(g.k)}</b><small>${esc(TOPN[g.k]||"")}</small></span>${odA?`<span class="pill p-r">⚠ ${odA} hồ sơ quá hạn</span>`:""}
        <span class="ckt1m">${nS} công việc · <b>${okA}/${IA.length}</b> hồ sơ ${prog(okA,IA.length)}</span></summary><div class="ckt1b">${inner.join("")}</div></details>`}).join("");
  }
  // bấm thẻ số liệu → lọc ngay danh sách (bấm lại để bỏ lọc): đã có · quá hạn · hạn hôm nay · còn thiếu
  const CKK=[5,2,6,1];let ckI=0;
  const hero=part?`<div class="ckhero" style="${CK_IMG[part]?`--img:url('${CK_IMG[part]}')`:""}"><button class="btn sm ckback" type="button" data-go="screen-09-03" data-sel="">${ico("back")}Tất cả phần dự án</button>
    <div class="ckhero-t"><b>${esc(part)}</b><span>${esc(CK_TOPN[part]||"")}</span><small>${new Set(I.map(i=>i.step_id)).size} công việc · ${I.filter(i=>i.ok).length}/${I.length} hồ sơ đã có</small></div></div>`:"";
  return `${hero}${kpis([["Hồ sơ đã có",`${ok}/${req.length}`,`${req.length?Math.round(ok/req.length*100):0}% hồ sơ bắt buộc${I.some(i=>!i.required&&i.ok)?` · thêm ${I.filter(i=>!i.required&&i.ok).length} hồ sơ «nếu có»`:""}`,"g"],["Quá hạn",String(n("qua_han")),"đã qua hạn mà chưa có",n("qua_han")?"r":"g"],["Hạn hôm nay",String(today_.length),dmy(t),today_.length?"a":"g"],["Còn thiếu",String(req.length-ok),`${soon.length} hồ sơ đến hạn trong 7 ngày`,"b"]]).replace(/<div class="kpi">/g,()=>{const k=CKK[ckI++];return `<div class="kpi plkpi" data-ckf="${k}" role="button" tabindex="0" aria-pressed="${c===k}" title="Bấm để xem danh sách">`})}
    ${over.length?`<div class="banner b-r" style="margin-top:14px">${ico("warn")}<span><b>Quá hạn — cần bổ sung ngay ${over.length} hồ sơ:</b><ul class="bl">${over.slice(0,8).map(i=>`<li>${esc(i.name)} <small>· ${esc(i.step)} · quá ${i.late} ngày</small></li>`).join("")}${over.length>8?`<li>… và ${over.length-8} hồ sơ khác (chọn bộ lọc «Quá hạn»)</li>`:""}</ul></span></div>`:""}
    ${(()=>{const sp=I.filter(i=>i.supp&&!i.ok).sort((a,b)=>(a.due||"9").localeCompare(b.due||"9"));return sp.length?`<div class="banner b-t" style="margin-top:10px">${ico("file")}<span><b>Đang chờ bổ sung ${sp.length} hồ sơ:</b><ul class="bl">${sp.slice(0,8).map(i=>`<li>${esc(i.name)} <small>· ${esc(i.step)} · lý do: ${esc(i.reason||"")} · ${i.start_on?dmy(i.start_on)+" → ":""}hạn ${dmy(i.due)}${i.state==="qua_han"?` · <b>quá hạn ${i.late} ngày</b>`:""}</small></li>`).join("")}${sp.length>8?`<li>… và ${sp.length-8} hồ sơ khác (bộ lọc «Hồ sơ bổ sung»)</li>`:""}</ul></span></div>`:""})()}
    ${today_.length?`<div class="banner b-a" style="margin-top:10px">${ico("cal")}<span><b>Hôm nay ${dmy(t)} cần có ${today_.length} hồ sơ:</b><ul class="bl">${today_.map(i=>`<li>${esc(i.name)} <small>· ${esc(i.step)}</small></li>`).join("")}</ul></span></div>`:""}
    <div style="margin-top:14px">${listBar("ck",{filters:F,placeholder:"Tìm hồ sơ, tên tệp, công việc, GPMB / DTXD…",primary:`${wbtn("ckSupp","Lập hồ sơ bổ sung",{icon:"plus",pri:1})}<div class="seg" role="group" aria-label="Cách xem"><button type="button" data-ckv="viec" aria-pressed="${view==="viec"}">Theo công việc</button><button type="button" data-ckv="ngay" aria-pressed="${view==="ngay"}">Theo ngày</button></div>`})}</div>
    ${body}${note("Tick ô khi đã có hồ sơ. Hồ sơ có tệp tải lên được tự tính là đã có. Hạn nộp = ngày hoàn thành dự kiến của công việc trong kế hoạch.")}`;
}
function bindChecklistAll(d){
  bindListBar("ck");
  $$("[data-ckf]").forEach(b=>{const f=()=>{const k=+b.dataset.ckf;ST.chip.ck=ST.chip.ck===k?0:k;ST.ckKept?.clear();render();const L=$("#q-ck");L&&scrollTo({top:L.getBoundingClientRect().top+scrollY-80,behavior:"smooth"});$(`[data-ckf="${k}"]`)?.focus({preventScroll:true})};
    b.onclick=f;b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f()}}});
  $$('[data-chip^="ck:"]').forEach(b=>b.addEventListener("click",()=>ST.ckKept?.clear(),{capture:true}));
  $("#ckSupp")&&($("#ckSupp").onclick=e=>suppMenu(e.currentTarget));
  // dấu + cuối mỗi công việc: lập hồ sơ bổ sung gắn thẳng vào công việc đó
  $$("[data-supp]").forEach(b=>b.onclick=()=>{const i=d.items.find(x=>x.step_id===b.dataset.supp);i&&suppMenu(b,{id:i.step_id,name:i.step})});
  $$("[data-sedit]").forEach(a=>a.onclick=e=>{e.preventDefault();suppModal({item:d.items.find(i=>i.id===a.dataset.sedit)})});
  $$("[data-ckv]").forEach(b=>b.onclick=()=>{ST.tab.ckv=b.dataset.ckv;render()});
  // nhớ mục đã sổ ra (bỏ qua sự kiện lúc vẽ lại, chỉ ghi khi người dùng bấm)
  let ckReady=false;setTimeout(()=>ckReady=true,0);
  const filtered=(ST.chip.ck??0)!==0||!!String(ST.q.ck||"").trim();
  $$("details[data-ck]").forEach(el=>el.addEventListener("toggle",()=>{if(!ckReady||filtered)return;const set=ST.ckOpen||(ST.ckOpen=new Set());el.open?set.add(el.dataset.ck):set.delete(el.dataset.ck)}));
  bindTicks(d.items);
}
function bindTicks(items){
  $$("[data-tick]").forEach(cb=>cb.onchange=async()=>{
    const it=items.find(i=>i.id===cb.dataset.tick);cb.disabled=true;(ST.ckKept||(ST.ckKept=new Set())).add(cb.dataset.tick);
    try{const r=await api("POST",`/api/items/${cb.dataset.tick}/done`,{done:cb.checked});dirty("00","01","02");
      if(it){it.done=cb.checked;it.ok=cb.checked}
      toast(cb.checked?(r.step_complete&&r.step_status!=="xong"?"Đã có — công việc đã đủ hồ sơ, cập nhật trạng thái «Hoàn thành» ở bước nếu đã xong":"Đã đánh dấu đã có"):"Đã bỏ đánh dấu");refreshQuiet()}
    catch(x){cb.checked=!cb.checked;cb.disabled=false;toast(x.message)}});
}
// lập hồ sơ bổ sung: nội dung (mỗi dòng một hồ sơ), lý do, nơi yêu cầu, làm từ ngày → hạn bổ sung
// nút «Lập hồ sơ bổ sung» sổ ra 2 lựa chọn: lập hồ sơ mới (tải tệp, lý do, hạn) / bổ sung hồ sơ cũ (chỉ tick hồ sơ của bước trước)
function suppMenu(btn,step){
  const was=$(".suppm");was&&was.remove();if(was&&was._btn===btn)return;
  const m=document.createElement("div");m.className="suppm";m.setAttribute("role","menu");m._btn=btn;
  m.innerHTML=`<button type="button" role="menuitem" data-m="moi">${ico("upload")}<span><b>Lập hồ sơ mới</b><small>Tải lên bản scan / PDF, ghi lý do và hạn bổ sung</small></span></button>
    <button type="button" role="menuitem" data-m="cu">${ico("file")}<span><b>Bổ sung hồ sơ cũ</b><small>Tra cứu hồ sơ đã có ở các bước trước, tick là xong</small></span></button>`;
  document.body.append(m);
  const r=btn.getBoundingClientRect(),w=m.offsetWidth;
  m.style.top=Math.min(r.bottom+6,innerHeight-m.offsetHeight-8)+"px";m.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+"px";
  btn.setAttribute("aria-expanded","true");
  const close=()=>{m.remove();btn.setAttribute("aria-expanded","false");document.removeEventListener("mousedown",out,true);document.removeEventListener("keydown",key,true);removeEventListener("scroll",close,true)};
  const out=e=>{if(!m.contains(e.target)&&!btn.contains(e.target))close()},key=e=>{if(e.key==="Escape"){close();btn.focus()}};
  document.addEventListener("mousedown",out,true);document.addEventListener("keydown",key,true);addEventListener("scroll",close,true);
  m.onclick=e=>{const b=e.target.closest("[data-m]");if(!b)return;close();suppModal({step,mode:b.dataset.m})};
  $("button",m).focus();
}
async function suppModal({step,item,mode="moi"}){
  const cu=!item&&mode==="cu";
  const t=ST.ref.today;
  // danh sách công việc theo kế hoạch (GPMB / DTXD) để chọn, gõ vài chữ là lọc
  const steps=item||!curProj()?[]:(await api("GET","/api/steps"+qs({project:curProj()})).catch(()=>[])).filter(s=>s.status!=="bo_qua");
  // hồ sơ của các bước trước để tra cứu rồi tick: chép sang công việc đang bổ sung, kèm tệp
  const prev=item||!curProj()?[]:(await api("GET","/api/checklist"+qs({project:curProj()})).catch(()=>({items:[]}))).items;
  const stepF={k:"step_name",label:"Công việc cần bổ sung",req:1,full:1,ph:"vd: Chi trả tiền BTHT / Thẩm định thiết kế về PCCC",hint:"Gõ tên công việc. Trùng tên công việc trong kế hoạch thì hồ sơ được gắn vào công việc đó; không trùng thì tạo công việc mới."},
    fromF={k:"from",label:"Hồ sơ đã có ở các bước trước — tra cứu rồi tick",type:"items",full:1,init:prevPicker,read:el=>$$("input[data-fi]:checked",el).map(x=>x.dataset.fi)};
  if(cu){formModal({title:"Bổ sung hồ sơ cũ",intro:"Chọn công việc, tìm hồ sơ đã có ở các bước trước rồi tick. Hồ sơ được chép sang công việc này cùng tệp, số văn bản và dấu «đã có».",
    values:{step_name:step?.name||""},fields:[stepF,fromF],okLabel:"Bổ sung hồ sơ",
    onSubmit:async v=>{if(!v.from.length)throw new Error("Tick ít nhất một hồ sơ cần bổ sung");
      const r=await api("POST","/api/supp",{from_items:v.from,names:[],project_id:curProj(),step_name:v.step_name,step_id:pickedStep(v.step_name)});
      toast(`Đã bổ sung ${r.from} hồ sơ từ bước trước${r.copied?` (${r.copied} tệp)`:""}`);dirty("00","01","02");refreshQuiet()}});
    stepPicker($("#fm-step_name"),steps,step);return}
  formModal({title:item?"Sửa hồ sơ bổ sung":"Lập hồ sơ mới",intro:item?`Công việc: ${item.step}`:"Ghi hồ sơ cơ quan / chuyên viên yêu cầu bổ sung. Mỗi dòng nội dung là một hồ sơ trong checklist, có hạn bổ sung và cảnh báo khi quá hạn. Công việc đã nộp hoặc đã xong sẽ chuyển lại «Đang chuẩn bị hồ sơ».",
    values:item?{name:item.name,reason:item.reason,req_by:item.req_by,start_on:item.start_on||"",due_on:item.due||"",note:item.note}:{step_name:step?.name||"",start_on:t},
    fields:[...(item?[{k:"name",label:"Nội dung hồ sơ",req:1,full:1}]:[stepF,
        {k:"files",label:"Hồ sơ cần bổ sung — tải lên bản scan / PDF (mỗi tệp là một hồ sơ)",type:"files",accept:HS_ACCEPT,req:1,full:1}]),
      {k:"reason",label:"Lý do bổ sung",type:"textarea",req:1,ph:"vd: Sở XD yêu cầu tại Thông báo số …/SXD ngày …: bản vẽ chưa thể hiện điểm đấu nối thoát nước"},
      {k:"req_by",label:"Cơ quan / người yêu cầu",ph:"vd: Sở Xây dựng — chuyên viên Nguyễn Văn A"},{k:"start_on",label:"Làm từ ngày",type:"date"},{k:"due_on",label:"Hạn bổ sung (đến ngày)",type:"date",req:1},
      {k:"note",label:"Ghi chú",type:"textarea"},...(item?[{k:"files",label:"Tải thêm bản scan / PDF cho hồ sơ này",type:"files",accept:HS_ACCEPT,full:1}]:[])],
    extra:item?[{label:"Xóa",cls:"dan",onClick:async(v,close)=>{await api("DELETE","/api/items/"+item.id);close();dirty("00","01","02");refreshQuiet()}}]:[],
    okLabel:item?"Lưu":"Lập hồ sơ bổ sung",
    // mỗi tệp tải lên thành một hồ sơ bổ sung (tên = tên tệp), tệp gắn luôn vào hồ sơ đó; bản chép ra thư mục hồ sơ trên máy
    onSubmit:async v=>{const files=v.files||[];delete v.files;
      if(item){await api("PUT","/api/supp/"+item.id,v);if(files.length)await upload(`/api/items/${item.id}/files`,files)}
      else{const r=await api("POST","/api/supp",{...v,names:files.map(f=>f.name.replace(/\.[^.]+$/,"").replace(/[_]+/g," ").trim()||f.name),project_id:curProj(),step_id:pickedStep(v.step_name)});
        for(let k=0;k<files.length&&k<r.ids.length;k++)await upload(`/api/items/${r.ids[k]}/files`,[files[k]]);
        toast(`Đã lập ${r.added} hồ sơ bổ sung và tải lên ${files.length} tệp`)}
      dirty("00","01","02");refreshQuiet()}});
  // công việc đã chọn trong danh sách (hoặc mở từ dấu + của công việc); không chọn thì máy chủ tìm theo tên / tạo công việc mới
  function pickedStep(name){const sid=$("#fm-step_name")?.dataset.sid,s=steps.find(x=>x.id===sid)||(step&&{id:step.id,name:step.name});return s&&s.name===name?s.id:null}
  if(!item)stepPicker($("#fm-step_name"),steps,step);
  // danh sách hồ sơ của các bước đứng trước công việc đang chọn (chưa chọn công việc → mọi bước); gõ để lọc, tick để lấy
  function prevPicker(el,add){
    add.hidden=true;const sel=new Set();
    el.innerHTML=`<input type="search" class="pkq" placeholder="Tìm tên hồ sơ, công việc, tên tệp…" aria-label="Tìm hồ sơ của bước trước"><small class="pkn muted"></small><div class="pkl" role="group" aria-label="Hồ sơ của các bước trước"></div>`;
    const qi=$(".pkq",el),L=$(".pkl",el),N=$(".pkn",el),inp=$("#fm-step_name");
    const draw=()=>{const sid=pickedStep(inp?.value)||inp?.dataset.sid||step?.id,cur=prev.find(i=>i.step_id===sid),k=fold(qi.value.trim());
      const I=prev.filter(i=>i.step_id!==sid&&(!cur||i.ord<cur.ord||sel.has(i.id))&&(!k||fold([i.name,i.step,i.sheet,...(i.file_list||[]).map(f=>f.name)].join(" ")).includes(k)));
      let last="";
      L.innerHTML=I.length?I.slice(0,300).map(i=>`${i.step_id!==last?(last=i.step_id,`<div class="pkh">${i.stt?esc(i.stt)+". ":""}${esc(i.step)} <small class="muted">${esc(ckTop(i.sheet))}</small></div>`):""}<label class="pki"><input type="checkbox" data-fi="${i.id}" ${sel.has(i.id)?"checked":""}><span>${esc(i.name)}${i.file_list?.length?` <small class="muted">· ${i.file_list.length} tệp</small>`:""}</span><span class="pill p-${i.ok?"g":"n"}">${i.ok?"✓ đã có":"chưa có"}</span></label>`).join(""):`<p class="muted" style="margin:8px">${k?"Không có hồ sơ nào khớp":"Chưa có hồ sơ nào ở các bước trước"}</p>`;
      N.textContent=`${sel.size?`Đã chọn ${sel.size} hồ sơ · `:""}${I.length} hồ sơ${cur?` trước «${cur.step}»`:""}`};
    L.onchange=e=>{const c=e.target.closest("[data-fi]");if(!c)return;c.checked?sel.add(c.dataset.fi):sel.delete(c.dataset.fi);draw()};
    qi.oninput=draw;qi.onkeydown=e=>e.key==="Enter"&&e.preventDefault();
    // đổi công việc cần bổ sung → danh sách bước trước đổi theo
    if(inp){inp.addEventListener("input",draw);inp.addEventListener("change",draw);inp.closest(".fld")?.addEventListener("click",()=>setTimeout(draw))}
    draw();
  }
}
async function importPlanXlsx(pid){
  const f=(await pickFiles(false,".xlsx"))[0];if(!f)return;
  confirmBox("Nhập kế hoạch từ Excel?",`Tệp «${f.name}»: mỗi công việc thành một bước, mỗi dòng «- …» trong cột Danh mục hồ sơ thành một hồ sơ trong checklist, giữ ngày bắt đầu / hoàn thành và tình trạng trong tệp. Nhập lại giữ dấu tick «đã có». Các bước không có trong tệp (và chưa có tệp đính kèm) sẽ bị thay.`,"Nhập",false,async()=>{
    const r=await upload(`/api/plan/${pid}/import`,[f]);ST.data={};render();toast(`Đã nhập ${r.steps} công việc, ${r.items} hồ sơ${r.removed?`, thay ${r.removed} bước cũ`:""}`)});
}

/* ---------- 09-03 Hồ sơ theo bước ---------- */
VIEW["screen-09-03"]={
  load:async()=>{const sel=ST.sel["screen-09-03"];if(sel&&!String(sel).startsWith("p-"))return {one:await api("GET","/api/steps/"+sel)};const pid=curProj();return pid?{ck:await api("GET","/api/checklist"+qs({project:pid}))}:null},
  actions:d=>d?.one?`<button class="btn sm" type="button" data-back>${ico("back")}Checklist hồ sơ</button>`+wbtn("stEdit","Cập nhật trạng thái",{icon:"edit"})+wbtn("stCheck","AI kiểm tra hồ sơ",{icon:"spark",dis:!ST.ref.ai,title:aiOff()})+btn("stBundle","Xuất bộ hồ sơ",{icon:"print",pri:1}):"",
  view(d){
    if(!ST.ref.projects.length)return noProject();
    if(!d)return pickProject("xem hồ sơ theo bước");
    if(d.ck)return d.ck.items.length?checklistAll(d.ck):emptyState("Chưa có danh mục hồ sơ","Nhập tệp Excel trình tự thủ tục (Kế hoạch pháp lý › Nhập từ Excel) hoặc khởi tạo các bước.",`<button class="btn pri" type="button" data-go="screen-09-02">${ico("cal")}Mở Kế hoạch pháp lý</button>`);
    return stepWork(d.one);
  },
  after(d){
    if(!d)return;
    if(d.ck)return bindChecklistAll(d.ck);
    bindStep(d.one);
  }};
// quay lại: từ chi tiết công việc về trang phần dự án đang xem (GPMB / DTXD) nếu có, không thì về danh sách
document.addEventListener("click",e=>{if(e.target.closest("[data-back]")){const back=ST.screen==="screen-09-03"&&ST.ckPart?"p-"+ST.ckPart:null;ST.sel[ST.screen]=back;try{history.replaceState(null,"","#"+ST.screen+(back?"/"+back:""))}catch(x){}reload()}});
const fileState=i=>i.na?["n","–","Không áp dụng"]:i.files.some(f=>f.current)?["ok","✓","Đã có tệp"]:i.done?["ok","✓","Đã có (đã tick)"]:i.ref_text?["warn","!","Có số văn bản, chưa có tệp"]:i.required?["miss","✕","Còn thiếu"]:["n","○","Không bắt buộc"];
function factsHtml(f){const a=f.ai_facts;if(!a)return "";
  return `<details class="facts"><summary>${esc([a.loai_van_ban,a.so_hieu,a.ngay_ban_hanh&&dmy(a.ngay_ban_hanh)].filter(Boolean).join(" · ")||"Nội dung AI đã đọc")}</summary>
  ${a.trich_yeu?`<p><b>Trích yếu:</b> ${esc(a.trich_yeu)}</p>`:""}${a.co_quan_ban_hanh?`<p><b>Cơ quan:</b> ${esc(a.co_quan_ban_hanh)}${a.nguoi_ky?" · Ký: "+esc(a.nguoi_ky):""}</p>`:""}${a.tom_tat?`<p>${esc(a.tom_tat)}</p>`:""}
  ${a.thong_tin?.length?`<ul>${a.thong_tin.map(x=>`<li>${esc(x.ten)}: <b>${esc(x.gia_tri)}</b></li>`).join("")}</ul>`:""}${a.chat_luong?`<p class="warn-t">${ico("warn")}${esc(a.chat_luong)}</p>`:""}</details>`}
function stepWork(s){
  const tab=ST.tab.step||"ck",items=s.items,app_=items.filter(i=>!i.na);
  const miss=app_.filter(i=>i.required&&i.kind!=="ket_qua"&&!i.files.some(f=>f.current)&&!i.ref_text);
  const lastChecks=[];s.checks.forEach(c=>{if(!lastChecks.some(x=>x.kind===c.kind&&x.target_id===c.target_id))lastChecks.push(c)});
  const openWarn=lastChecks.filter(c=>c.status==="xong").reduce((a,c)=>a+(c.result?.canh_bao?.length||0),0);
  const head=`<div class="card"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start"><div style="flex:1;min-width:240px"><div class="muted" style="font-size:12px">${esc(s.project_code)} · ${esc(s.phase_name||"")} · ${esc(s.code||"")}</div><h2 style="margin:2px 0 6px;font-size:19px">${esc(s.name)}</h2>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${pill(P(STEP_ST[s.status]))}${lateTxt(s)?pill(lateTxt(s)):""}${s.owner?`<span class="pill p-n">${esc(s.owner)}</span>`:""}</div></div>
    <div class="kv" style="min-width:min(100%,420px);flex:1">${[["Bắt đầu (KH)",dmy(s.plan_start)],["Nộp hồ sơ (KH)",dmy(s.plan_submit)],["Có kết quả (KH)",dmy(s.plan_end)],["Thực tế",s.act_end?"xong "+dmy(s.act_end):s.act_submit?"nộp "+dmy(s.act_submit):s.act_start?"bắt đầu "+dmy(s.act_start):"—"],["Cơ quan",agName(s.agency_text)||"—"],["Thời hạn giải quyết",s.proc_days?`${s.proc_days} ${s.workdays?"ngày làm việc":"ngày"}`:"—"]].map(x=>`<div><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join("")}</div></div>
    ${s.deps_names.length?`<p class="muted" style="font-size:12.5px;margin:10px 0 0">Phải xong trước: ${s.deps_names.map(x=>`<a href="#" data-go="screen-09-03" data-sel="${x.id}">${esc(x.name)}</a> ${pill(P(STEP_ST[x.status]))}`).join(" · ")}</p>`:""}</div>`;
  const warnBox=miss.length?`<div class="banner b-a" style="margin-top:14px">${ico("warn")}<span><b>Còn thiếu ${miss.length} hồ sơ bắt buộc:</b> ${miss.map(i=>esc(i.name)).join("; ")}.</span></div>`:app_.some(i=>i.required&&i.kind!=="ket_qua")?`<div class="banner b-g" style="margin-top:14px">${ico("check")}<span>Đã đủ hồ sơ bắt buộc của bước.${ST.ref.ai?" AI tự kiểm tra sai sót, mâu thuẫn khi hồ sơ đủ; có thể bấm «AI kiểm tra hồ sơ» để chạy lại.":""}</span></div>`:"";
  const tabs=[["ck","Checklist hồ sơ"],["ai",`Kiểm tra AI${openWarn?` (${openWarn})`:""}`],["dt",`Dự thảo (${s.docs.length})`],["prev",`Hồ sơ bước trước (${s.prev.reduce((a,p)=>a+p.files.length,0)})`],...(/TT-(PDPA|QDTHUHOI|CHITRA|BGMB)/.test(s.code||"")?[["bt","Bồi thường từng hộ"]]:[])];
  let body="";
  if(tab==="ck"){
    body=`<div class="toolbar" style="margin-bottom:10px"><span class="muted grow" style="font-size:12.5px">Checklist khởi tạo theo quy định / danh mục QLDA; sửa, bổ sung theo yêu cầu riêng của chuyên viên, cơ quan.</span>${wbtn("ckAdd","Thêm mục",{icon:"plus"})}${wbtn("ckSupp2","Lập hồ sơ bổ sung",{icon:"plus"})}${wbtn("ckAi","Bổ sung theo quy định mới (AI)",{icon:"spark",dis:!ST.ref.ai,title:aiOff()})}${s.similar.length?wbtn("ckCopy","Lấy từ dự án khác",{}):""}${wbtn("ckTpl","Lưu thành mẫu",{title:"Đưa các mục thêm ở bước này vào thư viện checklist mẫu của thủ tục"})}</div>`+
    ["soan","dau_vao","ket_qua"].map(k=>{const L=items.filter(i=>i.kind===k);if(!L.length)return "";
      return `<div class="card" style="margin-bottom:12px"><h3>${KIND[k]} <small class="muted" style="font-weight:400">${L.filter(i=>!i.na&&(i.files.some(f=>f.current)||i.ref_text)).length}/${L.filter(i=>!i.na).length}</small>${k==="ket_qua"?`<small class="muted" style="font-weight:400;margin-left:auto">Tải bản scan kết quả lên — AI đối chiếu với hồ sơ bước trước</small>`:""}</h3>
      <ul class="ilist">${L.map(i=>{const st=fileState(i),cur=i.files.filter(f=>f.current),old=i.files.filter(f=>!f.current);
        const lockT=i.na||cur.length||!!i.ref_text||!act(...W),dueI=i.due_on||s.plan_end,od=!i.na&&st[0]!=="ok"&&i.required&&dueI&&dueI<ST.ref.today;
        return `<li class="${i.na?"na":""}"><label class="tick" title="${st[2]}"><input type="checkbox" data-tick="${i.id}" ${st[0]==="ok"?"checked":""} ${lockT?"disabled":""} aria-label="Đã có: ${esc(i.name)}"><span aria-hidden="true">✓</span></label><div class="ib"><div class="it"><b>${esc(i.name)}</b>${i.required&&!i.na?`<span class="tag">bắt buộc</span>`:""}<span class="tag">${esc(SRC[i.source]||i.source)}</span>${i.tag?`<span class="tag ds">xuất từ bảng bồi thường</span>`:""}</div>
          ${i.supp?`<small class="supl"><span class="pill p-t">Bổ sung</span> Lý do: ${esc(i.reason||"")}${i.req_by?` · Yêu cầu: ${esc(i.req_by)}`:""}${i.start_on?` · từ ${dmy(i.start_on)}`:""}</small>`:""}${dueI&&!i.na?`<small class="${od?"err-t":"muted"}">${od?"⚠ Quá hạn — ":i.supp?"Hạn bổ sung: ":"Hạn: "}${dmy(dueI)}</small>`:""}${i.basis?`<small class="muted">Căn cứ: ${esc(i.basis)}</small>`:""}${i.ref_text?`<small>Văn bản đã có: <b>${esc(i.ref_text)}</b></small>`:""}${i.note?`<small class="muted">${esc(i.note)}</small>`:""}
          ${cur.length?`<ul class="flist">${cur.map(f=>`<li>${ico("file")}<a href="/api/file/${f.id}" target="_blank" rel="noopener">${esc(f.name)}</a><small>${kb(f.size||0)} · ${esc(f.uploader||"")} · ${hm(f.uploaded_at)}</small>${f.origin==="tai_len"?pill(P(AIS[f.ai_status])):pill(f.origin==="du_thao"?"~g:Dự thảo đã chốt":"~g:Xuất từ bảng bồi thường")}
            ${act(...W)&&f.origin==="tai_len"?`<button class="x" type="button" title="Thay bằng phiên bản mới" data-rep="${i.id}:${f.id}">${ico("upload")}</button>`:""}${act(...W)&&!(f.origin==="du_thao")?`<button class="x" type="button" title="Xóa tệp" data-fdel="${f.id}">${ico("x")}</button>`:""}
            ${ST.ref.ai&&f.origin==="tai_len"&&["loi","tat"].includes(f.ai_status)&&act(...W)?`<button class="btn sm" type="button" data-fai="${f.id}">AI đọc lại</button>`:""}${fileCheck(f,s.checks)}${ST.ref.ai&&f.origin==="tai_len"&&f.ai_status==="xong"&&act(...W)?`<button class="btn sm" type="button" data-fchk="${f.id}">${ico("spark")}${i.kind==="ket_qua"?"Đối chiếu lại":"AI kiểm tra lại"}</button>`:""}
            ${f.ai_error?`<small class="err-t">${esc(f.ai_error)}</small>`:""}${factsHtml(f)}</li>`).join("")}</ul>`:""}
          ${old.length?`<details class="muted" style="font-size:12px"><summary>${old.length} phiên bản cũ</summary>${old.map(f=>`<a href="/api/file/${f.id}" target="_blank" rel="noopener">${esc(f.name)}</a> · ${hm(f.uploaded_at)}`).join("<br>")}</details>`:""}</div>
          <div class="ia">${act(...W)&&!i.na?`<button class="btn sm" type="button" data-up="${i.id}">${ico("upload")}Tải lên</button>`:""}${i.kind==="soan"&&!i.na&&!i.tag?`<button class="btn sm" type="button" data-soan="${i.id}" ${act(...W)?"":"disabled"}>${ico("edit")}Soạn</button>`:""}${i.tag?`<button class="btn sm" type="button" data-go="screen-09-05">${ico("users")}Xuất từng hộ</button>`:""}<button class="btn sm" type="button" data-ied="${i.id}" ${act(...W)?"":"disabled"} aria-label="Sửa mục">…</button></div></li>`}).join("")}</ul></div>`}).join("");
  }else if(tab==="ai"){
    body=`<div class="toolbar" style="margin-bottom:10px"><span class="muted grow" style="font-size:12.5px">AI đọc toàn bộ hồ sơ của bước (và tóm tắt hồ sơ các bước trước) để tìm sai sót, mâu thuẫn. Kết quả là gợi ý — người dùng quyết định sửa.</span>${wbtn("ckRun","Chạy kiểm tra hồ sơ",{icon:"spark",dis:!ST.ref.ai,title:aiOff()})}</div>`+
      (s.checks.length?s.checks.map(checkCard).join(""):emptyState("Chưa có lần kiểm tra nào",ST.ref.ai?"AI tự kiểm tra khi đủ hồ sơ bắt buộc, và tự đối chiếu mỗi khi tải bản scan kết quả lên.":aiOff()));
  }else if(tab==="dt"){
    body=`<div class="toolbar" style="margin-bottom:10px"><span class="muted grow" style="font-size:12.5px">Dự thảo của bước. Chốt văn bản → tự gắn bản PDF vào checklist.</span>${wbtn("dtNew","Soạn văn bản mới",{icon:"plus",pri:1})}</div>`+
      (s.docs.length?table(["Văn bản","Loại","Trạng thái","Cập nhật","Người soạn"],s.docs.map(x=>[x.subject,VB.LOAI[x.kind]?.name,x.status==="chot"?"~g:Đã chốt":"~a:Nháp",hm(x.updated_at),x.author+(x.by_ai?" · AI":"")]),{rowAttr:i=>`data-doc="${s.docs[i].id}" tabindex="0"`}):emptyState("Chưa có dự thảo","Bấm «Soạn» ở mục văn bản cần soạn trong checklist, hoặc «Soạn văn bản mới»."));
  }else if(tab==="prev"){
    body=s.prev.length?s.prev.map(p=>`<div class="card" style="margin-bottom:12px"><h3>${esc(p.name)} ${pill(P(STEP_ST[p.status]))}</h3>${p.files.length?`<ul class="flist">${p.files.map(f=>`<li>${ico("file")}<a href="/api/file/${f.id}" target="_blank" rel="noopener">${esc(f.name)}</a><small>${esc(f.item)}${f.so_hieu?" · "+esc(f.so_hieu):""}${f.ngay?" · "+dmy(f.ngay):""}</small></li>`).join("")}</ul>`:`<p class="muted">Chưa có tệp.</p>`}</div>`).join(""):emptyState("Không có bước trước","Bước này không phụ thuộc bước nào. Sửa phụ thuộc ở màn Kế hoạch pháp lý.");
  }else{
    body=`<div class="card"><h3>Bảng tổng hợp phương án bồi thường</h3><p>${s.households.n?`Đã nhập ${s.households.n} hộ (${s.households.batches} đợt).`:"Chưa nhập bảng tổng hợp."} Từ bảng tổng hợp phương án được duyệt, xuất quyết định phê duyệt phương án, phiếu chi, quyết định thu hồi đất cho từng hộ và lưu thẳng vào checklist của bước tương ứng.</p><button class="btn pri" type="button" data-go="screen-09-05">${ico("users")}Mở Bồi thường từng hộ</button></div>`;
  }
  return `${head}${warnBox}<div class="tabs" role="tablist" style="margin-top:14px">${tabs.map(t=>`<button type="button" role="tab" aria-selected="${t[0]===tab}" data-tab="${t[0]}">${esc(t[1])}</button>`).join("")}</div>${body}`;
}
function checkCard(c){
  const r=c.result||{},W_=r.canh_bao||[];
  return `<div class="card ccard" data-ckid="${c.id}" style="margin-bottom:12px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>${esc(CK_KIND[c.kind])}</b>${c.kind==="tep"&&c.file_name?`<small>«${esc(c.file_name)}»</small>`:""}${c.status==="dang"?pill("~b:AI đang kiểm tra…"):c.status==="loi"?pill("~r:Lỗi"):c.status==="da_xu_ly"?pill("~g:Đã xử lý"):pill(P(KL[r.ket_luan]||["n","—"]))}
    <small class="muted">${hm(c.created_at)}${c.by_name?" · "+esc(c.by_name):" · tự động"}</small><span style="flex:1"></span>${c.status==="xong"&&act(...W)?`<button class="btn sm" type="button" data-hdl="${c.id}">Đánh dấu đã xử lý</button>`:""}</div>
    ${c.status==="loi"?`<p class="err-t">${esc(c.error||"")}</p>`:""}${r.tom_tat?`<p style="margin:8px 0">${esc(r.tom_tat)}</p>`:""}
    ${W_.length?`<ul class="wlist">${W_.map(w=>`<li><span class="pill p-${(MUC[w.muc_do]||MUC.thap)[0]}">${(MUC[w.muc_do]||MUC.thap)[1]}</span><div><b>${esc(WL[w.loai]||w.loai)}:</b> ${esc(w.noi_dung)}${w.ho_so?.length?`<small class="muted">Hồ sơ: ${w.ho_so.map(esc).join("; ")}</small>`:""}${w.de_xuat?`<small>→ ${esc(w.de_xuat)}</small>`:""}</div></li>`).join("")}</ul>`:c.status==="xong"||c.status==="da_xu_ly"?`<p class="muted">Không phát hiện sai sót, mâu thuẫn.</p>`:""}
    ${r.da_doi_chieu?.length?`<details class="muted" style="font-size:12.5px"><summary>Đã đối chiếu ${r.da_doi_chieu.length} nội dung</summary><ul>${r.da_doi_chieu.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></details>`:""}
    ${c.files?.skipped?.length?`<small class="muted">Tệp quá dung lượng, AI chỉ dùng phần tóm tắt: ${c.files.skipped.map(esc).join("; ")}</small>`:""}${c.handled_note?`<small class="muted">Xử lý: ${esc(c.handled_note)} — ${esc(c.handler||"")}</small>`:""}</div>`;
}
function bindStep(s){
  const re=()=>{dirty("01","02","04");refreshQuiet()};
  $$("[data-tab]").forEach(b=>b.onclick=()=>{ST.tab.step=b.dataset.tab;render()});
  bindTicks(s.items);
  $("#stEdit")&&($("#stEdit").onclick=async()=>{const steps=await api("GET","/api/steps"+qs({project:s.project_id}));editStep(steps.find(x=>x.id===s.id),{steps,pid:s.project_id})});
  const runCheck=e=>busy(e.target,"Đang gửi…",async()=>{await api("POST",`/api/steps/${s.id}/check`);ST.tab.step="ai";re();toast("AI đang kiểm tra hồ sơ — kết quả hiện ở tab Kiểm tra AI (1–3 phút)")}).catch(x=>toast(x.message));
  $("#stCheck")&&($("#stCheck").onclick=runCheck);$("#ckRun")&&($("#ckRun").onclick=runCheck);
  $("#stBundle")&&($("#stBundle").onclick=()=>bundleModal(s));
  $$("[data-up]").forEach(b=>b.onclick=async()=>{const fs_=await pickFiles(true);if(!fs_.length)return;await busy(b,"Đang tải…",async()=>{try{const it=s.items.find(i=>i.id===b.dataset.up);await upload(`/api/items/${b.dataset.up}/files`,fs_);toast(`Đã tải ${fs_.length} tệp${ST.ref.ai?it.kind==="ket_qua"?" — AI đang đọc và đối chiếu với hồ sơ bước trước":" — AI đang đọc nội dung":""}`);re()}catch(x){toast(x.message)}})});
  $$("[data-rep]").forEach(b=>b.onclick=async()=>{const [iid,fid]=b.dataset.rep.split(":");const fs_=await pickFiles(false);if(!fs_.length)return;try{await upload(`/api/items/${iid}/files`,fs_,{replace:fid});toast("Đã thay phiên bản mới"+(ST.ref.ai?" — AI kiểm tra lại":""));re()}catch(x){toast(x.message)}});
  $$("[data-fdel]").forEach(b=>b.onclick=()=>confirmBox("Xóa tệp?","Tệp bị xóa khỏi checklist và máy chủ.","Xóa",true,async()=>{await api("DELETE","/api/files/"+b.dataset.fdel);re()}));
  $$("[data-fai]").forEach(b=>b.onclick=async()=>{await api("POST",`/api/files/${b.dataset.fai}/ai`,{});re()});
  $$("[data-fchk]").forEach(b=>b.onclick=async()=>{try{await api("POST",`/api/files/${b.dataset.fchk}/ai`,{what:"check"});ST.tab.step="ai";re();toast("AI đang kiểm tra tệp với hồ sơ liên quan và quy định hiện hành")}catch(x){toast(x.message)}});
  $$("[data-fck]").forEach(b=>b.onclick=()=>{ST.tab.step="ai";render();setTimeout(()=>$(`[data-ckid="${b.dataset.fck}"]`)?.scrollIntoView({block:"center",behavior:"smooth"}),50)});
  $$("[data-ied]").forEach(b=>b.onclick=()=>editItem(s,s.items.find(i=>i.id===b.dataset.ied)));
  $("#ckAdd")&&($("#ckAdd").onclick=()=>editItem(s,null));
  $("#ckSupp2")&&($("#ckSupp2").onclick=e=>suppMenu(e.currentTarget,s));
  $("#ckAi")&&($("#ckAi").onclick=()=>suggestModal({step:s}));
  $("#ckCopy")&&($("#ckCopy").onclick=()=>formModal({title:"Lấy checklist từ hồ sơ dự án khác",intro:"Thêm các mục chưa có từ cùng thủ tục đã làm ở dự án khác (không lấy tệp).",
    fields:[{k:"from",label:"Dự án nguồn",type:"select",options:s.similar.map(x=>[x.id,`${x.project_code} ${x.project_name} · ${x.items} mục`])}],okLabel:"Lấy",onSubmit:async v=>{const r=await api("POST",`/api/steps/${s.id}/copy-from`,{from_step_id:v.from});re();toast(`Đã thêm ${r.added} mục`)}}));
  $("#ckTpl")&&($("#ckTpl").onclick=()=>confirmBox("Lưu thành mẫu?","Các mục thêm riêng ở bước này được đưa vào thư viện checklist mẫu của thủ tục, dùng cho dự án sau.","Lưu",false,async()=>{const r=await api("POST",`/api/steps/${s.id}/save-tpl`);dirty("06");toast(`Đã thêm ${r.added} mục vào thư viện mẫu`)}));
  $$("[data-soan]").forEach(b=>b.onclick=()=>composeDoc(s,s.items.find(i=>i.id===b.dataset.soan)));
  $("#dtNew")&&($("#dtNew").onclick=()=>composeDoc(s,null));
  $$("[data-doc]").forEach(el=>el.onclick=()=>openDoc(el.dataset.doc));
  $$("[data-hdl]").forEach(b=>b.onclick=()=>confirmBox("Đánh dấu đã xử lý?","Ghi cách đã xử lý các cảnh báo (đã sửa hồ sơ, giải trình…).","Xác nhận",false,async why=>{await api("PUT","/api/checks/"+b.dataset.hdl,{note:why});re()},"Đã xử lý thế nào"));
  // chờ AI: tự làm mới
  const waiting=s.items.some(i=>i.files.some(f=>f.current&&["cho","dang"].includes(f.ai_status)))||s.checks.some(c=>c.status==="dang");
  if(waiting)pollT=setTimeout(()=>{if(ST.screen==="screen-09-03"&&ST.sel["screen-09-03"]===s.id&&!document.querySelector(".ov"))refreshQuiet()},5000);
}
function editItem(s,i){
  formModal({title:i?"Sửa mục hồ sơ":"Thêm mục hồ sơ",intro:i?"":"Thêm hồ sơ theo yêu cầu riêng của chuyên viên / cơ quan tiếp nhận. Chọn «Lưu vào thư viện mẫu» để dự án sau có sẵn.",
    values:i?{...i,required:i.required?"1":"",na:i.na?"1":""}:{kind:"dau_vao",required:"1"},
    fields:[{k:"kind",label:"Nhóm",type:"select",options:Object.entries(KIND)},{k:"required",label:"Bắt buộc",type:"select",options:[["1","Bắt buộc"],["","Không bắt buộc"]]},{k:"name",label:"Tên hồ sơ",req:1,full:1},
      {k:"basis",label:"Căn cứ / yêu cầu",full:1,ph:"Điều …, khoản … / yêu cầu của chuyên viên … ngày …"},{k:"doc_kind",label:"Loại văn bản (nếu cần soạn)",type:"select",options:[["","—"],...VBK]},
      ...(i?[{k:"na",label:"Áp dụng cho dự án",type:"select",options:[["","Áp dụng"],["1","Không áp dụng"]]},{k:"ref_text",label:"Số văn bản đã có (khi chưa có tệp)",full:1,ph:"vd 123/QĐ-UBND ngày 29/7/2026"}]:[{k:"save_tpl",label:"Thư viện mẫu",type:"select",options:[["","Chỉ thêm cho bước này"],["1","Lưu vào thư viện mẫu của thủ tục"]]}]),
      {k:"note",label:"Ghi chú",type:"textarea"}],
    extra:i&&act(...W)?[{label:"Xóa mục",cls:"dan",onClick:async(v,close)=>{close();confirmBox("Xóa mục hồ sơ?","Xóa mục và các tệp đã tải lên của mục.","Xóa",true,async()=>{await api("DELETE","/api/items/"+i.id);dirty("01");refreshQuiet()})}}]:[],
    onSubmit:async v=>{const b={...v,required:!!v.required,na:!!v.na,save_tpl:!!v.save_tpl};if(i)await api("PUT","/api/items/"+i.id,b);else await api("POST",`/api/steps/${s.id}/items`,b);dirty("01","06");refreshQuiet()}});
}
// AI đề xuất bổ sung checklist từ văn bản luật mới / yêu cầu riêng
function suggestModal({step,proc}){
  panelModal({title:"Bổ sung checklist theo quy định mới",intro:`Dán nội dung văn bản luật / quy định mới, yêu cầu của chuyên viên hoặc cơ quan tiếp nhận — hoặc chọn tệp (PDF, Word, ảnh). AI đọc và đề xuất mục cần bổ sung, sửa; bạn chọn mục nào đưa vào ${step?"bước «"+step.name+"»":"thư viện mẫu"}.`,wide:820,
    html:`<div class="fld"><label for="sgT">Nội dung văn bản / yêu cầu</label><textarea id="sgT" class="bigta" style="min-height:180px" placeholder="vd: Điều … Nghị định …/2026/NĐ-CP: Hồ sơ đề nghị cấp giấy phép xây dựng gồm: …"></textarea></div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="btn sm" type="button" id="sgF">${ico("upload")}Chọn tệp văn bản</button><small class="muted" id="sgFn">Chưa chọn tệp</small><span style="flex:1"></span><button class="btn pri" type="button" id="sgRun">${ico("spark")}AI đọc và đề xuất</button></div>
    <div id="sgOut" style="margin-top:12px"></div>`,
    bind(ov,close,err){let file=null;
      $("#sgF",ov).onclick=async()=>{const f=(await pickFiles(false))[0];if(f){file=f;$("#sgFn",ov).textContent=f.name}};
      $("#sgRun",ov).onclick=e=>busy(e.target,"AI đang đọc… (1–2 phút)",async()=>{try{
        const r=await upload("/api/suggest",file?[file]:[],{text:$("#sgT",ov).value,step_id:step?.id,procedure_code:proc});
        const add=r.bo_sung||[];
        $("#sgOut",ov).innerHTML=`${r.ghi_chu?banner("b",r.ghi_chu):""}<h4 style="margin:12px 0 6px">Đề xuất bổ sung (${add.length})</h4>${add.length?`<div class="cklist dl">${add.map((x,i)=>`<label><input type="checkbox" checked value="${i}"> <span><b>${esc(x.ten)}</b> <small class="muted">${esc(KIND[x.kind])}${x.bat_buoc?" · bắt buộc":""}${x.can_cu?" · "+esc(x.can_cu):""}</small></span></label>`).join("")}</div>`:`<p class="muted">Không có mục cần bổ sung.</p>`}
          ${r.sua_doi?.length?`<h4 style="margin:12px 0 6px">Mục đang có nên sửa (${r.sua_doi.length})</h4><ul>${r.sua_doi.map(x=>`<li><b>${esc(x.ten_hien_tai)}</b> → ${esc(x.de_xuat)} <small class="muted">${esc(x.can_cu)}</small></li>`).join("")}</ul><p class="muted" style="font-size:12px">Sửa tay các mục này (bấm «…» ở mục).</p>`:""}
          ${add.length?`<div class="foot" style="margin-top:10px">${step?`<label class="muted" style="font-size:12.5px"><input type="checkbox" id="sgTpl"> Lưu cả vào thư viện mẫu</label>`:""}<span style="flex:1"></span><button class="btn pri" type="button" id="sgAdd">Thêm mục đã chọn</button></div>`:""}`;
        const ab=$("#sgAdd",ov);ab&&(ab.onclick=async()=>{const pick=$$("#sgOut input[type=checkbox][value]:checked",ov).map(i=>add[+i.value]).map(x=>({kind:x.kind,name:x.ten,required:x.bat_buoc,basis:x.can_cu,doc_kind:x.doc_kind||null,source:"ai",save_tpl:!!$("#sgTpl",ov)?.checked}));
          if(!pick.length)return err("Chưa chọn mục nào");
          try{if(step)await api("POST",`/api/steps/${step.id}/items`,{items:pick});else await api("POST","/api/tpl",{procedure_code:proc,items:pick});close();dirty("01","06");step?refreshQuiet():reload();toast(`Đã thêm ${pick.length} mục`)}catch(x){err(x.message)}});
      }catch(x){err(x.message)}})}});
}
function bundleModal(s){
  const files=[];["soan","dau_vao","ket_qua"].forEach(k=>s.items.filter(i=>i.kind===k&&!i.na).forEach(i=>i.files.filter(f=>f.current).forEach(f=>files.push({...f,item:i.name,kind:k}))));
  if(!files.length)return toast("Bước chưa có tệp nào để xuất");
  let order=files.map(f=>f.id),checked=new Set(files.filter(f=>f.kind!=="ket_qua").map(f=>f.id));
  const by=id=>files.find(f=>f.id===id),printable=f=>/\.(pdf|jpe?g|png)$/i.test(f.name);
  panelModal({title:"Xuất bộ hồ sơ để in, ký, nộp",intro:"Gom tệp từ checklist thành một bộ: trang 1 là danh mục hồ sơ (số trang từng tài liệu), sau đó lần lượt từng tài liệu. Tệp Word/Excel không ghép được vào PDF — dùng bản ZIP hoặc in riêng.",wide:820,
    html:`<div class="fgrid"><div class="fld full"><label for="bdT">Tiêu đề bộ hồ sơ</label><input id="bdT" value="${esc("HỒ SƠ "+s.name.toUpperCase())}"></div><div class="fld full"><label for="bdR">Kính gửi</label><input id="bdR" value="${esc(agName(s.agency_text||"").split(/[;(]/)[0].trim())}"></div></div>
    <div id="bdL" class="cklist dl" style="margin-top:10px"></div>
    <div class="foot" style="margin-top:12px"><span class="muted" id="bdN" style="font-size:12.5px"></span><span style="flex:1"></span><button class="btn" type="button" data-x>Đóng</button><button class="btn" type="button" id="bdZ">${ico("file")}Tải ZIP (nộp điện tử)</button><button class="btn pri" type="button" id="bdP">${ico("print")}Tải PDF để in</button></div>`,
    bind(ov,close,err){
      const draw=()=>{$("#bdL",ov).innerHTML=order.map((id,i)=>{const f=by(id);return `<div class="brow"><label><input type="checkbox" data-c="${id}" ${checked.has(id)?"checked":""}> <span><b>${esc(f.item)}</b><small class="muted"> ${esc(f.name)} · ${KIND[f.kind]}${printable(f)?"":" · không ghép PDF"}</small></span></label><span><button class="x" type="button" data-u="${i}" aria-label="Lên">${ico("up")}</button><button class="x" type="button" data-d="${i}" aria-label="Xuống">${ico("down")}</button></span></div>`}).join("");
        $("#bdN",ov).textContent=`${checked.size} tài liệu`;
        $$("[data-c]",ov).forEach(c=>c.onchange=()=>{c.checked?checked.add(c.dataset.c):checked.delete(c.dataset.c);$("#bdN",ov).textContent=`${checked.size} tài liệu`});
        $$("[data-u]",ov).forEach(b=>b.onclick=()=>{const i=+b.dataset.u;if(i>0){[order[i-1],order[i]]=[order[i],order[i-1]];draw()}});
        $$("[data-d]",ov).forEach(b=>b.onclick=()=>{const i=+b.dataset.d;if(i<order.length-1){[order[i+1],order[i]]=[order[i],order[i+1]];draw()}})};
      draw();
      const run=fmt=>e=>busy(e.target,"Đang ghép…",async()=>{const ids=order.filter(id=>checked.has(id));if(!ids.length)return err("Chọn ít nhất một tài liệu");
        try{await postDownload(`/api/steps/${s.id}/bundle`,{file_ids:ids,format:fmt,title:$("#bdT",ov).value,recipient:$("#bdR",ov).value},"bo-ho-so."+fmt);toast("Đã xuất bộ hồ sơ")}catch(x){err(x.message)}});
      $("#bdP",ov).onclick=run("pdf");$("#bdZ",ov).onclick=run("zip");
    }});
}
// mã cơ quan QLDA (CQ-TPBN-SXD…) → tên cơ quan
const agName=s=>String(s||"").replace(/CQ-[A-Z0-9-]+/g,c=>{const a=ST.ref.agencies.find(x=>x.code===c);return a?a.name:c});

/* ---------- 09-04 Dự thảo văn bản ---------- */
VIEW["screen-09-04"]={
  load:async()=>{const sel=ST.sel["screen-09-04"];if(sel)return {doc:await api("GET","/api/docs/"+sel)};const pid=curProj(),[list,pend]=await Promise.all([api("GET","/api/docs"+qs({project:ST.proj})),pid?api("GET","/api/docs-pending"+qs({project:pid})):null]);return {list,pend}},
  actions:d=>d?.doc?`<button class="btn sm" type="button" data-back>${ico("back")}Danh sách</button>`:wbtn("dvAuto","Cập nhật ngay",{icon:"refresh",dis:!curProj(),title:"Hệ thống tự soạn và cập nhật văn bản các bước đang xử lý mỗi 30 phút — bấm để cập nhật ngay"})+btn("dvLook","Nhờ AI",{icon:"spark",title:"Nhờ Trợ lý AI: tra cứu, soạn, kiểm tra văn bản, cập nhật hồ sơ…"})+wbtn("dvNew","Soạn văn bản",{icon:"plus",pri:1,dis:!curProj()}),
  view(d){
    if(!ST.ref.projects.length)return noProject();
    if(d.doc)return docEditor(d.doc);
    const F=["Nháp","Đã chốt","Tất cả"],c=ST.chip.dv??0,rows=d.list.filter(x=>[x.status==="nhap",x.status==="chot",true][c]&&match("dv",x.subject+" "+x.step_name));
    return `${pendCard(d.pend)}${listBar("dv",{filters:F,placeholder:"Tìm theo trích yếu, bước…"})}${rows.length?table(["Văn bản","Loại","Bước","Dự án","Trạng thái","AI kiểm tra","Cập nhật",""],rows.map(x=>[x.subject,VB.LOAI[x.kind]?.name,x.step_name,x.project_code,x.status==="chot"?"~g:Đã chốt":"~a:Nháp",x.last_check?(x.last_check.canh_bao?.length?`~a:${x.last_check.canh_bao.length} cảnh báo`:"~g:Không có cảnh báo"):"—",hm(x.updated_at),""]),{rowAttr:i=>`data-doc="${rows[i].id}" tabindex="0"`}):d.list.length?noHit("dv"):emptyState("Chưa có dự thảo","Bấm «Soạn» ở mục văn bản cần soạn của một bước, hoặc «Soạn văn bản».")}`},
  after(d){
    if(d.doc)return bindEditor(d.doc);
    $$("[data-pdoc]").forEach(b=>b.onclick=()=>openDoc(b.dataset.pdoc));
    $$("[data-plook]").forEach(b=>b.onclick=()=>aiAsk(lookQ(b.dataset.plook,b.dataset.pstep)));
    $("#dvLook")&&($("#dvLook").onclick=lookModal);$$("[data-pprint]").forEach(b=>b.onclick=()=>printDoc(b.dataset.pprint));
    $$("[data-pnew]").forEach(b=>b.onclick=async()=>{const [sid,iid]=b.dataset.pnew.split(":");const s=await api("GET","/api/steps/"+sid);composeDoc(s,s.items.find(i=>i.id===iid)||null)});
    bindListBar("dv");$$("[data-doc]").forEach(el=>{el.onclick=()=>openDoc(el.dataset.doc);const c=el.lastElementChild;if(c){c.innerHTML=`<button class="btn sm" type="button" title="In văn bản (A4, thể thức NĐ 30/2020)">${ico("print")}In</button>`;c.firstChild.onclick=e=>{e.stopPropagation();printDoc(el.dataset.doc)}}});
    $("#dvAuto")&&($("#dvAuto").onclick=e=>busy(e.target,"Đang soạn…",async()=>{try{const r=await api("POST","/api/docs/auto",{project:curProj()});dirty("03");reload();toast(r.made||r.updated?`Đã soạn mới ${r.made}, cập nhật ${r.updated} văn bản theo dữ liệu mới nhất`:"Văn bản các bước đang xử lý đã cập nhật")}catch(x){toast(x.message)}}));
    $("#dvNew")&&($("#dvNew").onclick=async()=>{const t=ST.ref.today,cur=s=>["dang","cho_kq"].includes(s.status)||(s.status!=="xong"&&s.plan_start&&s.plan_start<=t),steps=(await api("GET","/api/steps"+qs({project:curProj()}))).filter(s=>s.status!=="bo_qua").sort((a,b)=>cur(b)-cur(a)||(a.plan_start||"9").localeCompare(b.plan_start||"9"));if(!steps.length)return toast("Chưa có bước pháp lý — khởi tạo ở Kế hoạch pháp lý");
      formModal({title:"Soạn văn bản cho bước",fields:[{k:"step",label:"Bước đang xử lý",type:"select",options:steps.map(s=>[s.id,`${cur(s)?"▶ ":""}${s.name} · ${STEP_ST[s.status][1]} · KH ${dmy(s.plan_start)}–${dmy(s.plan_end)}`])}],okLabel:"Tiếp",onSubmit:async v=>{const s=await api("GET","/api/steps/"+v.step);setTimeout(()=>composeDoc(s,null),30)}})});
  }};
function openDoc(id){go("screen-09-04",id)}
function pendCard(p){
  if(!p)return "";const S=p.steps.filter(s=>s.items.length);
  const n=S.reduce((a,s)=>a+s.items.length,0),ok=S.reduce((a,s)=>a+s.items.filter(i=>i.doc||i.done).length,0);
  const row=(s,i)=>`<li><i class="dot-${i.done||i.doc?.status==="chot"?"g":i.doc?"b":"a"}"></i><div style="flex:1;min-width:0"><b>${esc(i.name)}</b><small>${i.done?"Đã có trong checklist":i.doc?(i.doc.status==="chot"?"Đã chốt":"Đã có dự thảo (nháp)"):"Chưa soạn"}${i.doc_kind?" · "+esc(VB.LOAI[i.doc_kind]?.name||""):""}</small></div>
    <span style="display:flex;gap:4px;flex:none"><button class="btn sm" type="button" data-plook="${esc(i.name)}" data-pstep="${esc(s.name)}" title="Nhờ AI về văn bản này: tìm mẫu, căn cứ, soạn, kiểm tra">${ico("spark")}Nhờ AI</button>${i.doc?`<button class="btn sm" type="button" data-pdoc="${i.doc.id}">${ico("edit")}Mở</button><button class="btn sm" type="button" data-pprint="${i.doc.id}">${ico("print")}In</button>`:i.done?"":act(...W)?`<button class="btn sm pri" type="button" data-pnew="${s.id}:${i.id}">${ico("plus")}Soạn</button>`:""}</span></li>`;
  let ph;
  return `<div class="card" style="margin-bottom:12px"><h3>Bước đang xử lý theo kế hoạch ngày ${dmy(p.today)} <small style="color:var(--muted);font-weight:400">${S.length} bước · ${ok}/${n} hồ sơ phải soạn đã có</small></h3>
    ${S.length?S.map(s=>`${s.phase!==ph?(ph=s.phase,`<h4 class="pdh">${esc(s.phase||"Chưa xếp giai đoạn")}</h4>`):""}<div class="pds"><div class="pdt"><b>${esc(s.name)}</b> ${pill(P(STEP_ST[s.status]))} ${s.late?pill("~r:Quá ngày kết quả KH"):s.in_window?pill("~b:Trong kỳ kế hoạch"):s.plan_start>p.today?pill("~g:Làm sớm hơn kế hoạch"):pill("~a:Chậm bắt đầu")}<small class="muted"> KH ${dmy(s.plan_start)} → ${dmy(s.plan_end)}</small></div><ul class="alist">${s.items.map(i=>row(s,i)).join("")}</ul></div>`).join(""):`<p class="muted">Không có bước nào đang xử lý cần soạn văn bản theo kế hoạch hôm nay.</p>`}</div>`;
}
function composeDoc(s,item){
  const soan=s.items.filter(i=>i.kind==="soan"&&!i.na&&!i.tag);
  const form=item?.form_code?ST.ref.forms.find(f=>f.code===item.form_code):null;
  formModal({title:item?`Soạn: ${item.name}`:"Soạn văn bản mới",intro:(ST.ref.ai?`AI soạn đúng mẫu và thể thức (NĐ 30/2020), lấy thông tin từ hồ sơ các bước trước và hồ sơ đầu vào của bước. Chỗ thiếu thông tin để dạng «[cần bổ sung: …]».`:"AI đang tắt — văn bản tạo từ mẫu soạn sẵn có điền thông tin dự án.")+(form?` Biểu mẫu: ${form.name}${form.legal_number?" ("+form.legal_number+")":""}.`:""),
    values:{item_id:item?.id||"",kind:item?.doc_kind||"cong_van",subject:item?.name||""},
    fields:[{k:"item_id",label:"Gắn vào mục checklist",type:"select",options:[["","— Tạo mục mới khi chốt —"],...soan.map(i=>[i.id,i.name])]},{k:"kind",label:"Loại văn bản",type:"select",options:VBK},
      {k:"subject",label:"Trích yếu",req:1,full:1},{k:"request",label:"Yêu cầu thêm cho người soạn / AI",type:"textarea",ph:"vd: nêu rõ diện tích 2,3 ha, đề nghị giải quyết trước 30/11; kèm theo hồ sơ …"}],
    okLabel:ST.ref.ai?"AI soạn":"Tạo từ mẫu",
    extra:ST.ref.ai?[{label:"Dùng mẫu (không AI)",onClick:async(v,close)=>{await mk(v,false);close()}}]:[],
    onSubmit:v=>mk(v,ST.ref.ai)});
  const sel=$("#fm-item_id");sel&&(sel.onchange=()=>{const it=soan.find(i=>i.id===sel.value);if(it){$("#fm-subject").value=it.name;if(it.doc_kind)$("#fm-kind").value=it.doc_kind}});
  async function mk(v,ai){const sb=$(".ov:last-of-type button[type=submit]");if(ai&&sb)sb.textContent="AI đang soạn… (1–3 phút)";
    const d=await api("POST","/api/docs",{step_id:s.id,item_id:v.item_id||null,kind:v.kind,subject:v.subject,request:v.request,use_ai:ai});dirty("03","04");toast(ai?"AI đã soạn xong — kiểm tra, bổ sung rồi chốt":"Đã tạo văn bản từ mẫu");openDoc(d.id)}
}
const lines=v=>(v||[]).join("\n");
function docEditor(d){
  const ro=d.status==="chot"||!act(...W),last=d.checks.find(c=>c.status!=="dang"),running=d.checks.some(c=>c.status==="dang");
  const sg=(d.signers||[]).concat([{},{}]).slice(0,2);
  const F=(k,label,v,o={})=>`<div class="fld ${o.full?"full":""}"><label for="de-${k}">${label}</label>${o.ta?`<textarea id="de-${k}" ${ro?"disabled":""} style="${o.h?"min-height:"+o.h+"px":""}">${esc(v||"")}</textarea>`:`<input id="de-${k}" value="${esc(v||"")}" ${ro?"disabled":""}>`}</div>`;
  return `<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b style="font-size:16px">${esc(VB.LOAI[d.kind]?.name)}: ${esc(d.subject)}</b>${d.status==="chot"?pill("~g:Đã chốt · trong checklist"):pill("~a:Nháp")}<small class="muted">${esc(d.project_code)} · ${esc(d.step_name)}${d.item_name?" · mục: "+esc(d.item_name):""} · v${d.version} · ${esc(d.author||"")}${d.by_ai?" · AI soạn":""}</small><span style="flex:1"></span>
    <a class="btn sm" href="#" data-go="screen-09-03" data-sel="${d.step_id}">${ico("check")}Hồ sơ của bước</a></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${d.status==="nhap"?`${wbtn("deSave","Lưu",{pri:1})}${wbtn("deRe","AI soạn lại",{icon:"spark",dis:!ST.ref.ai,title:ST.ref.ai?"AI soạn lại theo hồ sơ mới nhất của các bước và tra cứu mẫu, căn cứ pháp lý mới nhất":aiOff()})}${wbtn("deChk",running?"AI đang kiểm tra…":"AI kiểm tra",{icon:"spark",dis:!ST.ref.ai||running,title:aiOff()})}${wbtn("deChot","Chốt văn bản",{icon:"check"})}`:wbtn("deOpen","Mở lại để sửa",{icon:"edit"})}
      <button class="btn sm" type="button" id="deLook" title="Nhờ AI về văn bản này: tìm mẫu, căn cứ, soạn, kiểm tra">${ico("spark")}Nhờ AI</button><button class="btn sm" type="button" id="deWord">${ico("file")}Tải Word</button><button class="btn sm" type="button" id="dePrint">${ico("print")}In</button><span style="flex:1"></span>
      <label class="dekind"><span>Loại văn bản</span><select class="sel" id="de-kind" ${ro?"disabled":""}>${VBK.map(o=>`<option value="${o[0]}" ${o[0]===d.kind?"selected":""}>${esc(o[1])}</option>`).join("")}</select></label>${d.status==="nhap"?wbtn("deDel","Xóa",{cls:"dan"}):""}</div></div>
  ${d.auto&&d.status==="nhap"?banner("b","Hệ thống tự soạn theo mẫu và tự cập nhật khi dữ liệu dự án thay đổi (thông tin chủ đầu tư, số quyết định trong checklist, bảng bồi thường). Khi bạn sửa và lưu, văn bản thôi tự cập nhật."):""}${d.to_check?.length&&d.status==="nhap"?`<div class="banner b-a" style="margin-bottom:12px">${ico("warn")}<span><b>Cần kiểm tra / bổ sung:</b><ul style="margin:4px 0 0;padding-left:18px">${d.to_check.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></span></div>`:""}
  ${running?banner("b","AI đang đối chiếu dự thảo với hồ sơ liên quan…"):last?checkCard(last):""}
  <div class="ed2 solo dewrap"><div class="card" hidden><div class="fgrid">
    ${F("number_text","Số, ký hiệu",d.number_text)}${F("issuer","Cơ quan chủ quản (dòng trên)",d.issuer)}${F("unit","Cơ quan / đơn vị ban hành",d.unit)}${F("place","Địa danh",d.place)}${F("date_text","Ngày tháng",d.date_text)}
    ${F("subject","Trích yếu",d.subject,{full:1})}${F("authority","Thẩm quyền ban hành (quyết định)",d.authority,{full:1})}
    ${F("recipients","Kính gửi (mỗi nơi một dòng)",lines(d.recipients),{ta:1,full:1})}${F("bases","Căn cứ (mỗi dòng một căn cứ)",lines(d.bases),{ta:1,full:1})}
    ${F("body","Nội dung (mỗi đoạn một dòng; quyết định viết «Điều 1. …»)",d.body,{ta:1,full:1,h:340})}
    ${F("receivers","Nơi nhận (mỗi dòng một nơi)",lines(d.receivers),{ta:1,full:1})}
    ${F("s1t","Chức vụ người ký",sg[0].title,{ta:1})}${F("s1n","Họ tên người ký",sg[0].name)}${F("s2t","Người ký thứ 2 (biên bản)",sg[1].title,{ta:1})}${F("s2n","Họ tên người ký thứ 2",sg[1].name)}</div></div>
    <div class="card"><h3>${ro?"Văn bản (A4, thể thức NĐ 30/2020)":`Sửa trực tiếp trên văn bản <small style="color:var(--muted);font-weight:400">· bấm vào chữ để sửa · chỗ <mark class="edhint">tô vàng</mark> là cần bổ sung</small>`}</h3>
    ${ro?"":`<div id="deFill"></div>`}<div class="paper ${ro?"":"edpaper"}" id="dePrev" ${ro?"":'data-edit="1"'}>${VB.render(d,{edit:!ro})}</div>
    ${d.cites?.length?`<div class="cites"><small class="muted">Nguồn AI đã dùng / tra cứu:</small> ${d.cites.map(c=>{const m=/^(.*?)\s*·\s*(https?:\/\/\S+)$/.exec(c);return m?`<a class="cite" href="${esc(m[2])}" target="_blank" rel="noopener">${esc(m[1])}</a>`:`<span class="cite">${esc(c)}</span>`}).join("")}</div>`:""}${d.request?`<details class="muted" style="font-size:12.5px;margin-top:8px"><summary>Yêu cầu khi soạn</summary><p class="pre">${esc(d.request)}</p></details>`:""}</div>
    <aside class="card desrc">${srcPanel(d,ro)}</aside></div>`;
}
// căn cứ soạn thảo: hồ sơ của bước này và các bước trước (nội dung AI đã trích), số văn bản đã có, căn cứ pháp lý của thủ tục — bấm «+ Căn cứ» để đưa vào phần căn cứ
const ngay_=s=>/^\d{4}-\d{2}-\d{2}/.test(s||"")?dmy(s.slice(0,10)):s;
const baseOfFile=x=>`Căn cứ ${[x.loai||"Văn bản",x.so&&"số "+x.so,x.ngay&&"ngày "+ngay_(x.ngay),x.co_quan&&"của "+x.co_quan,x.trich_yeu&&"về "+VB.lc1(String(x.trich_yeu).replace(/^(v\/v|về)\s*/i,""))].filter(Boolean).join(" ")};`;
const baseOfLaw=b=>`Căn cứ ${b.title}${b.so&&!String(b.title).includes(b.so)?" số "+b.so:""};`;
function srcPanel(d,ro){
  const S=d.sources||{files:[],refs:[],basis:[]},add=t=>ro?"":`<button type="button" class="btn sm" data-ins="${esc(t)}" title="${esc(t)}">+ Căn cứ</button>`;
  const fl=f=>`<li><div><a href="/api/file/${f.id}" target="_blank" rel="noopener"><b>${esc(f.name)}</b></a><small>${esc(f.same?f.item:f.step+" · "+f.item)}</small>
    ${f.loai||f.so||f.trich_yeu?`<small class="srcf">${esc([f.loai,f.so&&"số "+f.so,f.ngay&&"ngày "+ngay_(f.ngay),f.co_quan].filter(Boolean).join(" · "))}${f.trich_yeu?` — ${esc(f.trich_yeu)}`:""}</small>`:`<small class="muted">AI chưa đọc nội dung tệp</small>`}</div>${f.so||f.trich_yeu?add(baseOfFile(f)):""}</li>`;
  const same=S.files.filter(f=>f.same),prev=S.files.filter(f=>!f.same);
  return `<h3>Căn cứ soạn thảo</h3><p class="muted" style="font-size:12.5px;margin:0 0 10px">AI lấy thông tin từ các hồ sơ dưới đây khi soạn${ro?"":"; bấm «+ Căn cứ» để đưa vào phần căn cứ của văn bản"}.</p>
    <details class="srcg" open><summary>Hồ sơ của bước này <small>${same.length}</small></summary>${same.length?`<ul class="srcl">${same.map(fl).join("")}</ul>`:`<p class="muted">Chưa có tệp.</p>`}</details>
    <details class="srcg" ${same.length?"":"open"}><summary>Hồ sơ các bước trước <small>${prev.length}</small></summary>${prev.length?`<ul class="srcl">${prev.map(fl).join("")}</ul>`:`<p class="muted">Chưa có tệp.</p>`}</details>
    ${S.refs.length?`<details class="srcg"><summary>Số văn bản đã ghi trong checklist <small>${S.refs.length}</small></summary><ul class="srcl">${S.refs.map(r=>`<li><div><b>${esc(r.ref_text)}</b><small>${esc(r.step)} · ${esc(r.name)}</small></div></li>`).join("")}</ul></details>`:""}
    <details class="srcg" open><summary>Căn cứ pháp lý của thủ tục <small>${S.basis.length}</small></summary>${S.basis.length?`<ul class="srcl">${S.basis.map(b=>`<li><div><b>${esc(b.title)}</b><small>${esc(b.so||"")}${b.dieu?" · "+esc(b.dieu):""}</small>${pill(/HẾT/.test(b.hieu_luc)?"~r:Hết hiệu lực":/chưa có hiệu/.test(b.hieu_luc)?"~a:Chưa có hiệu lực":/còn hiệu lực/.test(b.hieu_luc)?"~g:Còn hiệu lực":"~b:Chưa rõ hiệu lực")}</div>${/HẾT/.test(b.hieu_luc)?"":add(baseOfLaw(b))}</li>`).join("")}</ul>`:`<p class="muted">Thủ tục chưa gắn căn cứ trong danh mục. «AI soạn lại» sẽ tự tra cứu căn cứ mới nhất.</p>`}</details>`;
}
function bindEditor(d){
  const val=()=>({kind:$("#de-kind").value,number_text:$("#de-number_text").value,issuer:$("#de-issuer").value,unit:$("#de-unit").value,place:$("#de-place").value,date_text:$("#de-date_text").value,
    subject:$("#de-subject").value,authority:$("#de-authority").value,recipients:VB.lines($("#de-recipients").value),bases:VB.lines($("#de-bases").value),body:$("#de-body").value,receivers:VB.lines($("#de-receivers").value),
    signers:[{title:$("#de-s1t").value,name:$("#de-s1n").value},{title:$("#de-s2t").value,name:$("#de-s2n").value}].filter(s=>s.title.trim()||s.name.trim())});
  let dirtyEd=false;
  // đã rời màn soạn (vd bấm chuyển trang khi đang sửa) thì thôi vẽ lại
  const EDIT=!!$("#dePrev")?.dataset.edit,prevDraw=()=>{const pv=$("#dePrev");if(!pv||!$("#de-kind"))return;pv.innerHTML=VB.render({...d,...val()},{edit:EDIT})};
  $$("#cv .ed2 input,#cv .ed2 textarea,#de-kind").forEach(el=>el.addEventListener("input",()=>{dirtyEd=true;prevDraw();drawFill()}));
  // sửa trực tiếp trên bản A4: mỗi vùng [data-f] ghi ngược vào ô tương ứng (không vẽ lại bản xem trước để giữ con trỏ)
  if(EDIT){
    const pv=$("#dePrev"),LIST={recipients:1,bases:1,receivers:1,body:1},ML={s1t:1,s2t:1,issuer:1,unit:1,authority:1},UP={subject:1,s1t:1,s2t:1,issuer:1,unit:1,authority:1};
    const clean=x=>x.replace(/ /g," ").replace(/[ \t]+/g," ").trim();
    pv.addEventListener("input",e=>{const el=e.target.closest("[data-f]");if(!el)return;const f=el.dataset.f,inp=$("#de-"+f);if(!inp)return;
      let v;
      if(LIST[f]){const ls=el.children.length&&[...el.children].every(c=>c.tagName!=="BR")?[...el.children].flatMap(c=>c.innerText.split("\n")):el.innerText.split("\n");
        v=ls.map(clean).map(x=>f==="receivers"?x.replace(/^-\s*/,""):f==="recipients"&&!/^Kính gửi/.test(x)?x.replace(/^-\s*/,"").replace(/;$/,""):x).filter(Boolean).join("\n")}
      else v=ML[f]?el.innerText.split("\n").map(clean).filter(Boolean).join("\n"):clean(el.innerText.replace(/\n+/g," "));
      // phần hiển thị IN HOA: nếu chỉ khác hoa/thường thì giữ nguyên chữ gốc
      if(UP[f]&&v.toUpperCase()===inp.value.toUpperCase())return;
      inp.value=v;dirtyEd=true;drawFill()});
    pv.addEventListener("paste",e=>{if(!e.target.closest("[data-f]"))return;e.preventDefault();document.execCommand("insertText",false,(e.clipboardData||window.clipboardData).getData("text/plain"))});
    pv.addEventListener("keydown",e=>{const el=e.target.closest("[data-f]");if(e.key==="Enter"&&el&&!LIST[el.dataset.f]&&!ML[el.dataset.f])e.preventDefault()});
    // rời vùng sửa → vẽ lại cho đúng thể thức (in hoa, dấu câu)
    pv.addEventListener("focusout",()=>setTimeout(()=>{if(!pv.contains(document.activeElement))prevDraw()},0));
  }
  // Thông tin cần bổ sung: mỗi «[cần bổ sung: …]» thành một ô; điền là thay vào mọi chỗ trong văn bản
  const FF=["subject","number_text","place","date_text","unit","authority","recipients","bases","body","receivers","s1t","s1n"].map(k=>$("#de-"+k)).filter(Boolean),RE=/\[[^\]\n]{1,200}\]/g;
  const holes=()=>FF.reduce((a,el)=>a+[...el.value.matchAll(RE)].length,0);
  // dòng đếm chỗ «[cần bổ sung: …]» còn lại (điền hết mới chốt được); bấm → nhảy tới chỗ tô vàng tiếp theo và chọn sẵn để gõ đè
  function drawFill(){const box=$("#deFill");if(!box)return;const n=holes();
    box.className="defill "+(n?"todo":"ok");
    box.innerHTML=n?`${ico("warn")}<span>Còn <b>${n}</b> chỗ tô vàng cần bổ sung — điền xong mới chốt được</span><button type="button" class="lnk" id="deNext">Tới chỗ tiếp theo</button>`:`${ico("check")}<span>Đã đủ thông tin — kiểm tra lại rồi bấm <b>Chốt văn bản</b>, bản PDF tự vào checklist hồ sơ.</span>`;
    const nx=$("#deNext");nx&&(nx.onclick=()=>{const ms=$$("#dePrev mark");if(!ms.length)return;const a=document.activeElement,i=ms.findIndex(m=>a&&a.contains(m)&&getSelection().containsNode(m,true));const m=ms[(i+1)%ms.length];
      m.closest("[data-f]").focus();const r=document.createRange();r.selectNodeContents(m);const s=getSelection();s.removeAllRanges();s.addRange(r);m.scrollIntoView({block:"center",behavior:"smooth"})})}
  drawFill();
  const save=async()=>{const r=await api("PUT","/api/docs/"+d.id,val());dirtyEd=false;return r};
  const cur=()=>({...d,...(d.status==="nhap"?val():{})});
  // lưu sau khi bổ sung: điền đủ chỗ trống thì AI tự kiểm tra lại nội dung với hồ sơ liên quan và quy định hiện hành
  $("#deSave")&&($("#deSave").onclick=e=>busy(e.target,"Đang lưu…",async()=>{try{const changed=dirtyEd;await save();dirty("03");
    if(changed&&ST.ref.ai&&!holes()){await api("POST",`/api/docs/${d.id}/check`);toast("Đã lưu — AI đang kiểm tra lại nội dung vừa bổ sung…");refreshQuiet()}else toast(holes()?`Đã lưu — còn ${holes()} chỗ cần bổ sung`:"Đã lưu")}catch(x){toast(x.message)}}));
  $("#deChk")&&($("#deChk").onclick=e=>busy(e.target,"Đang gửi…",async()=>{try{if(dirtyEd)await save();await api("POST",`/api/docs/${d.id}/check`);toast("AI đang kiểm tra dự thảo với hồ sơ liên quan…");refreshQuiet()}catch(x){toast(x.message)}}));
  $("#deRe")&&($("#deRe").onclick=()=>formModal({title:"AI soạn lại văn bản",intro:"AI soạn lại toàn bộ theo hồ sơ mới nhất của bước này và các bước trước, tra cứu mẫu và căn cứ pháp lý mới nhất trên trang pháp luật chính thống (1–3 phút). Nội dung đang sửa sẽ được thay.",
    fields:[{k:"request",label:"Yêu cầu thêm cho AI (không bắt buộc)",type:"textarea",ph:"vd: nêu rõ diện tích 2,3 ha theo QĐ chủ trương; đề nghị giải quyết trước 30/11; bỏ phần …"}],okLabel:"AI soạn lại",
    onSubmit:async v=>{const sb=$(".ov:last-of-type button[type=submit]");sb&&(sb.textContent="AI đang soạn… (1–3 phút)");await api("POST",`/api/docs/${d.id}/redraft`,{request:v.request});dirtyEd=false;dirty("03");refreshQuiet();toast("AI đã soạn lại — kiểm tra, bổ sung rồi chốt")}}));
  // + Căn cứ: thêm một dòng căn cứ (không trùng) rồi vẽ lại bản A4
  $$("[data-ins]").forEach(b=>b.onclick=()=>{const el=$("#de-bases"),t=b.dataset.ins,L=VB.lines(el.value);if(L.includes(t))return toast("Căn cứ này đã có trong văn bản");
    el.value=[...L,t].join("\n");el.dispatchEvent(new Event("input",{bubbles:true}));toast("Đã thêm vào phần căn cứ — bấm Lưu")});
  // chốt: còn chỗ trống thì không cho; AI chưa kiểm tra bản mới nhất hoặc còn cảnh báo chưa xử lý thì hỏi lại
  $("#deChot")&&($("#deChot").onclick=()=>{
    const n=holes();if(n){toast(`Còn ${n} chỗ tô vàng cần bổ sung trước khi chốt`);$("#deNext")?.click();return}
    const last_=d.checks.find(c=>c.status!=="dang"),stale=!last_||dirtyEd||new Date(last_.created_at)<new Date(d.updated_at)-5e3,W_=last_?.status==="xong"?last_.result?.canh_bao||[]:[];
    const msg=[stale&&ST.ref.ai?"AI chưa kiểm tra bản mới nhất của văn bản này.":"",W_.length?`Lần AI kiểm tra gần nhất còn ${W_.length} cảnh báo chưa xử lý: ${W_.slice(0,3).map(w=>w.noi_dung).join(" | ")}${W_.length>3?" …":""}`:""].filter(Boolean).join(" ");
    confirmBox(msg?"Chốt khi chưa kiểm tra xong?":"Chốt văn bản?",(msg?msg+" ":"")+"Chốt sẽ lưu nội dung, in bản PDF theo thể thức và gắn vào checklist hồ sơ của bước. Sau khi chốt muốn sửa phải mở lại.",msg?"Vẫn chốt":"Chốt",!!msg,async()=>{await save();await api("POST",`/api/docs/${d.id}/chot`);dirty("01","03");refreshQuiet();toast("Đã chốt — bản PDF đã vào checklist hồ sơ")})});
  $("#deOpen")&&($("#deOpen").onclick=()=>confirmBox("Mở lại văn bản?","Bản PDF trong checklist chuyển thành phiên bản cũ; chốt lại sau khi sửa.","Mở lại",false,async()=>{await api("POST",`/api/docs/${d.id}/reopen`);dirty("03");refreshQuiet()}));
  $("#deDel")&&($("#deDel").onclick=()=>confirmBox("Xóa dự thảo?","Không hoàn tác được.","Xóa",true,async()=>{await api("DELETE","/api/docs/"+d.id);ST.sel["screen-09-04"]=null;dirty("03");reload()}));
  $("#deLook").onclick=()=>aiAsk(lookQ(cur().subject,d.step_name,VB.LOAI[cur().kind]?.name));
  $("#deWord").onclick=()=>wordFile(VB.render(cur()),`${VB.LOAI[d.kind].name} - ${String(cur().subject).slice(0,60).replace(/[\\/:*?"<>|]/g,"")}.doc`);
  $("#dePrint").onclick=()=>printDoc(d.id,d.status==="nhap"?val():null);
  if(d.checks.some(c=>c.status==="dang"))pollT=setTimeout(()=>{if(ST.screen==="screen-09-04"&&ST.sel["screen-09-04"]===d.id&&!dirtyEd&&!document.querySelector(".ov"))refreshQuiet()},5000);
}

/* ---------- 09-05 Bồi thường từng hộ ---------- */
VIEW["screen-09-05"]={
  load:()=>curProj()?api("GET","/api/households"+qs({project:curProj()})):Promise.resolve(null),
  actions:d=>d?wbtn("hhImp","Nhập bảng tổng hợp (Excel)",{icon:"upload",pri:!d.rows.length})+(d.rows.length?btn("hhExp","Xuất văn bản từng hộ",{icon:"print",pri:1}):""):"",
  view(d){
    if(!ST.ref.projects.length)return noProject();
    if(!d)return pickProject("làm hồ sơ bồi thường");
    if(!d.rows.length)return emptyState("Chưa có bảng tổng hợp","Nhập bảng tổng hợp phương án bồi thường, hỗ trợ đã được duyệt (Excel .xlsx). Hệ thống tự nhận cột họ tên, thửa, tờ bản đồ, diện tích, các khoản tiền; bạn kiểm tra lại trước khi nhập.",wbtn("hhImp2","Nhập bảng tổng hợp",{icon:"upload",pri:1}));
    const b=ST.chip.hh??0,bs=d.batches,cur=bs[b]||bs[0],rows=d.rows.filter(r=>r.batch===cur&&match("hh",r.ho_ten+" "+(r.ma_ho||"")+" "+(r.thua||""))),iss=d.issues.filter(x=>rows.some(r=>r.id===x.id));
    const sum=k=>rows.reduce((a,r)=>a+Number(r[k]||0),0);
    return `${kpis([["Số hộ",String(rows.length),cur,"b"],["Diện tích thu hồi",VB.so(sum("dt_thu_hoi"))+" m²","tổng đợt","b"],["Tổng kinh phí",ty(sum("tong")),VB.tien(sum("tong"))+" đ","g"],["Cần kiểm tra",String(iss.length),"hộ có số liệu chưa khớp",iss.length?"r":"g"]])}
    ${iss.length?`<div class="banner b-a" style="margin-top:14px">${ico("warn")}<span><b>Số liệu cần kiểm tra trước khi xuất:</b><ul style="margin:4px 0 0;padding-left:18px">${iss.slice(0,12).map(x=>`<li>${esc(x.ho_ten)}: ${esc(x.issues.join("; "))}</li>`).join("")}${iss.length>12?`<li>… và ${iss.length-12} hộ khác</li>`:""}</ul></span></div>`:""}
    <div style="margin-top:14px">${listBar("hh",{filters:bs,placeholder:"Tìm họ tên, mã hộ, số thửa…"})}</div>
    ${table(["STT","Họ và tên","Địa chỉ","Thửa / tờ","Diện tích (m²)","BT đất","BT tài sản","Hỗ trợ","Tổng (đ)"],rows.map(r=>[String(r.stt??""),(d.issues.some(x=>x.id===r.id)?"⚠ ":"")+r.ho_ten,r.dia_chi||"",`${r.thua||"—"} / ${r.to_bd||"—"}`,VB.so(r.dt_thu_hoi),VB.tien(r.tien_dat),VB.tien(r.tien_ts),VB.tien(r.tien_ht),VB.tien(r.tong)]),{rowAttr:i=>`data-ho="${rows[i].id}" tabindex="0"`})}
    ${note(`Bấm một hộ để sửa. Tổng ${bs.length} đợt, ${d.rows.length} hộ, ${VB.tien(d.total)} đồng. Văn bản xuất ra lưu được thẳng vào checklist các bước: ${d.targets.map(t=>esc(t.step)).join(", ")||"(chưa khởi tạo bước PDPA / thu hồi đất / chi trả)"}.`)}`},
  after(d){
    if(!d)return;bindListBar("hh");
    [$("#hhImp"),$("#hhImp2")].forEach(b=>b&&(b.onclick=()=>importHH(d)));
    $("#hhExp")&&($("#hhExp").onclick=()=>exportHH(d));
    $$("[data-ho]").forEach(el=>el.onclick=()=>{const h=d.rows.find(r=>r.id===el.dataset.ho);
      formModal({title:h.ho_ten,values:h,fields:Object.entries({stt:"STT",ma_ho:"Mã hộ",ho_ten:"Họ và tên",cccd:"Số CCCD",dia_chi:"Địa chỉ",thua:"Thửa đất số",to_bd:"Tờ bản đồ số",loai_dat:"Loại đất",dt_thu_hoi:"Diện tích thu hồi (m²)",tien_dat:"Bồi thường đất (đ)",tien_ts:"Bồi thường tài sản, cây cối (đ)",tien_ht:"Hỗ trợ (đ)",tien_khac:"Khác (đ)",tong:"Tổng cộng (đ)"}).map(([k,l])=>({k,label:l,req:k==="ho_ten",full:k==="dia_chi",type:/^(tien|tong)/.test(k)?"money":k==="dt_thu_hoi"?"number":undefined})),
        extra:act(...W)?[{label:"Xóa hộ",cls:"dan",onClick:async(v,close)=>{await api("DELETE","/api/households/"+h.id);close();reload()}}]:[],readOnly:!act(...W),
        onSubmit:async v=>{await api("PUT","/api/households/"+h.id,v);reload()}})});
  }};
async function importHH(d){
  const f=(await pickFiles(false,".xlsx"))[0];if(!f)return;
  let p;try{p=await upload("/api/households/parse",[f])}catch(x){return toast(x.message)}
  let si=p.sheets.findIndex(s=>s.guess.map.ho_ten!=null);if(si<0)si=0;
  panelModal({title:"Nhập bảng tổng hợp phương án bồi thường",intro:`Tệp «${p.file}». Kiểm tra dòng tiêu đề và cột tương ứng; dòng «Tổng cộng» và dòng không có họ tên được bỏ qua.`,wide:960,
    html:`<div class="fgrid"><div class="fld"><label for="hiS">Trang tính</label><select id="hiS">${p.sheets.map((s,i)=>`<option value="${i}" ${i===si?"selected":""}>${esc(s.name)} (${s.rows.length} dòng)</option>`).join("")}</select></div>
      <div class="fld"><label for="hiH">Dòng tiêu đề (số thứ tự dòng)</label><input id="hiH" inputmode="numeric"></div><div class="fld"><label for="hiB">Tên đợt</label><input id="hiB" value="${esc(d.batches?.length?"Đợt "+(d.batches.length+1):"Đợt 1")}" list="hiBl"><datalist id="hiBl">${(d.batches||[]).map(b=>`<option value="${esc(b)}">`).join("")}</datalist></div>
      <div class="fld"><label for="hiR">Nếu đợt đã có</label><select id="hiR"><option value="1">Thay toàn bộ dữ liệu đợt</option><option value="">Thêm vào đợt</option></select></div></div>
      <div id="hiM" class="mgrid" style="margin-top:10px"></div><div id="hiP" style="margin-top:10px"></div>
      <div class="foot" style="margin-top:12px"><span class="muted" id="hiN"></span><span style="flex:1"></span><button class="btn" type="button" data-x>Hủy</button><button class="btn pri" type="button" id="hiOk">Nhập</button></div>`,
    bind(ov,close,err){
      let map={},hr=0;
      const sh=()=>p.sheets[+$("#hiS",ov).value];
      const rowsOf=()=>sh().rows.slice(hr+1).map(r=>{const o={};Object.entries(map).forEach(([k,ci])=>{if(ci!==""&&ci!=null)o[k]=r[ci]});return o}).filter(o=>String(o.ho_ten||"").trim()&&!/^(tổng|cộng)/i.test(String(o.ho_ten).trim()));
      const draw=()=>{const s=sh(),hdr=s.rows[hr]||[];
        $("#hiM",ov).innerHTML=Object.entries(p.fields).map(([k,l])=>`<div class="fld"><span>${esc(l)}${k==="ho_ten"?" *":""}</span><select data-m="${k}"><option value="">— không có —</option>${hdr.map((h,ci)=>`<option value="${ci}" ${String(map[k])===String(ci)?"selected":""}>${esc(String(h||"Cột "+(ci+1)).slice(0,40))}</option>`).join("")}</select></div>`).join("");
        const rs=rowsOf();$("#hiN",ov).textContent=`${rs.length} hộ sẽ được nhập`;
        $("#hiP",ov).innerHTML=rs.length?table(["Họ tên","Thửa/tờ","Diện tích","Tổng"],rs.slice(0,6).map(r=>[String(r.ho_ten),`${r.thua??"—"} / ${r.to_bd??"—"}`,String(r.dt_thu_hoi??""),String(r.tong??"")])):banner("a","Chưa nhận được cột họ tên — chọn đúng dòng tiêu đề và cột «Họ và tên chủ hộ».");
        $$("[data-m]",ov).forEach(x=>x.onchange=()=>{map[x.dataset.m]=x.value;draw()})};
      const pickSheet=()=>{const g=sh().guess;hr=g.header_row;map={...g.map};$("#hiH",ov).value=hr+1;draw()};
      $("#hiS",ov).onchange=pickSheet;$("#hiH",ov).onchange=()=>{hr=Math.max(0,(+$("#hiH",ov).value||1)-1);draw()};pickSheet();
      $("#hiOk",ov).onclick=e=>busy(e.target,"Đang nhập…",async()=>{const rows=rowsOf();if(!rows.length)return err("Không có dòng hợp lệ");
        try{const r=await api("POST","/api/households/import",{project_id:curProj(),batch:$("#hiB",ov).value,rows,replace:!!$("#hiR",ov).value,file:p.file});close();reload();dirty("03");toast(`Đã nhập ${r.imported} hộ`)}catch(x){err(x.message)}});
    }});
}
function exportHH(d){
  const info=d.info,bs=d.batches,cur=bs[ST.chip.hh??0]||bs[0];
  const def={du_an:info.project.name,dia_diem:info.dia_diem,chu_dau_tu:info.cdt,don_vi_chi:info.cdt,dia_chi_dv:info.dia_chi,don_vi_bt:info.don_vi_bt||"[Đơn vị làm nhiệm vụ bồi thường]",
    unit:(info.ubnd||"ỦY BAN NHÂN DÂN [XÃ …]").toUpperCase(),authority:"CHỦ TỊCH "+(info.ubnd||"ỦY BAN NHÂN DÂN [XÃ …]").toUpperCase(),place:info.place,date_text:"",so_mau:"{n}/QĐ-UBND",so_bat_dau:"",
    so_qd_pa:"[số, ngày QĐ phê duyệt phương án tổng hợp]",thi_hanh:"Chánh Văn phòng HĐND và UBND",signer_title:"CHỦ TỊCH",signer_name:"",mau_phieu_chi:"Mẫu số 02-TT",ly_do_chi:"",bases:d.bases.join("\n"),receivers:"Như Điều 3;\nLưu: VT.",...(d.cfg||{})};
  let loai="qd_pa_ho";
  const FL=[["du_an","Tên dự án",1],["dia_diem","Địa điểm dự án",1],["unit","Cơ quan ban hành"],["authority","Thẩm quyền ban hành"],["place","Địa danh"],["date_text","Ngày tháng (để trống = điền tay)"],
    ["so_mau","Mẫu số hiệu ({n} = số)"],["so_bat_dau","Số bắt đầu (để trống = điền tay)"],["so_qd_pa","Số, ngày QĐ phê duyệt PA tổng hợp",1],["don_vi_bt","Đơn vị làm nhiệm vụ BTHT",1],["thi_hanh","Đơn vị thi hành (Điều 3)",1],
    ["signer_title","Chức vụ người ký"],["signer_name","Họ tên người ký"]];
  const FP=[["don_vi_chi","Đơn vị chi",1],["dia_chi_dv","Địa chỉ đơn vị",1],["mau_phieu_chi","Mẫu phiếu chi"],["quyen_so","Quyển số"],["tk_no","Nợ TK"],["tk_co","Có TK"],["ly_do_chi","Lý do chi (để trống = mặc định)",1],["date_text","Ngày tháng"],["so_bat_dau","Số phiếu bắt đầu"]];
  panelModal({title:"Xuất văn bản từng hộ",intro:`Mỗi hộ một trang, lấy số liệu từ bảng tổng hợp ${cur}. Kiểm tra căn cứ pháp lý trước khi in — mẫu dùng chỗ […] cho thông tin cần xác nhận.`,wide:1100,
    html:`<div class="tabs" role="tablist">${Object.entries(d.loai).map(([k,v])=>`<button type="button" role="tab" data-l="${k}" aria-selected="${k===loai}">${esc(v)}</button>`).join("")}</div>
    <div class="ed2"><div><div class="fgrid" id="heF"></div></div><div><div class="paper" id="heP" style="max-height:70vh"></div><small class="muted" id="heN"></small></div></div>
    <div class="foot" style="margin-top:12px"><select id="heB" class="sel">${bs.map(b=>`<option ${b===cur?"selected":""}>${esc(b)}</option>`).join("")}</select><select id="heT" class="sel"></select><span style="flex:1"></span><button class="btn" type="button" data-x>Đóng</button><button class="btn" type="button" id="heW">${ico("file")}Tải Word</button><button class="btn pri" type="button" id="heX">${ico("print")}Xuất PDF</button></div>`,
    bind(ov,close,err){
      const cfg={...def};
      const rowsB=()=>d.rows.filter(r=>r.batch===$("#heB",ov).value);
      const fields=()=>loai==="phieu_chi_ho"?FP:[...FL,["bases","Căn cứ (mỗi dòng một căn cứ)",1,1],["receivers","Nơi nhận",1,1],["body_"+loai,"Nội dung (mẫu; {ho_ten}, {dt_thu_hoi}, {tong}, {tong_chu}…)",1,1]];
      const prev=()=>{const r=rowsB();$("#heP",ov).innerHTML=r.length?VB.hoHtml(loai,r[0],{...cfg,bases:VB.lines(cfg.bases),receivers:VB.lines(cfg.receivers)},0):"";$("#heN",ov).textContent=`Xem trước hộ đầu tiên · ${r.length} hộ trong đợt`};
      const draw=()=>{if(cfg["body_"+loai]==null&&d.mau[loai])cfg["body_"+loai]=d.mau[loai].body;
        $("#heF",ov).innerHTML=fields().map(([k,l,full,ta])=>`<div class="fld ${full?"full":""}"><label for="he-${k}">${esc(l)}</label>${ta?`<textarea id="he-${k}" data-k="${k}" style="min-height:${k.startsWith("body")?260:90}px">${esc(cfg[k]??"")}</textarea>`:`<input id="he-${k}" data-k="${k}" value="${esc(cfg[k]??"")}">`}</div>`).join("");
        $$("[data-k]",ov).forEach(x=>x.oninput=()=>{cfg[x.dataset.k]=x.value;prev()});
        $("#heT",ov).innerHTML=`<option value="">Không lưu vào checklist</option>`+d.targets.filter(t=>t.tag===loai).map(t=>`<option value="${t.item_id}" selected>Lưu vào: ${esc(t.step)} › ${esc(t.item)}</option>`).join("");prev()};
      $$("[data-l]",ov).forEach(b=>b.onclick=()=>{loai=b.dataset.l;$$("[data-l]",ov).forEach(x=>x.setAttribute("aria-selected",x===b));draw()});
      $("#heB",ov).onchange=prev;draw();
      const payload=()=>({...cfg,bases:VB.lines(cfg.bases),receivers:VB.lines(cfg.receivers)});
      $("#heW",ov).onclick=()=>{const r=rowsB(),c=payload();wordFile(r.map((h,i)=>`<div class="pg">${VB.hoHtml(loai,h,c,i)}</div>`).join(""),`${d.loai[loai]} - ${$("#heB",ov).value}.doc`)};
      $("#heX",ov).onclick=e=>busy(e.target,"Đang in PDF…",async()=>{try{await postDownload("/api/households/export",{project_id:curProj(),batch:$("#heB",ov).value,loai,cfg:payload(),save_item:$("#heT",ov).value||null},d.loai[loai]+".pdf");
        toast($("#heT",ov).value?"Đã xuất PDF và lưu vào checklist":"Đã xuất PDF");dirty("03")}catch(x){err(x.message)}});
    }});
}

/* ---------- 09-06 Thư viện checklist mẫu ---------- */
VIEW["screen-09-06"]={
  load:()=>api("GET","/api/tpl"),
  view(d){
    const sel=ST.sel["screen-09-06"]||d[0]?.code,p=d.find(x=>x.code===sel)||d[0],ed=ST.me.is_admin||ST.me.is_legal;
    const grp=[];d.forEach(x=>{let g=grp.find(y=>y[0]===x.phase_code);if(!g)grp.push(g=[x.phase_code,[]]);g[1].push(x)});
    return `<div class="grid side2"><aside class="card tplnav"><input class="search" id="tq" placeholder="Tìm thủ tục…" value="${esc(ST.q.tq||"")}">${grp.map(g=>`<h6>${esc(phaseName(g[0]))}</h6>${g[1].filter(x=>match("tq",x.name+" "+x.code)).map(x=>`<button type="button" data-tp="${x.code}" aria-current="${x.code===p.code}">${esc(x.name)}<small>${x.items.length}</small></button>`).join("")}`).join("")}</aside>
    <div><div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start"><div style="flex:1;min-width:220px"><div class="muted" style="font-size:12px">${esc(p.code)} · ${esc(phaseName(p.phase_code))}</div><h2 style="margin:2px 0 4px;font-size:18px">${esc(p.name)}</h2>${p.basis_text?`<small class="muted">Căn cứ (QLDA): ${esc(p.basis_text)}</small>`:""}</div>
      ${ed?`${btn("tAdd","Thêm mục",{icon:"plus"})}${btn("tAi","AI bổ sung từ văn bản luật",{icon:"spark",dis:!ST.ref.ai,title:aiOff()})}${btn("tApply","Áp dụng vào các dự án",{title:"Thêm mục mẫu còn thiếu vào checklist các bước đang có của thủ tục"})}`:""}</div></div>
      ${["soan","dau_vao","ket_qua"].map(k=>{const L=p.items.filter(i=>i.kind===k);return L.length?`<div class="card" style="margin-top:12px"><h3>${KIND[k]}</h3>${table(["Hồ sơ","Bắt buộc","Căn cứ","Nguồn"],L.map(i=>[i.name+(i.doc_kind?` (${VB.LOAI[i.doc_kind]?.name})`:""),i.required?"~g:Bắt buộc":"~n:Không",i.basis||"",SRC[i.source]||i.source]),{rowAttr:j=>`data-ti="${L[j].id}" tabindex="0"`})}</div>`:""}).join("")||`<div style="margin-top:12px">${emptyState("Chưa có mục mẫu","Thêm mục hoặc cho AI đọc văn bản luật để đề xuất.")}</div>`}
      ${note("Checklist khởi tạo là bộ khởi đầu theo thành phần hồ sơ thông dụng, danh mục hồ sơ bắt buộc và biểu mẫu QLDA — Pháp chế rà soát theo văn bản hiện hành. Sửa mẫu không tự sửa checklist các bước đã tạo; bấm «Áp dụng vào các dự án» để bổ sung mục mới.")}</div></div>`},
  after(d){
    const sel=ST.sel["screen-09-06"]||d[0]?.code,p=d.find(x=>x.code===sel)||d[0];
    const tq=$("#tq");tq&&tq.addEventListener("input",()=>{ST.q.tq=tq.value;const c=tq.selectionStart;render();const n=$("#tq");n.focus();n.setSelectionRange(c,c)});
    $$("[data-tp]").forEach(b=>b.onclick=()=>{ST.sel["screen-09-06"]=b.dataset.tp;render()});
    const edit=i=>formModal({title:i?"Sửa mục mẫu":"Thêm mục mẫu",values:i?{...i,required:i.required?"1":""}:{kind:"dau_vao",required:"1"},
      fields:[{k:"kind",label:"Nhóm",type:"select",options:Object.entries(KIND)},{k:"required",label:"Bắt buộc",type:"select",options:[["1","Bắt buộc"],["","Không bắt buộc"]]},{k:"name",label:"Tên hồ sơ",req:1,full:1},{k:"basis",label:"Căn cứ",full:1},{k:"doc_kind",label:"Loại văn bản (nếu cần soạn)",type:"select",options:[["","—"],...VBK]}],
      extra:i?[{label:"Xóa",cls:"dan",onClick:async(v,close)=>{await api("DELETE","/api/tpl/"+i.id);close();reload()}}]:[],
      onSubmit:async v=>{const b={...v,required:!!v.required,procedure_code:p.code};if(i)await api("PUT","/api/tpl/"+i.id,b);else await api("POST","/api/tpl",b);reload()}});
    const ed=ST.me.is_admin||ST.me.is_legal;
    if(ed)$$("[data-ti]").forEach(el=>el.onclick=()=>edit(p.items.find(i=>i.id===el.dataset.ti)));
    $("#tAdd")&&($("#tAdd").onclick=()=>edit(null));
    $("#tAi")&&($("#tAi").onclick=()=>suggestModal({proc:p.code}));
    $("#tApply")&&($("#tApply").onclick=()=>confirmBox("Áp dụng vào các dự án?",`Thêm mục mẫu còn thiếu vào checklist các bước «${p.name}» đang có ở mọi dự án.`,"Áp dụng",false,async()=>{const r=await api("POST","/api/tpl/apply",{procedure_code:p.code});dirty("03","01");toast(`Đã thêm ${r.added} mục vào ${r.steps} bước`)}));
  }};

/* ---------- thanh trên ---------- */
$("#proj").onchange=e=>{setProj(e.target.value);ST.data={};ST.sel={};render();toast(e.target.value?"Đang xem "+projOf(e.target.value).code:"Đang xem tất cả dự án")};
$("#role").onchange=e=>{ST.role=e.target.value;ST.roleManual=true;render();toast("Đang xem với vai trò "+ROLE[ST.role])};
$("#themeBtn").onclick=()=>{const r=document.documentElement;const dark=r.dataset.theme!=="light";r.dataset.theme=dark?"light":"dark";try{localStorage.setItem("ctg-theme-v2",r.dataset.theme)}catch(e){}};
addEventListener("hashchange",()=>{const [h,sel]=location.hash.slice(1).split("/");if(BY[h]&&(h!==ST.screen||(sel||null)!==(ST.sel[h]||null)))go(h,sel||null)});
boot().then(()=>{if(!ST.me)showLogin()});

/* ---------- Trợ lý AI: hội thoại về pháp lý dự án (đính kèm tệp, chọn hồ sơ trong phần mềm) ---------- */
const AI_ID="screen-09-ai";
BY[AI_ID]={id:AI_ID,name:"Trợ lý AI"};
Object.assign(ICON,{clip:'<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',send:'<path d="M4 12l16-8-6 16-3-7zM11 13l9-9"/>',folder:'<path d="M3 6h7l2 2h9v11H3z"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',stop:'<path d="M7 7h10v10H7z"/>'});
const CH={list:null,cur:null,msgs:[],busy:false,files:[],picks:[],mode:"chuan",draft:"",ctrl:null,hfiles:null};
CH.act="tu";   // chỉ một chế độ: AI tự làm thao tác dữ liệu, không hỏi lại
try{CH.mode=localStorage.getItem("pl-ai-mode")||"chuan";CH.model=localStorage.getItem("pl-ai-model")||""}catch(e){}
// mô hình đang chọn: theo lựa chọn đã lưu nếu còn trong danh sách, không thì mặc định của máy chủ
const chatModel=()=>{const L=ST.ref.chat_models||[];return L.some(m=>m.id===CH.model&&m.ok!==false)?CH.model:(ST.ref.chat_default||L[0]?.id||"")};
const modelName=id=>(ST.ref.chat_models||[]).find(m=>m.id===id)?.name||id||"";
const AI_MODE=[["nhanh","Trả lời nhanh"],["chuan","Tiêu chuẩn"],["ky","Phân tích kỹ"]];
const AI_SUG=[
 ["Báo cáo tình hình pháp lý","Lập báo cáo tình hình pháp lý dự án đến hôm nay: đã xong những bước nào, đang làm gì, chậm ở đâu và nguyên nhân, để báo cáo lãnh đạo."],
 ["Việc phải làm tuần này","Liệt kê việc pháp lý phải làm trong 7 ngày tới, theo từng người phụ trách: hồ sơ nào phải có, hạn nộp, cơ quan nào."],
 ["Hồ sơ còn thiếu","Hồ sơ bắt buộc nào còn thiếu hoặc đã quá hạn? Sắp xếp theo mức độ gấp và gợi ý cách xử lý từng hồ sơ."],
 ["Đọc tài liệu scan / ảnh","Đọc văn bản scan đính kèm: tóm tắt nội dung, số hiệu, ngày ban hành, cho biết thuộc bước nào của dự án và có điểm nào lệch với hồ sơ đã có không."],
 ["Soạn văn bản","Soạn công văn gửi cơ quan đang giải quyết bước chậm nhất, đề nghị đẩy nhanh tiến độ giải quyết hồ sơ của dự án."],
 ["Tra cứu thủ tục","Bước tiếp theo của dự án cần hồ sơ gì, nộp cơ quan nào, thời hạn giải quyết bao lâu và căn cứ pháp lý nào?"],
];
// markdown tối giản: tiêu đề, đậm/nghiêng, mã, danh sách, bảng, trích dẫn
function md(src){
  const inl=s=>esc(s).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g,"$1<i>$2</i>").replace(/(^|\W)_([^_\n]+)_(?!\w)/g,"$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/api\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\[([^\]]+)\]\((#screen-[^)\s]+)\)/g,'<a href="$2" data-hash="$2">$1</a>');
  const L=String(src||"").replace(/\r/g,"").split("\n"),out=[];let i=0;
  const cells=l=>l.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(c=>c.trim());
  while(i<L.length){const l=L[i];
    if(/^```/.test(l)){const b=[];i++;while(i<L.length&&!/^```/.test(L[i]))b.push(L[i++]);i++;out.push(`<pre><code>${esc(b.join("\n"))}</code></pre>`);continue}
    if(/^\s*\|.*\|\s*$/.test(l)&&/^\s*\|?\s*:?-{2,}/.test(L[i+1]||"")){const h=cells(l);i+=2;const rows=[];while(i<L.length&&/^\s*\|.*\|\s*$/.test(L[i]))rows.push(cells(L[i++]));
      out.push(`<div class="mdt"><table><thead><tr>${h.map(c=>`<th>${inl(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${inl(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);continue}
    const hm=/^(#{1,4})\s+(.*)$/.exec(l);if(hm){const n=Math.min(4,hm[1].length+1);out.push(`<h${n}>${inl(hm[2])}</h${n}>`);i++;continue}
    if(/^\s*([-*+]|\d+[.)])\s+/.test(l)){const ord=/^\s*\d/.test(l),it=[];
      while(i<L.length&&/^\s*([-*+]|\d+[.)])\s+/.test(L[i])){const sub=/^\s{2,}/.test(L[i]);it.push(`<li${sub?' class="sub"':""}>${inl(L[i].replace(/^\s*([-*+]|\d+[.)])\s+/,""))}</li>`);i++}
      out.push(ord?`<ol>${it.join("")}</ol>`:`<ul>${it.join("")}</ul>`);continue}
    if(/^>\s?/.test(l)){const b=[];while(i<L.length&&/^>\s?/.test(L[i]))b.push(L[i++].replace(/^>\s?/,""));out.push(`<blockquote>${inl(b.join(" "))}</blockquote>`);continue}
    if(/^\s*(---|\*\*\*)\s*$/.test(l)){out.push("<hr>");i++;continue}
    if(!l.trim()){i++;continue}
    const p=[];while(i<L.length&&L[i].trim()&&!/^(#{1,4}\s|```|\s*([-*+]|\d+[.)])\s|>|\s*\|.*\|\s*$)/.test(L[i]))p.push(L[i++]);
    if(!p.length)p.push(L[i++]);
    out.push(`<p>${p.map(inl).join("<br>")}</p>`)}
  return out.join("");
}
const chatProj=()=>ST.proj||"";
const chatScope=()=>ST.proj?`<b>${esc(projOf(ST.proj)?.code||"")}</b>`:"<b>các dự án</b>";
async function chatLoadList(){try{CH.list=await api("GET","/api/ai-chats")}catch(e){CH.list=CH.list||[];toast(e.message)}}
function renderChat(){
  $("#page").classList.add("chatpage");
  const on=ST.ref.chat_ok??ST.ref.ai,admin=ST.me.is_admin||ST.me.is_legal||ST.me.is_leader;
  $("#page").innerHTML=`<div class="chat">
  <aside class="chl" aria-label="Các cuộc trò chuyện">
    <button class="btn pri chnew" type="button" id="chNew">${ico("plus")}Cuộc trò chuyện mới</button>
    <div class="chlist" id="chList">${CH.list===null?'<div class="sk" style="height:32px"></div>'.repeat(3):!CH.list.length?'<p class="chmut">Chưa có cuộc trò chuyện nào</p>':
      CH.list.map(c=>`<div class="chit ${c.id===CH.cur?"on":""}"><button type="button" data-chat="${c.id}" title="${esc(c.title)}"><span>${esc(c.title)}</span><small>${c.project_code?esc(c.project_code)+" · ":""}${hm(c.updated_at)}</small></button><button type="button" class="chdel" data-del="${c.id}" aria-label="Xóa cuộc trò chuyện «${esc(c.title)}»">${ico("trash")}</button></div>`).join("")}</div>
  </aside>
  <section class="chm" aria-label="Trợ lý AI">
    <div class="chscroll" id="chScroll">${CH.msgs.length?CH.msgs.map(msgHtml).join(""):`
      <div class="chhello"><div class="chlogo">${ico("spark")}</div><h1>Xin chào, ${esc(ST.me.full_name)}</h1><p>Hôm nay bạn cần hỗ trợ gì cho ${chatScope()}?</p>
      <div class="chsug">${AI_SUG.map((s,i)=>`<button type="button" data-sug="${i}"><b>${esc(s[0])}</b><span>${esc(s[1])}</span></button>`).join("")}</div></div>`}</div>
    ${on?"":`<div class="chconn">${ico("spark")}<span><b>Trợ lý AI chưa được kết nối.</b> ${admin?"Dán khóa API Anthropic (sk-ant-…) để bật — chỉ cần làm một lần cho cả hệ thống.":"Nhờ quản trị, lãnh đạo hoặc Pháp chế bấm «Kết nối Trợ lý AI»."}</span>${admin?`<button class="btn pri" type="button" id="chKey2">Kết nối Trợ lý AI</button>`:""}</div>`}
    <form class="chin" id="chForm">
      ${CH.files.length||CH.picks.length?`<div class="chatt">${CH.files.map((f,i)=>`<span class="chf">${ico("clip")}${esc(f.name)} <small>${kb(f.size)}</small><button type="button" data-rmf="${i}" aria-label="Bỏ tệp ${esc(f.name)}">${ico("x")}</button></span>`).join("")}${CH.picks.map((f,i)=>`<span class="chf hs">${ico("folder")}${esc(f.name)}<button type="button" data-rmp="${i}" aria-label="Bỏ hồ sơ ${esc(f.name)}">${ico("x")}</button></span>`).join("")}</div>`:""}
      <label class="skip" for="chTxt">Câu hỏi cho Trợ lý AI</label>
      <textarea id="chTxt" rows="2" placeholder="${on?"Hỏi về tiến độ, hồ sơ, thủ tục… hoặc yêu cầu soạn văn bản (Enter để gửi, Shift+Enter xuống dòng)":"Kết nối Trợ lý AI để bắt đầu"}" ${on?"":"disabled"}>${esc(CH.draft)}</textarea>
      <div class="chbar"><button class="chb" type="button" id="chAtt" ${on?"":"disabled"}>${ico("clip")}Đính kèm</button><button class="chb" type="button" id="chPick" ${on?"":"disabled"}>${ico("folder")}Từ hồ sơ trong phần mềm</button><span style="flex:1"></span>
        ${CH.busy?`<button class="chsend stop" type="button" id="chStop" aria-label="Dừng trả lời">${ico("stop")}</button>`:`<button class="chsend" type="submit" id="chSend" aria-label="Gửi" ${on?"":"disabled"}>${ico("send")}</button>`}</div>
    </form>
    <p class="chfoot"><label for="chMode">Chế độ:</label> <select class="sel" id="chMode">${AI_MODE.map(m=>`<option value="${m[0]}" ${m[0]===CH.mode?"selected":""}>${m[1]}</option>`).join("")}</select>
      · <label for="chModel">Mô hình:</label> <select class="sel" id="chModel">${(ST.ref.chat_models||[]).map(m=>`<option value="${esc(m.id)}" ${m.id===chatModel()?"selected":""} ${m.ok===false?"disabled":""} title="${esc(m.note)}">${esc(m.name)} — ${esc(m.ok===false?"chưa kết nối khóa":m.note)}</option>`).join("")}</select> · AI có thể nhầm — kiểm tra số liệu và văn bản trước khi sử dụng${ST.ref.ai?"":` · ${admin?`<button type="button" class="lnk" id="chKey">${on?"Kết nối Claude":"Kết nối Trợ lý AI"}</button>`:on?"":"Nhờ quản trị kết nối Trợ lý AI"}`}</p>
  </section></div>`;
  bindChat();
  if(CH.list===null)chatLoadList().then(()=>ST.screen===AI_ID&&!CH.busy&&renderChat());
  const sc=$("#chScroll");sc.scrollTop=sc.scrollHeight;
}
function msgHtml(m,i){
  if(m.role==="user")return `<div class="cmu"><div class="bub">${m.files?.length?`<div class="chatt">${m.files.map(f=>`<span class="chf ${f.src==="ho_so"?"hs":""}">${ico(f.src==="ho_so"?"folder":"clip")}${esc(f.name)}</span>`).join("")}</div>`:""}${m.content?`<div>${esc(m.content).replace(/\n/g,"<br>")}</div>`:""}</div></div>`;
  return `<div class="cma" data-mi="${i}"><div class="av">${ico("spark")}</div><div class="cmb">${m.model?`<small class="cmm">${esc(modelName(m.model))}</small>`:""}
    <div class="mdx" ${m.live?'aria-live="polite"':""}>${m.content?md(m.content):m.live?'<span class="typing"><i></i><i></i><i></i></span>':""}</div>
    ${m.confirm?`<div class="aiconf"><b>${ico("warn")}AI muốn thực hiện ${m.confirm.length} thao tác:</b><ul>${m.confirm.map(x=>`<li>${esc(x.label)}</li>`).join("")}</ul><div class="aiconf-b"><button class="btn pri" type="button" data-aiok>${ico("check")}Đồng ý thực hiện</button><button class="btn" type="button" data-aino>Không</button></div></div>`:""}${m.error?`<div class="banner b-r">${ico("warn")}<span>${esc(m.error)}</span></div>`:""}
    ${!m.live&&m.content?`<div class="cmact"><button type="button" class="chb" data-cp="${i}">${ico("copy")}Sao chép</button><button type="button" class="chb" data-word="${i}">${ico("file")}Tải Word</button>${m.error||i===CH.msgs.length-1?`<button type="button" class="chb" data-retry-ai>${ico("refresh")}Hỏi lại</button>`:""}</div>`:m.error?`<div class="cmact"><button type="button" class="chb" data-retry-ai>${ico("refresh")}Hỏi lại</button></div>`:""}
  </div></div>`;
}
function bindChat(){
  const tx=$("#chTxt");
  const grow=()=>{tx.style.height="auto";tx.style.height=Math.min(220,tx.scrollHeight)+"px"};grow();
  tx.addEventListener("input",()=>{CH.draft=tx.value;grow()});
  tx.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();chatSend()}});
  $("#chForm").onsubmit=e=>{e.preventDefault();chatSend()};
  $("#chNew").onclick=()=>{if(CH.busy)return toast("Đang trả lời — bấm dừng trước");CH.cur=null;CH.msgs=[];CH.files=[];CH.picks=[];CH.draft="";renderChat();$("#chTxt").focus()};
  $("#chModel")&&($("#chModel").onchange=e=>{CH.model=e.target.value;try{localStorage.setItem("pl-ai-model",CH.model)}catch(x){}toast("Trợ lý AI dùng "+modelName(CH.model))});
  $("#chMode").onchange=e=>{CH.mode=e.target.value;try{localStorage.setItem("pl-ai-mode",CH.mode)}catch(x){}};
  $("#chAtt").onclick=async()=>{const fs=await pickFiles(true,".pdf,.jpg,.jpeg,.png,.webp,.gif,.docx,.xlsx,.txt,.csv,.md");
    const big=fs.filter(f=>f.size>30e6);if(big.length)toast("Bỏ qua tệp quá 30 MB: "+big.map(f=>f.name).join(", "));
    CH.files=[...CH.files,...fs.filter(f=>f.size<=30e6)].slice(0,10);renderChat();$("#chTxt").focus()};
  $("#chPick").onclick=pickHoSo;
  $("#chStop")&&($("#chStop").onclick=()=>CH.ctrl&&CH.ctrl.abort());
  $("#chKey")&&($("#chKey").onclick=connectAi);$("#chKey2")&&($("#chKey2").onclick=connectAi);
  $$("[data-sug]").forEach(b=>b.onclick=()=>{const s=AI_SUG[+b.dataset.sug];CH.draft=s[1];tx.value=s[1];grow();tx.focus();if(+b.dataset.sug===3&&!CH.files.length&&ST.ref.ai)$("#chAtt").click()});
  $$("[data-rmf]").forEach(b=>b.onclick=()=>{CH.files.splice(+b.dataset.rmf,1);renderChat()});
  $$("[data-rmp]").forEach(b=>b.onclick=()=>{CH.picks.splice(+b.dataset.rmp,1);renderChat()});
  $$("[data-chat]").forEach(b=>b.onclick=()=>openChat(b.dataset.chat));
  $$("[data-del]").forEach(b=>b.onclick=()=>{const c=CH.list.find(x=>x.id===b.dataset.del);confirmBox("Xóa cuộc trò chuyện?",`«${c.title}» và tệp đính kèm tải lên trong cuộc trò chuyện sẽ bị xóa.`,"Xóa",true,async()=>{await api("DELETE","/api/ai-chats/"+c.id);CH.list=CH.list.filter(x=>x.id!==c.id);if(CH.cur===c.id){CH.cur=null;CH.msgs=[]}renderChat()})});
  $$("[data-cp]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(CH.msgs[+b.dataset.cp].content);toast("Đã sao chép")}catch(e){toast("Trình duyệt chặn sao chép")}});
  $$("[data-word]").forEach(b=>b.onclick=()=>{const m=CH.msgs[+b.dataset.word];wordFile(`<div style="font-family:'Times New Roman';font-size:13pt;line-height:1.4">${md(m.content)}</div>`,"Tro ly AI - "+(CH.list?.find(c=>c.id===CH.cur)?.title||"tra loi").replace(/[\\/:*?"<>|]+/g," ").slice(0,60)+".doc")});
  $$("[data-aiok]").forEach(b=>b.onclick=()=>chatConfirm(true));$$("[data-aino]").forEach(b=>b.onclick=()=>chatConfirm(false));
  $$("[data-retry-ai]").forEach(b=>b.onclick=()=>{const u=[...CH.msgs].reverse().find(m=>m.role==="user");if(!u)return;CH.draft=u.content;chatSend()});
}
async function openChat(id){
  if(CH.busy)return toast("Đang trả lời — bấm dừng trước");
  try{const c=await api("GET","/api/ai-chats/"+id);CH.cur=id;CH.msgs=c.msgs;CH.files=[];CH.picks=[];renderChat()}catch(e){toast(e.message)}
}
async function pickHoSo(){
  let list;try{list=await api("GET","/api/ai-files"+qs({project:chatProj()}))}catch(e){return toast(e.message)}
  if(!list.length)return toast("Chưa có tệp hồ sơ nào được tải lên checklist"+(ST.proj?" của dự án này":""));
  const sel=new Set(CH.picks.map(p=>p.id));
  panelModal({title:"Chọn hồ sơ trong phần mềm",wide:760,html:`<p class="chmut" style="margin:0 0 8px">Tệp đã tải lên checklist hồ sơ. Chọn tối đa 10 tệp để AI đọc cùng câu hỏi.</p>
    <input class="search" id="hsQ" placeholder="Tìm theo tên tệp, bước, mục hồ sơ…" style="width:100%;margin-bottom:8px"><div class="hslist" id="hsL"></div>
    <div class="foot" style="margin-top:10px"><span id="hsN" class="chmut"></span><span style="flex:1"></span><button class="btn" type="button" data-x>Hủy</button><button class="btn pri" type="button" id="hsOk">Dùng hồ sơ đã chọn</button></div>`,
    bind:(ov,close)=>{
      const draw=()=>{const qq=fold($("#hsQ",ov).value).trim().split(/\s+/).filter(Boolean);
        const rows=list.filter(f=>{const t=fold(f.name+" "+f.step+" "+f.item+" "+f.project_code);return qq.every(w=>t.includes(w))});
        $("#hsL",ov).innerHTML=rows.length?rows.map(f=>`<label class="hsr"><input type="checkbox" value="${f.id}" ${sel.has(f.id)?"checked":""}><span><b>${esc(f.name)}</b><small>${esc(f.project_code)} · ${esc(f.step)} › ${esc(f.item)} · ${kb(f.size)}</small></span></label>`).join(""):'<p class="chmut">Không có tệp khớp.</p>';
        $("#hsN",ov).textContent=`Đã chọn ${sel.size}/10`;
        $$("#hsL input",ov).forEach(c=>c.onchange=()=>{if(c.checked){if(sel.size>=10){c.checked=false;return toast("Tối đa 10 tệp")}sel.add(c.value)}else sel.delete(c.value);$("#hsN",ov).textContent=`Đã chọn ${sel.size}/10`})};
      $("#hsQ",ov).oninput=draw;draw();
      $("#hsOk",ov).onclick=()=>{CH.picks=list.filter(f=>sel.has(f.id)).map(f=>({id:f.id,name:f.name}));close();renderChat();$("#chTxt").focus()};
    }});
}
function connectAi(){
  formModal({title:"Kết nối Trợ lý AI",intro:"",fields:[{k:"key",label:"Khóa API Anthropic (sk-ant-…)",type:"password",req:1,full:1,ph:"sk-ant-api03-…"}],okLabel:"Kết nối",
    onSubmit:async v=>{const r=await api("POST","/api/ai-key",{key:v.key.trim()});ST.ref.ai=true;fillTop();render();toast("Đã kết nối Trợ lý AI — đang dùng "+modelName(chatModel()))}});
}
async function chatSend(){
  if(CH.busy||!(ST.ref.chat_ok??ST.ref.ai))return;
  const text=(CH.draft||"").trim();if(!text&&!CH.files.length&&!CH.picks.length)return $("#chTxt").focus();
  const fd=new FormData();fd.append("text",text);fd.append("mode",CH.mode);fd.append("model",chatModel());fd.append("act",CH.act);if(CH.cur)fd.append("chat_id",CH.cur);if(chatProj())fd.append("project_id",chatProj());
  fd.append("picks",JSON.stringify(CH.picks.map(p=>p.id)));CH.files.forEach(f=>fd.append("file",f,f.name));
  CH.msgs.push({role:"user",content:text,files:[...CH.files.map(f=>({name:f.name,src:"tai_len"})),...CH.picks.map(f=>({name:f.name,src:"ho_so"}))]});
  const a={role:"assistant",content:"",live:true,model:chatModel()};CH.msgs.push(a);
  const keep={files:CH.files,picks:CH.picks,draft:CH.draft};CH.files=[];CH.picks=[];CH.draft="";
  await chatStream(a,()=>fetch("/api/ai-chat/send",{method:"POST",body:fd,signal:CH.ctrl.signal}),()=>{CH.msgs.splice(-2,2);Object.assign(CH,keep)});
}
// đọc luồng trả lời (SSE) vào bong bóng a: chữ, trạng thái tra cứu / thao tác, thẻ xác nhận, lỗi
async function chatStream(a,req,onPre){
  CH.busy=true;CH.ctrl=new AbortController();a.live=true;a.confirm=null;renderChat();
  const box=()=>$(`[data-mi="${CH.msgs.indexOf(a)}"] .mdx`);let raf=0;
  const paint=()=>{raf=0;const b=box();if(!b||ST.screen!==AI_ID)return;const sc=$("#chScroll"),stick=sc.scrollHeight-sc.scrollTop-sc.clientHeight<80;b.innerHTML=md(a.content)+(a.status?`<div class="cms">🔎 ${esc(a.status.length>120?a.status.slice(0,119)+"…":a.status)}</div>`:a.content?"":'<span class="typing"><i></i><i></i><i></i></span>');if(stick)sc.scrollTop=sc.scrollHeight};
  let acted=false;
  try{
    const r=await req();
    if(!r.ok){const j=await r.json().catch(()=>null);if(r.status===401)showLogin();throw Object.assign(new Error(j?.error||"Lỗi "+r.status),{pre:true})}
    const rd=r.body.getReader(),dec=new TextDecoder();let buf="";
    for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let k;
      while((k=buf.indexOf("\n\n"))>=0){const line=buf.slice(0,k);buf=buf.slice(k+2);if(!line.startsWith("data: "))continue;const ev=JSON.parse(line.slice(6));
        if(ev.t==="meta"){if(!CH.cur){CH.cur=ev.chat_id;(CH.list||(CH.list=[])).unshift({id:ev.chat_id,title:ev.title,updated_at:new Date().toISOString(),project_code:ST.proj?projOf(ST.proj)?.code:null})}}
        else if(ev.t==="d"){a.content+=ev.v;a.status="";if(ev.v.includes("✅"))acted=true;if(!raf)raf=requestAnimationFrame(paint)}
        else if(ev.t==="s"){a.status=ev.v;if(!raf)raf=requestAnimationFrame(paint)}
        else if(ev.t==="confirm")a.confirm=ev.actions
        else if(ev.t==="done"){if(ev.acted)acted=true}
        else if(ev.t==="err")a.error=ev.v}}
  }catch(e){
    if(e.name==="AbortError")a.error=a.content?"Đã dừng trả lời.":"Đã dừng.";
    else if(e.pre){if(onPre)onPre();else a.error=e.message;toast(e.message)}
    else a.error=e.message.includes("fetch")?"Mất kết nối máy chủ.":e.message;
  }
  a.live=false;a.status="";CH.busy=false;CH.ctrl=null;
  // AI đã thay đổi dữ liệu → các màn khác tải lại khi mở
  if(acted){ST.data={};toast("AI đã cập nhật dữ liệu — các màn sẽ hiện số liệu mới")}
  if(CH.list){const c=CH.list.find(x=>x.id===CH.cur);if(c){c.updated_at=new Date().toISOString();CH.list=[c,...CH.list.filter(x=>x!==c)]}}
  if(ST.screen===AI_ID){renderChat();if(!a.error&&!a.confirm)$("#chTxt")?.focus()}
}
// người dùng trả lời thẻ xác nhận thao tác
async function chatConfirm(ok){
  const a=[...CH.msgs].reverse().find(m=>m.role==="assistant");if(!a||CH.busy)return;
  a.content+=ok?"\n\n":"\n\n_(Bạn đã chọn không thực hiện.)_\n\n";a.confirm=null;
  await chatStream(a,()=>fetch("/api/ai-chat/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:CH.cur,ok}),signal:CH.ctrl.signal}));
}
/* ---------- Giải trình quá hạn · đề xuất hạn mới · duyệt gia hạn ----------
   chuyên viên (Người lập / kiểm) giải trình lý do + đề xuất hạn mới cho hồ sơ hoặc cả công việc;
   Người duyệt / lãnh đạo duyệt (có thể chỉnh hạn) hoặc từ chối; duyệt xong hạn hồ sơ, công việc và kế hoạch tự cập nhật */
const extPill=(e,wait)=>e?.status==="cho"?`<span class="pill p-a">⏳ Chờ duyệt gia hạn → ${dm(e.new_due)}</span>`:wait>0?`<span class="pill p-a">⏳ ${wait} đề xuất chờ duyệt</span>`
  :e?.status==="duyet"?`<span class="pill p-g">✓ Đã gia hạn đến ${dmy(e.new_due)}</span>`:e?.status==="tu_choi"?`<span class="pill p-r">✗ Gia hạn bị từ chối</span>`:"";
// danh sách Quá hạn: hồ sơ còn thiếu của từng việc, bấm để giải trình / duyệt
function overItems(s,d){
  const L=(d.items||[]).filter(i=>i.step_id===s.id&&!i.ok&&i.required).sort((a,b)=>(a.due||"9").localeCompare(b.due||"9"));
  return `<li class="odsub"><ul class="odl">${L.map(i=>`<li><button type="button" class="odi ${i.state}" data-ext-step="${s.id}" data-ext-item="${i.id}">
      <span class="odb"><b>${esc(i.name)}</b><small>${esc(dueTxt(i))}</small></span>${extPill(i.ext)}<span class="odgo">Giải trình · đề xuất hạn mới ›</span></button></li>`).join("")}
    <li><button type="button" class="odi step" data-ext-step="${s.id}"><span class="odb"><b>${L.length?"Gia hạn cả công việc":"Công việc chưa gắn hồ sơ — gia hạn cả công việc"}</b><small>hạn hoàn thành hiện tại ${dmy(s.plan_end)}</small></span>${extPill(s.ext)}<span class="odgo">Giải trình · đề xuất hạn mới ›</span></button></li></ul></li>`;
}
function extBanner(d){
  const L=(d.ext?.list||[]).filter(e=>e.status==="cho");if(!L.length)return "";
  return `<div class="banner b-a exban" style="margin-top:14px">${ico("cal")}<span><b>${L.length} đề xuất gia hạn ${d.ext.can_approve?"chờ bạn duyệt":"đang chờ Người duyệt / lãnh đạo duyệt"}:</b><ul class="bl">${L.map(e=>`<li><a href="#" data-ext-step="${e.step_id}" data-ext-item="${e.item_id||""}">${esc(e.item||"Cả công việc: "+e.step)}</a> <small>· ${e.item?esc(e.step)+" · ":""}${dmy(e.old_due)} → <b>${dmy(e.new_due)}</b> · ${esc(e.requester||"")}</small></li>`).join("")}</ul></span></div>`;
}
const EXS={cho:["a","Chờ duyệt"],duyet:["g","Đã duyệt"],tu_choi:["r","Từ chối"]};
// nguyên nhân quá hạn / vướng mắc do người phụ trách ghi (của hồ sơ, hoặc của cả công việc) — hiện trên biểu đồ Tổng quan
function issueBox(x,isStep,can){
  const K=ST.ref.issue_kinds,by=isStep?(x.issue_since?"từ "+dmy(x.issue_since):""):[x.issue_by_name,x.issue_at?hm(x.issue_at):""].filter(Boolean).join(" · ");
  const view=x.issue_kind?`<p class="isv"><span class="pill p-a">${esc(K[x.issue_kind]||x.issue_kind)}</span> ${esc(x.issue_text||"").replace(/\n/g,"<br>")}</p>`:`<p class="muted" style="margin:4px 0 0">Chưa ai ghi lý do quá hạn.</p>`;
  return `<div class="exbox isbox"><div class="exh">${ico("warn")}<b>Nguyên nhân quá hạn · vướng ở đâu</b>${x.issue_kind&&by?`<small>${esc(by)}</small>`:""}</div>
    ${can?`<div class="fgrid"><div class="fld full"><label for="isK">Nguyên nhân</label><select id="isK"><option value="">— Chưa ghi —</option>${Object.entries(K).map(([k,v])=>`<option value="${k}" ${x.issue_kind===k?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
      <div class="fld full"><label for="isT">Vướng ở đâu, tình trạng hiện tại</label><textarea id="isT" placeholder="vd: Hồ sơ đang nằm ở Phòng TN-MT huyện, chờ anh … ký xác nhận; đã gọi đôn đốc ngày …; dự kiến có ngày …">${esc(x.issue_text||"")}</textarea></div></div>
      <div class="foot" style="border:0;padding:0;margin-top:8px"><span style="flex:1"></span><button class="btn pri" type="button" id="isSave">Lưu nguyên nhân</button></div>`:view}</div>`;
}
async function extModal(stepId,itemId,pid0){
  const pid=pid0||curProj();if(!pid)return toast("Chọn dự án trước");
  let E,steps,ck;try{[E,steps,ck]=await Promise.all([api("GET","/api/extensions"+qs({project:pid})),api("GET","/api/steps"+qs({project:pid})),api("GET","/api/checklist"+qs({project:pid}))])}catch(x){return toast(x.message)}
  const s=steps.find(x=>x.id===stepId);if(!s)return toast("Không tìm thấy công việc");
  const it=itemId?ck.items.find(i=>i.id===itemId):null;
  const hist=E.list.filter(e=>e.step_id===stepId&&(itemId?e.item_id===itemId:!e.item_id)),pend=hist.find(e=>e.status==="cho"),lastNo=hist.find(e=>e.status==="tu_choi");
  const due=it?it.due:s.plan_end,t=ST.ref.today,late=due&&due<t?Math.round((new Date(t)-new Date(due))/864e5):0;
  const def=pend?.new_due||(()=>{const x=new Date(t);x.setDate(x.getDate()+7);return x.toISOString().slice(0,10)})();
  const who=`${E.can_request?"chuyên viên":""}${E.can_request&&E.can_approve?" · ":""}${E.can_approve?"người duyệt":""}`||"chỉ xem";
  const html=`<div class="exinfo"><div><small>Công việc</small><b>${s.stt?esc(s.stt)+". ":""}${esc(s.name)}</b></div>${it?`<div><small>Hồ sơ</small><b>${esc(it.name)}</b></div>`:`<div><small>Phạm vi</small><b>Cả công việc (hồ sơ còn thiếu theo hạn cũ cũng được gia hạn)</b></div>`}
      <div><small>Hạn hiện tại</small><b>${dmy(due)}</b>${late?` <span class="pill p-r">⚠ Quá hạn ${late} ngày</span>`:""}</div><div><small>Bạn đang thao tác với vai trò</small><b>${esc(who)}</b></div></div>
    ${issueBox(it||s,!it,E.can_request||E.can_approve)}
    ${pend?`<div class="exbox wait"><div class="exh">⏳ <b>Đề xuất gia hạn đến ${dmy(pend.new_due)}</b><small>${esc(pend.requester||"")} · ${hm(pend.created_at)}</small></div><p><small>Lý do giải trình:</small><br>${esc(pend.reason).replace(/\n/g,"<br>")}</p>
      ${E.can_approve?`<div class="fgrid"><div class="fld"><label for="exNew">Hạn mới được duyệt</label>${dateInput("exNew",pend.new_due,{min:t})}</div>
        <div class="fld full"><label for="exNote">Ý kiến của người duyệt <small class="muted">(bắt buộc khi từ chối)</small></label><textarea id="exNote" placeholder="vd: Đồng ý, yêu cầu hoàn thành chậm nhất ngày … / Không đồng ý vì …"></textarea></div></div>
        <div class="foot" style="border:0;padding:0;margin-top:8px">${pend.requested_by===E.me?`<button class="btn" type="button" id="exWd">Rút đề xuất</button>`:""}<span style="flex:1"></span><button class="btn dan" type="button" id="exNo">Từ chối</button><button class="btn pri" type="button" id="exOk">${ico("check")}Duyệt gia hạn</button></div>`
      :`<p class="muted" style="margin:8px 0 0">Đang chờ Người duyệt / lãnh đạo duyệt. Duyệt xong, hạn mới tự cập nhật vào checklist và kế hoạch.</p>${pend.requested_by===E.me?`<div class="foot" style="border:0;padding:0;margin-top:8px"><span style="flex:1"></span><button class="btn" type="button" id="exWd">Rút đề xuất</button></div>`:""}`}</div>`
    :E.can_request?`${lastNo?`<div class="banner b-r" style="margin-bottom:10px">${ico("warn")}<span><b>Lần đề xuất trước bị từ chối</b> (${esc(lastNo.decider||"")}, ${hm(lastNo.decided_at)}): ${esc(lastNo.decision_note||"")}</span></div>`:""}
      <div class="fgrid"><div class="fld full"><label for="exWhy">Giải trình lý do quá hạn <span class="rq">*</span></label><textarea id="exWhy" placeholder="vd: Chưa đủ hồ sơ do UBND xã chưa ký danh sách chi trả; đã đôn đốc ngày …; dự kiến có trong tuần sau"></textarea></div>
        <div class="fld"><label for="exNew">Đề xuất hạn mới <span class="rq">*</span></label>${dateInput("exNew",def,{min:t})}</div></div>
      <div class="foot" style="border:0;padding:0;margin-top:8px"><span style="flex:1"></span><button class="btn" type="button" data-x>Hủy</button><button class="btn pri" type="button" id="exSend">Gửi đề xuất cho người duyệt</button></div>`
    :`<p class="muted">Chưa có đề xuất gia hạn. Chuyên viên phụ trách (Người lập) giải trình lý do và đề xuất hạn mới; Người duyệt / lãnh đạo duyệt.</p>`}
    ${hist.filter(e=>e!==pend).length?`<h4 class="exhh">Lịch sử gia hạn</h4><ul class="exhist">${hist.filter(e=>e!==pend).map(e=>`<li>${pill(P(EXS[e.status]))} <b>${dmy(e.old_due)} → ${dmy(e.new_due)}</b> <small>· đề xuất: ${esc(e.requester||"")} ${hm(e.created_at)}${e.decider?` · ${e.status==="duyet"?"duyệt":"từ chối"}: ${esc(e.decider)} ${hm(e.decided_at)}`:""}</small><br><small>Lý do: ${esc(e.reason)}${e.decision_note?` · Ý kiến: ${esc(e.decision_note)}`:""}</small></li>`).join("")}</ul>`:""}`;
  panelModal({title:it?"Giải trình quá hạn hồ sơ":"Gia hạn công việc",html,wide:720,bind:(ov,close,err)=>{
    const done=msg=>{close();dirty("00","01","02","03");reload();toast(msg)};
    $("#isSave",ov)&&($("#isSave",ov).onclick=e=>go(e.target,"Đang lưu…",async()=>{const k=$("#isK",ov).value;await api("PUT","/api/issue",{step_id:stepId,item_id:itemId||null,issue_kind:k,issue_text:$("#isT",ov).value});done(k?"Đã lưu nguyên nhân quá hạn":"Đã xóa nguyên nhân")}));
    const go=(b,label,fn)=>busy(b,label,async()=>{try{await fn()}catch(x){err(x.message)}});
    $("#exSend",ov)&&($("#exSend",ov).onclick=e=>go(e.target,"Đang gửi…",async()=>{const why=$("#exWhy",ov).value.trim(),nd=dval($("#exNew",ov));if(!why)throw new Error("Nhập lý do giải trình");if(!nd)throw new Error("Chọn hạn mới");
      await api("POST","/api/extensions",{step_id:stepId,item_id:itemId||null,reason:why,new_due:nd});done("Đã gửi đề xuất gia hạn — chờ người duyệt")}));
    $("#exOk",ov)&&($("#exOk",ov).onclick=e=>go(e.target,"Đang duyệt…",async()=>{const r=await api("POST",`/api/extensions/${pend.id}/decide`,{ok:true,new_due:dval($("#exNew",ov)),note:$("#exNote",ov).value});done(`Đã duyệt — hạn mới ${dmy(dval($("#exNew",ov))||pend.new_due)}, kế hoạch đã cập nhật${r.finish?" (dự kiến xong "+dmy(r.finish)+")":""}`)}));
    $("#exNo",ov)&&($("#exNo",ov).onclick=e=>go(e.target,"Đang gửi…",async()=>{const n=$("#exNote",ov).value.trim();if(!n){$("#exNote",ov).focus();throw new Error("Nhập lý do từ chối")}await api("POST",`/api/extensions/${pend.id}/decide`,{ok:false,note:n});done("Đã từ chối đề xuất gia hạn")}));
    $("#exWd",ov)&&($("#exWd",ov).onclick=e=>go(e.target,"Đang rút…",async()=>{await api("DELETE","/api/extensions/"+pend.id);done("Đã rút đề xuất")}));
  }});
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-ext-step]");if(!b)return;e.preventDefault();e.stopPropagation();extModal(b.dataset.extStep,b.dataset.extItem||null)},true);
/* ---------- ô ngày dd/mm/yyyy (ô date của trình duyệt hiện theo ngôn ngữ máy, có máy ra tháng/ngày → dễ nhập nhầm) ----------
   gõ ngày/tháng/năm hoặc bấm nút lịch; giá trị gửi đi vẫn là YYYY-MM-DD */
function isoDmy(v){return v&&/^\d{4}-\d{2}-\d{2}/.test(v)?`${v.slice(8,10)}/${v.slice(5,7)}/${v.slice(0,4)}`:""}
// "" → "" (để trống); sai → null
function dmyIso(s){s=String(s||"").trim();if(!s)return "";if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(s);if(!m)return null;
  const d=+m[1],mo=+m[2],y=m[3].length===2?2000+ +m[3]:+m[3],dt=new Date(Date.UTC(y,mo-1,d));
  if(dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return null;return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`}
function dval(el){if(!el)return "";const r=dmyIso(el.value);return r===null?el.value:r}
function dateInput(id,v,{dis,min}={}){
  return `<span class="dfield"><input id="${id}" class="dtext" type="text" inputmode="numeric" autocomplete="off" placeholder="ngày/tháng/năm" value="${esc(isoDmy(v))}" ${dis?"disabled":""}>`+
    `<input type="date" class="dpick" tabindex="-1" aria-hidden="true" value="${esc(v||"")}" ${min?`min="${esc(min)}"`:""}>`+
    `<button type="button" class="dbtn" aria-label="Chọn ngày trên lịch" ${dis?"disabled":""}>${ico("cal")}</button></span>`;
}
document.addEventListener("click",e=>{const b=e.target.closest(".dfield .dbtn");if(!b)return;const f=b.closest(".dfield"),p=$(".dpick",f),t=$(".dtext",f);
  const iso=dmyIso(t.value);if(iso)p.value=iso;try{p.showPicker()}catch(x){p.focus();p.click()}});
document.addEventListener("change",e=>{const p=e.target.closest(".dfield .dpick");if(!p)return;const t=$(".dtext",p.closest(".dfield"));t.value=isoDmy(p.value);t.dispatchEvent(new Event("input",{bubbles:true}));t.focus()});
// gõ 12102026 → 12/10/2026; ngày sai thì tô đỏ ô
document.addEventListener("input",e=>{const t=e.target.closest(".dfield .dtext");if(!t)return;
  if(/^\d{8}$/.test(t.value))t.value=`${t.value.slice(0,2)}/${t.value.slice(2,4)}/${t.value.slice(4)}`;
  t.classList.toggle("bad",dmyIso(t.value)===null&&t.value.trim().length>=8)});
document.addEventListener("focusout",e=>{const t=e.target.closest?.(".dfield .dtext");if(!t)return;const r=dmyIso(t.value);if(r)t.value=isoDmy(r);t.classList.toggle("bad",r===null)});

/* ---------- tải hồ sơ (bản scan / PDF) từ máy tính; tệp được chép ra thư mục hồ sơ trên máy (Hồ sơ dự án\<dự án>\<GPMB|DTXD>\<công việc>\<hồ sơ>) ---------- */
const HS_ACCEPT=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp,.heic,application/pdf,image/*";
document.addEventListener("click",async e=>{
  const u=e.target.closest("[data-up]");
  if(u){e.preventDefault();const fs_=await pickFiles(true,HS_ACCEPT);if(!fs_.length)return;
    u.disabled=true;try{await upload(`/api/items/${u.dataset.up}/files`,fs_);dirty("00","01","02","03");toast(`Đã tải lên ${fs_.length} tệp — đã chép vào thư mục hồ sơ trên máy`);refreshQuiet()}catch(x){toast(x.message);u.disabled=false}return}
  const dr=e.target.closest("[data-dir]");
  if(dr){e.preventDefault();try{const r=await api("POST","/api/open-folder",{item_id:dr.dataset.dir||null});toast("Đã mở thư mục: "+r.dir)}catch(x){toast(x.message)}}
});
// ô chọn tệp: liệt kê tệp đã chọn
document.addEventListener("change",e=>{const i=e.target.closest(".fdrop input[type=file]");if(!i)return;const ul=$(".fsel",i.closest(".fdrop"));
  ul.innerHTML=[...i.files].map(f=>`<li>${ico("file")}${esc(f.name)} <small>${kb(f.size)}</small></li>`).join("");i.closest(".fdrop").classList.toggle("has",i.files.length>0)});
/* ---------- chọn công việc theo kế hoạch: bấm để xem danh sách (gom GPMB / DTXD), gõ vài chữ (không cần dấu) là lọc ---------- */
function stepPicker(inp,steps,pre){
  if(!inp||!steps.length)return;
  const box=document.createElement("div");box.className="spk";box.hidden=true;box.setAttribute("role","listbox");box.id="spkList";
  const info=document.createElement("small");info.className="spk-i";
  inp.after(box);box.after(info);inp.closest(".fld")?.classList.add("has-spk");
  inp.setAttribute("autocomplete","off");inp.setAttribute("role","combobox");inp.setAttribute("aria-controls","spkList");inp.setAttribute("aria-expanded","false");
  inp.placeholder="Bấm để chọn, hoặc gõ vài chữ: chi trả, giao đất, PCCC…";
  const top=s=>ckTop(s.sheet||phaseName(s.phase_code)),where=s=>[top(s),ckSub(s.sheet),s.section].filter(Boolean).join(" › ");
  // phần dự án đang xem (GPMB / DTXD) lên trước, còn lại giữ thứ tự kế hoạch
  const order=[...steps].sort((a,b)=>(top(a)===ST.ckPart?0:1)-(top(b)===ST.ckPart?0:1));
  let cur=-1,shown=[];
  const close=()=>{box.hidden=true;cur=-1;inp.setAttribute("aria-expanded","false")};
  const pick=s=>{inp.value=s.name;inp.dataset.sid=s.id;info.className="spk-i ok";info.textContent="✓ Công việc có sẵn: "+where(s);close()};
  const draw=()=>{
    const chosen=inp.dataset.sid&&steps.find(x=>x.id===inp.dataset.sid)?.name===inp.value,words=chosen?[]:fold(inp.value).trim().split(/\s+/).filter(Boolean);
    shown=order.filter(s=>{const t=fold([s.stt,s.name,s.sheet,s.section].join(" "));return words.every(w=>t.includes(w))});
    let last="";
    box.innerHTML=shown.length?shown.map((s,i)=>{const g=top(s),h=g!==last?`<div class="spk-g">${esc(g)}${CK_TOPN[g]?" · "+esc(CK_TOPN[g]):""}</div>`:"";last=g;
      return h+`<div class="spk-o ${i===cur?"on":""} ${s.id===inp.dataset.sid?"sel":""}" role="option" aria-selected="${i===cur}" data-i="${i}"><b>${s.stt?esc(s.stt)+". ":""}${esc(s.name)}</b><small>${esc([ckSub(s.sheet),s.section].filter(Boolean).join(" › "))}</small></div>`}).join("")
      :`<div class="spk-n">Không có công việc nào khớp «${esc(inp.value)}». Giữ tên này thì hệ thống tạo công việc mới.</div>`;
    box.hidden=false;inp.setAttribute("aria-expanded","true")};
  inp.addEventListener("focus",draw);inp.addEventListener("click",draw);
  inp.addEventListener("input",()=>{delete inp.dataset.sid;cur=-1;info.className="spk-i";info.textContent=inp.value.trim()?"Chọn một công việc trong danh sách — không chọn thì tạo công việc mới tên này":"";draw()});
  inp.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();if(box.hidden)draw();cur=e.key==="ArrowDown"?Math.min(cur+1,shown.length-1):Math.max(cur-1,0);draw();box.querySelector(".spk-o.on")?.scrollIntoView({block:"nearest"})}
    else if(e.key==="Enter"&&!box.hidden&&cur>=0){e.preventDefault();pick(shown[cur])}
    else if(e.key==="Escape"&&!box.hidden){e.preventDefault();e.stopPropagation();close()}});
  box.addEventListener("mousedown",e=>{const o=e.target.closest(".spk-o");if(o){e.preventDefault();pick(shown[+o.dataset.i])}});
  inp.addEventListener("blur",()=>setTimeout(close,120));
  const p=pre&&steps.find(x=>x.id===pre.id);if(p){inp.dataset.sid=p.id;info.className="spk-i ok";info.textContent="✓ Công việc có sẵn: "+where(p)}
  // form vừa mở đã đặt con trỏ vào ô này → mở danh sách luôn (khi chưa chọn sẵn công việc)
  if(document.activeElement===inp&&!p)draw();
}
/* ---------- bấm tên hồ sơ → sổ ra xem hồ sơ ngay dưới dòng (PDF / ảnh scan; nhiều tệp thì chuyển tab) ---------- */
function pvHtml(i){
  const L=i.file_list||[],k=Math.min((ST.ckPvSel||{})[i.id]||0,Math.max(L.length-1,0)),f=L[k];
  if(!f)return `<div class="ckpv"><div class="pvempty">${ico("file")}<span>Chưa có tệp cho hồ sơ này.${act(...W)?` Bấm <b>Tải hồ sơ</b> để tải bản scan / PDF lên.`:""}</span>${act(...W)?`<button type="button" class="ckbtn" data-up="${i.id}">${ico("upload")}Tải hồ sơ</button>`:""}</div></div>`;
  const u=fileUrl(f.id),view=/\.pdf$/i.test(f.name)?`<iframe src="${u}#view=FitH" title="${esc(f.name)}" loading="lazy"></iframe>`
    :/\.(jpe?g|png|gif|webp)$/i.test(f.name)?`<img src="${u}" alt="${esc(f.name)}" loading="lazy">`
    :`<p class="pvno">Tệp «${esc(f.name)}» không xem trực tiếp được trên trình duyệt — bấm «Tải về» để mở bằng phần mềm trên máy.</p>`;
  return `<div class="ckpv">${L.length>1?`<div class="pvtabs" role="tablist">${L.map((x,j)=>`<button type="button" role="tab" aria-selected="${j===k}" data-pvf="${i.id}:${j}">${ico("file")}${esc(x.name)}</button>`).join("")}</div>`:""}
    <div class="pvbox">${view}</div>
    <div class="pvbar"><small>${esc(f.name)}</small><span style="flex:1"></span><button type="button" class="ckbtn pri" data-printf="${f.id}" data-fname="${esc(f.name)}" title="In văn bản này — chọn máy in trong hộp thoại">${ico("print")}In</button><a class="ckbtn" href="${u}" target="_blank" rel="noopener">${ico("eye")}Mở tab mới</a><a class="ckbtn" href="${window.__SNAPF?u:`/api/file/${f.id}?dl=1`}" ${window.__SNAPF?`download="${esc(f.name)}"`:""}>${ico("down")}Tải về</a>${act(...W)?`<button type="button" class="ckbtn dan" data-delf="${f.id}" data-fname="${esc(f.name)}">${ico("x")}Xóa tệp</button>`:""}</div></div>`;
}
const ckItem=id=>(ST.data["screen-09-03"]?.ck?.items||[]).find(x=>x.id===id)||(ST.panelItems||[]).find(x=>x.id===id);
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-pv]");
  if(b){e.preventDefault();const id=b.dataset.pv,it=ckItem(id),li=b.closest(".ckr");if(!it||!li)return;
    const set=ST.ckPv||(ST.ckPv=new Set()),old=li.querySelector(".ckpv");
    if(old){old.remove();set.delete(id);b.setAttribute("aria-expanded","false")}else{li.insertAdjacentHTML("beforeend",pvHtml(it));set.add(id);b.setAttribute("aria-expanded","true")}return}
  // bấm chip tên tệp → sổ khung xem (đang mở thì chuyển sang tệp đó)
  const o=e.target.closest("[data-pvo]");
  if(o){e.preventDefault();e.stopImmediatePropagation();const [id,j]=o.dataset.pvo.split(":"),it=ckItem(id),li=o.closest(".ckr");if(!it||!li)return;(ST.ckPvSel||(ST.ckPvSel={}))[id]=+j;
    const old=li.querySelector(".ckpv");if(old)old.outerHTML=pvHtml(it);else{li.insertAdjacentHTML("beforeend",pvHtml(it));(ST.ckPv||(ST.ckPv=new Set())).add(id);li.querySelector("[data-pv]")?.setAttribute("aria-expanded","true")}return}
  const t=e.target.closest("[data-pvf]");
  if(t){const [id,j]=t.dataset.pvf.split(":"),it=ckItem(id),li=t.closest(".ckr");if(!it||!li)return;(ST.ckPvSel||(ST.ckPvSel={}))[id]=+j;li.querySelector(".ckpv").outerHTML=pvHtml(it)}
});
// xóa tệp tải nhầm (xóa cả bản chép trong thư mục hồ sơ trên máy); hồ sơ không còn tệp nào thì trở lại «còn thiếu»
document.addEventListener("click",e=>{const b=e.target.closest("[data-delf]");if(!b)return;e.preventDefault();e.stopPropagation();
  confirmBox("Xóa tệp này?",`«${b.dataset.fname}» sẽ bị xóa khỏi hồ sơ và khỏi thư mục hồ sơ trên máy. Không hoàn tác được.`,"Xóa tệp",true,async()=>{
    await api("DELETE","/api/files/"+b.dataset.delf);for(const k in ST.ckPvSel||{})delete ST.ckPvSel[k];dirty("00","01","02");toast("Đã xóa tệp");await refreshQuiet()})},true);
/* ---------- bấm một bước (Tổng quan, Hôm nay) → sổ ngay nội dung công việc: hồ sơ, tải / xem / xóa tệp;
   quá hạn thì giải trình lý do + đề xuất hạn mới, cấp trên duyệt ngay tại đây, app tự cập nhật hạn và kế hoạch ---------- */
async function stepPanel(id){
  const pid=curProj()||ovProj()?.id;if(!pid)return toast("Chọn dự án trước");
  const content=async()=>{
    const [steps,ck,E]=await Promise.all([api("GET","/api/steps"+qs({project:pid})),api("GET","/api/checklist"+qs({project:pid})),api("GET","/api/extensions"+qs({project:pid}))]);
    const s=steps.find(x=>x.id===id);if(!s)throw new Error("Không tìm thấy công việc");
    const items=ck.items.filter(i=>i.step_id===id);ST.panelItems=items;
    const over=isOver(s),odI=items.filter(i=>!i.ok&&i.state==="qua_han"),pend=E.list.filter(e=>e.step_id===id&&e.status==="cho"),okN=items.filter(i=>i.ok).length;
    const html=`<div class="exinfo"><div><small>Phần dự án</small><b>${esc([s.sheet,s.section].filter(Boolean).join(" › ")||phaseName(s.phase_code))}</b></div>
        <div><small>Tình trạng</small>${pill(P(STEP_ST[s.status]))}${over?` <span class="pill p-r">⚠ Quá hạn ${s.late} ngày</span>`:s.open&&s.late_kind==="cham_ke_hoach"&&s.late>0?` <span class="pill p-a">Chậm ${s.late} ngày so với gốc</span>`:""}</div>
        <div><small>Kế hoạch</small><b>${esc(spanTxt(s))}</b></div><div><small>Hồ sơ</small><b>${okN}/${items.length} đã có</b>${s.owner?` · ${esc(s.owner)}`:""}</div></div>
      ${s.issue_text||s.issue_kind?banner("a","Vướng mắc: "+[ST.ref.issue_kinds?.[s.issue_kind],s.issue_text].filter(Boolean).join(" — ")):""}
      ${over||odI.length?`<div class="spover"><div class="spoh">${ico("warn")}<b>${[over?`Công việc quá hạn ${s.late} ngày`:"",odI.length?`${odI.length} hồ sơ quá hạn`:""].filter(Boolean).join(" · ")}</b></div>
        <p>Bấm vào hồ sơ (hoặc cả công việc) để <b>giải trình lý do và đề xuất hạn mới</b>. Người duyệt / lãnh đạo duyệt thì hạn hồ sơ, công việc và kế hoạch tự cập nhật.</p>
        <ul class="odl">${odI.map(i=>`<li><button type="button" class="odi qua_han" data-ext-step="${id}" data-ext-item="${i.id}"><span class="odb"><b>${esc(i.name)}</b><small>${esc(dueTxt(i))}</small></span>${extPill(i.ext)}<span class="odgo">Giải trình · đề xuất hạn mới ›</span></button></li>`).join("")}
        ${over?`<li><button type="button" class="odi step" data-ext-step="${id}"><span class="odb"><b>Gia hạn cả công việc</b><small>hạn hoàn thành hiện tại ${dmy(s.plan_end)}</small></span>${extPill(s.ext)}<span class="odgo">Giải trình · đề xuất hạn mới ›</span></button></li>`:""}</ul></div>`:""}
      ${pend.length?`<div class="banner b-a" style="margin:10px 0">${ico("cal")}<span><b>${pend.length} đề xuất gia hạn ${E.can_approve?"chờ bạn duyệt":"đang chờ Người duyệt / lãnh đạo duyệt"}:</b> ${pend.map(e=>`<a href="#" data-ext-step="${e.step_id}" data-ext-item="${e.item_id||""}">${esc(e.item||"cả công việc")} → ${dmy(e.new_due)}</a>`).join(" · ")}</span></div>`:""}
      <h4 class="sph4">Hồ sơ của công việc</h4>
      ${items.length?`<ul class="cklist2">${items.map(i=>ckRow(i,false)).join("")}</ul>`:`<p class="muted">Công việc chưa có danh mục hồ sơ.</p>`}
      ${act(...W)?`<button type="button" class="ckadd" data-psupp><span aria-hidden="true">+</span>Lập hồ sơ bổ sung cho công việc này</button>`:""}
      <div class="foot" style="margin-top:12px"><span style="flex:1"></span><button class="btn" type="button" data-x>Đóng</button></div>`;
    return {s,items,html};
  };
  let r;try{r=await content()}catch(x){return toast(x.message)}
  const {ov}=panelModal({title:`${r.s.stt?r.s.stt+". ":""}${r.s.name}`,html:r.html,wide:960,bind:ov=>bindPanel(ov,r)});
  ov.classList.add("stp");
  function bindPanel(ov,r){
    bindTicks(r.items);
    $("[data-psupp]",ov)&&($("[data-psupp]",ov).onclick=e=>suppMenu(e.currentTarget,{id:r.s.id,name:r.s.name}));
  }
  // tick, tải tệp, lập hồ sơ bổ sung, duyệt gia hạn… xong thì nội dung trong khung tự cập nhật
  const onRefresh=async()=>{if(!document.body.contains(ov)){document.removeEventListener("pl:refresh",onRefresh);return}
    try{const n=await content();$(".pmb",ov).innerHTML=n.html;bindPanel(ov,n)}catch(x){}};
  document.addEventListener("pl:refresh",onRefresh);
}

/* ---------- Tra cứu: mở Trợ lý AI với câu hỏi soạn sẵn (Claude Sonnet có tìm kiếm Internet; không có khóa Claude thì Gemini) ---------- */
const lookQ=(name,step,kind)=>`Tra cứu trên Internet mẫu văn bản và căn cứ pháp lý hiện hành cho «${name}»${kind?` (loại: ${kind})`:""}${step?`, thuộc bước «${step}»`:""} của dự án. Cho biết: văn bản quy định mẫu (số hiệu, số mẫu / phụ lục, còn hiệu lực không), nội dung chính phải có, căn cứ pháp lý nên viện dẫn, nơi nhận / cơ quan tiếp nhận, và đường dẫn nguồn.`;
function aiAsk(q){
  const L=ST.ref.chat_models||[],web=L.find(m=>m.id==="claude-sonnet-5-5"&&m.ok!==false)||L.find(m=>m.ok!==false);
  if(!web)return toast("Chưa kết nối Trợ lý AI");
  if(CH.busy)return toast("Trợ lý AI đang trả lời câu khác — đợi xong rồi tra cứu");
  CH.model=web.id;try{localStorage.setItem("pl-ai-model",CH.model)}catch(e){}
  CH.cur=null;CH.msgs=[];CH.files=[];CH.picks=[];CH.draft=q;
  go(AI_ID);setTimeout(()=>chatSend(),50);
}
function lookModal(){
  const Q=[["mau","Mẫu văn bản","Tra cứu mẫu văn bản: "],["can_cu","Căn cứ pháp lý","Tra cứu căn cứ pháp lý, văn bản còn hiệu lực về: "],["thu_tuc","Thủ tục hành chính","Tra cứu thủ tục hành chính (hồ sơ, cơ quan, thời hạn, phí) về: "],["hieu_luc","Hiệu lực văn bản","Kiểm tra hiệu lực (còn / hết / bị sửa đổi, thay thế) của văn bản: "]];
  // «Nhờ AI»: AI làm được mọi việc trong app (tra cứu, soạn, kiểm tra, cập nhật hồ sơ) — gõ yêu cầu tự do, chọn sẵn kiểu nếu muốn
  formModal({title:"Nhờ Trợ lý AI",intro:"AI tra cứu Internet, soạn và kiểm tra văn bản, cập nhật hồ sơ, kế hoạch trong phần mềm. Gõ việc cần làm, AI làm luôn.",
    fields:[{k:"kind",label:"Kiểu việc (không bắt buộc)",type:"select",options:[["","— Tự do —"],...Q.map(x=>[x[0],x[1]])]},{k:"q",label:"Bạn cần AI làm gì?",type:"textarea",req:1,ph:"vd: Soạn tờ trình đề nghị chấp thuận chủ trương đầu tư theo NĐ 192/2025 · Kiểm tra căn cứ của dự thảo giao đất · Đánh dấu đã có phiếu chi bước Chi trả tiền BTHT"}],
    okLabel:"Gửi cho AI",onSubmit:async v=>{const k=Q.find(x=>x[0]===v.kind);setTimeout(()=>aiAsk(k?k[2]+v.q.trim()+". Ghi rõ nguồn (đường dẫn).":v.q.trim()),30)}});
}
// liên kết «mở» trong câu trả lời AI → chuyển tới màn tương ứng (vd dự thảo vừa tạo)
document.addEventListener("click",e=>{const a=e.target.closest("[data-hash]");if(!a)return;e.preventDefault();const [h,sel]=a.dataset.hash.slice(1).split("/");go(h,sel||"")});

/* ---------- Hôm nay: thẻ số liệu bấm được → danh sách việc theo phần dự án (GPMB / DTXD), trình tự kế hoạch ---------- */
const TDF=[["dang","Đang thực hiện"],["cham","Chậm trễ"],["xong","Hoàn thành"],["cuoi","Dự kiến xong"]];
function tdKpis(rows,d){let k=0;return kpis(rows).replace(/<div class="kpi">/g,()=>{const f=TDF[k++]?.[0];return f?`<div class="kpi plkpi" data-tdf="${f}" role="button" tabindex="0" aria-pressed="${ST.tab.tdf===f}" title="Bấm để xem danh sách">`:'<div class="kpi">'})}
function tdList(d){
  const f=ST.tab.tdf;if(!f||!d.all)return "";
  const A=d.all.filter(s=>s.status!=="bo_qua"),fin=A.map(s=>s.plan_end).filter(Boolean).sort().at(-1);
  const L={dang:A.filter(s=>["dang","cho_kq"].includes(s.status)),cham:A.filter(s=>s.open&&s.late>0),xong:A.filter(s=>s.status==="xong"),cuoi:A.filter(s=>s.plan_end&&s.plan_end===fin)}[f]||[];
  const why=s=>s.late_kind==="qua_han_tra"?`Cơ quan quá hạn trả kết quả ${s.late} ngày`:s.late_kind==="cham_ke_hoach"?`Chậm ${s.late} ngày so với kế hoạch gốc`:s.late_kind==="qua_han_ke_hoach"?`Quá ngày hoàn thành ${s.late} ngày`:"";
  const groups=[...new Set(L.map(s=>ckTop(s.sheet||s.phase_name)))].map(k=>({k,L:L.filter(s=>ckTop(s.sheet||s.phase_name)===k).sort((a,b)=>(a.ord??1e9)-(b.ord??1e9))}));
  const row=s=>{const [c,ic]=stIcon(s);return `<li class="plr ${c}" data-step="${s.id}" tabindex="0" role="button"><span class="pli ${c}" aria-hidden="true">${ic}</span>
    <div class="plb"><b>${s.stt?esc(s.stt)+". ":""}${esc(s.name)}</b><small>${esc([ckSub(s.sheet),s.section].filter(Boolean).join(" › "))}${s.sheet||s.section?" · ":""}${esc(spanTxt(s))}${s.req_n?` · hồ sơ ${s.req_ok}/${s.req_n}`:""}${s.owner?" · "+esc(s.owner):""}</small>${f==="cham"?`<small style="color:var(--red)">${esc(why(s))}</small>`:""}${s.issue_text?`<small style="color:var(--orange)">Vướng: ${esc(s.issue_text)}</small>`:""}</div>
    <span class="plst">${pill(P(STEP_ST[s.status]))}</span></li>`};
  return `<div class="card plsec plfil ${f==="cham"?"bad":""}" id="tdList" style="margin-top:14px"><div class="plh"><b>${esc(TDF.find(x=>x[0]===f)[1])}${f==="cuoi"?" · "+dmy(fin):""}</b><small class="muted">${L.length} việc · tính đến ${dmy(d.today)}</small><span style="flex:1"></span><button class="btn sm" type="button" data-tdf="${f}">${ico("x")}Đóng</button></div>
    ${L.length?groups.map(g=>`<h4 class="ckpart" style="margin:12px 0 4px">${esc(g.k)}${CK_TOPN[g.k]?" · "+esc(CK_TOPN[g.k]):""} <small class="muted" style="text-transform:none;letter-spacing:0">${g.L.length} việc</small></h4><ul class="pllist">${g.L.map(row).join("")}</ul>`).join(""):`<p class="muted" style="margin:8px 0 0">Không có việc nào.</p>`}
    <p class="muted" style="margin:10px 2px 0;font-size:12.5px">Bấm một việc để xem hồ sơ, giải trình quá hạn, đề xuất gia hạn.</p></div>`;
}
