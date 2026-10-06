/**
 * STC BG V2 — Hệ thống chung trên Google Sheet
 * Dán toàn bộ file này vào Tiện ích mở rộng → Apps Script của file "STC_BaoGia_Data".
 * Menu "STC Báo Giá" → "1. Khởi tạo hệ thống" (chạy 1 lần) → Triển khai dạng Ứng dụng web.
 *
 * Quy tắc: Đặt cọc = trừ kho. Hủy báo giá đã cọc = hoàn kho. Mọi thay đổi kho ghi nhật ký tab PhieuXuat.
 * File NXT gốc của kế toán chỉ được ĐỌC khi khởi tạo, không bao giờ ghi.
 */

var NXT_CSV_URL = 'https://docs.google.com/spreadsheets/d/1qaUdLFSbPgAYWjP4Cn0mawKORm26CBC1/export?format=csv&gid=667618843';
var STAFF_NAMES = ['Nguyễn Thành Công', 'Lê Thị Nhàng', 'Lê Quang Toàn'];
// Nguồn chép danh mục lần đầu (trước khi gỡ file công khai khỏi web app)
var SEED_BASE = 'https://stc-bg-nhanh-v2.vercel.app/assets/';
var TZ = 'Asia/Ho_Chi_Minh';
var LOCKED = ['Đặt cọc', 'Hoàn tất', 'Hủy'];

var SHEETS = {
  BaoGia: ['Mã báo giá (ID)', 'Số báo giá', 'Ngày', 'Khách hàng', 'Điện thoại', 'Địa chỉ', 'Người lập', 'Loại', 'Cách tính', 'Tổng tiền', 'Trạng thái', 'Tiền cọc', 'Ngày cọc', 'Người chốt cọc', 'Số phiếu xuất', 'Phương án chọn', 'Cập nhật lúc', 'Cập nhật bởi', 'Ghi chú hủy', 'Dữ liệu (không sửa)'],
  ChiTiet: ['Mã báo giá (ID)', 'Số báo giá', 'STT', 'Mã hàng', 'Tên hàng', 'ĐVT', 'Số lượng', 'Đơn giá', 'Giá gốc', 'Thành tiền', 'Không trừ kho'],
  Kho: ['Mã hàng', 'Tên hàng', 'ĐVT', 'Tồn', 'Cập nhật lúc', 'Ghi chú', 'Tồn tối thiểu'],
  PhieuXuat: ['Số phiếu', 'Thời gian', 'Loại', 'Mã báo giá (ID)', 'Số báo giá', 'Khách hàng', 'Mã hàng', 'Tên hàng', 'ĐVT', 'Số lượng', 'Tồn trước', 'Tồn sau', 'Nhân viên'],
  DoiChieu: ['Dòng NXT', 'Mã hàng', 'Tên hàng', 'Tồn nguồn', 'Lý do chưa nhập'],
  DeXuatNhap: ['Thời gian', 'Loại cảnh báo', 'Mã báo giá (ID)', 'Số báo giá', 'Khách hàng', 'Nhân viên', 'Mã hàng', 'Tên hàng', 'ĐVT', 'Cần', 'Tồn hiện tại', 'Thiếu', 'Tồn tối thiểu', 'Đề xuất nhập', 'Trạng thái', 'Ghi chú xử lý'],
  DanhMuc: ['Mã hàng', 'Tên hàng', 'ĐVT', 'Đơn giá (sau VAT)', 'Nhóm', 'Ghi chú'],
  CauHinh: ['Khóa', 'Giá trị (JSON — sửa cẩn thận)', 'Ghi chú']
};
// Trạng thái đề xuất nhập: kế toán đổi tay trên Sheet
var ALERT_OPEN = 'Chờ xử lý', ALERT_DONE = ['Đã nhập', 'Bỏ qua'];
// Cột (bắt đầu từ 0) của tab BaoGia
// Cột để dạng chữ (tránh Google Sheet tự đổi ngày giờ, mã hàng, số điện thoại)
var TEXT_COLS = {BaoGia: ['A', 'B', 'C', 'E', 'M', 'Q'], ChiTiet: ['A', 'B', 'D'], Kho: ['A', 'E'], PhieuXuat: ['A', 'B', 'D', 'E', 'G'], DeXuatNhap: ['A', 'C', 'D', 'G'], DanhMuc: ['A'], CauHinh: ['A', 'B']};

