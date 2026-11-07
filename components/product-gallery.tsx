'use client';
import {useState} from 'react';
import {ChevronLeft,ChevronRight,ZoomIn,X} from 'lucide-react';
export function ProductGallery({images,title}:{images:{imageUrl:string}[];title:string}){
 const [active,setActive]=useState(0),[zoom,setZoom]=useState(false);
 const list=images?.filter(x=>x?.imageUrl)||[];const current=list[active]?.imageUrl;
 if(!list.length)return <div className="product-image" style={{height:390,fontSize:90}}>📦</div>;
 const move=(d:number)=>setActive(v=>(v+d+list.length)%list.length);
 return <div style={{display:'grid',gap:10}}>
  <div style={{position:'relative',height:'min(68vw,480px)',minHeight:280,borderRadius:16,overflow:'hidden',background:'var(--surface2)',display:'grid',placeItems:'center'}}>
   <img src={current} alt={`${title} image ${active+1}`} onClick={()=>setZoom(true)} style={{width:'100%',height:'100%',objectFit:'contain',cursor:'zoom-in'}}/>
   {list.length>1&&<><button aria-label="Previous image" className="btn btn-ghost" onClick={()=>move(-1)} style={{position:'absolute',left:10,top:'46%',background:'var(--surface)',borderRadius:99}}><ChevronLeft/></button><button aria-label="Next image" className="btn btn-ghost" onClick={()=>move(1)} style={{position:'absolute',right:10,top:'46%',background:'var(--surface)',borderRadius:99}}><ChevronRight/></button></>}
   <button aria-label="Zoom image" className="btn btn-ghost" onClick={()=>setZoom(true)} style={{position:'absolute',right:10,bottom:10,background:'var(--surface)',borderRadius:99}}><ZoomIn size={17}/></button>
   <span style={{position:'absolute',left:10,bottom:10,background:'var(--surface)',padding:'5px 9px',borderRadius:20,fontSize:12}}>{active+1} / {list.length}</span>
  </div>
  {list.length>1&&<div style={{display:'flex',gap:8,overflowX:'auto'}}>{list.map((im,i)=><button key={im.imageUrl+i} onClick={()=>setActive(i)} aria-label={`Show image ${i+1}`} style={{padding:3,border:active===i?'2px solid var(--purple)':'1px solid var(--border)',borderRadius:10,background:'var(--surface)',flex:'0 0 76px',height:72}}><img src={im.imageUrl} alt={`${title} thumbnail ${i+1}`} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:7}}/></button>)}</div>}
  {zoom&&<div role="dialog" aria-modal="true" onClick={()=>setZoom(false)} style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,.92)',display:'grid',placeItems:'center',padding:18}}><button className="btn btn-ghost" aria-label="Close zoom" onClick={()=>setZoom(false)} style={{position:'absolute',right:16,top:16,background:'#fff'}}><X/></button><img src={current} alt={title} onClick={e=>e.stopPropagation()} style={{maxWidth:'96vw',maxHeight:'90vh',objectFit:'contain'}}/></div>}
 </div>
}
