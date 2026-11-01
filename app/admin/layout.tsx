import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {AdminShell} from '@/components/admin-shell';
export default async function AdminLayout({children}:{children:React.ReactNode}){const user=await requireUser(['ADMIN']);if(!user)redirect('/login/admin');return <AdminShell>{children}</AdminShell>}
