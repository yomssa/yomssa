/**
 * 병원 재고 앱 - 공유 서버 (Google Apps Script)
 *
 * 1) 아래 TEAM_PASSWORD 를 직원들과 같이 쓸 비밀번호로 바꾸세요.
 * 2) 배포 > 새 배포 > 유형: 웹 앱
 *    - 다음 사용자로 실행: 나
 *    - 액세스 권한이 있는 사용자: 모든 사용자
 * 3) 나온 웹 앱 URL 을 재고 앱 > ⋯ 메뉴 > 공유 연결하기 에 붙여넣으세요.
 */
const TEAM_PASSWORD = '여기에-비밀번호-입력';

const ITEM_SHEET = '품목';
const ENTRY_SHEET = '기록';
const ITEM_COLS = ['id', '카테고리', '품목', '단위', '샷관리', '메모', '순서'];
const ENTRY_COLS = ['id', 'itemId', '품목', '날짜', '수량', '남은샷', '메모', '수정자', '수정시각'];

function doGet() {
  return ContentService.createTextOutput('병원 재고 서버가 동작 중입니다.');
}

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) {}
  try {
    if (TEAM_PASSWORD === '여기에-비밀번호-입력') return out({ ok: false, error: '스크립트의 TEAM_PASSWORD 를 먼저 바꿔주세요' });
    if (req.key !== TEAM_PASSWORD) return out({ ok: false, error: '비밀번호가 틀렸어요' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (req.ops && req.ops.length) {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { applyOps(ss, req.ops, String(req.user || '')); } finally { lock.releaseLock(); }
    }
    return out(Object.assign({ ok: true }, readAll(ss)));
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(ss, name, cols) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:Z').setNumberFormat('@'); // 날짜 등이 자동 변환되지 않게 텍스트로
  }
  return sh;
}

function rows(sh, n) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, n).getValues();
}

function dayStr(v, ss) {
  if (v instanceof Date) return Utilities.formatDate(v, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return String(v);
}

function readAll(ss) {
  const items = rows(sheet(ss, ITEM_SHEET, ITEM_COLS), ITEM_COLS.length)
    .filter(r => r[0] !== '')
    .map(r => ({
      id: String(r[0]), category: String(r[1]), name: String(r[2]), unit: String(r[3]),
      tracksShots: r[4] === true || String(r[4]).toUpperCase() === 'TRUE' || r[4] === 'O',
      note: String(r[5]), sortOrder: Number(r[6]) || 0,
    }));
  const entries = rows(sheet(ss, ENTRY_SHEET, ENTRY_COLS), ENTRY_COLS.length)
    .filter(r => r[0] !== '')
    .map(r => ({
      id: String(r[0]), itemId: String(r[1]), date: dayStr(r[3], ss),
      qty: Number(r[4]) || 0, shots: r[5] === '' ? null : Number(r[5]),
      memo: String(r[6]), by: String(r[7]), updatedAt: Number(new Date(r[8])) || 0,
    }));
  return { items, entries };
}

function applyOps(ss, ops, user) {
  const itemSh = sheet(ss, ITEM_SHEET, ITEM_COLS);
  const entrySh = sheet(ss, ENTRY_SHEET, ENTRY_COLS);
  const itemRows = rows(itemSh, ITEM_COLS.length);
  const entryRows = rows(entrySh, ENTRY_COLS.length);
  const names = {};
  itemRows.forEach(r => { names[String(r[0])] = String(r[2]); });

  // 메모리에서 수정한 뒤 한 번에 다시 씁니다
  const itemMap = new Map(itemRows.map(r => [String(r[0]), r]));
  const entryMap = new Map(entryRows.map(r => [String(r[0]), r]));
  const now = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

  ops.forEach(op => {
    if (op.t === 'item') {
      const v = op.v;
      itemMap.set(v.id, [v.id, v.category, v.name, v.unit, v.tracksShots ? 'TRUE' : 'FALSE', v.note || '', v.sortOrder]);
      names[v.id] = v.name;
    } else if (op.t === 'delItem') {
      itemMap.delete(op.id);
      for (const [k, r] of entryMap) if (String(r[1]) === op.id) entryMap.delete(k);
    } else if (op.t === 'entry') {
      const v = op.v;
      entryMap.set(v.id, [v.id, v.itemId, names[v.itemId] || '', v.date, v.qty,
        v.shots === null || v.shots === undefined ? '' : v.shots, v.memo || '', user, now]);
    } else if (op.t === 'delEntry') {
      entryMap.delete(op.id);
    }
  });

  write(itemSh, ITEM_COLS.length, [...itemMap.values()].sort((a, b) => Number(a[6]) - Number(b[6])), itemRows.length);
  write(entrySh, ENTRY_COLS.length, [...entryMap.values()].sort((a, b) =>
    String(a[3]) === String(b[3]) ? 0 : (String(a[3]) < String(b[3]) ? -1 : 1)), entryRows.length);
}

function write(sh, n, data, oldCount) {
  if (data.length) sh.getRange(2, 1, data.length, n).setValues(data.map(r => r.map(c => (c === null || c === undefined) ? '' : c)));
  if (oldCount > data.length) sh.getRange(2 + data.length, 1, oldCount - data.length, n).clearContent();
}
