'use client';
import {useEffect,useState} from 'react';
import {Download,X} from 'lucide-react';

type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
export function PwaRegister(){
 const [installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  const onInstall=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);setVisible(true)};
  const onInstalled=()=>{setVisible(false);setInstallEvent(null)};
  window.addEventListener('beforeinstallprompt',onInstall);
  window.addEventListener('appinstalled',onInstalled);
  return()=>{window.removeEventListener('beforeinstallprompt',onInstall);window.removeEventListener('appinstalled',onInstalled)};
 },[]);
 async function install(){if(!installEvent)return;await installEvent.prompt();const choice=await installEvent.userChoice;if(choice.outcome==='accepted'){setVisible(false);setInstallEvent(null)}}
 if(!visible||!installEvent)return null;
 return <aside aria-label="Install Nova Marketplace" style={{position:'fixed',zIndex:70,bottom:16,left:'50%',transform:'translateX(-50%)',width:'min(520px,calc(100vw - 24px))',display:'flex',alignItems:'center',gap:12,padding:12,border:'1px solid var(--border)',borderRadius:16,background:'var(--surface)',boxShadow:'0 14px 45px #0002'}}><img
  src="/icon-512.png"
  alt="Nova Campus Marketplace"
  className="brandmark-image"
/><span style={{flex:1,minWidth:0}}><b style={{display:'block',fontSize:13}}>Install Nova Marketplace</b><small className="muted">Add the marketplace to your home screen.</small></span><button className="btn btn-primary" onClick={install}><Download size={15}/> Install</button><button className="btn btn-ghost" aria-label="Dismiss install prompt" onClick={()=>setVisible(false)}><X size={15}/></button></aside>
}