// Tạo tab / bổ sung cột tiêu đề còn thiếu (dùng cho cả file đã khởi tạo từ bản trước)
function ensureSheet(name) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name) || ss.insertSheet(name), head = SHEETS[name];
  var cur = sh.getLastRow() ? sh.getRange(1, 1, 1, head.length).getValues()[0] : [];
  if (cur.join('|') !== head.join('|')) {
    var fixed = head.map(function (h, i) { return cur[i] ? cur[i] : h; });
    sh.getRange(1, 1, 1, head.length).setValues([fixed]).setFontWeight('bold').setBackground('#061b49').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    (TEXT_COLS[name] || []).forEach(function (c) { sh.getRange(c + ':' + c).setNumberFormat('@'); });
  }
  return sh;
}
function cell(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'dd/MM/yyyy HH:mm') : v; }
var B = {id: 0, number: 1, date: 2, customer: 3, phone: 4, address: 5, preparedBy: 6, type: 7, mode: 8, total: 9, status: 10, deposit: 11, depositAt: 12, depositBy: 13, slip: 14, chosen: 15, updatedAt: 16, updatedBy: 17, cancelNote: 18, meta: 19};

/* ============================ Menu & khởi tạo ============================ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('STC Báo Giá')
    .addItem('1. Khởi tạo hệ thống (chạy 1 lần)', 'setupSystem')
    .addItem('2. Nâng cấp cấu trúc (sau khi cập nhật mã)', 'upgradeSchema')
    .addItem('3. Chép danh mục giá vào tab DanhMuc (1 lần)', 'seedCatalog')
    .addItem('Xem mã PIN nhân viên', 'showPins')
    .addItem('Đổi mã PIN nhân viên', 'resetPins')
    .addToUi();
}

// Bổ sung tab/cột mới cho file đã khởi tạo; không đụng dữ liệu, không hiện PIN
function upgradeSchema() {
  for (var name in SHEETS) ensureSheet(name);
  var added = ensurePins();
  notify('STC Báo Giá', 'Đã cập nhật cấu trúc (DanhMuc, CauHinh, DeXuatNhap, cột "Tồn tối thiểu"). Dữ liệu cũ giữ nguyên.' +
    (added.length ? '\nĐã tạo PIN mới cho: ' + added.join(', ') + ' (PIN cũ của nhân viên giữ nguyên). Xem ở menu "Xem mã PIN".' : ''));
}

// Chép danh mục giá từ file công khai cũ vào tab DanhMuc/CauHinh (chạy 1 lần, không ghi đè nếu đã có)
function seedCatalog() {
  var dm = ensureSheet('DanhMuc'), ch = ensureSheet('CauHinh');
  if (dm.getLastRow() > 1) { notify('STC Báo Giá', 'Tab DanhMuc đã có ' + (dm.getLastRow() - 1) + ' mã — giữ nguyên, không chép lại.'); return; }
  function get(f) { var r = UrlFetchApp.fetch(SEED_BASE + f, {muteHttpExceptions: true}); if (r.getResponseCode() !== 200) throw new Error('Không đọc được ' + f + ' (' + r.getResponseCode() + ')'); return JSON.parse(r.getContentText('UTF-8')); }
  var list = get('list-prices-v8.json').products, curtain = get('curtain-fpt.json'), gate = get('gate-products.json'), base = get('prices.json').products, sample = get('sample.json');
  var drop = {}; curtain.removeIds.concat(Object.keys(curtain.mergeIds || {})).forEach(function (id) { drop[id] = 1; });
  var seen = {}, rows = [];
  function add(p, group) { if (drop[p.id] || seen[p.id]) return; seen[p.id] = 1; rows.push([String(p.id), p.name, p.unit, Number(p.unitPrice), group, '']); }
  list.forEach(function (p) { add(p, 'FPT · NXT T09/2026'); });
  curtain.products.forEach(function (p) { add(p, 'Rèm kéo ngang FPT'); });
  gate.products.forEach(function (p) { add(p, 'Động cơ cổng'); });
  base.forEach(function (p) { add(p, 'Mã mẫu (chọn mã thật khi chốt)'); });
  dm.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  var g = JSON.parse(JSON.stringify(gate)); delete g.products;
  var cfg = [['gate', JSON.stringify(g), 'Thông số, thành phần, yêu cầu kỹ thuật, mẫu 3 phương án & ưu đãi động cơ cổng'],
    ['sample', JSON.stringify(sample), 'Báo giá mẫu 7 sản phẩm + thông tin công ty mặc định']];
  ch.getRange(ch.getLastRow() + 1, 1, cfg.length, 3).setValues(cfg);
  notify('STC Báo Giá', 'Đã chép ' + rows.length + ' mã vào tab DanhMuc và cấu hình động cơ cổng / báo giá mẫu vào tab CauHinh.');
}

function readConfig() {
  var sh = SpreadsheetApp.getActive().getSheetByName('CauHinh'), out = {};
  if (!sh) return out;
  body(sh).forEach(function (r) { if (!r[0]) return; try { out[String(r[0])] = JSON.parse(String(r[1])); } catch (e) { throw new Error('Tab CauHinh, khóa "' + r[0] + '": JSON lỗi, kiểm tra lại dấu ngoặc/dấu phẩy.'); } });
  return out;
}

function listCatalog() {
  var sh = SpreadsheetApp.getActive().getSheetByName('DanhMuc');
  if (!sh) throw new Error('Chưa có tab DanhMuc.');
  var seen = {}, out = [];
  body(sh).forEach(function (r) {
    var id = text(r[0]), name = text(r[1]), unit = text(r[2]), price = num(r[3]);
    if (!id || !name || !unit || seen[id] || !(price >= 0) || Math.round(price) !== price) return;
    seen[id] = 1; out.push({id: id, name: name, unit: unit, unitPrice: price});
  });
  return out;
}

function setupSystem() {
  var ss = SpreadsheetApp.getActive();
  for (var name in SHEETS) ensureSheet(name);
  var first = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);

  var kho = ss.getSheetByName('Kho');
  var msg = '';
  if (kho.getLastRow() > 1) {
    msg = 'Tab Kho đã có dữ liệu (' + (kho.getLastRow() - 1) + ' mã) — giữ nguyên, không nạp lại.\n';
  } else {
    var csv = UrlFetchApp.fetch(NXT_CSV_URL, {muteHttpExceptions: true});
    if (csv.getResponseCode() !== 200) throw new Error('Không đọc được file NXT (mã ' + csv.getResponseCode() + ').');
    var data = prepareNxt(Utilities.parseCsv(csv.getContentText('UTF-8')));
    var now = stamp();
    var rows = data.rows.map(function (r) { return [r.id, r.name, r.unit, r.quantity, now, 'Khởi tạo từ NXT: ' + data.period]; });
    if (rows.length) kho.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    var dc = ss.getSheetByName('DoiChieu');
    var issues = data.issues.map(function (r) { return [r.line, r.id, r.name, r.quantity, r.reason]; });
    if (issues.length) dc.getRange(dc.getLastRow() + 1, 1, issues.length, issues[0].length).setValues(issues);
    msg = 'Đã khởi tạo kho: ' + rows.length + ' mã từ NXT (' + data.period + ').\n' + issues.length + ' dòng cần đối chiếu — xem tab DoiChieu.\n';
  }
  ensurePins();
  notify('STC Báo Giá', msg + '\n' + pinText() + '\n\nBước tiếp theo: Triển khai → Tùy chọn triển khai mới → Ứng dụng web.');
}

// Hộp thoại chỉ hiện khi chạy từ menu trên Sheet; chạy trong trình soạn mã thì xem "Nhật ký thực thi"
function notify(title, m) {
  Logger.log(title + '\n' + m);
  try { SpreadsheetApp.getUi().alert(title, m, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* không có giao diện Sheet */ }
}

