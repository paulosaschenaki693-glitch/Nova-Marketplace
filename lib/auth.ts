import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';
function getSessionSecret() {
 const configuredSecret = process.env.AUTH_SECRET;
 if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error('AUTH_SECRET must be configured with at least 32 characters in production.');
 }
 return new TextEncoder().encode(configuredSecret || 'local-development-secret-only-not-for-production-123456');
}
export async function createSession(user: {id:string; role:Role; status:string}) {
 const token = await new SignJWT({sub:user.id, role:user.role, status:user.status}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('7d').sign(getSessionSecret());
 (await cookies()).set('nova_session', token, {httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge:60*60*24*7});
}
export async function getSession() {
 try { const token=(await cookies()).get('nova_session')?.value; if(!token) return null; const {payload}=await jwtVerify(token,getSessionSecret()); return {id:String(payload.sub), role:String(payload.role), status:String(payload.status)}; } catch { return null; }
}
export async function requireUser(roles?: Role[]) {
 const session=await getSession(); if(!session) return null;
 const user=await prisma.user.findFirst({where:{id:session.id,status:'ACTIVE'}, select:{id:true,role:true,status:true,fullName:true,shopName:true,email:true,phone:true,studentIdNo:true}});
 if(!user || user.status!=='ACTIVE' || (roles && !roles.includes(user.role))) return null;
 return user;
}
