'use strict';

/* ---------- 저장소 ---------- */
// 데이터 구조:
// { weights: { "YYYY-MM-DD": { am: 70.1, pm: 70.6 } },
//   workouts: { "YYYY-MM-DD": [ { id, name, sets, reps, kg, min, memo } ] } }
const KEY = 'fitlog.v1';

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') {
      return { weights: d.weights || {}, workouts: d.workouts || {} };
    }
  } catch (e) { /* 저장소 사용 불가 */ }
  return { weights: {}, workouts: {} };
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('저장에 실패했어요'); }
}

/* ---------- 날짜 유틸 ---------- */
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };
const today = () => toKey(new Date());
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function prettyDate(k) {
  const d = fromKey(k);
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
  if (k === today()) return `오늘 · ${base}`;
  if (k === addDays(today(), -1)) return `어제 · ${base}`;
  return `${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '년 ' : ''}${base}`;
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1);

let current = today();
let editingId = null;
let range = 30;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1600);
}

/* ---------- 날짜 이동 ---------- */
function setDate(k) {
  current = k;
  $('datePicker').value = k;
  $('dateLabel').textContent = prettyDate(k);
  resetForm();
  renderToday();
}
$('prevDay').onclick = () => setDate(addDays(current, -1));
$('nextDay').onclick = () => setDate(addDays(current, 1));
$('datePicker').onchange = (e) => e.target.value && setDate(e.target.value);

/* ---------- 체중 ---------- */
function saveWeight(slot, input) {
  const v = parseFloat(input.value);
  const entry = { ...(db.weights[current] || {}) };
  if (input.value.trim() === '' || isNaN(v)) delete entry[slot];
  else if (v <= 0 || v > 500) { toast('체중 값을 확인해주세요'); return; }
  else entry[slot] = Math.round(v * 10) / 10;

  if (entry.am == null && entry.pm == null) delete db.weights[current];
  else db.weights[current] = entry;
  save();
  renderWeightDiff();
  toast(`${slot === 'am' ? '아침' : '저녁'} 체중 저장됨`);
}
for (const [slot, id] of [['am', 'wAm'], ['pm', 'wPm']]) {
  const el = $(id);
  el.addEventListener('change', () => saveWeight(slot, el));
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); });
}

// 직전 기록이 있는 날짜의 체중 찾기
function prevWeight(k, slot) {
  const keys = Object.keys(db.weights).filter((d) => d < k && db.weights[d][slot] != null).sort();
  const last = keys[keys.length - 1];
  return last ? { date: last, v: db.weights[last][slot] } : null;
}

function renderWeightDiff() {
  const w = db.weights[current] || {};
  const parts = [];
  if (w.am != null && w.pm != null) {
    const d = w.pm - w.am;
    parts.push(`하루 변동 ${d >= 0 ? '+' : ''}${fmt(d)}kg`);
  }
  if (w.am != null) {
    const p = prevWeight(current, 'am');
    if (p) {
      const d = w.am - p.v;
      parts.push(`이전 아침 대비 ${d >= 0 ? '+' : ''}${fmt(d)}kg`);
    }
  }
  $('weightDiff').textContent = parts.join(' · ');
}

/* ---------- 운동 ---------- */
function exDetail(e) {
  const p = [];
  if (e.sets) p.push(`${e.sets}세트`);
  if (e.reps) p.push(`${e.reps}회`);
  if (e.kg) p.push(`${e.kg}kg`);
  if (e.min) p.push(`${e.min}분`);
  let s = p.join(' × ').replace(/ × (\d+분)$/, ' · $1');
  if (e.memo) s += (s ? ' · ' : '') + e.memo;
  return s;
}

function renderExercises() {
  const list = db.workouts[current] || [];
  $('exCount').textContent = list.length ? `${list.length}개` : '';
  $('exList').innerHTML = list.map((e) => `
    <li class="ex-item" data-id="${e.id}">
      <div class="ex-main" data-act="edit">
        <div class="ex-name">${esc(e.name)}</div>
        ${exDetail(e) ? `<div class="ex-detail">${esc(exDetail(e))}</div>` : ''}
      </div>
      <button class="del" data-act="del" aria-label="삭제">✕</button>
    </li>`).join('');
}

$('exList').addEventListener('click', (ev) => {
  const li = ev.target.closest('.ex-item');
  const act = ev.target.closest('[data-act]');
  if (!li || !act) return;
  const id = li.dataset.id;
  const list = db.workouts[current] || [];
  const item = list.find((x) => x.id === id);
  if (!item) return;

  if (act.dataset.act === 'del') {
    if (!confirm(`'${item.name}' 기록을 삭제할까요?`)) return;
    db.workouts[current] = list.filter((x) => x.id !== id);
    if (!db.workouts[current].length) delete db.workouts[current];
    save();
    if (editingId === id) resetForm();
    renderExercises();
    toast('삭제됨');
  } else {
    editingId = id;
    $('exName').value = item.name;
    $('exSets').value = item.sets ?? '';
    $('exReps').value = item.reps ?? '';
    $('exKg').value = item.kg ?? '';
    $('exMin').value = item.min ?? '';
    $('exMemo').value = item.memo ?? '';
    $('exSubmit').textContent = '수정 저장';
    $('exCancel').hidden = false;
    $('exName').focus();
  }
});