function makePins() {
  var staff = {}, used = {};
  STAFF_NAMES.forEach(function (n) {
    var pin;
    do { pin = String(100000 + Math.floor(Math.random() * 900000)); } while (used[pin]);
    used[pin] = 1; staff[pin] = n;
  });
  PropertiesService.getScriptProperties().setProperty('STAFF', JSON.stringify(staff));
}
// Chỉ tạo PIN cho người chưa có; PIN đang dùng giữ nguyên
function ensurePins() {
  var props = PropertiesService.getScriptProperties(), staff = JSON.parse(props.getProperty('STAFF') || '{}'), have = {}, added = [];
  Object.keys(staff).forEach(function (p) { have[staff[p]] = 1; });
  STAFF_NAMES.forEach(function (n) {
    if (have[n]) return;
    var pin; do { pin = String(100000 + Math.floor(Math.random() * 900000)); } while (staff[pin]);
    staff[pin] = n; added.push(n);
  });
  if (added.length) props.setProperty('STAFF', JSON.stringify(staff));
  return added;
}
function pinText() {
  var staff = JSON.parse(PropertiesService.getScriptProperties().getProperty('STAFF') || '{}');
  return 'Mã PIN nhân viên (giữ bí mật, gửi riêng từng người):\n' + Object.keys(staff).map(function (p) { return '• ' + staff[p] + ': ' + p; }).join('\n');
}
function showPins() { notify('Mã PIN', pinText()); }
function resetPins() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Đổi mã PIN?', 'PIN cũ sẽ hết hiệu lực ngay. Nhân viên phải nhập PIN mới trong app.', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  makePins(); ui.alert(pinText());
}

