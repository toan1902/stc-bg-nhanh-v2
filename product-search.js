export const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/wi[ -]?fi/g,'wifi').replace(/blutooth|bluetooh/g,'bluetooth').replace(/(\d)\s*(nut|nút)/g,'$1 nut').replace(/[^a-z0-9]+/g,' ').trim();
export const groups=['Công tắc đèn','Công tắc công suất cao','Công tắc rèm','Công tắc cửa cuốn','Công tắc ngữ cảnh','Ổ cắm','Cảm biến','Trung tâm & mở rộng sóng','Điều khiển IR / remote','Đèn & nguồn LED','Động cơ cổng','Động cơ rèm','Ray / vải / phụ kiện rèm','Khóa cửa','Camera & lưu trữ','Mặt kính & phụ kiện','Dịch vụ & lắp đặt','Khác'];
export function variants(p){
 const n=fold(p.name);let group='Khác';
 if(/^CONG-/.test(String(p.id||'')))group='Động cơ cổng';
 else if(/mat kinh cong tac|mat na/.test(n)||(/phu kien/.test(n)&&!/rem/.test(n)))group='Mặt kính & phụ kiện';
 else if(/cong tac/.test(n))group=/rem/.test(n)?'Công tắc rèm':/cua cuon/.test(n)?'Công tắc cửa cuốn':/ngu canh/.test(n)?'Công tắc ngữ cảnh':/cong suat cao|\bcsc\b/.test(n)?'Công tắc công suất cao':'Công tắc đèn';
 else if(/o cam/.test(n))group='Ổ cắm';else if(/cam bien|coi hu/.test(n))group='Cảm biến';
 else if(/trung tam|mesh song|mo rong song|usb mesh|play box/.test(n))group='Trung tâm & mở rộng sóng';
 else if(/dong co/.test(n))group='Động cơ rèm';else if(/rem|thanh ray|ray dinh/.test(n))group='Ray / vải / phụ kiện rèm';
 else if(/camera|the nho|luu tru/.test(n))group='Camera & lưu trữ';else if(/khoa/.test(n))group='Khóa cửa';
 else if(/den|led/.test(n))group='Đèn & nguồn LED';else if(/dieu khien|remote|\bir\b/.test(n))group='Điều khiển IR / remote';else if(/lap dat|nhan cong|dich vu/.test(n))group='Dịch vụ & lắp đặt';
 const family=/leto/.test(n)?'Leto':/athena/.test(n)?'Athena':/hera/.test(n)?'Hera':'';
 // Family and radio are separate: some Athena devices explicitly use Wi-Fi.
 const radio=/wifi/.test(n)?'Wi-Fi':/bluetooth|\bble\b/.test(n)?'Bluetooth Mesh':/zigbee/.test(n)?'Zigbee':'';
 const color=/trang/.test(n)?'Trắng':/\bden\b/.test(n)&&!/^den /.test(n)?'Đen':/champagne/.test(n)?'Champagne':/stone gray/.test(n)?'Stone gray':/rose gold/.test(n)?'Rose gold':'';
 return {group,family,radio,color,shape:/vuong/.test(n)?'Vuông':/chu nhat/.test(n)?'Chữ nhật':'',buttons:n.match(/\b([1-6]) nut\b/)?.[1]||'',power:/cong suat cao|\bcsc\b/.test(n)?'Công suất cao':''};
}
function tokens(q){return fold(q).replace(/\bbt\b|\bble\b/g,'bluetooth').replace(/\bcsc\b/g,'cong suat cao').split(/\s+/).filter(Boolean);}
export function searchProducts(catalog,query,filters={}){
 const words=tokens(query),fq=fold(query);
 return catalog.map(p=>{const v=variants(p),hay=tokens([p.id,p.name,...Object.entries(v).filter(([k])=>k!=='group').map(([,val])=>val)].join(' ')).join(' ');return {p,v,hay};})
 .filter(({v,hay})=>Object.entries(filters).every(([k,val])=>!val||v[k]===val)&&words.every(w=>/^\d{1,2}$/.test(w)?hay.split(' ').includes(w):hay.includes(w)))
 .sort((a,b)=>{const score=x=>fold(x.p.id)===fq&&fq?100:fold(x.p.name).startsWith(fq)&&fq?20:0;return score(b)-score(a)||a.p.name.localeCompare(b.p.name,'vi');}).map(x=>x.p);
}
