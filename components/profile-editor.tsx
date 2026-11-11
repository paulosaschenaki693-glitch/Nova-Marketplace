'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components/header';
import { ProfileAvatar } from '@/components/profile-avatar';

type Account = { role:'STUDENT'|'MERCHANT'; fullName:string|null; shopName:string|null; phone:string; bio:string|null; publicLocation:string|null; telegramHandle:string|null; profileImageUrl:string|null; verifiedSeller:{id:string;expiresAt:string}|null };
export default function ProfileEditor() {
  const [account,setAccount]=useState<Account|null>(null);
  const [form,setForm]=useState({fullName:'',shopName:'',phone:'',bio:'',publicLocation:'',telegramHandle:''});
  const [file,setFile]=useState<File|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  useEffect(()=>{fetch('/api/auth/me',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!d.user){location.href='/login';return;}const u=d.user as Account;setAccount(u);setForm({fullName:u.fullName||'',shopName:u.shopName||'',phone:u.phone||'',bio:u.bio||'',publicLocation:u.publicLocation||'',telegramHandle:u.telegramHandle||''});}).catch(()=>setError('Unable to load your profile.'));},[]);
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSuccess('');try{
    if(file){const fd=new FormData();fd.append('file',file);fd.append('publicConsent',String(consent));const up=await fetch('/api/uploads/profile-image',{method:'POST',body:fd});const ud=await up.json();if(!up.ok)throw new Error(ud.error||'Photo upload failed.');}
    const res=await fetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await res.json();if(!res.ok)throw new Error(d.error||'Could not save profile.');
    setAccount(a=>a?{...a,...d.user,profileImageUrl:d.user.profileImageUrl||a.profileImageUrl}:a);setFile(null);setConsent(false);setSuccess('Your profile has been updated.');
  }catch(e){setError(e instanceof Error?e.message:'Could not save profile.');}finally{setBusy(false);}}
  const verified=Boolean(account?.verifiedSeller&&new Date(account.verifiedSeller.expiresAt)>new Date());
  return <><Header/><main className="shell section" style={{maxWidth:820}}>
    <div className="row" style={{justifyContent:'space-between',flexWrap:'wrap',gap:12}}><div><p className="pill">ACCOUNT SETTINGS</p><h1>Edit profile</h1><p className="muted">Update the information shown on your Nova account.</p></div><Link className="btn btn-ghost" href="/profile">Back to profile</Link></div>
    {error&&<div className="surface2 profile-error" role="alert">{error}</div>}{success&&<div className="surface" role="status" style={{padding:12,border:'1px solid var(--purple)'}}>{success}</div>}
    <form className="surface" onSubmit={save} style={{padding:22,display:'grid',gap:16,marginTop:18}}>
      <div className="row" style={{gap:16,alignItems:'center'}}><ProfileAvatar name={account?.fullName||account?.shopName} imageUrl={account?.profileImageUrl} verified={verified} size={76}/><div style={{display:'grid',gap:6}}><b>Profile photo</b><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e=>setFile(e.target.files?.[0]||null)}/><small className="muted">JPG, PNG, WebP or AVIF · maximum 5 MB. Publicly visible.</small></div></div>
      {file&&<label className="row" style={{alignItems:'flex-start',gap:8}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I consent to displaying this profile photo publicly on Nova Marketplace.</span></label>}
      <label>Full name<input className="input" value={form.fullName} maxLength={80} required onChange={e=>setForm(v=>({...v,fullName:e.target.value}))}/></label>
      {account?.role==='MERCHANT'&&<label>Shop name<input className="input" value={form.shopName} maxLength={100} required onChange={e=>setForm(v=>({...v,shopName:e.target.value}))}/></label>}
      <label>Phone number<input className="input" value={form.phone} maxLength={20} required onChange={e=>setForm(v=>({...v,phone:e.target.value}))}/></label>
      <label>Short bio<textarea className="input" rows={4} maxLength={500} value={form.bio} onChange={e=>setForm(v=>({...v,bio:e.target.value}))}/></label>
      <label>General location<input className="input" value={form.publicLocation} maxLength={120} onChange={e=>setForm(v=>({...v,publicLocation:e.target.value}))} placeholder="For example, Woldia"/></label>
      <label>Telegram username<input className="input" value={form.telegramHandle} maxLength={33} onChange={e=>setForm(v=>({...v,telegramHandle:e.target.value}))} placeholder="Without @"/></label>
      <p className="muted" style={{fontSize:12}}>Email, student ID number, account role, student verification, wallet balance and account status cannot be changed here. Name and shop-name changes apply immediately.</p>
      <button className="btn btn-primary" disabled={busy||!account||(Boolean(file)&&!consent)}>{busy?'Saving…':'Save changes'}</button>
    </form>
  </main><Footer/></>;
}
