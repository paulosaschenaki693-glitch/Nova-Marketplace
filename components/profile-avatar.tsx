'use client';
import { Check } from 'lucide-react';
type Props = { name?: string | null; imageUrl?: string | null; verified?: boolean; size?: number; className?: string };
export function ProfileAvatar({ name, imageUrl, verified = false, size = 40, className = '' }: Props) {
  const initial = (name || 'N').trim().slice(0, 1).toUpperCase() || 'N';
  return <span className={`profile-avatar ${className}`} style={{ width:size, height:size, minWidth:size, minHeight:size, position:'relative', overflow:'visible', padding:0, display:'inline-grid', placeItems:'center', fontSize:Math.max(12,size*.42) }} aria-label={verified ? 'Nova Verified Seller' : 'Profile image'}>
    {imageUrl ? <img src={imageUrl} alt="" width={size} height={size} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%',display:'block'}} /> : initial}
    {verified && <span title="Nova Verified Seller" aria-label="Nova Verified Seller" style={{position:'absolute',right:-2,bottom:-2,width:Math.max(17,size*.42),height:Math.max(17,size*.42),borderRadius:'50%',background:'#2563eb',color:'#fff',border:'2px solid var(--surface, #fff)',display:'grid',placeItems:'center',boxSizing:'border-box'}}><Check size={Math.max(10,size*.25)} strokeWidth={3}/></span>}
  </span>;
}
