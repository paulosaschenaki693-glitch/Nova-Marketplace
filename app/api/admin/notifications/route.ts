import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {requireUser} from '@/lib/auth';

export async function GET(){
 const admin=await requireUser(['ADMIN']);
 if(!admin)return NextResponse.json({error:'Admin access required.'},{status:403});
 const rows=await prisma.notification.findMany({where:{userId:admin.id},orderBy:{createdAt:'desc'},take:200});
 const priorityRank:Record<string,number>={URGENT:0,HIGH:1,NORMAL:2};
 rows.sort((a,b)=>(priorityRank[a.priority]??3)-(priorityRank[b.priority]??3)||b.createdAt.getTime()-a.createdAt.getTime());
 return NextResponse.json(rows);
}
export async function PATCH(req:Request){
 const admin=await requireUser(['ADMIN']);
 if(!admin)return NextResponse.json({error:'Admin access required.'},{status:403});
 try{const body=await req.json();
  if(body.all===true){await prisma.notification.updateMany({where:{userId:admin.id,readAt:null},data:{readAt:new Date()}});return NextResponse.json({ok:true});}
  if(!body.notificationId)return NextResponse.json({error:'Notification ID required.'},{status:400});
  const result=await prisma.notification.updateMany({where:{id:String(body.notificationId),userId:admin.id},data:{readAt:new Date()}});
  return NextResponse.json({ok:result.count===1});
 }catch{return NextResponse.json({error:'Unable to update notifications.'},{status:400});}
}
