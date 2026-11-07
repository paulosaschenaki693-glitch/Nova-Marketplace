'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
const Ctx=createContext<{theme:string;toggle:()=>void}>({theme:'dark',toggle:()=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}){const [theme,setTheme]=useState('light');useEffect(()=>{const saved=localStorage.getItem('nova-theme')||'light';setTheme(saved);document.body.classList.toggle('light',saved==='light');document.body.classList.toggle('dark',saved==='dark');if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);const toggle=()=>setTheme(t=>{const n=t==='dark'?'light':'dark';document.body.classList.toggle('light',n==='light');document.body.classList.toggle('dark',n==='dark');localStorage.setItem('nova-theme',n);return n});return <Ctx.Provider value={{theme,toggle}}>{children}</Ctx.Provider>}
export function ThemeToggle(){const {theme,toggle}=useContext(Ctx);return <button className="btn btn-ghost" style={{padding:9}} aria-label="Toggle theme" onClick={toggle}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>}
