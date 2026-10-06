// Read-only adapter for the selected NXT TH09.26 worksheet.
export function prepareNxt(matrix) {
  const text=v=>String(v??'').replace(/\s+/g,' ').trim();
  // CSV từ Google Sheets trả số dạng chữ kế toán: "2.409.000", " 18 ", "-" = 0, "- 1"/"(1)" = âm
  const num=v=>{if(typeof v==='number')return v;const s=String(v??'').replace(/\s/g,'');if(s==='-')return 0;const m=s.match(/^\((\d+)\)$/);if(m)return -Number(m[1]);if(/^\d{1,3}(\.\d{3})+$/.test(s))return Number(s.replace(/\./g,''));if(/^-?\d+(,\d+)?$/.test(s))return Number(s.replace(',','.'));return v;};
  const header=matrix.findIndex(r=>text(r[3])==='Mã hàng'&&/TỒN CUỐI K[ÌỲ]/i.test(text(r[14])));
  if(header<0)throw Error('Không tìm thấy cột Mã hàng và TỒN CUỐI KÌ đúng mẫu NXT.');
  const input=matrix.slice(header+1).map((r,i)=>({r,line:header+i+2})).filter(({r})=>text(r[2])||text(r[3]));
  const counts=new Map();input.forEach(({r})=>{const id=text(r[3]);if(id)counts.set(id,(counts.get(id)||0)+1);});
  const products=[],rows=[],issues=[];
  for(const {r,line} of input){
    const id=text(r[3]),name=text(r[2]),unit=text(r[5]),price=num(r[8]),quantity=num(r[14]),reasons=[];
    if(!id)reasons.push('Thiếu mã hàng');
    if(counts.get(id)>1)reasons.push('Mã trùng — cần đối chiếu, không tự cộng');
    if(!name||!unit)reasons.push('Thiếu tên hoặc đơn vị');
    if(typeof price!=='number'||!Number.isInteger(price)||price<0||price>1e11)reasons.push('Thiếu/không hợp lệ giá sau VAT');
    if(typeof quantity!=='number'||!Number.isFinite(quantity)||quantity<0||quantity>1e6||Math.abs(quantity*1e4-Math.round(quantity*1e4))>1e-6)reasons.push('Tồn âm hoặc không hợp lệ');
    if(reasons.length){issues.push({line,id,name,quantity:quantity??'',reason:reasons.join('; ')});continue;}
    products.push({id,name,unit,unitPrice:price});rows.push({id,name,unit,quantity,min:0});
  }
  if(!rows.length)throw Error('Không có dòng hợp lệ để nhập.');
  return {products,rows,issues,period:text(matrix[4]?.[2]),sheet:'NXT TH09.26'};
}