/* ============================ Đọc NXT ============================ */

function text(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
function num(v) {
  if (typeof v === 'number') return v;
  var s = String(v == null ? '' : v).replace(/\s/g, '');
  if (s === '-') return 0;
  var m = s.match(/^\((\d+)\)$/); if (m) return -Number(m[1]);
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  if (/^-?\d+(,\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  return NaN;
}
function prepareNxt(matrix) {
  var header = -1;
  for (var i = 0; i < matrix.length; i++) if (text(matrix[i][3]) === 'Mã hàng' && /TỒN CUỐI K[ÌỲ]/i.test(text(matrix[i][14]))) { header = i; break; }
  if (header < 0) throw new Error('Không tìm thấy cột Mã hàng và TỒN CUỐI KÌ trong file NXT.');
  var input = [], counts = {};
  for (var j = header + 1; j < matrix.length; j++) {
    var r = matrix[j];
    if (!text(r[2]) && !text(r[3])) continue;
    input.push({r: r, line: j + 1});
    var id0 = text(r[3]); if (id0) counts[id0] = (counts[id0] || 0) + 1;
  }
  var rows = [], issues = [];
  input.forEach(function (x) {
    var r = x.r, id = text(r[3]), name = text(r[2]), unit = text(r[5]), price = num(r[8]), q = num(r[14]), why = [];
    if (!id) why.push('Thiếu mã hàng');
    if (counts[id] > 1) why.push('Mã trùng — cần đối chiếu, không tự cộng');
    if (!name || !unit) why.push('Thiếu tên hoặc đơn vị');
    if (!(price >= 0) || Math.round(price) !== price) why.push('Thiếu/không hợp lệ giá sau VAT');
    if (!(q >= 0) || q > 1e6) why.push('Tồn âm hoặc không hợp lệ');
    if (why.length) { issues.push({line: x.line, id: id, name: name, quantity: text(r[14]), reason: why.join('; ')}); return; }
    rows.push({id: id, name: name, unit: unit, quantity: q});
  });
  return {rows: rows, issues: issues, period: text((matrix[4] || [])[2])};
}

/* ============================ API web ============================ */

function doGet() { return json({ok: true, app: 'STC BG V2 API', time: stamp()}); }

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var staff = auth(req.pin);
    var fn = ACTIONS[req.action];
    if (!fn) throw new Error('Thao tác không hợp lệ.');
    var result = fn(req, staff);
    result.ok = true; result.staff = staff;
    return json(result);
  } catch (err) {
    return json({ok: false, error: String(err && err.message || err)});
  }
}

var ACTIONS = {
  ping: function () { return {}; },
  stock: function () { return {rows: readKho().list}; },
  list: function () { return {quotes: listQuotes()}; },
  alerts: function () { return {alerts: listAlerts()}; },
  catalog: function () { var c = readConfig(); return {products: listCatalog(), gate: c.gate || null, sample: c.sample || null}; },
  get: function (req) { return {quote: getQuote(req.id)}; },
  save: function (req, staff) { return withLock(function () { return saveQuote(req.quote, staff, null); }); },
  sent: function (req, staff) { return withLock(function () { return setStatus(req.id, 'Đã gửi khách', ['Nháp'], staff); }); },
  complete: function (req, staff) { return withLock(function () { return setStatus(req.id, 'Hoàn tất', ['Đặt cọc'], staff); }); },
  deposit: function (req, staff) { return withLock(function () { return deposit(req, staff); }); },
  cancel: function (req, staff) { return withLock(function () { return cancel(req, staff); }); }
};

function json(x) { return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON); }
function stamp() { return Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss'); }
function sheet(n) { var s = SpreadsheetApp.getActive().getSheetByName(n); if (!s) throw new Error('Chưa khởi tạo hệ thống (thiếu tab ' + n + ').'); return s; }
function body(sh) { var n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, sh.getLastColumn()).getValues() : []; }
function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Hệ thống đang bận (người khác đang ghi). Thử lại sau vài giây.');
  try { var r = fn(); SpreadsheetApp.flush(); return r; } finally { lock.releaseLock(); }
}

