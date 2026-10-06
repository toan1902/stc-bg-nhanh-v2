// Hệ thống chung: lưu báo giá, đặt cọc trừ kho, hủy hoàn kho qua Google Sheet (Apps Script web app)
const KEY = 'stc-cloud-v1';
export const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbykVznrCEOQj8EBbCO-1bRXMC0NULXPi24DCn1DOQJLfADQuwWLhPKlc9lcCv20-BSgJg/exec';
const LOCKED = ['Đặt cọc', 'Hoàn tất', 'Hủy'];
const STATUSES = ['Nháp', 'Đã gửi khách', 'Đặt cọc', 'Hoàn tất', 'Hủy'];

export function installCloud(api) {
  const $ = s => document.querySelector(s), e = api.esc;
  let cfg = { url: DEFAULT_URL, pin: '', staff: '' }, rows = null, list = [], busy = false;
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (err) { /* dùng mặc định */ }
  if (!cfg.url) cfg.url = DEFAULT_URL;
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (err) { api.tell('Không lưu được cấu hình kết nối trên trình duyệt này.'); } };
  const connected = () => !!(cfg.url && cfg.pin && cfg.staff);
  const info = () => { const q = api.state(); return q.cloud && q.cloud.id === q.id ? q.cloud : null; };
  const locked = () => LOCKED.includes(info()?.status);

  async function call(action, payload = {}) {
    if (!cfg.url) throw Error('Chưa kết nối hệ thống chung (tab Công ty).');
    let r;
    try { r = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, pin: cfg.pin, ...payload }), signal: AbortSignal.timeout(45000) }); }
    catch (err) { throw Error('Không kết nối được hệ thống (mạng yếu hoặc link sai). Báo giá vẫn còn trên máy này.'); }
    let d; try { d = JSON.parse(await r.text()); } catch (err) { throw Error('Link không trả dữ liệu hệ thống. Kiểm tra link /exec và quyền truy cập "Bất kỳ ai".'); }
    if (!d.ok) throw Error(d.error || 'Hệ thống báo lỗi.');
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

  /* ---------- UI: Công ty ---------- */
  const set = document.createElement('section'); set.className = 'card cloud-settings';
  set.innerHTML = `<h2>Kết nối hệ thống chung (Google Sheet)</h2><p class="muted">Báo giá, đặt cọc và tồn kho dùng chung cho cả công ty. Dán link Ứng dụng web Apps Script (kết thúc bằng /exec) và mã PIN của bạn. PIN chỉ lưu trên trình duyệt máy này.</p>
  <div class="field-grid"><label class="wide">Link ứng dụng web<input id="cloudURL" type="url" placeholder="https://script.google.com/macros/s/…/exec"></label><label>Mã PIN nhân viên<input id="cloudPin" type="password" inputmode="numeric" autocomplete="off" maxlength="6"></label></div>
  <div class="heading-actions"><button id="cloudConnect" class="primary">Kết nối</button><button id="cloudDisconnect">Ngắt kết nối trên máy này</button></div><p id="cloudConnMsg" role="status"></p>`;
  $('#settings').append(set);
  $('#cloudConnect').onclick = () => run($('#cloudConnect'), async () => {
    const url = $('#cloudURL').value.trim(), pin = $('#cloudPin').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) throw Error('Link phải là link Ứng dụng web của Google Apps Script (https://script.google.com/macros/s/…/exec).');
    if (!/^\d{6}$/.test(pin)) throw Error('PIN gồm 6 chữ số.');
    const prev = { ...cfg }; cfg.url = url; cfg.pin = pin;
    try { const d = await call('ping'); cfg.staff = d.staff; saveCfg(); } catch (err) { cfg = prev; throw err; }
    $('#cloudConnMsg').textContent = '✓ Đã kết nối: ' + cfg.staff; await loadStock(); await loadList(); await loadAlerts(); api.tell('Đã kết nối hệ thống chung — ' + cfg.staff);
  });
  $('#cloudDisconnect').onclick = () => { cfg = { url: cfg.url || DEFAULT_URL, pin: '', staff: '' }; saveCfg(); rows = null; list = []; api.stockChanged(); render(); $('#cloudConnMsg').textContent = 'Đã ngắt kết nối trên máy này.'; };

  /* ---------- UI: Soạn báo giá ---------- */
  const panel = document.createElement('section'); panel.className = 'card cloud-panel';
  panel.innerHTML = `<div class="card-title"><h2>05 · Hệ thống chung · Đặt cọc & kho</h2><span id="cloudStatus" class="badge">Chưa kết nối</span></div>
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
  let alerts = [];
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
    document.body.classList.toggle('cloud-on', connected());
    $('#cloudURL').value = cfg.url || ''; if (!$('#cloudPin').matches(':focus')) $('#cloudPin').value = cfg.pin || '';
    if (connected() && !$('#cloudConnMsg').textContent) $('#cloudConnMsg').textContent = '✓ Đang kết nối: ' + cfg.staff;
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
  if (connected()) { loadStock().then(loadList).then(loadAlerts).catch(err => api.tell('Hệ thống chung: ' + err.message)); }
  return { stock: () => (connected() ? rows : null), locked, render, refresh: () => run(null, async () => { await loadStock(); await loadList(); }) };
}
