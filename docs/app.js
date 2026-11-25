"use strict";
// ───────── 기본 품목 (처음 실행 시 등록) ─────────
const SEED = [
  ["울쎄라팁 주황 (1.0-1.5)", "울쎄라", "개", 1, 300],
  ["울쎄라팁 초록 (7-3.0)", "울쎄라", "개", 1, 198],
  ["울쎄라팁 파랑 (4-4.5)", "울쎄라", "개", 1, 0],
  ["써마지 600샷", "써마지", "개", 0],
  ["써마지 300샷", "써마지", "개", 0],
  ["써마지 아이 450샷", "써마지", "개", 1],
  ["덴서티 클래식", "덴서티", "개", 0],
  ["덴서티 알파", "덴서티", "개", 0],
  ["덴서티 하이", "덴서티", "개", 2],
  ["리쥬란", "리쥬란", "개", 21],
  ["리쥬란 HB", "리쥬란", "개", 4],
  ["리쥬란 i", "리쥬란", "개", 5],
  ["뉴라미스 클래식", "필러", "개", 3],
  ["뉴라미스 딥", "필러", "개", 6],
  ["레스틸렌", "필러", "개", 3],
  ["레스틸렌 키스", "필러", "개", 5],
  ["레스틸렌 리프트", "필러", "개", 2],
  ["쥬비덤 볼루마", "필러", "개", 2],
  ["쥬비덤 볼리프트", "필러", "개", 3],
  ["바이리즌", "필러", "개", 4],
  ["보툴렉스 50", "보톡스", "개", 4],
  ["보툴렉스 100", "보톡스", "개", 0],
  ["보툴렉스 150", "보톡스", "개", 0],
  ["보툴렉스 200", "보톡스", "개", 10],
  ["엘러간 50", "보톡스", "개", 1],
  ["쥬베룩 스킨", "쥬베룩", "개", 6],
  ["쥬베룩 볼륨", "쥬베룩", "개", 7],
  ["줄기세포 30", "줄기세포", "개", 6],
  ["줄기세포 60", "줄기세포", "개", 5],
  ["줄기세포 120", "줄기세포", "개", 2],
  ["줄기세포 240", "줄기세포", "개", 1],
  ["민트 파인 (x4)", "실·보형물", "팩", 24],
  ["엘라텐스 페이스", "실·보형물", "개", 0, null, "모델명 18085"],
  ["엘라텐스 넥", "실·보형물", "개", 3, null, "모델명 17085"],
  ["기증늑", "실·보형물", "개", 1],
  ["메가덤", "실·보형물", "개", 7],
  ["포폴", "약품", "바이알", 33],
  ["미다", "약품", "앰플", 33.6],
  ["케타", "약품", "앰플", 28.6],
];
const UNITS = ["개", "샷", "팩", "바이알", "앰플", "박스", "병", "cc", "ml"];
const KEY = "hospital-inventory-v1";
const CONFIG_KEY = "hospital-inventory-config";
const PENDING_KEY = "hospital-inventory-pending";
const POLL_MS = 30000;