function auth(pin) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('fails') || 0);
  if (fails >= 30) throw new Error('Nhập sai PIN quá nhiều lần. Thử lại sau 10 phút.');
  var staff = JSON.parse(PropertiesService.getScriptProperties().getProperty('STAFF') || '{}');
  var name = staff[String(pin || '')];
  if (!name) { cache.put('fails', String(fails + 1), 600); throw new Error('Mã PIN không đúng.'); }
  return name;
}

/* ============================ Báo giá ============================ */

function findRow(sh, id) {
  var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function listQuotes() {
  return body(sheet('BaoGia')).map(function (r) {
    r = r.map(cell);
    return {id: r[B.id], number: r[B.number], date: r[B.date], customer: r[B.customer], phone: r[B.phone], preparedBy: r[B.preparedBy],
      type: r[B.type], mode: r[B.mode], total: r[B.total], status: r[B.status], deposit: r[B.deposit], depositAt: r[B.depositAt],
      depositBy: r[B.depositBy], slip: r[B.slip], chosen: r[B.chosen], updatedAt: r[B.updatedAt], updatedBy: r[B.updatedBy]};
  }).reverse();
}

function getQuote(id) {
  var sh = sheet('BaoGia'), row = findRow(sh, id);
  if (!row) throw new Error('Không tìm thấy báo giá.');
  var r = sh.getRange(row, 1, 1, SHEETS.BaoGia.length).getValues()[0].map(cell);
  var q = JSON.parse(r[B.meta] || '{}');
  q.items = body(sheet('ChiTiet')).filter(function (x) { return String(x[0]) === String(id); })
    .sort(function (a, b) { return a[2] - b[2]; })
    .map(function (x) {
      var it = {productId: String(x[3] || ''), name: String(x[4]), unit: String(x[5]), quantity: Number(x[6]), unitPrice: Number(x[7])};
      if (x[8] !== '' && x[8] != null) it.listPrice = Number(x[8]);
      if (x[10] === true || x[10] === 'Có') it.nonStock = true;
      return it;
    });
  q.cloud = {status: r[B.status], deposit: r[B.deposit], depositAt: r[B.depositAt], depositBy: r[B.depositBy], slip: r[B.slip], chosen: r[B.chosen], updatedAt: r[B.updatedAt], updatedBy: r[B.updatedBy]};
  return q;
}

function saveQuote(q, staff, forceStatus) {
  if (!q || !q.id || !Array.isArray(q.items)) throw new Error('Dữ liệu báo giá không hợp lệ.');
  if (q.items.length > 500) throw new Error('Báo giá tối đa 500 dòng.');
  q.items.forEach(function (i) {
    if (!text(i.name) || !text(i.unit) || !(Number(i.quantity) > 0) || !(Number(i.unitPrice) >= 0)) throw new Error('Dòng hàng thiếu tên/đơn vị hoặc số lượng, đơn giá không hợp lệ.');
  });
  var sh = sheet('BaoGia'), row = findRow(sh, q.id), old = row ? sh.getRange(row, 1, 1, SHEETS.BaoGia.length).getValues()[0] : null;
  if (old && LOCKED.indexOf(old[B.status]) >= 0) throw new Error('Báo giá đang ở trạng thái "' + old[B.status] + '" nên đã khóa. Hãy nhân bản để sửa.');
  var meta = {};
  for (var k in q) if (k !== 'items' && k !== 'cloud') meta[k] = q[k];
  if (meta.company) { meta.company = JSON.parse(JSON.stringify(meta.company)); delete meta.company.fptLogo; if (/^data:/.test(meta.company.logo || '')) meta.company.logo = 'assets/stc-logo.jpg'; }
  var status = forceStatus || (old ? old[B.status] : 'Nháp') || 'Nháp';
  var now = stamp();
  var rec = [q.id, q.number || '', q.date ? String(q.date).split('-').reverse().join('/') : '', q.customer || '', q.phone ? "'" + q.phone : '', q.address || '', q.preparedBy || staff, q.type === 'gate' ? 'Động cơ cổng' : 'Thiết bị thông minh',
    q.mode === 'options' ? 'Phương án lựa chọn' : 'Cộng dồn', Number(q.total) || 0, status,
    old ? old[B.deposit] : '', old ? old[B.depositAt] : '', old ? old[B.depositBy] : '', old ? old[B.slip] : '', old ? old[B.chosen] : '',
    now, staff, old ? old[B.cancelNote] : '', JSON.stringify(meta)];
  if (rec[B.meta].length > 45000) throw new Error('Thông tin phụ của báo giá quá dài (ghi chú/ưu đãi). Hãy rút gọn.');
  if (row) sh.getRange(row, 1, 1, rec.length).setValues([rec]); else sh.appendRow(rec);

  var ct = sheet('ChiTiet');
  var keep = body(ct).filter(function (x) { return String(x[0]) !== String(q.id); });
  var add = q.items.map(function (i, n) {
    var amount = Math.round(Number(i.quantity) * Number(i.unitPrice));
    return [q.id, q.number || '', n + 1, i.productId || '', i.name, i.unit, Number(i.quantity), Number(i.unitPrice), i.listPrice != null ? Number(i.listPrice) : '', amount, i.nonStock ? 'Có' : ''];
  });
  rewrite(ct, keep.concat(add));
  return {status: status, updatedAt: now};
}

function rewrite(sh, rows) {
  var width = sh.getLastColumn();
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, width).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, width).setValues(rows);
}

