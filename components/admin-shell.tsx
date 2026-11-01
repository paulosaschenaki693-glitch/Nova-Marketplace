'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {LayoutDashboard,Users,ClipboardCheck,CreditCard,ShoppingCart,Wallet,Flag,Settings,Store,ExternalLink,LogOut,Menu,X} from 'lucide-react';
import {useState} from 'react';
const nav=[
 {href:'/admin/dashboard',label:'Overview',icon:LayoutDashboard},
 {href:'/admin/users',label:'Account verification',icon:Users},
 {href:'/admin/listings',label:'Listing moderation',icon:ClipboardCheck},
 {href:'/admin/orders',label:'Orders & fulfillment',icon:ShoppingCart},
 {href:'/admin/payments',label:'Payment review',icon:CreditCard},
 {href:'/admin/commissions',label:'Commission ledger',icon:Wallet},
 {href:'/admin/reports',label:'Reports & safety',icon:Flag},
 {href:'/admin/categories',label:'Category management',icon:Settings},
];
export function AdminShell({children}:{children:React.ReactNode}){const path=usePathname();const [open,setOpen]=useState(false);async function logout(){await fetch('/api/auth/logout',{method:'POST'});location.href='/login/admin'}return <div className="admin-layout">{open&&<button aria-label="Close admin navigation" className="admin-sidebar-backdrop" onClick={()=>setOpen(false)}/>}<aside className={`admin-sidebar ${open?'is-open':''}`}><button className="admin-sidebar-close" aria-label="Close navigation" onClick={()=>setOpen(false)}><X size={20}/></button><Link href="/admin/dashboard" className="admin-brand"><span className="brandmark">N</span><span><b>Nova</b><small>ADMIN CONSOLE</small></span></Link><div className="admin-nav-label">WORKSPACE</div><nav>{nav.map(n=>{const I=n.icon;return <Link key={n.href} href={n.href} onClick={()=>setOpen(false)} className={`admin-nav-link ${path===n.href?'active':''}`}><I size={18}/><span>{n.label}</span></Link>})}</nav><div className="admin-sidebar-bottom"><Link href="/" className="admin-nav-link"><Store size={18}/><span>View marketplace</span><ExternalLink size={13}/></Link><button className="admin-nav-link admin-logout" onClick={logout}><LogOut size={18}/><span>Sign out</span></button></div></aside><div className="admin-main"><header className="admin-topbar"><button className="btn btn-ghost admin-menu-toggle" onClick={()=>setOpen(v=>!v)} aria-label="Toggle admin navigation"><Menu size={18}/></button><div><strong>Marketplace administration</strong><p className="muted">Manage the Woldiya University marketplace</p></div><span className="admin-secure"><span/> Admin access</span></header><div className="admin-content">{children}</div></div></div>}
