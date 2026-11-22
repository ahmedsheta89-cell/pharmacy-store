export const PHOTO_LIMIT = 200 * 1024;
export type ImageSize = {width:number;height:number};

// Bound pixel allocation before decoding a file. Large metadata blocks beyond
// this header budget are rejected rather than decoded speculatively.
export function photoDimensions(b:Uint8Array):ImageSize|null {
  const view = new DataView(b.buffer,b.byteOffset,b.byteLength);
  if (b.length >= 24 && [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)) {
    return {width:view.getUint32(16),height:view.getUint32(20)};
  }
  if (b.length >= 30 && String.fromCharCode(...b.slice(0,4))==='RIFF' && String.fromCharCode(...b.slice(8,12))==='WEBP') {
    const kind=String.fromCharCode(...b.slice(12,16));
    if(kind==='VP8X') return {width:1+b[24]+(b[25]<<8)+(b[26]<<16),height:1+b[27]+(b[28]<<8)+(b[29]<<16)};
    if(kind==='VP8 '&&b[23]===157&&b[24]===1&&b[25]===42) return {width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};
    if(kind==='VP8L'&&b[20]===47) return {width:1+b[21]+((b[22]&63)<<8),height:1+(b[22]>>6)+(b[23]<<2)+((b[24]&15)<<10)};
    return null;
  }
  if(b[0]!==255||b[1]!==216)return null;
  let i=2;
  while(i+3<b.length){
    if(b[i++]!==255)return null;while(b[i]===255)i++;
    const marker=b[i++];if(marker===218||marker===217)return null;
    if(marker===1||(marker>=208&&marker<=215))continue;
    if(i+2>b.length)return null;const length=(b[i]<<8)|b[i+1];
    if(length<2||i+length>b.length)return null;
    if([192,193,194].includes(marker))return length>=8?{width:(b[i+5]<<8)|b[i+6],height:(b[i+3]<<8)|b[i+4]}:null;
    i+=length;
  }
  return null;
}

export async function compressProductPhoto(file:File):Promise<Blob>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw new Error('اختر صورة JPG أو PNG أو WebP حتى 15 ميجابايت. حوّل HEIC إلى JPG أولًا.');
  const header=new Uint8Array(await file.slice(0,512*1024).arrayBuffer());
  const size=photoDimensions(header);
  if(!size||!size.width||!size.height)throw new Error('تعذر قراءة أبعاد الصورة. جرّب نسخة JPG من المعرض.');
  if(size.width>16000||size.height>16000||size.width*size.height>36000000)throw new Error('أبعاد الصورة كبيرة جدًا. اختر نسخة حتى 36 ميجابكسل.');
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('تعذر فتح الصورة. جرّب نسخة JPG من معرض الصور.');}
  try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>36000000)throw new Error('أبعاد الصورة كبيرة جدًا. اختر نسخة أصغر.');
    const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
    let width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');
    for(let round=0;round<4;round++){
      canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('المتصفح لا يدعم تجهيز الصور.');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(bitmap,0,0,width,height);
      for(const quality of [.86,.72,.58,.44]){
        const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        if(blob&&blob.type==='image/jpeg'&&blob.size<=PHOTO_LIMIT)return blob;
      }
      width=Math.max(1,Math.round(width*.75));height=Math.max(1,Math.round(height*.75));
    }
    throw new Error('تعذر ضغط الصورة بالحجم المسموح. اختر صورة أبسط أو أصغر.');
  }finally{bitmap.close();}
}
