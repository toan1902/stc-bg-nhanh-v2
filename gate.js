import {normalizeProducts} from './core.js';
let data=null;
export async function loadGateData(){const r=await fetch('assets/gate-products.json',{cache:'no-store'});if(!r.ok)throw Error('Không tải được dữ liệu động cơ cổng.');const d=await r.json();d.products=normalizeProducts(d.products);data=d;return d;}
export const gateData=()=>data;
export const isGateId=id=>/^CONG-/.test(String(id||''));
function gateModels(q){if(!data)return [];const ids=[...new Set(q.items.map(i=>i.productId).filter(id=>data.specs[id]))];return ids.map(id=>({id,...data.specs[id]}));}
// part 'a' = chỉ tiêu + thành phần, 'b' = yêu cầu kỹ thuật + quy trình, 'all' = cả hai
export function gateAppendixHTML(q,esc,part='all'){const list=gateModels(q);if(!list.length)return '';let h='';
 if(part!=='b'){
  const rows=data.specRows.filter(([k])=>list.some(p=>p[k]&&p[k]!=='—'));
  h+=`<h4 class="gate-h">Chỉ tiêu kỹ thuật</h4><table class="gate-spec"><thead><tr><th>Chỉ tiêu</th>${list.map(p=>`<th>${esc(p.short)}</th>`).join('')}</tr></thead><tbody>${rows.map(([k,l])=>`<tr><td>${esc(l)}</td>${list.map(p=>`<td>${esc(p[k]||'—')}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="gate-src">Nguồn: catalogue hãng AB GATE / DEA. Dấu “—” là thông số catalogue không ghi.</p>`;
  h+=`<h4 class="gate-h">Thành phần bộ sản phẩm</h4><div class="gate-cards">${list.map(p=>`<div class="gate-card"><b>${esc(p.short)}</b><ul>${p.components.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>`).join('')}</div>`;
 }
 if(part!=='a'){
  const kinds=['amsan','lua'].filter(k=>list.some(p=>p.kind===k)).concat('dien');
  h+=`<h4 class="gate-h">Yêu cầu kỹ thuật &amp; chuẩn bị mặt bằng</h4><div class="gate-cards">${kinds.map(k=>{const r=data.requirements[k];return `<div class="gate-card"><b>${esc(r.title)}</b><ul>${r.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;}).join('')}</div>`;
  h+=`<h4 class="gate-h">Quy trình triển khai</h4><ol class="gate-flow">${data.flow.map(([t,d])=>`<li><b>${esc(t)}:</b> ${esc(d)}</li>`).join('')}</ol>`;
 }
 return `<section class="gate-appendix">${h}</section>`;}
// Mẫu 3 phương án; lấy tên/đơn vị theo danh mục hiện tại để khớp tên đã chỉnh
export function gateSample(catalog){if(!data)throw Error('Chưa tải dữ liệu động cơ cổng.');const s=data.sample;return {items:s.items.map(x=>{const p=catalog.find(c=>c.id===x.productId)||data.products.find(c=>c.id===x.productId);return {productId:p.id,name:p.name,unit:p.unit,quantity:x.quantity,unitPrice:x.unitPrice,listPrice:x.listPrice};}),promo:s.promo,validity:s.validity,warranty:s.warranty,note:s.note};}
