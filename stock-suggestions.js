import {variants} from './product-search.js';
export function stockSuggestions(item,index,items,catalog,rows){
 const original=catalog.find(p=>p.id===item.productId);if(!original)return [];
 const v=variants(original);
 // Only suggest switch variants with enough identity information; no inferred
 // interchangeability for motors, sensors, controllers or curtain accessories.
 if(!['Công tắc đèn','Công tắc công suất cao','Công tắc rèm','Công tắc cửa cuốn'].includes(v.group)||!v.family||!v.shape)return [];
 return catalog.filter(p=>{if(p.id===original.id||p.unit!==item.unit)return false;const a=variants(p);if(['group','family','shape','buttons','power','radio'].some(k=>v[k]!==a[k]))return false;const stock=rows.find(r=>r.id===p.id&&r.unit===p.unit);const already=items.reduce((sum,i,n)=>sum+(n!==index&&!i.nonStock&&i.productId===p.id?i.quantity:0),0);return stock&&stock.quantity-already>=item.quantity;}).sort((a,b)=>Math.abs(a.unitPrice-item.unitPrice)-Math.abs(b.unitPrice-item.unitPrice)).slice(0,3);
}