function num(id) {
  const v = parseFloat($(id).value);
  return isNaN(v) || v <= 0 ? null : v;
}

$('exForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const name = $('exName').value.trim();
  if (!name) return;
  const data = {
    name,
    sets: num('exSets'),
    reps: num('exReps'),
    kg: num('exKg'),
    min: num('exMin'),
    memo: $('exMemo').value.trim(),
  };
  const list = db.workouts[current] || (db.workouts[current] = []);
  if (editingId) {
    const i = list.findIndex((x) => x.id === editingId);
    if (i >= 0) list[i] = { ...list[i], ...data };
    toast('수정됨');
  } else {
    list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
    toast('운동 추가됨');
  }
  save();
  resetForm();
  renderExercises();
  renderNameSuggestions();
});

function resetForm() {
  editingId = null;
  $('exForm').reset();
  $('exSubmit').textContent = '+ 운동 추가';
  $('exCancel').hidden = true;
}
$('exCancel').onclick = resetForm;

// 이전에 입력한 운동 이름 자동완성
function renderNameSuggestions() {
  const counts = {};
  for (const list of Object.values(db.workouts)) for (const e of list) counts[e.name] = (counts[e.name] || 0) + 1;
  $('exNames').innerHTML = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 50)
    .map((n) => `<option value="${esc(n)}"></option>`).join('');
}

function renderToday() {
  const w = db.weights[current] || {};
  $('wAm').value = w.am ?? '';
  $('wPm').value = w.pm ?? '';
  renderWeightDiff();
  renderExercises();
}

/* ---------- 그래프 ---------- */
$('rangeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  range = Number(b.dataset.range);
  for (const x of $('rangeSeg').children) x.classList.toggle('on', x === b);
  renderChart();
});

function renderChart() {
  const end = today();
  const start = addDays(end, -(range - 1));
  const days = [];
  for (let k = start; k <= end; k = addDays(k, 1)) days.push(k);

  const pts = { am: [], pm: [] };
  days.forEach((k, i) => {
    const w = db.weights[k];
    if (!w) return;
    if (w.am != null) pts.am.push([i, w.am]);
    if (w.pm != null) pts.pm.push([i, w.pm]);
  });
  const all = [...pts.am, ...pts.pm].map((p) => p[1]);

  if (!all.length) {
    $('chart').innerHTML = '<div class="empty">이 기간에 체중 기록이 없어요</div>';
    $('stats').innerHTML = '';
  } else {
    const W = 600, H = 320, L = 56, R = 12, T = 14, B = 36;
    let min = Math.min(...all), max = Math.max(...all);
    const padY = Math.max(0.5, (max - min) * 0.15);
    min = Math.floor((min - padY) * 2) / 2;
    max = Math.ceil((max + padY) * 2) / 2;
    const x = (i) => L + (days.length === 1 ? (W - L - R) / 2 : (i / (days.length - 1)) * (W - L - R));
    const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);

    // 가로 눈금
    let grid = '';
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
      const v = min + ((max - min) * s) / steps;
      grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/>`;
      grid += `<text x="${L - 6}" y="${y(v) + 6}" text-anchor="end" font-size="18" fill="var(--muted)">${fmt(v)}</text>`;
    }
    // 날짜 라벨
    const labelEvery = Math.ceil(days.length / 6);
    days.forEach((k, i) => {
      if ((days.length - 1 - i) % labelEvery !== 0) return;
      const d = fromKey(k);
      grid += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="18" fill="var(--muted)">${d.getMonth() + 1}/${d.getDate()}</text>`;
    });

    const r = days.length > 120 ? 2.5 : 4.5;
    const series = (arr, color) => {
      if (!arr.length) return '';
      const path = arr.map((p, j) => `${j ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
      const dots = arr.map((p) => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="${r}" fill="${color}"><title>${days[p[0]]} ${fmt(p[1])}kg</title></circle>`).join('');
      return `<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    };

    $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="체중 변화 그래프">${grid}${series(pts.am, 'var(--am)')}${series(pts.pm, 'var(--pm)')}</svg>`;

    // 통계 (아침 체중 기준, 없으면 저녁)
    const base = pts.am.length >= 1 ? pts.am : pts.pm;
    const first = base[0][1], last = base[base.length - 1][1];
    const diff = last - first;
    const avg = all.reduce((a, b) => a + b, 0) / all.length;
    const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
    $('stats').innerHTML = `
      <div class="stat"><b>${fmt(last)}</b><small>최근 (${base === pts.am ? '아침' : '저녁'})</small></div>
      <div class="stat"><b class="${cls}">${diff >= 0 ? '+' : ''}${fmt(diff)}</b><small>기간 변화</small></div>
      <div class="stat"><b>${fmt(avg)}</b><small>평균</small></div>`;
  }

  // 운동 잔디
  const heatDays = days.slice(-Math.max(range, 28));
  let active = 0, total = 0;
  $('exHeat').innerHTML = heatDays.map((k) => {
    const n = (db.workouts[k] || []).length;
    if (n) { active++; total += n; }
    const lv = n === 0 ? '' : n === 1 ? 'l1' : n <= 3 ? 'l2' : 'l3';
    return `<i class="${lv}" title="${k} · 운동 ${n}개"></i>`;
  }).join('');
  $('exSummary').textContent = `최근 ${heatDays.length}일 중 ${active}일 운동 · 총 ${total}개 종목`;
}