function setStatus(id, status, from, staff) {
  var sh = sheet('BaoGia'), row = findRow(sh, id);
  if (!row) throw new Error('Báo giá chưa lưu lên hệ thống.');
  var cur = sh.getRange(row, B.status + 1).getValue();
  if (from.indexOf(cur) < 0) throw new Error('Không chuyển được từ "' + cur + '" sang "' + status + '".');
  sh.getRange(row, B.status + 1).setValue(status);
  sh.getRange(row, B.updatedAt + 1, 1, 2).setValues([[stamp(), staff]]);
  return {status: status};
}

/* ============================ Kho: đặt cọc / hủy ============================ */

function readKho() {
  var sh = sheet('Kho'), rows = body(sh), map = {}, list = [];
  rows.forEach(function (r, i) {
    var x = {id: String(r[0]), name: String(r[1]), unit: String(r[2]), quantity: Number(r[3]) || 0, min: Number(r[6]) || 0, row: i + 2};
    map[x.id] = x; list.push({id: x.id, name: x.name, unit: x.unit, quantity: x.quantity, min: x.min});
  });
  return {sheet: sh, map: map, list: list};
}

function needsOf(q, chosen) {
  var items = q.items;
  if (q.mode === 'options') {
    if (!(chosen >= 0 && chosen < items.length)) throw new Error('Báo giá dạng phương án: chọn phương án khách đặt cọc.');
    items = [items[chosen]];
  }
  var need = {};
  items.forEach(function (i) {
    if (i.nonStock || !i.productId) return;
    var k = i.productId + '|' + i.unit;
    need[k] = need[k] || {id: i.productId, unit: i.unit, name: i.name, quantity: 0};
    need[k].quantity = Math.round((need[k].quantity + Number(i.quantity)) * 10000) / 10000;
  });
  return Object.keys(need).map(function (k) { return need[k]; });
}

