import {NextResponse} from 'next/server';import {prisma} from '@/lib/prisma';import {requireUser} from '@/lib/auth';
export async function GET(){
 const admin=await requireUser(['ADMIN']);
 if(!admin) return NextResponse.json({error:'Admin access required.'},{status:403});
 const payments=await prisma.payment.findMany({
  include:{order:{include:{
   buyer:{select:{fullName:true,phone:true,studentIdNo:true,email:true}},
   items:{include:{product:{include:{images:true,category:true}},seller:{select:{role:true,shopName:true,fullName:true}}}}
  }}},
  orderBy:{createdAt:'desc'},take:100
 });
 return NextResponse.json(payments);
}
export async function PATCH(req:Request){const admin=await requireUser(['ADMIN']);if(!admin)return NextResponse.json({error:'Admin access required.'},{status:403});try{const {paymentId,decision,note}=await req.json();if(!['APPROVED','REJECTED'].includes(decision))return NextResponse.json({error:'Invalid decision.'},{status:400});const p=await prisma.payment.findUnique({where:{id:paymentId},include:{order:true}});if(!p)return NextResponse.json({error:'Payment not found.'},{status:404});if(p.status!=='UNDER_REVIEW')return NextResponse.json({error:'Payment is not awaiting review.'},{status:409});await prisma.$transaction(async tx=>{await tx.payment.update({where:{id:paymentId},data:{status:decision,adminNote:note||null,reviewedById:admin.id,reviewedAt:new Date()}});await tx.order.update({where:{id:p.orderId},data:{status:decision==='APPROVED'?'CONFIRMED':'AWAITING_PAYMENT'}});await tx.orderStatusHistory.create({data:{orderId:p.orderId,status:decision==='APPROVED'?'CONFIRMED':'AWAITING_PAYMENT',changedById:admin.id,note:note||`Payment ${decision.toLowerCase()}.`}});await tx.notification.create({data:{userId:p.order.buyerId,type:'PAYMENT',title:decision==='APPROVED'?'Payment approved':'Payment needs attention',body:note|| (decision==='APPROVED'?'Your payment was verified. Our team will now coordinate your order.':'Your payment could not be approved. Please review the note and submit proof again.')}});});return NextResponse.json({ok:true})}catch{return NextResponse.json({error:'Unable to review payment.'},{status:500})}}
