import { useMemo, useState } from "react";
import { FiCopy, FiDownload } from "react-icons/fi";

const SIZE=41;
const CAPACITY=134;

function gfTables(){
  const exp=Array(512).fill(0),log=Array(256).fill(0);let x=1;
  for(let i=0;i<255;i++){exp[i]=x;log[x]=i;x<<=1;if(x&0x100)x^=0x11d;}
  for(let i=255;i<512;i++)exp[i]=exp[i-255];
  return {exp,log};
}
const GF=gfTables();
function mul(a,b){return !a||!b?0:GF.exp[GF.log[a]+GF.log[b]];}
function generator(n){let g=[1];for(let i=0;i<n;i++){const next=Array(g.length+1).fill(0);for(let j=0;j<g.length;j++){next[j]^=g[j];next[j+1]^=mul(g[j],GF.exp[i]);}g=next;}return g;}
function ecc(data,n){const gen=generator(n),msg=[...data,...Array(n).fill(0)];for(let i=0;i<data.length;i++){const factor=msg[i];if(factor)for(let j=0;j<gen.length;j++)msg[i+j]^=mul(gen[j],factor);}return msg.slice(-n);}
function pushBits(bits,value,count){for(let i=count-1;i>=0;i--)bits.push((value>>i)&1);}
function codewords(text){
  const bytes=new TextEncoder().encode(text);if(bytes.length>CAPACITY)throw new Error("Booking URL is too long for the built-in QR code.");
  const bits=[];pushBits(bits,4,4);pushBits(bits,bytes.length,8);bytes.forEach(byte=>pushBits(bits,byte,8));
  const cap=136*8;for(let i=0;i<Math.min(4,cap-bits.length);i++)bits.push(0);while(bits.length%8)bits.push(0);
  const data=[];for(let i=0;i<bits.length;i+=8){let value=0;for(let j=0;j<8;j++)value=(value<<1)|(bits[i+j]||0);data.push(value);}
  const pads=[0xec,0x11];let p=0;while(data.length<136)data.push(pads[p++%2]);
  const a=data.slice(0,68),b=data.slice(68),ea=ecc(a,18),eb=ecc(b,18),out=[];
  for(let i=0;i<68;i++)out.push(a[i],b[i]);for(let i=0;i<18;i++)out.push(ea[i],eb[i]);return out;
}
function bchFormat(data){
  const g=0x537;let d=data<<10;const degree=value=>32-Math.clz32(value);
  while(degree(d)>=degree(g))d^=g<<(degree(d)-degree(g));
  return ((data<<10)|d)^0x5412;
}
function makeMatrix(text){
  const m=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
  function finder(row,col){for(let r=-1;r<=7;r++)for(let c=-1;c<=7;c++){const rr=row+r,cc=col+c;if(rr<0||rr>=SIZE||cc<0||cc>=SIZE)continue;m[rr][cc]=Boolean(r>=0&&r<=6&&c>=0&&c<=6&&(r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4)));}}
  finder(0,0);finder(SIZE-7,0);finder(0,SIZE-7);
  for(const row of [6,34])for(const col of [6,34]){if(m[row][col]!==null)continue;for(let r=-2;r<=2;r++)for(let c=-2;c<=2;c++)m[row+r][col+c]=Boolean(Math.abs(r)===2||Math.abs(c)===2||(r===0&&c===0));}
  for(let i=8;i<SIZE-8;i++){if(m[i][6]===null)m[i][6]=i%2===0;if(m[6][i]===null)m[6][i]=i%2===0;}
  const format=bchFormat(8);
  for(let i=0;i<15;i++){
    const dark=((format>>i)&1)===1;
    if(i<6)m[i][8]=dark;else if(i<8)m[i+1][8]=dark;else m[SIZE-15+i][8]=dark;
    if(i<8)m[8][SIZE-i-1]=dark;else if(i<9)m[8][15-i]=dark;else m[8][15-i-1]=dark;
  }
  m[SIZE-8][8]=true;
  const bits=[];for(const byte of codewords(text))pushBits(bits,byte,8);
  let row=SIZE-1,inc=-1,index=0,col=SIZE-1;
  while(col>0){
    if(col===6)col-=1;
    while(true){
      for(const cc of [col,col-1])if(m[row][cc]===null){let dark=Boolean(bits[index++]||0);if((row+cc)%2===0)dark=!dark;m[row][cc]=dark;}
      row+=inc;if(row<0||row>=SIZE){row-=inc;inc=-inc;break;}
    }
    col-=2;
  }
  return m;
}

export default function BookingQrCard({bookingUrl,businessName="Business"}){
  const [copied,setCopied]=useState(false);
  const result=useMemo(()=>{try{return {matrix:makeMatrix(bookingUrl),error:""};}catch(e){return {matrix:null,error:e.message};}},[bookingUrl]);
  const quiet=4,total=SIZE+quiet*2;
  async function copy(){await navigator.clipboard.writeText(bookingUrl);localStorage.setItem("bookflow_booking_shared","1");setCopied(true);setTimeout(()=>setCopied(false),1600);}
  function download(){
    if(!result.matrix)return;
    const cells=[];result.matrix.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)cells.push(`<rect x="${x+quiet}" y="${y+quiet}" width="1" height="1"/>`);}));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">${cells.join("")}</g></svg>`;
    localStorage.setItem("bookflow_booking_shared","1");const blob=new Blob([svg],{type:"image/svg+xml"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=(businessName||"bookflow").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+"-booking-qr.svg";link.click();URL.revokeObjectURL(url);
  }
  return <section className="panel booking-qr-card">
    <div><p className="eyebrow">QR BOOKING</p><h2>Share your booking page</h2><p className="muted">This QR code is generated directly in BookFlow. Print it or add it to your storefront, flyers, or social posts.</p><p className="booking-qr-url">{bookingUrl}</p><div className="row-actions"><button type="button" className="secondary" onClick={copy}><FiCopy/>{copied?"Copied":"Copy link"}</button><button type="button" className="primary-button compact-button" onClick={download} disabled={!result.matrix}><FiDownload/>Download QR</button></div>{result.error&&<p className="error">{result.error}</p>}</div>
    {result.matrix&&<svg className="booking-qr-svg" viewBox={`0 0 ${total} ${total}`} aria-label="Booking page QR code" role="img" shapeRendering="crispEdges"><rect width={total} height={total} fill="white"/>{result.matrix.map((row,y)=>row.map((dark,x)=>dark?<rect key={x+"-"+y} x={x+quiet} y={y+quiet} width="1" height="1" fill="black"/>:null))}</svg>}
  </section>;
}
