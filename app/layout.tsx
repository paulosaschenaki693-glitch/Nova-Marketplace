import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { PwaRegister } from '@/components/pwa-register';

export const metadata: Metadata = {
  title: 'Nova Campus Marketplace',
  description: 'Direct campus marketplace for Woldia University & Weldiya town.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nova Marketplace',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <PwaRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
