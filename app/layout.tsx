import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { CartProvider } from '@/components/cart-store';
import { PwaRegister } from '@/components/pwa-register';
export const metadata: Metadata = {title:'Nova Campus Marketplace',description:'Your campus. Your marketplace. Buy and sell at Woldiya University.', manifest:'/manifest.webmanifest', appleWebApp:{capable:true,statusBarStyle:'default',title:'Nova Marketplace'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><ThemeProvider><CartProvider><PwaRegister/>{children}</CartProvider></ThemeProvider></body></html>}
