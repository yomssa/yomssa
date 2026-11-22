(function(){
  'use strict';
  const DOW = ['일','월','화','수','목','금','토'];
  const WEEK_ORDER = [1,2,3,4,5,6,0];
  const LS = 'ledger-v1';
  const $ = id => document.getElementById(id);
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
  const cls = n => n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero';
  const pad = n => String(n).padStart(2,'0');
  const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function short(n){ const a=Math.abs(n), s=n<0?'−':'';
    if(a>=1e8) return s+(+(a/1e8).toFixed(1))+'억';
    if(a>=1e4) return s+(+(a/1e4).toFixed(a>=1e5?0:1))+'만';
    return s+fmt(a); }

  let today = new Date();
  let viewY = today.getFullYear(), viewM = today.getMonth();
  let kind = 'in';
  let view = 'home';
  let entries = load();
  const open = new Set();

  /* ---------- storage ---------- */
  function clean(x){
    if (!x || typeof x !== 'object') return null;
    const date = String(x.date||''); const amount = Math.round(Number(x.amount));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(amount > 0)) return null;
    return { id: String(x.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,8))),
      date, kind: x.kind === 'out' ? 'out' : 'in', amount, memo: String(x.memo||'').slice(0,200),
      createdAt: String(x.createdAt || new Date().toISOString()) };
  }
  function load(){ try{ return (JSON.parse(localStorage.getItem(LS)||'[]')||[]).map(clean).filter(Boolean); }catch(_){ return []; } }
  function save(){
    try{ localStorage.setItem(LS, JSON.stringify(entries)); return true; }
    catch(_){ status('저장 공간에 쓰지 못했습니다. 개인정보 보호 모드인지 확인하세요.'); return false; }
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});

  /* ---------- UI wiring ---------- */
  function status(t){ $('status').textContent = t || ''; }
  $('fDate').value = ymd(today);
  function setKind(k){ kind = k; $('kIn').setAttribute('aria-pressed', k==='in'); $('kOut').setAttribute('aria-pressed', k==='out'); }
  $('kIn').onclick = () => setKind('in');
  $('kOut').onclick = () => setKind('out');
  $('fAmt').addEventListener('input', e => {
    const raw = e.target.value.replace(/[^\d]/g,'').slice(0,13);
    e.target.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
  });
  $('prev').onclick = () => { viewM--; if(viewM<0){viewM=11;viewY--;} render(); };
  $('next').onclick = () => { viewM++; if(viewM>11){viewM=0;viewY++;} render(); };

  const TITLES = {home:'장부', week:'주별', dow:'요일별', month:'월별', set:'설정'};
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setView(b.dataset.view));
  function setView(v){
    view = v;
    for (const k of Object.keys(TITLES)) $('v-'+k).hidden = k !== v;
    document.querySelectorAll('.tabs button').forEach(b => {
      if (b.dataset.view === v) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    $('title').textContent = TITLES[v];
    window.scrollTo(0,0);
    render();
    try{ sessionStorage.setItem('view', v); }catch(_){}
  }
  try{ const v = sessionStorage.getItem('view'); if (v && TITLES[v]) setView(v); }catch(_){}

  document.querySelectorAll('[data-legend]').forEach(el => el.innerHTML =
    '<span><i style="background:var(--in)"></i>수입</span><span><i style="background:var(--out)"></i>지출</span><span><svg width="12" height="12"><circle cx="6" cy="6" r="4" class="net"></circle></svg>순익</span>');

  // tap on chart → show tip text below chart
  document.addEventListener('click', e => {
    const hit = e.target.closest && e.target.closest('rect.hit');
    if (!hit) return;
    const tip = hit.closest('.chart').querySelector('[data-tip]');
    if (tip) tip.textContent = hit.getAttribute('data-t');
  });

  /* ---------- charts ---------- */
  let W = 720; const H = 220, PL = 50, PR = 10, PT = 12, PB = 26;
  function niceScale(lo, hi){
    if (lo === hi) hi = lo + 1;
    const raw = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1,2,2.5,5,10].map(m=>m*mag).find(s => s >= raw);
    const a = Math.floor(lo/step)*step, b = Math.ceil(hi/step)*step;
    const ticks = []; for (let v=a; v<=b+step/2; v+=step) ticks.push(Math.round(v));
    return {a, b, ticks};
  }
  function frame(lo, hi){
    const s = niceScale(Math.min(0,lo), Math.max(0,hi));
    const y = v => PT + (s.b - v) / (s.b - s.a) * (H - PT - PB);
    let g = '';
    for (const t of s.ticks) g += `<line class="${t===0?'zl':'gl'}" x1="${PL}" x2="${W-PR}" y1="${y(t)}" y2="${y(t)}"></line><text x="${PL-6}" y="${y(t)+4}" text-anchor="end">${short(t)}</text>`;
    return {y, g};
  }
  function fitW(el){ const m = document.querySelector('main'); const w = el.clientWidth || (m ? m.clientWidth - 48 : 720); W = Math.max(300, Math.min(900, Math.round(w))); }
  function clearTips(el){ const t = el.closest('.chart').querySelector('[data-tip]'); if (t) t.textContent = ''; }
  function groupChart(el, labels, ins, outs, tips){
    clearTips(el); fitW(el);
    const nets = ins.map((v,i)=>v-outs[i]);
    const all = ins.concat(outs, nets);
    if (!all.some(v=>v)) { el.innerHTML = '<div class="empty">아직 기록이 없습니다.</div>'; return; }
    const {y, g} = frame(Math.min(...all), Math.max(...all));
    const n = labels.length, slot = (W-PL-PR)/n, bw = Math.min(26, slot*0.32);
    let s = g;
    labels.forEach((lb,i)=>{
      const cx = PL + slot*(i+.5);
      s += `<rect class="b-in" x="${cx-bw-1}" y="${y(ins[i])}" width="${bw}" height="${Math.max(0,y(0)-y(ins[i]))}" rx="2"></rect>`;
      s += `<rect class="b-out" x="${cx+1}" y="${y(outs[i])}" width="${bw}" height="${Math.max(0,y(0)-y(outs[i]))}" rx="2"></rect>`;
      if (ins[i]||outs[i]) s += `<circle class="net" cx="${cx}" cy="${y(nets[i])}" r="4.5"></circle>`;
      s += `<text x="${cx}" y="${H-8}" text-anchor="middle">${esc(lb)}</text>`;
      s += `<rect class="hit" x="${cx-slot/2}" y="${PT}" width="${slot}" height="${H-PT}" data-t="${esc(tips[i])} · 수입 ${fmt(ins[i])} · 지출 ${fmt(outs[i])} · 순익 ${signed(nets[i])}원"></rect>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="수입·지출 비교 그래프">${s}</svg>`;
  }
  function dailyChart(el, nDays, nets, ins, outs){
    clearTips(el); fitW(el);
    if (!ins.some(v=>v) && !outs.some(v=>v)) { el.innerHTML = '<div class="empty">이 달 기록이 없습니다.</div>'; return; }
    const cum = []; nets.reduce((a,v,i)=> (cum[i]=a+v), 0);
    const {y, g} = frame(Math.min(...nets, ...cum), Math.max(...nets, ...cum));
    const slot = (W-PL-PR)/nDays, bw = Math.max(2, slot*0.62);
    const isNow = viewY===today.getFullYear() && viewM===today.getMonth();
    const isFuture = viewY>today.getFullYear() || (viewY===today.getFullYear() && viewM>today.getMonth());
    let lastDay = isNow ? today.getDate() : nDays;
    if (isFuture){ lastDay = 0; for (let i=0;i<nDays;i++) if (ins[i]||outs[i]) lastDay = i+1; }
    let s = g, path = '';
    for (let i=0;i<nDays;i++){
      const cx = PL + slot*(i+.5), v = nets[i];
      if (v) s += `<rect class="${v>0?'b-pos':'b-neg'}" x="${cx-bw/2}" y="${Math.min(y(v),y(0))}" width="${bw}" height="${Math.abs(y(v)-y(0))}" rx="1.5"></rect>`;
      if (i < lastDay) path += (path?'L':'M') + cx.toFixed(1) + ' ' + y(cum[i]).toFixed(1);
      if (i===0 || (i+1)%5===0) s += `<text x="${cx}" y="${H-8}" text-anchor="middle">${i+1}</text>`;
    }
    if (path){ s += `<path class="cum" d="${path}"></path>`;
      const li = lastDay-1; s += `<circle class="dot" cx="${PL + slot*(li+.5)}" cy="${y(cum[li])}" r="4"></circle>`; }
    for (let i=0;i<nDays;i++){
      const cx = PL + slot*(i+.5), w = new Date(viewY,viewM,i+1).getDay();
      s += `<rect class="hit" x="${cx-slot/2}" y="${PT}" width="${slot}" height="${H-PT}" data-t="${viewM+1}/${i+1}(${DOW[w]}) · 순익 ${signed(nets[i])} · 누적 ${signed(cum[i])}원"></rect>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="날짜별 순익과 누적 그래프">${s}</svg>`;
  }

  /* ---------- render ---------- */
  function render(){
    today = new Date();
    $('monthLabel').textContent = viewY + '.' + pad(viewM+1);
    const prefix = viewY + '-' + pad(viewM+1) + '-';
    const nDays = new Date(viewY, viewM+1, 0).getDate();
    const dayIn = Array(nDays).fill(0), dayOut = Array(nDays).fill(0), dayItems = Array.from({length:nDays},()=>[]);
    for (const e of entries){ if (!e.date.startsWith(prefix)) continue;
      const d = +e.date.slice(8)-1; if (d<0||d>=nDays) continue;
      if (e.kind==='out') dayOut[d]+=e.amount; else dayIn[d]+=e.amount; dayItems[d].push(e); }
    const dayNet = dayIn.map((v,i)=>v-dayOut[i]);
    const tin = dayIn.reduce((a,b)=>a+b,0), tout = dayOut.reduce((a,b)=>a+b,0), net = tin-tout;

    const fit = (n, f) => { const t = f(n); return t.length > 10 ? (n>0&&f===signed?'+':'') + short(n) : t; };
    $('sumIn').textContent = fit(tin, fmt); $('sumOut').textContent = fit(tout, fmt);
    const sn = $('sumNet'); sn.textContent = fit(net, signed); sn.className = cls(net);

    // daily
    const rows = []; let cum = 0;
    for (let i=nDays-1, c=dayNet.reduce((a,b)=>a+b,0); i>=0; i--){ /* newest first */
      const k = prefix + pad(i+1);
      if (dayItems[i].length){
        const w = new Date(viewY,viewM,i+1).getDay(), wc = w===0?'sun':w===6?'sat':'';
        rows.push(`<tr class="day" data-d="${k}" tabindex="0">
          <td>${i+1}일<span class="dow ${wc}">${DOW[w]}</span></td>
          <td class="num pos">${dayIn[i]?fmt(dayIn[i]):'·'}</td>
          <td class="num neg">${dayOut[i]?fmt(dayOut[i]):'·'}</td>
          <td class="num ${cls(dayNet[i])}">${signed(dayNet[i])}</td>
          <td class="num ${cls(c)}">${signed(c)}</td></tr>`);
        if (open.has(k)){
          const items = dayItems[i].map(e=>`<div class="item"><span class="num ${e.kind==='out'?'neg':'pos'}">${e.kind==='out'?'−':'+'}${fmt(e.amount)}</span><span class="memo">${esc(e.memo)}</span><button type="button" data-del="${esc(e.id)}">삭제</button></div>`).join('');
          rows.push(`<tr class="detail"><td colspan="5"><div class="items">${items}</div></td></tr>`);
        }
      }
      c -= dayNet[i];
    }
    $('tDaily').innerHTML = rows.length ? rows.join('') :
      `<tr><td colspan="5" class="empty">${viewY}년 ${viewM+1}월 기록이 없습니다.<br>위에서 금액을 넣고 <b>추가</b>를 누르세요.</td></tr>`;
    dailyChart($('cDaily'), nDays, dayNet, dayIn, dayOut);

    // weeks
    const weeks = [];
    for (let i=0;i<nDays;i++){
      const w = new Date(viewY,viewM,i+1).getDay();
      if (i===0 || w===1) weeks.push({from:i+1,to:i+1,in:0,out:0});
      const wk = weeks[weeks.length-1]; wk.to = i+1; wk.in += dayIn[i]; wk.out += dayOut[i];
    }
    const curWeek = (viewY===today.getFullYear()&&viewM===today.getMonth()) ? weeks.findIndex(w=>today.getDate()>=w.from&&today.getDate()<=w.to) : -1;
    cum = 0;
    $('tWeek').innerHTML = weeks.map((w,i)=>{ const n=w.in-w.out; cum+=n;
      return `<tr class="${i===curWeek?'cur':''}"><td>${i+1}주<span class="sub">${viewM+1}/${w.from}~${w.to}</span></td>
      <td class="num pos">${w.in?fmt(w.in):'·'}</td><td class="num neg">${w.out?fmt(w.out):'·'}</td>
      <td class="num ${cls(n)}">${(w.in||w.out)?signed(n):'·'}</td><td class="num ${cls(cum)}">${signed(cum)}</td></tr>`; }).join('');
    $('fWeek').innerHTML = `<tr><td>합계</td><td class="num pos">${fmt(tin)}</td><td class="num neg">${fmt(tout)}</td><td class="num ${cls(net)}">${signed(net)}</td><td></td></tr>`;
    groupChart($('cWeek'), weeks.map((w,i)=>(i+1)+'주'), weeks.map(w=>w.in), weeks.map(w=>w.out),
      weeks.map((w,i)=>`${i+1}주(${viewM+1}/${w.from}~${w.to})`));

    // weekday
    const dw = DOW.map(()=>({in:0,out:0,n:0}));
    for (let i=0;i<nDays;i++){ if(!dayItems[i].length) continue; const w=new Date(viewY,viewM,i+1).getDay(); dw[w].in+=dayIn[i]; dw[w].out+=dayOut[i]; dw[w].n++; }
    $('tDow').innerHTML = WEEK_ORDER.map(w=>{ const x=dw[w], n=x.in-x.out, c=w===0?'sun':w===6?'sat':'';
      return `<tr><td><span class="dow ${c}" style="margin:0;font-size:14px">${DOW[w]}</span>${x.n?`<span class="sub">${x.n}일</span>`:''}</td>
        <td class="num pos">${x.in?fmt(x.in):'·'}</td><td class="num neg">${x.out?fmt(x.out):'·'}</td>
        <td class="num ${cls(n)}">${x.n?signed(n):'·'}</td><td class="num ${cls(n)}">${x.n?signed(n/x.n):'·'}</td></tr>`; }).join('');
    groupChart($('cDow'), WEEK_ORDER.map(w=>DOW[w]), WEEK_ORDER.map(w=>dw[w].in), WEEK_ORDER.map(w=>dw[w].out), WEEK_ORDER.map(w=>DOW[w]+'요일'));

    // months
    $('monthTitle').textContent = viewY + '년 월별 합계';
    const ms = Array.from({length:12},()=>({in:0,out:0}));
    for (const e of entries){ if (!e.date.startsWith(viewY+'-')) continue; const m = +e.date.slice(5,7)-1; if (m<0||m>11) continue; ms[m][e.kind==='out'?'out':'in'] += e.amount; }
    let mc = 0, yin = 0, yout = 0;
    const lastM = viewY===today.getFullYear() ? today.getMonth() : (viewY < today.getFullYear() ? 11 : -1);
    $('tMonth').innerHTML = ms.map((x,m)=>{ const n=x.in-x.out; mc+=n; yin+=x.in; yout+=x.out; const has = x.in||x.out;
      return `<tr class="${m===viewM?'cur':''}"><td>${m+1}월</td>
        <td class="num pos">${x.in?fmt(x.in):'·'}</td><td class="num neg">${x.out?fmt(x.out):'·'}</td>
        <td class="num ${cls(n)}">${has?signed(n):'·'}</td><td class="num ${cls(mc)}">${(has||m<=lastM)?signed(mc):'·'}</td></tr>`; }).join('');
    $('fMonth').innerHTML = `<tr><td>${viewY}년</td><td class="num pos">${fmt(yin)}</td><td class="num neg">${fmt(yout)}</td><td class="num ${cls(yin-yout)}">${signed(yin-yout)}</td><td></td></tr>`;
    groupChart($('cMonth'), ms.map((_,m)=>String(m+1)), ms.map(x=>x.in), ms.map(x=>x.out), ms.map((_,m)=>`${viewY}년 ${m+1}월`));

    $('countInfo').textContent = `저장된 기록 ${entries.length.toLocaleString('ko-KR')}건`;
  }

  /* ---------- actions ---------- */
  function toggle(k){ open.has(k) ? open.delete(k) : open.add(k); render(); }
  $('tDaily').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del){ e.stopPropagation(); remove(del.dataset.del, del); return; }
    const tr = e.target.closest('tr.day'); if (tr) toggle(tr.dataset.d);
  });
  $('tDaily').addEventListener('keydown', e => {
    const tr = e.target.closest('tr.day'); if (tr && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); toggle(tr.dataset.d); }
  });
  function twoStep(btn, label, confirmLabel, fn){
    if (btn.dataset.confirm !== '1'){ btn.dataset.confirm='1'; btn.textContent=confirmLabel;
      setTimeout(()=>{ btn.dataset.confirm=''; btn.textContent=label; },3000); return; }
    fn();
  }
  function remove(id, btn){
    twoStep(btn, '삭제', '정말 삭제', () => { entries = entries.filter(e=>e.id!==id); save(); render(); status('삭제했습니다.'); });
  }
  $('entry').addEventListener('submit', e => {
    e.preventDefault();
    const amount = Number($('fAmt').value.replace(/[^\d]/g,''));
    const date = $('fDate').value;
    if (!date || !amount){ status('날짜와 금액을 입력하세요.'); return; }
    const rec = clean({ date, kind, amount, memo: $('fMemo').value.trim() });
    entries.push(rec);
    if (!save()) { entries.pop(); return; }
    const [y,m] = date.split('-').map(Number); viewY=y; viewM=m-1;
    $('fAmt').value=''; $('fMemo').value=''; $('fAmt').blur();
    status((kind==='in'?'입금 ':'출금 ') + fmt(amount) + '원 추가했습니다.');
    render();
  });

  async function deliver(filename, text, mime){
    const blob = new Blob([text], {type: mime});
    try{
      const file = new File([blob], filename, {type: mime});
      if (navigator.canShare && navigator.canShare({files:[file]})) { await navigator.share({files:[file], title: filename}); return; }
    }catch(err){ if (err && err.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  }
  const stamp = () => ymd(new Date()).replace(/-/g,'');
  $('exportJson').onclick = () => deliver(`순익장부-백업-${stamp()}.json`, JSON.stringify({app:'ledger', version:1, entries}, null, 1), 'application/json');
  $('exportCsv').onclick = () => {
    const sorted = [...entries].sort((a,b)=>a.date.localeCompare(b.date));
    const q = s => '"' + String(s).replace(/"/g,'""') + '"';
    const lines = ['날짜,요일,구분,금액,메모'].concat(sorted.map(e => [e.date, DOW[new Date(e.date+'T00:00:00').getDay()], e.kind==='out'?'출금':'입금', e.kind==='out'?-e.amount:e.amount, q(e.memo)].join(',')));
    deliver(`순익장부-${stamp()}.csv`, '﻿' + lines.join('\n'), 'text/csv');
  };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    try{
      const data = JSON.parse(await f.text());
      const list = (Array.isArray(data) ? data : data.entries || []).map(clean).filter(Boolean);
      const ids = new Set(entries.map(x=>x.id)); let added = 0;
      for (const x of list) if (!ids.has(x.id)) { entries.push(x); ids.add(x.id); added++; }
      save(); render();
      $('countInfo').textContent = `${added}건을 불러왔습니다 (이미 있던 ${list.length-added}건은 건너뜀). 저장된 기록 ${entries.length}건`;
    }catch(_){ $('countInfo').textContent = '백업 파일을 읽지 못했습니다. 이 앱에서 저장한 .json 파일인지 확인하세요.'; }
  };
  $('wipe').onclick = () => twoStep($('wipe'), '모든 기록 삭제', '한 번 더 누르면 전부 삭제', () => {
    entries = []; save(); render(); $('countInfo').textContent = '모든 기록을 삭제했습니다.'; });

  document.addEventListener('visibilitychange', () => { if (!document.hidden){ entries = load(); render(); } });

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(render, 150); });
  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