function deposit(req, staff) {
  var q = req.quote, amount = Number(req.amount);
  if (!(amount >= 0)) throw new Error('Nhập số tiền cọc hợp lệ.');
  ensureSheet('Kho'); ensureSheet('DeXuatNhap');
  saveQuote(q, staff, null);
  var sh = sheet('BaoGia'), row = findRow(sh, q.id), cur = sh.getRange(row, B.status + 1).getValue();
  if (['Nháp', 'Đã gửi khách'].indexOf(cur) < 0) throw new Error('Báo giá đang "' + cur + '", không đặt cọc được.');
  var chosen = q.mode === 'options' ? Number(req.chosen) : '';
  var kho = readKho(), lines = needsOf(q, chosen), problems = [], untracked = [], short = [];
  lines.forEach(function (n) {
    var s = kho.map[n.id];
    if (!s) { untracked.push(n.name); n.skip = true; return; }
    if (s.unit !== n.unit) problems.push(n.name + ': đơn vị kho "' + s.unit + '" khác báo giá "' + n.unit + '"');
    else if (s.quantity < n.quantity) {
      var miss = Math.round((n.quantity - s.quantity) * 10000) / 10000;
      problems.push(n.name + ': cần ' + n.quantity + ', kho còn ' + s.quantity + ' → thiếu ' + miss);
      short.push({type: 'Thiếu hàng khi đặt cọc', id: n.id, name: n.name, unit: n.unit, need: n.quantity, have: s.quantity, miss: miss, min: s.min, suggest: Math.round((miss + s.min) * 10000) / 10000});
    }
  });
  if (problems.length) {
    if (short.length) addAlerts(short, q, staff);
    throw new Error('Không đủ tồn để đặt cọc:\n' + problems.join('\n') + (short.length ? '\n→ Đã tự ghi cảnh báo & đề xuất nhập hàng (tab DeXuatNhap) để kế toán xử lý.' : ''));
  }
  var now = stamp(), slip = nextSlip(), log = [];
  lines.forEach(function (n) {
    if (n.skip) return;
    var s = kho.map[n.id], before = s.quantity, after = Math.round((before - n.quantity) * 10000) / 10000;
    kho.sheet.getRange(s.row, 4, 1, 2).setValues([[after, now]]);
    s.quantity = after;
    log.push([slip, now, 'Xuất - đặt cọc', q.id, q.number || '', q.customer || '', n.id, n.name, n.unit, n.quantity, before, after, staff]);
  });
  if (log.length) { var px = sheet('PhieuXuat'); px.getRange(px.getLastRow() + 1, 1, log.length, log[0].length).setValues(log); }
  sh.getRange(row, B.status + 1, 1, 6).setValues([['Đặt cọc', amount, now, staff, log.length ? slip : '(không có hàng theo dõi tồn)', chosen === '' ? '' : 'Phương án ' + (chosen + 1)]]);
  sh.getRange(row, B.updatedAt + 1, 1, 2).setValues([[now, staff]]);
  // Cảnh báo sau khi trừ: hết hàng, hoặc dưới mức tồn tối thiểu (cột G tab Kho)
  var low = [];
  lines.forEach(function (n) {
    if (n.skip) return;
    var s = kho.map[n.id];
    if (s.quantity <= 0 || (s.min > 0 && s.quantity < s.min)) {
      low.push({type: s.quantity <= 0 ? 'Hết hàng sau đặt cọc' : 'Dưới tồn tối thiểu', id: n.id, name: n.name, unit: n.unit, need: '', have: s.quantity, miss: '', min: s.min || '', suggest: s.min > 0 ? Math.round((s.min - s.quantity) * 10000) / 10000 : ''});
    }
  });
  if (low.length) addAlerts(low, null, staff);
  return {status: 'Đặt cọc', slip: log.length ? slip : '', deducted: log.length, untracked: untracked, alerts: low.map(function (a) { return a.type + ': ' + a.name + ' (còn ' + a.have + ')'; }),
    rows: kho.list.map(function (x) { var m = kho.map[x.id]; return {id: x.id, name: x.name, unit: x.unit, quantity: m.quantity, min: m.min}; })};
}