// ───────── 유틸 ─────────
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, "0");
const toDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toDay(new Date());
const fmtQty = (n) => (Math.round(n * 100) / 100).toString();
const num = (s) => { const v = parseFloat(String(s).replace(",", ".")); return isNaN(v) ? null : v; };
const entryId = (itemId, day) => `${itemId}_${day}`;
function korDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  const w = "일월화수목금토"[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${w})`;
}
function shiftDay(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return toDay(new Date(y, m - 1, d + n));
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
}
function lsGet(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function b64enc(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64dec(s) { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))); }
function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  return `${Math.floor(s / 3600)}시간 전`;
}

// ───────── 데이터 ─────────
let config = lsGet(CONFIG_KEY, null);  // { url, key, user }
let pending = lsGet(PENDING_KEY, []);   // 서버에 아직 안 보낸 변경
let db = lsGet(KEY, null);
if (!db || !Array.isArray(db.items)) db = seedDb();

function seedDb() {
  const t = today(), items = [], entries = [];
  SEED.forEach(([name, category, unit, qty, shots, note], i) => {
    const id = "seed-" + i;
    const tracksShots = shots !== undefined && shots !== null;
    items.push({ id, name, category, unit, tracksShots, note: note || "", sortOrder: i });
    entries.push({ id: entryId(id, t), itemId: id, date: t, qty, shots: tracksShots ? shots : null, memo: "초기 재고", seed: true, by: "", updatedAt: Date.now() });
  });
  const d = { items, entries };
  lsSet(KEY, d);
  return d;
}
function saveLocal() {
  if (!lsSet(KEY, db)) toast("저장 공간이 부족해요");
  lsSet(PENDING_KEY, pending);
}

// 변경 하나를 데이터에 적용 (내 변경 + 서버에서 받은 뒤 아직 안 보낸 변경 재적용에 같이 사용)
function applyOp(d, op) {
  if (op.t === "item") {
    const i = d.items.findIndex((x) => x.id === op.v.id);
    if (i >= 0) d.items[i] = { ...op.v }; else d.items.push({ ...op.v });
  } else if (op.t === "delItem") {
    d.items = d.items.filter((x) => x.id !== op.id);
    d.entries = d.entries.filter((x) => x.itemId !== op.id);
  } else if (op.t === "entry") {
    const i = d.entries.findIndex((x) => x.id === op.v.id);
    if (i >= 0) d.entries[i] = { ...op.v }; else d.entries.push({ ...op.v });
  } else if (op.t === "delEntry") {
    d.entries = d.entries.filter((x) => x.id !== op.id);
  }
}
function commit(op) {
  applyOp(db, op);
  if (config) {
    const k = op.t === "item" || op.t === "delItem" ? "i:" + (op.id || op.v.id) : "e:" + (op.id || op.v.id);
    pending = pending.filter((p) => p.k !== k);
    pending.push({ k, op, n: uid() });
  }
  saveLocal();
  scheduleFlush();
}
const putItem = (v) => commit({ t: "item", v });
const putEntry = (v) => commit({ t: "entry", v });
const delItem = (id) => commit({ t: "delItem", id });
const delEntry = (id) => commit({ t: "delEntry", id });

const sorted = () => [...db.items].sort((a, b) => a.sortOrder - b.sortOrder);
function categories() {
  const seen = new Set(), out = [];
  for (const it of sorted()) if (!seen.has(it.category)) { seen.add(it.category); out.push(it.category); }
  return out;
}
const itemById = (id) => db.items.find((i) => i.id === id);
function stockOn(itemId, day) {
  let best = null;
  for (const e of db.entries) if (e.itemId === itemId && e.date <= day && (!best || e.date > best.date)) best = e;
  return best;
}
const entryOn = (itemId, day) => db.entries.find((e) => e.itemId === itemId && e.date === day) || null;
function prevStock(itemId, day) {
  let best = null;
  for (const e of db.entries) if (e.itemId === itemId && e.date < day && (!best || e.date > best.date)) best = e;
  return best;
}
function setStock(itemId, day, qty, shots, memo) {
  const e = entryOn(itemId, day);
  putEntry({ id: e ? e.id : entryId(itemId, day), itemId, date: day, qty, shots, memo,
    by: config ? config.user : "", updatedAt: Date.now() });
}
function nextSortOrder(category, exceptId) {
  const inCat = db.items.filter((i) => i.category === category && i.id !== exceptId).map((i) => i.sortOrder);
  const order = inCat.length ? Math.max(...inCat) + 1 : Math.max(-1, ...db.items.map((i) => i.sortOrder)) + 1;
  db.items.forEach((i) => { if (i.sortOrder >= order && i.id !== exceptId) putItem({ ...i, sortOrder: i.sortOrder + 1 }); });
  return order;
}

// ───────── 공유 서버 동기화 ─────────
let syncing = false, lastSync = 0, syncError = "", flushTimer = null;

async function callServer(ops, cfg = config) {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // 구글 스크립트 CORS 우회용
    body: JSON.stringify({ key: cfg.key, user: cfg.user, ops }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "서버 오류");
  return data;
}
function scheduleFlush() {
  if (!config) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(sync, 700);
  renderStatus();
}
async function sync() {
  if (!config || syncing) return;
  syncing = true; renderStatus();
  const sending = pending.slice();
  try {
    const data = await callServer(sending.map((p) => p.op));
    const sentIds = new Set(sending.map((p) => p.n));
    pending = pending.filter((p) => !sentIds.has(p.n));
    db = { items: data.items, entries: data.entries };
    pending.forEach((p) => applyOp(db, p.op));
    saveLocal();
    lastSync = Date.now(); syncError = "";
  } catch (e) {
    syncError = (navigator.onLine === false || e instanceof TypeError) ? "인터넷 연결 안 됨" : (e.message || "연결 실패");
  }
  syncing = false;
  if (!$("#sheet").classList.contains("open")) render(); else renderStatus();
  if (pending.length && !syncError) scheduleFlush();
}
setInterval(() => { if (config && !document.hidden) sync(); }, POLL_MS);
window.addEventListener("online", () => sync());

function renderStatus() {
  const el = $("#sync");
  if (!config) {
    el.innerHTML = `<span class="sdot off"></span>이 폰에만 저장 중 · <u>직원과 공유하기</u>`;
    el.onclick = openShareSetup;
    return;
  }
  let text, cls;
  if (syncing) { text = "동기화 중…"; cls = "busy"; }
  else if (syncError) { text = `${syncError} — 변경 ${pending.length}건 대기 · 다시 시도`; cls = "err"; }
  else if (pending.length) { text = `저장 대기 ${pending.length}건`; cls = "busy"; }
  else { text = `공유 중 · ${esc(config.user)} · ${timeAgo(lastSync)} 동기화`; cls = "ok"; }
  el.innerHTML = `<span class="sdot ${cls}"></span>${text}`;
  el.onclick = () => sync();
}

// ───────── 상태 ─────────
let day = today();
let search = "";
let tab = "stock";

// ───────── 재고 목록 ─────────
function renderList() {
  $("#date").value = day;
  const isToday = day === today();
  $("#today").style.display = isToday ? "none" : "";
  $("#date-hint").textContent = isToday ? "오늘 재고" : `${korDay(day)} 기준 재고`;
  const q = search.trim().toLowerCase();
  let html = "";
  for (const cat of categories()) {
    const rows = sorted().filter((i) => i.category === cat &&
      (!q || (i.name + " " + i.category + " " + i.note).toLowerCase().includes(q)));
    if (!rows.length) continue;
    html += `<div class="group-title">${esc(cat)}</div><div class="card">`;
    for (const it of rows) {
      const s = stockOn(it.id, day);
      const qty = s ? s.qty : 0;
      const todays = entryOn(it.id, day);
      const edited = !!todays && !todays.seed && todays.memo !== "초기 재고";
      const shots = s && s.shots != null ? s.shots : 0;
      html += `<div class="row">
        <div class="info" data-open="${esc(it.id)}">
          <div class="name">${esc(it.name)}${edited ? '<span class="dot" title="이 날짜에 수정됨"></span>' : ""}</div>
          ${it.note ? `<div class="meta">${esc(it.note)}</div>` : ""}
          ${it.tracksShots ? `<div class="shots ${shots === 0 ? "zero" : ""}">${shots}샷 남음</div>` : ""}
        </div>
        <button class="round" data-adj="-1" data-id="${esc(it.id)}" ${qty <= 0 ? "disabled" : ""} aria-label="빼기">−</button>
        <div class="qty ${qty <= 0 ? "zero" : ""}" data-open="${esc(it.id)}">${fmtQty(qty)}${esc(it.unit)}</div>
        <button class="round" data-adj="1" data-id="${esc(it.id)}" aria-label="더하기">＋</button>
      </div>`;
    }
    html += `</div>`;
  }
  $("#list").innerHTML = html || `<div class="empty">${q ? "검색 결과가 없어요" : "품목이 없어요. ＋ 버튼으로 추가하세요"}</div>`;
  renderStatus();
}
$("#list").addEventListener("click", (ev) => {
  const adj = ev.target.closest("[data-adj]");
  if (adj) {
    const id = adj.dataset.id, s = stockOn(id, day), e = entryOn(id, day);
    const q = Math.max(0, (s ? s.qty : 0) + Number(adj.dataset.adj));
    setStock(id, day, q, s ? s.shots : null, e && e.memo !== "초기 재고" ? e.memo : "");
    renderList();
    return;
  }
  const open = ev.target.closest("[data-open]");
  if (open) openDetail(open.dataset.open);
});
$("#date").addEventListener("change", (e) => { if (e.target.value) { day = e.target.value; renderList(); } });
$("#prev-day").onclick = () => { day = shiftDay(day, -1); renderList(); };
$("#next-day").onclick = () => { day = shiftDay(day, 1); renderList(); };
$("#today").onclick = () => { day = today(); renderList(); };
$("#search").addEventListener("input", (e) => { search = e.target.value; renderList(); });
$("#btn-add").onclick = () => openForm(null);
$("#btn-menu").onclick = openMenu;

// ───────── 시트 공통 ─────────
function openSheet(html) {
  $("#sheet-inner").innerHTML = html;
  $("#sheet").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeSheet() {
  $("#sheet").classList.remove("open");
  document.body.style.overflow = "";
  render();
}
$("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });

// ───────── 품목 상세 (날짜별 수량 수정) ─────────
function openDetail(id, startDay) {
  if (!itemById(id)) return;
  let dday = startDay || day;
  const draw = () => {
    const it = itemById(id);
    if (!it) { closeSheet(); return; }
    const s = stockOn(id, dday), e = entryOn(id, dday);
    const hist = db.entries.filter((x) => x.itemId === id).sort((a, b) => (a.date < b.date ? 1 : -1));
    openSheet(`
      <div class="sheet-head">
        <button class="link" data-act="close">닫기</button>
        <h2>${esc(it.name)}</h2>
        <span style="min-width:50px"></span>
      </div>
      <div class="sheet-body">
        <div class="group-title">날짜</div>
        <div class="card"><div class="field"><label>날짜</label><input type="date" id="d-date" value="${dday}"></div></div>
        ${!e && s ? `<div class="note">이 날짜엔 기록이 없어 ${korDay(s.date)} 기록을 보여주고 있어요.</div>` : ""}
        <div class="group-title">재고 수량</div>
        <div class="card">
          <div class="field"><input class="big" id="d-qty" inputmode="decimal" value="${fmtQty(s ? s.qty : 0)}"><span class="unit">${esc(it.unit)}</span></div>
          <div class="quick">
            <button data-q="-1">−1</button><button data-q="1">+1</button><button data-q="5">+5</button><button data-q="10">+10</button>
          </div>
          ${it.tracksShots ? `<div class="field"><label>남은 샷</label><input id="d-shots" inputmode="numeric" value="${s && s.shots != null ? s.shots : 0}"><span class="unit">샷</span></div>` : ""}
          <div class="field"><input class="left" id="d-memo" placeholder="메모 (예: 입고, 시술 사용)" value="${esc(e && e.memo !== "초기 재고" ? e.memo : "")}"></div>
        </div>
        <button class="primary" id="d-save">${korDay(dday)} 재고로 저장</button>
        <div class="group-title">변경 기록 (누르면 그 날짜로 이동)</div>
        <div class="card">
          ${hist.length ? hist.map((h) => histRow(h, it, true)).join("") : `<div class="hrow"><div class="l m">기록 없음</div></div>`}
        </div>
        <div class="group-title">품목</div>
        <div class="card">
          <button class="plain" data-act="edit">품목 정보 수정</button>
          <button class="danger" data-act="delete" style="border-top:1px solid var(--line)">품목 삭제</button>
        </div>
      </div>`);
    const sheet = $("#sheet-inner");
    sheet.querySelector("#d-date").onchange = (ev) => { if (ev.target.value) { dday = ev.target.value; day = dday; draw(); } };
    sheet.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => {
      const inp = $("#d-qty"); inp.value = fmtQty(Math.max(0, (num(inp.value) || 0) + Number(b.dataset.q)));
    });
    sheet.querySelector("#d-save").onclick = () => {
      const q = num($("#d-qty").value);
      if (q === null) { toast("수량을 숫자로 입력해 주세요"); return; }
      const shots = it.tracksShots ? (parseInt($("#d-shots").value, 10) || 0) : null;
      setStock(id, dday, Math.max(0, q), shots, $("#d-memo").value.trim());
      toast("저장했어요");
      draw();
      const btn = $("#d-save"); btn.textContent = "저장됨 ✓"; btn.classList.add("done");
    };
    sheet.querySelectorAll("[data-goto]").forEach((r) => r.onclick = (ev) => {
      if (ev.target.closest("[data-del]")) return;
      dday = r.dataset.goto; day = dday; draw();
    });
    sheet.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
      const h = db.entries.find((x) => x.id === b.dataset.del);
      if (h && confirm(`${korDay(h.date)} 기록을 삭제할까요?`)) { delEntry(h.id); draw(); }
    });
    sheet.querySelector('[data-act="close"]').onclick = closeSheet;
    sheet.querySelector('[data-act="edit"]').onclick = () => openForm(it, () => openDetail(id, dday));
    sheet.querySelector('[data-act="delete"]').onclick = () => {
      if (confirm(`'${it.name}' 품목과 모든 기록을 삭제할까요?${config ? "\n직원 모두에게서 삭제됩니다." : ""}`)) {
        delItem(id); closeSheet(); toast("삭제했어요");
      }
    };
  };
  draw();
}

function histRow(h, it, clickable) {
  const p = prevStock(h.itemId, h.date);
  const sub = [h.memo, h.by ? `✎ ${h.by}` : ""].filter(Boolean).join(" · ");
  return `<div class="hrow" ${clickable ? `data-goto="${h.date}"` : ""}>
    <div class="l">
      <div class="d">${clickable ? korDay(h.date) : esc(it.name)}</div>
      ${sub ? `<div class="m">${esc(sub)}</div>` : ""}
    </div>
    <div class="r">
      <div>${p ? `<span class="prev">${fmtQty(p.qty)} → </span>` : ""}<b>${fmtQty(h.qty)}${esc(it.unit)}</b></div>
      ${it.tracksShots ? `<div class="s">${p && p.shots != null && p.shots !== h.shots ? p.shots + " → " : ""}${h.shots ?? 0}샷</div>` : ""}
    </div>
    <button class="del" data-del="${esc(h.id)}" aria-label="기록 삭제">✕</button>
  </div>`;
}

// ───────── 품목 추가 / 수정 ─────────
function openForm(item, after) {
  const isEdit = !!item;
  const cats = categories();
  const curCat = isEdit ? item.category : (cats[0] || "");
  const curUnit = isEdit ? item.unit : "개";
  const customUnit = !UNITS.includes(curUnit);
  openSheet(`
    <div class="sheet-head">
      <button class="link" data-act="cancel">취소</button>
      <h2>${isEdit ? "품목 수정" : "새 품목 추가"}</h2>
      <button class="link bold" data-act="ok">${isEdit ? "저장" : "추가"}</button>
    </div>
    <div class="sheet-body">
      <div class="group-title">품목</div>
      <div class="card">
        <div class="field"><input class="left" id="f-name" placeholder="품목 이름 (예: 리쥬란 HB)" value="${esc(isEdit ? item.name : "")}"></div>
        <div class="field"><input class="left" id="f-note" placeholder="메모 / 모델명 (선택)" value="${esc(isEdit ? item.note : "")}"></div>
      </div>
      <div class="group-title">분류</div>
      <div class="card">
        <div class="field"><label>카테고리</label>
          <select id="f-cat">${cats.map((c) => `<option ${c === curCat ? "selected" : ""}>${esc(c)}</option>`).join("")}<option value="__new__" ${cats.length ? "" : "selected"}>새 카테고리…</option></select>
        </div>
        <div class="field" id="f-newcat-row" ${cats.length ? "hidden" : ""}><input class="left" id="f-newcat" placeholder="새 카테고리 이름"></div>
        <div class="field"><label>단위</label>
          <select id="f-unit">${UNITS.map((u) => `<option ${u === curUnit ? "selected" : ""}>${u}</option>`).join("")}<option value="__custom__" ${customUnit ? "selected" : ""}>직접 입력…</option></select>
        </div>
        <div class="field" id="f-cunit-row" ${customUnit ? "" : "hidden"}><input class="left" id="f-cunit" placeholder="단위" value="${esc(customUnit ? curUnit : "")}"></div>
        <div class="field"><label for="f-shots-on" style="flex:1">남은 샷 수 관리 (울쎄라 팁 등)</label><input type="checkbox" class="toggle" id="f-shots-on" ${isEdit && item.tracksShots ? "checked" : ""}></div>
      </div>
      ${isEdit ? "" : `
      <div class="group-title">현재 재고</div>
      <div class="card">
        <div class="field"><label>등록 날짜</label><input type="date" id="f-date" value="${day}"></div>
        <div class="field"><label>수량</label><input id="f-qty" inputmode="decimal" value="0"></div>
        <div class="field" id="f-shots-row" hidden><label>남은 샷</label><input id="f-shots" inputmode="numeric" value="0"></div>
      </div>`}
    </div>`);
  const s = $("#sheet-inner");
  const syncRows = () => {
    s.querySelector("#f-newcat-row").hidden = $("#f-cat").value !== "__new__";
    s.querySelector("#f-cunit-row").hidden = $("#f-unit").value !== "__custom__";
    const sr = s.querySelector("#f-shots-row"); if (sr) sr.hidden = !$("#f-shots-on").checked;
  };
  ["#f-cat", "#f-unit", "#f-shots-on"].forEach((q) => s.querySelector(q).addEventListener("change", syncRows));
  syncRows();
  s.querySelector('[data-act="cancel"]').onclick = () => { closeSheet(); if (after) after(); };
  s.querySelector('[data-act="ok"]').onclick = () => {
    const name = $("#f-name").value.trim();
    const category = ($("#f-cat").value === "__new__" ? $("#f-newcat").value : $("#f-cat").value).trim();
    const unit = ($("#f-unit").value === "__custom__" ? $("#f-cunit").value : $("#f-unit").value).trim();
    const tracksShots = $("#f-shots-on").checked;
    const note = $("#f-note").value.trim();
    if (!name) return toast("품목 이름을 입력해 주세요");
    if (!category) return toast("카테고리를 입력해 주세요");
    if (!unit) return toast("단위를 입력해 주세요");
    if (isEdit) {
      const sortOrder = item.category !== category ? nextSortOrder(category, item.id) : item.sortOrder;
      putItem({ ...item, name, category, unit, tracksShots, note, sortOrder });
      closeSheet(); toast("수정했어요");
      if (after) after();
    } else {
      const qty = num($("#f-qty").value);
      if (qty === null) return toast("수량을 숫자로 입력해 주세요");
      const d = $("#f-date").value || day;
      const id = uid();
      putItem({ id, name, category, unit, tracksShots, note, sortOrder: nextSortOrder(category) });
      putEntry({ id: entryId(id, d), itemId: id, date: d, qty: Math.max(0, qty),
        shots: tracksShots ? (parseInt($("#f-shots").value, 10) || 0) : null, memo: "신규 등록",
        by: config ? config.user : "", updatedAt: Date.now() });
      closeSheet(); toast(`'${name}' 추가했어요`);
    }
  };
}

// ───────── 날짜별 기록 ─────────
function renderHistory() {
  const days = [...new Set(db.entries.map((e) => e.date))].sort().reverse();
  if (!days.length) { $("#history").innerHTML = `<div class="empty">아직 기록이 없어요</div>`; return; }
  $("#history").innerHTML = `<div style="height:8px"></div><div class="card">` + days.map((d) => {
    const n = db.entries.filter((e) => e.date === d).length;
    return `<div class="hrow" data-day="${d}"><div class="l"><div class="d">${korDay(d)}</div></div><div class="r m">${n}건 ›</div></div>`;
  }).join("") + `</div>`;
}
$("#history").addEventListener("click", (e) => {
  const r = e.target.closest("[data-day]"); if (r) openDay(r.dataset.day);
});
function openDay(d) {
  const draw = () => {
    const list = db.entries.filter((e) => e.date === d && itemById(e.itemId))
      .sort((a, b) => itemById(a.itemId).sortOrder - itemById(b.itemId).sortOrder);
    openSheet(`
      <div class="sheet-head">
        <button class="link" data-act="close">닫기</button>
        <h2>${korDay(d)}</h2>
        <button class="link" data-act="go">재고 보기</button>
      </div>
      <div class="sheet-body">
        <div class="group-title">이 날 바뀐 품목 ${list.length}개</div>
        <div class="card">${list.length ? list.map((h) => histRow(h, itemById(h.itemId), false)).join("") : `<div class="hrow"><div class="l m">기록 없음</div></div>`}</div>
      </div>`);
    const s = $("#sheet-inner");
    s.querySelector('[data-act="close"]').onclick = closeSheet;
    s.querySelector('[data-act="go"]').onclick = () => { day = d; switchTab("stock"); closeSheet(); };
    s.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
      if (confirm("이 기록을 삭제할까요?")) { delEntry(b.dataset.del); draw(); }
    });
  };
  draw();
}

// ───────── 메뉴 ─────────
function openMenu() {
  openSheet(`
    <div class="sheet-head"><span style="min-width:50px"></span><h2>메뉴</h2><button class="link" data-act="close">닫기</button></div>
    <div class="sheet-body">
      <div class="group-title">직원과 공유</div>
      <div class="card">
        ${config ? `
          <div class="field"><label>상태</label><span style="flex:1;text-align:right">공유 중 (${esc(config.user)})</span></div>
          <button class="plain" data-act="invite">직원 초대 링크 보내기</button>
          <button class="plain" data-act="sync">지금 동기화</button>
          <button class="plain" data-act="rename">내 이름 바꾸기</button>
          <button class="danger" data-act="disconnect" style="border-top:1px solid var(--line)">이 폰에서 공유 끊기</button>
        ` : `
          <button class="plain" data-act="setup">공유 연결하기 (관리자 설정)</button>
        `}
      </div>
      <div class="group-title">내보내기</div>
      <div class="card"><button class="plain" data-act="csv">${korDay(day)} 재고표 (엑셀용 CSV)</button></div>
      <div class="group-title">백업</div>
      <div class="card">
        <button class="plain" data-act="backup">백업 파일 저장</button>
        <button class="plain" data-act="restore">백업 파일 불러오기</button>
      </div>
      <div class="note">${config ? "재고는 공유 구글 시트에 저장되어 직원 모두가 같은 내용을 봅니다." : "지금은 데이터가 이 아이폰 안에만 저장됩니다."}</div>
    </div>`);
  const s = $("#sheet-inner");
  const on = (a, f) => { const b = s.querySelector(`[data-act="${a}"]`); if (b) b.onclick = f; };
  on("close", closeSheet);
  on("setup", openShareSetup);
  on("invite", shareInvite);
  on("sync", () => { sync(); closeSheet(); });
  on("rename", () => {
    const n = prompt("내 이름 (변경 기록에 표시돼요)", config.user);
    if (n && n.trim()) { config.user = n.trim(); lsSet(CONFIG_KEY, config); toast("바꿨어요"); openMenu(); }
  });
  on("disconnect", () => {
    if (!confirm("이 폰에서 공유를 끊을까요?\n(공유 시트의 데이터는 그대로 남아요)")) return;
    config = null; pending = []; lsSet(CONFIG_KEY, null); saveLocal(); closeSheet(); toast("공유를 끊었어요");
  });
  on("csv", exportCSV);
  on("backup", () => shareFile(`병원재고_백업_${today()}.json`, JSON.stringify(db), "application/json"));
  on("restore", () => $("#import-file").click());
}

// ───────── 공유 연결 (관리자) ─────────
function openShareSetup() {
  openSheet(`
    <div class="sheet-head"><button class="link" data-act="close">닫기</button><h2>직원과 공유하기</h2><span style="min-width:50px"></span></div>
    <div class="sheet-body">
      <div class="note" style="padding-top:12px">관리자 한 명이 처음 한 번만 설정하면 됩니다. 컴퓨터에서 하는 걸 추천해요.</div>
      <div class="group-title">1. 구글 시트 만들기</div>
      <div class="card"><div class="steps">
        구글 드라이브에서 <b>새 스프레드시트</b>를 만들고, 메뉴 <b>확장 프로그램 → Apps Script</b>를 엽니다.
      </div></div>
      <div class="group-title">2. 서버 코드 붙여넣기</div>
      <div class="card">
        <button class="plain" data-act="copy">서버 코드 복사하기</button>
        <div class="steps" style="border-top:1px solid var(--line)">
          편집기 안의 내용을 모두 지우고 붙여넣은 뒤, 맨 위 <b>TEAM_PASSWORD</b>를 직원끼리 쓸 비밀번호로 바꾸고 저장(💾)합니다.
        </div>
      </div>
      <div class="group-title">3. 웹 앱으로 배포</div>
      <div class="card"><div class="steps">
        오른쪽 위 <b>배포 → 새 배포</b> → 톱니바퀴에서 <b>웹 앱</b> 선택<br>
        · 다음 사용자로 실행: <b>나</b><br>
        · 액세스 권한: <b>모든 사용자</b><br>
        → <b>배포</b> → 구글 계정 권한 허용 → 나오는 <b>웹 앱 URL</b>을 복사합니다.
      </div></div>
      <div class="group-title">4. 여기에 입력</div>
      <div class="card">
        <div class="field"><input class="left" id="s-url" placeholder="웹 앱 URL (https://script.google.com/...)" autocapitalize="off" autocorrect="off"></div>
        <div class="field"><input class="left" id="s-key" placeholder="TEAM_PASSWORD 로 정한 비밀번호" autocapitalize="off" autocorrect="off"></div>
        <div class="field"><input class="left" id="s-user" placeholder="내 이름 (예: 원장님, 김간호사)"></div>
      </div>
      <button class="primary" id="s-connect">연결하기</button>
      <div class="note">시트가 비어 있으면 지금 이 폰의 재고가 시트에 올라갑니다.</div>
    </div>`);
  const s = $("#sheet-inner");
  s.querySelector('[data-act="close"]').onclick = closeSheet;
  s.querySelector('[data-act="copy"]').onclick = async () => {
    try {
      const code = await (await fetch("server.gs", { cache: "no-store" })).text();
      await navigator.clipboard.writeText(code);
      toast("서버 코드를 복사했어요");
    } catch (e) { window.open("server.gs", "_blank"); }
  };
  s.querySelector("#s-connect").onclick = async () => {
    const cfg = { url: $("#s-url").value.trim(), key: $("#s-key").value.trim(), user: $("#s-user").value.trim() };
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url)) return toast("웹 앱 URL을 확인해 주세요");
    if (!cfg.key) return toast("비밀번호를 입력해 주세요");
    if (!cfg.user) return toast("이름을 입력해 주세요");
    await connect(cfg, true);
  };
}

// 연결: 서버가 비어 있으면(그리고 업로드 허용 시) 이 폰 데이터를 올리고, 아니면 서버 데이터를 받음
async function connect(cfg, allowUpload) {
  const btn = $("#s-connect") || $("#j-connect");
  if (btn) { btn.disabled = true; btn.textContent = "연결 중…"; }
  try {
    let data = await callServer([], cfg);
    if (!data.items.length && allowUpload) {
      const ops = [
        ...db.items.map((v) => ({ t: "item", v })),
        ...db.entries.map((v) => ({ t: "entry", v: { ...v, id: entryId(v.itemId, v.date) } })),
      ];
      data = await callServer(ops, cfg);
    }
    config = cfg; lsSet(CONFIG_KEY, config);
    pending = [];
    db = { items: data.items, entries: data.entries };
    saveLocal(); lastSync = Date.now(); syncError = "";
    closeSheet();
    toast("공유 연결 완료!");
    if (allowUpload) setTimeout(shareInvite, 400);
  } catch (e) {
    toast("연결 실패: " + (e.message || "URL을 확인해 주세요"));
    if (btn) { btn.disabled = false; btn.textContent = "연결하기"; }
  }
}

function inviteUrl() {
  return location.origin + location.pathname + "#join=" + b64enc({ u: config.url, k: config.key });
}
async function shareInvite() {
  const url = inviteUrl();
  const text = "병원 재고 앱 초대 링크예요. 아이폰 Safari로 열고 [공유 → 홈 화면에 추가] 한 뒤, 홈 화면 아이콘으로 열어서 이름을 입력하세요.";
  try {
    if (navigator.share) { await navigator.share({ title: "병원 재고 앱", text, url }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(url); toast("초대 링크를 복사했어요"); }
  catch (e) { prompt("이 초대 링크를 직원에게 보내세요", url); }
}

// 초대 링크로 들어온 경우
function checkJoin() {
  const m = location.hash.match(/join=([\w-]+)/);
  if (!m) return false;
  let inv;
  try { inv = b64dec(m[1]); } catch (e) { return false; }
  if (!inv || !inv.u || !inv.k) return false;
  if (config && config.url === inv.u && config.key === inv.k) return false; // 이미 연결됨
  const standalone = window.navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  openSheet(`
    <div class="sheet-head"><span style="min-width:50px"></span><h2>팀 재고 참여</h2><button class="link" data-act="close">나중에</button></div>
    <div class="sheet-body">
      ${standalone ? "" : `<div class="install-tip" style="margin-top:16px"><b>먼저 홈 화면에 추가하세요</b><br>
        Safari 아래쪽 <b>공유(□↑)</b> → <b>홈 화면에 추가</b> → 홈 화면의 "병원 재고" 아이콘으로 열어서 이름을 입력하면 됩니다.</div>`}
      <div class="group-title">내 이름</div>
      <div class="card"><div class="field"><input class="left" id="j-user" placeholder="예: 김간호사 (변경 기록에 표시돼요)"></div></div>
      <button class="primary" id="j-connect">참여하기</button>
    </div>`);
  const s = $("#sheet-inner");
  s.querySelector('[data-act="close"]').onclick = closeSheet;
  s.querySelector("#j-connect").onclick = () => {
    const user = $("#j-user").value.trim();
    if (!user) return toast("이름을 입력해 주세요");
    connect({ url: inv.u, key: inv.k, user }, false);
  };
  return true;
}

// ───────── 내보내기 / 백업 ─────────
function exportCSV() {
  const cell = (v) => /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const lines = ["카테고리,품목,수량,단위,남은샷,메모"];
  for (const it of sorted()) {
    const s = stockOn(it.id, day);
    lines.push([it.category, it.name, fmtQty(s ? s.qty : 0), it.unit, it.tracksShots ? (s && s.shots != null ? s.shots : 0) : "", it.note].map(cell).join(","));
  }
  shareFile(`병원재고_${day}.csv`, "﻿" + lines.join("\n"), "text/csv");
}
async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
$("#import-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || !Array.isArray(d.items) || !Array.isArray(d.entries)) throw new Error();
    const warn = config ? "\n공유 중이라 직원 모두의 데이터가 바뀝니다." : "";
    if (!confirm(`백업(품목 ${d.items.length}개)으로 지금 데이터를 바꿀까요?${warn}`)) return;
    if (config) {
      db.items.filter((x) => !d.items.some((y) => y.id === x.id)).forEach((x) => delItem(x.id));
      db.entries.filter((x) => !d.entries.some((y) => y.id === x.id)).forEach((x) => delEntry(x.id));
      d.items.forEach(putItem); d.entries.forEach(putEntry);
    } else { db = d; saveLocal(); }
    closeSheet(); toast("백업을 불러왔어요");
  } catch (err) { toast("백업 파일을 읽을 수 없어요"); }
});

// ───────── 탭 / 설치 안내 ─────────
function switchTab(t) {
  tab = t;
  $("#page-stock").hidden = t !== "stock";
  $("#page-history").hidden = t !== "history";
  $("#tab-stock").classList.toggle("on", t === "stock");
  $("#tab-history").classList.toggle("on", t === "history");
  render(); window.scrollTo(0, 0);
}
$("#tab-stock").onclick = () => switchTab("stock");
$("#tab-history").onclick = () => switchTab("history");
function render() { tab === "stock" ? renderList() : renderHistory(); renderStatus(); }

(function installTip() {
  const standalone = window.navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  let hidden = false; try { hidden = localStorage.getItem("tip-hidden") === "1"; } catch (e) {}
  if (standalone || hidden || /join=/.test(location.hash)) return;
  $("#install-tip").innerHTML = `<div class="install-tip"><button aria-label="닫기">✕</button>
    <b>앱처럼 쓰려면</b><br>Safari 아래쪽 <b>공유 버튼(□↑)</b> → <b>홈 화면에 추가</b>를 누르세요.</div>`;
  $("#install-tip button").onclick = () => { try { localStorage.setItem("tip-hidden", "1"); } catch (e) {} $("#install-tip").innerHTML = ""; };
})();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (config) sync();
  if (!$("#sheet").classList.contains("open")) render();
});
setInterval(renderStatus, 15000);
render();
checkJoin();
if (config) sync();
