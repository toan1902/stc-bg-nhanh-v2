// Quantity precision: one ten-thousandth of a unit, shared by imports and movements.
export const ticks=n=>Math.round(n*10000);
export const qty=n=>n/10000;
export const emptyStock=()=>({version:1,revision:0,rows:[],receipts:[],logs:[],source:null,importHashes:[]});
export function stockNumber(value){
  if(typeof value==='string'){const s=value.trim();if(!/^\d+(?:[.,]\d{1,4})?$/.test(s))throw Error('Số lượng không hợp lệ. Dùng 42,6 hoặc 42.6; không dùng dấu phân cách hàng nghìn.');value=Number(s.replace(',','.'));}
  if(!Number.isFinite(value)||value<0||value>1000000||Math.abs(value*10000-Math.round(value*10000))>0.000001)throw Error('Số lượng phải từ 0 đến 1.000.000, tối đa 4 số thập phân.');
  return value;
}
export function normalizeStock(rows,catalog){
  if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw Error('File kho cần từ 1 đến 5.000 dòng.');
  const seen=new Set();return rows.map((r,n)=>{try{const id=String(r.id??'').trim(),unit=String(r.unit??'').trim(),p=catalog.find(x=>x.id===id);if(!p)throw Error('Mã '+id+' chưa có trong bảng giá; nhập bảng giá trước.');if(seen.has(id))throw Error('Trùng mã '+id);if(unit!==p.unit)throw Error(`Đơn vị ${unit} không khớp ${p.unit}.`);seen.add(id);return {id,name:p.name,unit,quantity:stockNumber(r.quantity),min:stockNumber(r.min===''||r.min==null?0:r.min)};}catch(e){throw Error(`Dòng ${n+1}: ${e.message}`);}});
}
export function assessStock(quote,db){
  const errors=[],needs=new Map();
  for(const item of quote.items){if(item.nonStock===true)continue;if(!item.productId){errors.push(`${item.name}: chưa gắn mã kho.`);continue;}const stock=db.rows.find(r=>r.id===item.productId);if(!stock){errors.push(`${item.name}: chưa có dữ liệu tồn.`);continue;}if(item.unit!==stock.unit){errors.push(`${item.name}: đơn vị không khớp kho (${stock.unit}).`);continue;}needs.set(item.productId,(needs.get(item.productId)||0)+ticks(item.quantity));}
  const lines=[...needs].map(([id,amount])=>{const r=db.rows.find(r=>r.id===id);if(amount>ticks(r.quantity))errors.push(`${r.name}: cần ${qty(amount)}, chỉ còn ${r.quantity} ${r.unit}.`);return {id,name:r.name,unit:r.unit,quantity:qty(amount),before:r.quantity,after:qty(ticks(r.quantity)-amount)};});
  return {errors:[...new Set(errors)],lines};
}
export function issueStock(db,quote,receiptId,date){
  if(db.receipts.some(r=>r.quoteId===quote.id))throw Error('Báo giá này đã có phiếu xuất. Hãy mở phiếu đã tạo, không xuất lần hai.');
  if(!quote.items.length)throw Error('Báo giá chưa có sản phẩm.');
  const result=assessStock(quote,db);if(result.errors.length)throw Error(result.errors.join('\n'));
  const next=structuredClone(db);for(const l of result.lines)next.rows.find(r=>r.id===l.id).quantity=l.after;
  const receipt={id:receiptId,quoteId:quote.id,number:receiptId,date,status:'issued',quote:structuredClone(quote),lines:result.lines};
  next.receipts.unshift(receipt);next.logs.unshift({id:receiptId,type:'issue',date,reason:'Chốt '+quote.number,lines:result.lines});return {next,receipt};
}
export function voidStock(db,id,reason,date){const next=structuredClone(db),r=next.receipts.find(r=>r.id===id);if(!r||r.status!=='issued')throw Error('Phiếu không tồn tại hoặc đã hoàn kho.');if(!reason.trim())throw Error('Cần lý do hủy và hoàn kho.');const lines=r.lines.map(l=>{const row=next.rows.find(x=>x.id===l.id);if(!row||row.unit!==l.unit)throw Error('Mã hoặc đơn vị kho đã thay đổi; đối chiếu trước khi hoàn kho.');const before=row.quantity;row.quantity=qty(ticks(before)+ticks(l.quantity));stockNumber(row.quantity);return {...l,before,after:row.quantity};});r.status='void';r.voidReason=reason;r.voidDate=date;next.logs.unshift({id:'VOID-'+id,type:'return',date,reason,lines});return next;}
export function validateStock(db){if(!db||db.version!==1||!Array.isArray(db.rows)||!Array.isArray(db.receipts)||!Array.isArray(db.logs)||!Number.isInteger(db.revision))throw Error('Dữ liệu kho không đúng định dạng.');const ids=new Set();for(const r of db.rows){if(typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.name!=='string'||typeof r.unit!=='string')throw Error('Mã kho trùng hoặc không hợp lệ.');ids.add(r.id);stockNumber(r.quantity);stockNumber(r.min);}const quotes=new Set();for(const r of db.receipts){if(!r.id||!r.quoteId||quotes.has(r.quoteId)||!['issued','void'].includes(r.status)||!r.quote||!Array.isArray(r.lines))throw Error('Phiếu xuất kho không hợp lệ.');quotes.add(r.quoteId);}return db;}