// Ghi / cập nhật cảnh báo & đề xuất nhập. Trùng (cùng loại, mã hàng, báo giá) mà còn "Chờ xử lý" thì cập nhật dòng cũ, không nhân đôi.
function addAlerts(items, q, staff) {
  var sh = ensureSheet('DeXuatNhap'), rows = body(sh), now = stamp(), add = [];
  items.forEach(function (a) {
    var qid = q ? q.id : '', rec = [now, a.type, qid, q ? (q.number || '') : '', q ? (q.customer || '') : '', staff, a.id, a.name, a.unit, a.need, a.have, a.miss, a.min, a.suggest, ALERT_OPEN,
      a.suggest === '' ? 'Điền cột "Tồn tối thiểu" ở tab Kho để app tự tính số đề xuất' : ''];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r[1] === a.type && String(r[6]) === String(a.id) && String(r[2]) === String(qid) && r[14] === ALERT_OPEN) {
        sh.getRange(i + 2, 1, 1, rec.length).setValues([rec]); return;
      }
    }
    add.push(rec);
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
}

function listAlerts() {
  var sh = SpreadsheetApp.getActive().getSheetByName('DeXuatNhap');
  if (!sh) return [];
  return body(sh).map(function (r) { return r.map(cell); }).filter(function (r) { return ALERT_DONE.indexOf(r[14]) < 0; }).map(function (r) {
    return {time: r[0], type: r[1], number: r[3], customer: r[4], staff: r[5], id: r[6], name: r[7], unit: r[8], need: r[9], have: r[10], miss: r[11], min: r[12], suggest: r[13], status: r[14], note: r[15]};
  }).reverse();
}

function nextSlip() {
  var prefix = 'PX-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-', seen = {};
  body(sheet('PhieuXuat')).forEach(function (x) { var s = String(x[0]); if (s.indexOf(prefix) === 0 && !/-HK$/.test(s)) seen[s] = 1; });
  return prefix + ('00' + (Object.keys(seen).length + 1)).slice(-3);
}

function cancel(req, staff) {
  var sh = sheet('BaoGia'), row = findRow(sh, req.id);
  if (!row) throw new Error('Báo giá chưa lưu lên hệ thống.');
  var r = sh.getRange(row, 1, 1, SHEETS.BaoGia.length).getValues()[0], cur = r[B.status], now = stamp();
  var note = text(req.reason) || 'Không ghi lý do';
  if (cur === 'Hủy' || cur === 'Hoàn tất') throw new Error('Báo giá đang "' + cur + '", không hủy được.');
  var returned = 0;
  if (cur === 'Đặt cọc') {
    var px = sheet('PhieuXuat'), logs = body(px).filter(function (x) { return String(x[3]) === String(req.id) && x[2] === 'Xuất - đặt cọc'; });
    var kho = readKho(), back = [];
    logs.forEach(function (x) {
      var id = String(x[6]), qn = Number(x[9]), s = kho.map[id];
      if (!s) throw new Error('Mã ' + id + ' không còn trong tab Kho, chưa hoàn kho được.');
      var before = s.quantity, after = Math.round((before + qn) * 10000) / 10000;
      kho.sheet.getRange(s.row, 4, 1, 2).setValues([[after, now]]); s.quantity = after;
      back.push([x[0] + '-HK', now, 'Hoàn kho - hủy', req.id, r[B.number], r[B.customer], id, x[7], x[8], qn, before, after, staff]);
    });
    if (back.length) px.getRange(px.getLastRow() + 1, 1, back.length, back[0].length).setValues(back);
    returned = back.length;
  }
  sh.getRange(row, B.status + 1).setValue('Hủy');
  sh.getRange(row, B.updatedAt + 1, 1, 3).setValues([[now, staff, note]]);
  return {status: 'Hủy', returned: returned, rows: readKho().list};
}
