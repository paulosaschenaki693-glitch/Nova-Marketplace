'use client';
import { useCart } from '@/components/cart-store';
import { Heart, ShoppingCart, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props={product:{id:string;title:string;price:number;emoji?:string;imageUrl?:string;sellerType?:'STUDENT'|'MERCHANT';quantity?:number};compact?:boolean};
export function ProductActions({product,compact=false}:Props){
 const {add}=useCart(); const router=useRouter(); const [saved,setSaved]=useState(false); const [added,setAdded]=useState(false);
 useEffect(()=>{let alive=true;fetch('/api/favorites',{cache:'no-store'}).then(r=>r.ok?r.json():[]).then(d=>{if(alive&&Array.isArray(d))setSaved(d.some((x:any)=>x.productId===product.id||x.product?.id===product.id))}).catch(()=>{});return()=>{alive=false}},[product.id]);
 const item={productId:product.id,title:product.title,price:Number(product.price),emoji:product.emoji,imageUrl:product.imageUrl,sellerType:product.sellerType||'STUDENT',quantity:1 as number};
 function addToCart(){add(item);setAdded(true);window.setTimeout(()=>setAdded(false),1400)}
 async function toggleFavorite(){const next=!saved;setSaved(next);try{const res=await fetch(next?'/api/favorites':`/api/favorites?productId=${encodeURIComponent(product.id)}`,{method:next?'POST':'DELETE',headers:{'Content-Type':'application/json'},...(next?{body:JSON.stringify({productId:product.id})}:{})});if(res.status===401){router.push('/login');return}if(!res.ok)setSaved(!next)}catch{setSaved(!next)}}
 function buyNow(){add(item);router.push('/checkout')}
 return <div className={compact?'product-actions compact':'product-actions'}>
  <button className="favorite-icon" aria-label={saved?'Remove from saved items':'Save item'} title={saved?'Saved':'Save item'} onClick={toggleFavorite}><Heart size={17} fill={saved?'currentColor':'none'}/></button>
  <button className="btn btn-ghost add-cart" onClick={addToCart}><ShoppingCart size={15}/><span>{added?'Added': 'Add to cart'}</span></button>
  <button className="btn btn-primary buy-now" onClick={buyNow}><Zap size={15}/><span>Buy now</span></button>
 </div>
}