/* ---------- 전체 기록 ---------- */
function renderHistory() {
  const keys = [...new Set([...Object.keys(db.weights), ...Object.keys(db.workouts)])].sort().reverse();
  $('history').innerHTML = keys.map((k) => {
    const w = db.weights[k] || {};
    const ws = [w.am != null ? `☀️${fmt(w.am)}` : '', w.pm != null ? `🌙${fmt(w.pm)}` : ''].filter(Boolean).join(' ');
    const ex = (db.workouts[k] || []).map((e) => e.name + (exDetail(e) ? ` (${exDetail(e)})` : '')).join(', ');
    return `<li data-date="${k}">
      <div class="h-date"><span>${esc(prettyDate(k))}</span><span class="h-w">${ws}</span></div>
      ${ex ? `<div class="h-ex">🏋️ ${esc(ex)}</div>` : ''}
    </li>`;
  }).join('');
}
$('history').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-date]');
  if (!li) return;
  setDate(li.dataset.date);
  showTab('today');
});

/* ---------- 백업 ---------- */
$('exportBtn').onclick = async () => {
  const name = `fitlog-${today()}.json`;
  const text = JSON.stringify(db, null, 2);
  const file = new File([text], name, { type: 'application/json' });
  // 아이폰: 공유 시트 → '파일에 저장'으로 iCloud Drive 등에 보관
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '핏로그 백업' });
      markBackup();
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  markBackup();
};
function markBackup() {
  try { localStorage.setItem(KEY + '.lastBackup', today()); } catch (e) { /* 무시 */ }
  renderLastBackup();
}
function renderLastBackup() {
  let d = null;
  try { d = localStorage.getItem(KEY + '.lastBackup'); } catch (e) { /* 무시 */ }
  $('lastBackup').textContent = d ? `마지막 백업: ${prettyDate(d)}` : '아직 백업한 적이 없어요';
}
$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || typeof d.weights !== 'object' || typeof d.workouts !== 'object') throw new Error();
    if (!confirm('가져온 데이터로 현재 기록을 덮어쓸까요?')) return;
    db = { weights: d.weights || {}, workouts: d.workouts || {} };
    save();
    renderAll();
    toast('가져오기 완료');
  } catch {
    toast('올바른 백업 파일이 아니에요');
  }
};

/* ---------- 탭 ---------- */
function showTab(name) {
  for (const b of document.querySelectorAll('.tabbar button')) b.classList.toggle('on', b.dataset.tab === name);
  for (const s of document.querySelectorAll('.tab')) s.hidden = s.id !== `tab-${name}`;
  if (name === 'chart') renderChart();
  if (name === 'history') { renderHistory(); renderLastBackup(); }
  window.scrollTo(0, 0);
}
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) showTab(b.dataset.tab);
});

function renderAll() {
  setDate(current);
  renderNameSuggestions();
}
renderAll();

/* ---------- 좌우로 밀어서 날짜 이동 ---------- */
(() => {
  const area = $('tab-today');
  let sx = 0, sy = 0, tracking = false;
  area.addEventListener('touchstart', (e) => {
    if (e.target.closest('input, button')) { tracking = false; return; }
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; tracking = true;
  }, { passive: true });
  area.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setDate(addDays(current, dx < 0 ? 1 : -1));
    }
  }, { passive: true });
})();

// 앱을 다시 열었을 때 날짜가 바뀌었으면 오늘로 이동
let openedOn = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (today() !== openedOn) {
    if (current === openedOn) setDate(today());
    openedOn = today();
  }
});

// 저장된 기록이 브라우저 정리 때 지워지지 않도록 영구 저장 요청
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

/* ---------- 오프라인 지원 ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
