// Hệ thống chung: lưu báo giá, đặt cọc trừ kho, hủy hoàn kho qua Google Sheet (Apps Script web app)
const KEY = 'stc-cloud-v1';
export const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbykVznrCEOQj8EBbCO-1bRXMC0NULXPi24DCn1DOQJLfADQuwWLhPKlc9lcCv20-BSgJg/exec';
const LOCKED = ['Đặt cọc', 'Hoàn tất', 'Hủy'];
const STATUSES = ['Nháp', 'Đã gửi khách', 'Đặt cọc', 'Hoàn tất', 'Hủy'];

export function installCloud(api) {
  const $ = s => document.querySelector(s), e = api.esc;
  let cfg = { url: DEFAULT_URL, pin: '', staff: '', day: '' }, rows = null, list = [], alerts = [], busy = false;
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (err) { /* dùng mặc định */ }
  if (!cfg.url) cfg.url = DEFAULT_URL;
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (err) { api.tell('Không lưu được cấu hình kết nối trên trình duyệt này.'); } };
  const connected = () => !!(cfg.url && cfg.pin && cfg.staff);
  // Đăng nhập theo ngày (giờ Việt Nam): sang ngày mới phải nhập lại PIN
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  if (cfg.pin && cfg.day !== today()) { cfg.pin = ''; cfg.staff = ''; saveCfg(); }
  const info = () => { const q = api.state(); return q.cloud && q.cloud.id === q.id ? q.cloud : null; };
  const locked = () => LOCKED.includes(info()?.status);

  async function call(action, payload = {}) {
    if (!cfg.url) throw Error('Chưa kết nối hệ thống chung (tab Công ty).');
    let r;
    try { r = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, pin: cfg.pin, ...payload }), signal: AbortSignal.timeout(45000) }); }
    catch (err) { throw Error('Không kết nối được hệ thống (mạng yếu hoặc link sai). Báo giá vẫn còn trên máy này.'); }
    let d; try { d = JSON.parse(await r.text()); } catch (err) { throw Error('Link không trả dữ liệu hệ thống. Kiểm tra link /exec và quyền truy cập "Bất kỳ ai".'); }
    if (!d.ok) { if (/Mã PIN không đúng|quá nhiều lần/.test(d.error || '') && action !== 'ping') logout('Phiên đăng nhập không còn hiệu lực. Vui lòng nhập lại PIN.'); throw Error(d.error || 'Hệ thống báo lỗi.'); }
    return d;
  }
  async function run(btn, fn) {
    if (busy) return; busy = true; const all = [...document.querySelectorAll('.cloud-panel button,.cloud-list button')]; all.forEach(b => b.disabled = true);
    const old = btn?.textContent; if (btn) btn.textContent = 'Đang xử lý…';
    try { await fn(); } catch (err) { msg(err.message, true); api.tell(err.message.split('\n')[0]); } finally { busy = false; if (btn) btn.textContent = old; render(); }
  }
  function msg(t, bad) { const m = $('#cloudMsg'); if (m) { m.textContent = t; m.className = bad ? 'error' : 'stock-ok'; } }

  /* ---------- payload ---------- */
  function payload(chosen) {
    const q = api.clone(api.state()); delete q.cloud;
    if (q.company) { delete q.company.fptLogo; if (/^data:/.test(q.company.logo || '')) q.company.logo = 'assets/stc-logo.jpg'; }
    if (!q.preparedBy) q.preparedBy = cfg.staff;
    const t = api.totals(q).total;
    q.total = q.mode === 'options' ? (chosen >= 0 ? api.amount(q.items[chosen]) : 0) : t;
    return q;
  }
  function apply(res, extra = {}) {
    const q = api.state();
    q.cloud = { ...(info() || {}), id: q.id, status: res.status, updatedAt: res.updatedAt || new Date().toLocaleString('vi-VN'), updatedBy: cfg.staff, ...extra };
    if (!q.preparedBy) q.preparedBy = cfg.staff;
    if (res.rows) { rows = res.rows; api.stockChanged(); }
    api.changed(); api.saveLocal();
  }

  /* ---------- Đăng nhập bằng PIN ---------- */
  const gate = document.createElement('div'); gate.id = 'loginGate';
  gate.innerHTML = `<form class="login-card" autocomplete="off"><img src="assets/stc-logo.jpg" alt="STC CROP"><h1>APP BÁO GIÁ STC</h1><p>Nhập mã PIN nhân viên để vào</p>
  <input id="loginPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="● ● ● ● ● ●" aria-label="Mã PIN 6 số" required>
  <button id="loginBtn" class="primary" type="submit">Đăng nhập</button><p id="loginMsg" role="status"></p>
  <small>Quên PIN hoặc nghi bị lộ: báo Giám đốc để đổi PIN.</small></form>`;
  document.body.append(gate);
  gate.querySelector('form').onsubmit = async ev => {
    ev.preventDefault(); const pin = $('#loginPin').value.trim(), btn = $('#loginBtn');
    if (!/^\d{6}$/.test(pin)) { $('#loginMsg').textContent = 'PIN gồm 6 chữ số.'; return; }
    btn.disabled = true; btn.textContent = 'Đang kiểm tra…'; $('#loginMsg').textContent = '';
    const prev = { ...cfg }; cfg.pin = pin;
    try { const d = await call('ping'); cfg.staff = d.staff; cfg.day = today(); saveCfg(); }
    catch (err) { cfg = prev; $('#loginMsg').textContent = err.message; return; }
    finally { btn.disabled = false; btn.textContent = 'Đăng nhập'; }
    $('#loginPin').value = ''; showGate(false);
    try { await loadAll(); api.tell('Xin chào ' + cfg.staff); }
    catch (err) { api.tell('Đã đăng nhập nhưng chưa tải được bảng giá: ' + err.message + ' — vào tab Công ty bấm "Tải lại bảng giá".'); }
  };
  function showGate(on) { document.body.classList.toggle('need-login', on); if (on) setTimeout(() => $('#loginPin')?.focus(), 50); render(); }
  function logout(why) {
    cfg = { url: cfg.url || DEFAULT_URL, pin: '', staff: '', day: '' }; saveCfg(); rows = null; list = []; alerts = [];
    api.onLogout(); renderList(); renderAlerts(); showGate(true); if (why) $('#loginMsg').textContent = why;
  }
  async function loadAll() { const d = await call('catalog'); api.onCatalog(d); await loadStock(); await loadList(); await loadAlerts(); }
  // Để app mở qua đêm: sang ngày mới tự đăng xuất
  setInterval(() => { if (connected() && cfg.day !== today()) logout('Đã sang ngày mới, vui lòng nhập lại PIN.'); }, 60000);

  const who = document.createElement('div'); who.className = 'user-chip';
  who.innerHTML = '<span id="userName"></span><button id="logoutBtn" type="button">Đăng xuất</button>';
  document.querySelector('.topbar').append(who);
  $('#logoutBtn').onclick = () => logout();

  const set = document.createElement('section'); set.className = 'card cloud-settings';
  set.innerHTML = `<h2>Tài khoản & hệ thống chung</h2><p id="cloudConnMsg" class="muted"></p>
  <p class="muted">Bảng giá: tab <b>DanhMuc</b> · tồn kho: tab <b>Kho</b> · báo giá, đặt cọc, phiếu xuất, đề xuất nhập: Google Sheet <b>STC_BaoGia_Data</b>. Sửa giá trên Sheet rồi bấm <b>Tải lại bảng giá</b>.</p>
  <div class="heading-actions"><button id="reloadCatalog">↻ Tải lại bảng giá & tồn kho</button><button id="logoutBtn2">Đăng xuất</button></div>`;
  $('#settings').append(set);
  const reloadCatalog = () => run($('#reloadCatalog'), async () => { await loadAll(); api.tell('Đã tải lại bảng giá và tồn kho từ hệ thống.'); });
  $('#reloadCatalog').onclick = reloadCatalog;
  $('#logoutBtn2').onclick = () => logout();
  const note = document.createElement('p'); note.className = 'catalog-cloud-note';
  note.innerHTML = 'Bảng giá quản lý trên Google Sheet <b>STC_BaoGia_Data → tab DanhMuc</b>. Sửa giá ở đó rồi bấm “↻ Tải lại bảng giá & tồn kho” (tab Công ty).';
  document.querySelector('#catalog .page-heading')?.after(note);

  /* ---------- UI: Soạn báo giá ---------- */
  const panel = document.createElement('section'); panel.className = 'card cloud-panel';
  panel.innerHTML = `<div class="card-title"><h2><span class="step" id="cloudStep">05</span> Hệ thống chung · Đặt cọc & kho</h2><span id="cloudStatus" class="badge">Chưa kết nối</span></div>
  <p id="cloudInfo" class="muted"></p>
  <div class="cloud-actions"><button id="cloudSave" class="primary">Lưu lên hệ thống</button><button id="cloudSent">Đánh dấu đã gửi khách</button></div>
  <div class="cloud-deposit"><label id="cloudChosenWrap">Phương án khách chọn<select id="cloudChosen"></select></label><label>Số tiền cọc (đ)<input id="cloudAmount" type="number" min="0" step="1000"></label><button id="cloudDeposit" class="primary">Đặt cọc & trừ kho</button></div>
  <div class="cloud-actions"><button id="cloudComplete">Hoàn tất (đã giao, đã thu đủ)</button><button id="cloudCancel" class="danger">Hủy báo giá · hoàn kho nếu đã cọc</button></div>
  <p id="cloudMsg" role="status" style="white-space:pre-wrap"></p>`;
  $('.editor-column').append(panel);

  $('#cloudChosen').onchange = () => { $('#cloudAmount').value = suggestDeposit(); };
  function suggestDeposit() { const q = api.state(); const c = Number($('#cloudChosen').value); const base = q.mode === 'options' ? (c >= 0 ? api.amount(q.items[c]) : 0) : api.totals(q).total; return Math.round(base * 0.2 / 1000) * 1000; }

  $('#cloudSave').onclick = () => run($('#cloudSave'), async () => {
    const q = payload(-1); if (!q.items.length) throw Error('Thêm sản phẩm trước khi lưu.');
    const d = await call('save', { quote: q }); apply(d); msg('✓ Đã lưu lên hệ thống lúc ' + d.updatedAt + ' — trạng thái: ' + d.status); loadList();
  });
  $('#cloudSent').onclick = () => run($('#cloudSent'), async () => {
    if (!info()) { const d0 = await call('save', { quote: payload(-1) }); apply(d0); }
    const d = await call('sent', { id: api.state().id }); apply(d); msg('✓ Đã đánh dấu: Đã gửi khách.'); loadList();
  });
  $('#cloudDeposit').onclick = () => run($('#cloudDeposit'), async () => {
    const q = api.state(); if (!q.items.length) throw Error('Báo giá chưa có sản phẩm.');
    if (!q.customer?.trim()) { const el = document.querySelector('#customer'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus({ preventScroll: true }); throw Error('Nhập tên khách hàng trước khi đặt cọc.'); }
    if (!String(q.phone || '').trim()) { const el = document.querySelector('[data-field=phone]'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus({ preventScroll: true }); throw Error('Nhập số điện thoại khách trước khi đặt cọc.'); }
    const chosen = q.mode === 'options' ? Number($('#cloudChosen').value) : -1;
    if (q.mode === 'options' && !(chosen >= 0)) throw Error('Chọn phương án khách đặt cọc.');
    const amount = Number($('#cloudAmount').value);
    if (!Number.isFinite(amount) || amount < 0) throw Error('Nhập số tiền cọc.');
    const lines = q.mode === 'options' ? [q.items[chosen]] : q.items;
    const text = lines.filter(i => !i.nonStock && i.productId).map(i => {
      const s = rows?.find(r => r.id === i.productId && r.unit === i.unit);
      return s ? `• ${i.name}: trừ ${api.number(i.quantity)} ${i.unit}, tồn ${api.number(s.quantity)} → ${api.number(s.quantity - i.quantity)}` : `• ${i.name}: không theo dõi tồn — không trừ kho`;
    }).join('\n') || '• Không có hàng theo dõi tồn.';
    if (!await api.confirm('Đặt cọc & trừ kho?', `${q.number} · ${q.customer || 'Chưa có tên khách'}\nTiền cọc: ${api.money(amount)}${q.mode === 'options' ? '\nPhương án ' + (chosen + 1) + ': ' + q.items[chosen].name : ''}\n${text}\nSau khi cọc, báo giá bị khóa (muốn sửa phải nhân bản).`)) return;
    let d;
    try { d = await call('deposit', { quote: payload(chosen), amount, chosen: chosen >= 0 ? chosen : undefined }); }
    catch (err) { loadAlerts().catch(() => {}); throw err; }
    apply(d, { deposit: amount, depositBy: cfg.staff, slip: d.slip, chosen: chosen >= 0 ? 'Phương án ' + (chosen + 1) : '' });
    msg(`✓ Đã đặt cọc ${api.money(amount)}. ` + (d.slip ? `Phiếu ${d.slip}: trừ ${d.deducted} mã hàng.` : 'Không có hàng theo dõi tồn nên không trừ kho.') + (d.untracked?.length ? '\nKhông theo dõi tồn: ' + d.untracked.join(', ') : '') + (d.alerts?.length ? '\n⚠ ' + d.alerts.join('\n⚠ ') + '\n→ Đã ghi đề xuất nhập hàng cho kế toán.' : ''));
    loadList(); loadAlerts();
  });
  $('#cloudComplete').onclick = () => run($('#cloudComplete'), async () => {
    if (!await api.confirm('Hoàn tất báo giá?', 'Xác nhận đã giao hàng/thi công và thu đủ tiền.')) return;
    const d = await call('complete', { id: api.state().id }); apply(d); msg('✓ Đã hoàn tất.'); loadList();
  });
  $('#cloudCancel').onclick = () => run($('#cloudCancel'), async () => {
    const st = info()?.status;
    if (!await api.confirm('Hủy báo giá?', st === 'Đặt cọc' ? 'Hàng đã trừ khi đặt cọc sẽ được HOÀN lại kho và ghi phiếu hoàn kho. Tiền cọc xử lý ngoài app.' : 'Báo giá chuyển sang trạng thái Hủy.')) return;
    const reason = prompt('Lý do hủy (ghi vào hệ thống):', '') ?? '';
    const d = await call('cancel', { id: api.state().id, reason }); apply(d); msg('✓ Đã hủy.' + (d.returned ? ` Hoàn kho ${d.returned} mã hàng.` : '')); loadList();
  });

  /* ---------- UI: Đã lưu ---------- */
  const box = document.createElement('section'); box.className = 'card cloud-list';
  box.innerHTML = `<div class="card-title"><h2>Báo giá chung · cả công ty</h2><button id="cloudRefresh">↻ Tải lại</button></div>
  <div class="variant-filters"><label>Trạng thái<select id="cloudFStatus"><option value="">Tất cả</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select></label><label>Nhân viên<select id="cloudFStaff"><option value="">Tất cả</option></select></label><label>Tìm khách / số báo giá<input id="cloudFind"></label></div>
  <div id="cloudSummary" class="muted"></div><div id="cloudRows" class="saved-list"></div>`;
  $('#history').insertBefore(box, $('#savedList'));

  // Cảnh báo tồn kho & đề xuất nhập hàng (tab DeXuatNhap trên Sheet)
  const warnBox = document.createElement('section'); warnBox.className = 'card cloud-alerts';
  warnBox.innerHTML = `<div class="card-title"><h2>⚠ Cảnh báo tồn kho & đề xuất nhập hàng</h2><span id="alertCount" class="badge">0 việc</span></div>
  <p class="muted">Tự ghi khi đặt cọc bị thiếu hàng, hoặc sau khi cọc mà tồn hết / dưới mức tối thiểu. Kế toán xử lý ở tab <b>DeXuatNhap</b> trên Google Sheet (đổi Trạng thái thành “Đã đặt hàng”, “Đã nhập” hoặc “Bỏ qua”).</p>
  <div class="table-scroll"><table class="data-table"><thead><tr><th>Thời gian</th><th>Loại</th><th>Hàng</th><th>Cần</th><th>Tồn</th><th>Thiếu</th><th>Đề xuất nhập</th><th>Báo giá · khách</th><th>Trạng thái</th></tr></thead><tbody id="alertRows"></tbody></table></div>`;
  $('#history').insertBefore(warnBox, $('#savedList'));
  async function loadAlerts() { if (!connected()) return; const d = await call('alerts'); alerts = d.alerts || []; renderAlerts(); }
  function renderAlerts() {
    $('#alertCount').textContent = alerts.length + ' việc';
    $('#alertRows').innerHTML = alerts.map(a => `<tr><td>${e(a.time)}</td><td><b class="${/Thiếu|Hết/.test(a.type) ? 'stock-danger' : ''}">${e(a.type)}</b></td><td>${e(a.name)}<br><small class="muted">${e(a.id)} · ${e(a.unit)}</small></td><td>${e(a.need)}</td><td>${e(a.have)}</td><td>${e(a.miss)}</td><td><b>${e(a.suggest)}</b>${a.note ? `<br><small class="muted">${e(a.note)}</small>` : ''}</td><td>${e(a.number)}${a.customer ? ' · ' + e(a.customer) : ''}<br><small class="muted">${e(a.staff)}</small></td><td>${e(a.status)}</td></tr>`).join('')
      || `<tr><td colspan="9" class="muted">${connected() ? 'Không có cảnh báo nào đang chờ xử lý.' : 'Chưa kết nối hệ thống chung.'}</td></tr>`;
  }
  $('#cloudRefresh').onclick = () => run($('#cloudRefresh'), async () => { await loadList(); await loadAlerts(); });
  ['#cloudFStatus', '#cloudFStaff', '#cloudFind'].forEach(s => $(s).oninput = renderList);
  $('#cloudRows').onclick = ev => {
    const b = ev.target.closest('[data-cloud-open]'); if (!b) return;
    run(b, async () => {
      if (api.state().items.length && !await api.confirm('Mở báo giá từ hệ thống?', 'Thay bản nháp đang soạn trên máy này. Hãy lưu nếu cần giữ.')) return;
      const d = await call('get', { id: b.dataset.cloudOpen }); const q = d.quote; q.cloud = { ...q.cloud, id: q.id };
      api.open(q); msg('Đã mở từ hệ thống — trạng thái: ' + q.cloud.status);
    });
  };

  async function loadList() { if (!connected()) return; const d = await call('list'); list = d.quotes; renderList(); }
  async function loadStock() { if (!connected()) return; const d = await call('stock'); rows = d.rows; api.stockChanged(); }
  function renderList() {
    const staffSel = $('#cloudFStaff'), cur = staffSel.value;
    staffSel.innerHTML = '<option value="">Tất cả</option>' + [...new Set(list.map(q => q.preparedBy).filter(Boolean))].map(s => `<option ${s === cur ? 'selected' : ''}>${e(s)}</option>`).join('');
    const st = $('#cloudFStatus').value, sf = staffSel.value, f = api.fold($('#cloudFind').value);
    const view = list.filter(q => (!st || q.status === st) && (!sf || q.preparedBy === sf) && (!f || api.fold(q.customer + ' ' + q.number + ' ' + q.phone).includes(f)));
    const count = s => list.filter(q => q.status === s).length;
    $('#cloudSummary').textContent = connected() ? STATUSES.map(s => `${s}: ${count(s)}`).join(' · ') : 'Chưa kết nối hệ thống chung (tab Công ty).';
    $('#cloudRows').innerHTML = view.map(q => `<article class="saved-card"><div><h2>${e(q.customer || 'Chưa có tên khách')} <span class="cloud-badge s-${STATUSES.indexOf(q.status)}">${e(q.status)}</span></h2><p class="muted">${e(q.number)} · ${e(q.date)} · Lập: ${e(q.preparedBy)}${q.status === 'Đặt cọc' || q.status === 'Hoàn tất' ? ` · Cọc ${api.money(Number(q.deposit) || 0)} (${e(q.depositBy)} ${e(q.depositAt)})${q.slip ? ' · ' + e(q.slip) : ''}${q.chosen ? ' · ' + e(q.chosen) : ''}` : ''} · Cập nhật ${e(q.updatedAt)} bởi ${e(q.updatedBy)}</p><strong>${q.total ? api.money(Number(q.total)) : (q.mode === 'Phương án lựa chọn' ? 'Phương án' : '')}</strong></div><div class="heading-actions"><button data-cloud-open="${e(q.id)}">Mở</button></div></article>`).join('') || (connected() ? '<div class="empty">Chưa có báo giá nào trên hệ thống.</div>' : '');
  }

  let lastId = null;
  function render() {
    if (api.state().id !== lastId) { lastId = api.state().id; delete $('#cloudAmount').dataset.touched; }
    document.body.classList.toggle('cloud-on', connected()); $('#cloudStep').textContent = connected() ? '04' : '05';
    $('#userName').textContent = connected() ? '👤 ' + cfg.staff : '';
    $('#cloudConnMsg').textContent = connected() ? '✓ Đang đăng nhập: ' + cfg.staff + ' (tự đăng xuất khi sang ngày mới)' : 'Chưa đăng nhập.';
    const q = api.state(), c = info(), on = connected(), lock = locked();
    $('#cloudStatus').textContent = !on ? 'Chưa kết nối' : c ? c.status : 'Chưa lưu lên hệ thống';
    $('#cloudStatus').className = 'badge cloud-badge s-' + STATUSES.indexOf(c?.status);
    $('#cloudInfo').textContent = !on ? 'Vào tab Công ty → Kết nối hệ thống chung để lưu báo giá dùng chung và đặt cọc trừ kho.'
      : (c ? `Cập nhật ${c.updatedAt || ''} bởi ${c.updatedBy || ''}` + (c.deposit !== undefined && c.deposit !== '' ? ` · Cọc ${api.money(Number(c.deposit) || 0)} · ${c.slip || ''} ${c.chosen || ''}` : '') : 'Báo giá này mới nằm trên máy. Bấm "Lưu lên hệ thống" để cả công ty thấy.') + ` · Đang dùng: ${cfg.staff}` + (lock ? '\n⚠ Báo giá đã khóa trên hệ thống. Muốn sửa: Tạo mới hoặc Nhân bản ở tab Đã lưu.' : '');
    const opts = q.mode === 'options';
    $('#cloudChosenWrap').style.display = opts ? '' : 'none';
    const sel = $('#cloudChosen'), prevSel = sel.value;
    sel.innerHTML = '<option value="">— Chọn —</option>' + q.items.map((i, n) => `<option value="${n}">Phương án ${n + 1}: ${e(i.name).slice(0, 60)} · ${api.money(api.amount(i))}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === prevSel) ? prevSel : '';
    if (!$('#cloudAmount').matches(':focus') && !$('#cloudAmount').dataset.touched) $('#cloudAmount').value = suggestDeposit() || '';
    const st = c?.status;
    $('#cloudSave').disabled = !on || lock || busy;
    $('#cloudSent').disabled = !on || lock || st === 'Đã gửi khách' || busy;
    $('#cloudDeposit').disabled = !on || lock || busy;
    $('#cloudComplete').disabled = !on || st !== 'Đặt cọc' || busy;
    $('#cloudCancel').disabled = !on || !c || st === 'Hủy' || st === 'Hoàn tất' || busy;
  }
  $('#cloudAmount').oninput = ev => { ev.target.dataset.touched = '1'; };

  render(); renderList(); renderAlerts();
  if (connected()) { showGate(false); loadAll().catch(err => api.tell('Hệ thống chung: ' + err.message + ' — đang dùng bảng giá đã tải trước đó.')); }
  else showGate(true);
  return { stock: () => (connected() ? rows : null), locked, render, reloadCatalog };
}
