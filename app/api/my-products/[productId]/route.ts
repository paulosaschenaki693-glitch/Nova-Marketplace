import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import {inspectDescription,inspectProductImage} from '@/lib/gemini';
import {notifyAdmins} from '@/lib/admin-notifications';
import { isAllowedProductImageUrl } from '@/lib/storage-validation';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function PATCH(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await requireUser(['STUDENT','MERCHANT']);
  if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'Sign in with an approved seller account.' }, { status: 401 });
  try {
    const { productId } = await params; const body = await req.json();
    const product = await prisma.product.findFirst({ where: { id: productId, sellerId: user.id, status: { not: 'ARCHIVED' } } });
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    const data:any = {};
    if (body.quantity !== undefined) { const quantity=Number(body.quantity); if(!Number.isInteger(quantity)||quantity<0||quantity>100000)return NextResponse.json({error:'Invalid quantity.'},{status:400}); data.quantity=quantity; }
    let listingChanged=false; for (const key of ['title','description','categoryId','locationText']) if(body[key]!==undefined){
      const value=String(body[key]).trim();
      if(key==='title'&&(!value||value.length>140))return NextResponse.json({error:'Product title must be 1–140 characters.'},{status:400});
      if(key==='description'&&value.length>5000)return NextResponse.json({error:'Description must be 5000 characters or fewer.'},{status:400});
      if(key==='categoryId'&&!value)return NextResponse.json({error:'Choose a product category.'},{status:400});
      if(key==='locationText'&&value.length>120)return NextResponse.json({error:'Location must be 120 characters or fewer.'},{status:400});
      data[key]=value;listingChanged=true;
    }
    if(body.price!==undefined){const price=Number(body.price);if(!Number.isFinite(price)||price<=0||price>100000000)return NextResponse.json({error:'Enter a valid price.'},{status:400});data.price=price;listingChanged=true;}
    if(body.condition!==undefined){if(!['NEW','LIKE_NEW','GOOD','FAIR'].includes(body.condition))return NextResponse.json({error:'Invalid product condition.'},{status:400});data.condition=body.condition;listingChanged=true;}
    let imageUrls:string[]|undefined;
    if(body.images!==undefined){if(!Array.isArray(body.images)||body.images.length>3||body.images.some((x:unknown)=>!isAllowedProductImageUrl(x)))return NextResponse.json({error:'Use up to three valid product images.'},{status:400});imageUrls=body.images;data.images={deleteMany:{},create:body.images.map((imageUrl:string,i:number)=>({imageUrl,sortOrder:i}))};listingChanged=true;}
    const targetCategoryId=String(data.categoryId??product.categoryId);
    const category=await prisma.category.findFirst({where:{id:targetCategoryId,isActive:true},select:{id:true,listingTemplate:true}});
    if(!category)return NextResponse.json({error:'Choose an active marketplace category.'},{status:400});
    if(body.templateValues!==undefined||data.categoryId!==undefined){
      const fields=Array.isArray(category.listingTemplate)?category.listingTemplate as Array<{key?:string;label?:string;required?:boolean}>:[];
      const values=body.templateValues&&typeof body.templateValues==='object'?body.templateValues as Record<string,unknown>:{};
      const missing=fields.filter(field=>field.required&&(!field.key||!String(values[field.key]??'').trim()));
      if(missing.length)return NextResponse.json({error:`Complete the required category details: ${missing.map(field=>field.label||field.key).join(', ')}.`},{status:400});
      const rawDescription=String(body.description??product.description);
      const general=rawDescription.split('\n').filter(line=>!fields.some(field=>field.label&&line.startsWith(`${field.label}:`))).join('\n').trim();
      const templateDescription=fields.map(field=>`${field.label}: ${String(values[field.key||'']??'').trim()}`).filter(line=>!line.endsWith(': '));
      data.description=[...templateDescription,general].filter(Boolean).join('\n');
      listingChanged=true;
    }
    if(listingChanged){
      const title=String(data.title??product.title), descriptionResult=await inspectDescription(title,String(data.description??product.description));
      data.description=String(descriptionResult.cleanedDescription||data.description||product.description).slice(0,5000);
      const images=imageUrls??(await prisma.productImage.findMany({where:{productId:product.id},orderBy:{sortOrder:'asc'},take:3})).map(x=>x.imageUrl);
      if(images.length===0||images.some((url:string)=>!isAllowedProductImageUrl(url)))return NextResponse.json({error:'Replace this listing’s images with images uploaded to Nova marketplace storage before editing the listing.'},{status:422});
      const checks=await Promise.all(images.map(async(url:string)=>{try{const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Image fetch failed');const mime=response.headers.get('content-type')?.split(';')[0]||'image/webp';if(!mime.startsWith('image/'))throw new Error('Stored product file is not an image.');return await inspectProductImage(Buffer.from(await response.arrayBuffer()),mime,title,String(data.description))}catch{return {imageMatches:false,containsContact:false,containsWatermark:false,containsPromotion:false,confidence:0,reasons:['Image analysis unavailable']}}}))
      const blocked=checks.some((c:any)=>c.containsContact||c.containsWatermark||c.containsPromotion);
      if(blocked)return NextResponse.json({error:'Your edited image contains contact information, a watermark or promotional graphics. Replace the image before saving.',reasons:checks.flatMap((c:any)=>c.reasons||[])},{status:422});
      const uncertain=checks.some((c:any)=>!c.imageMatches||Number(c.confidence)<0.8)||!descriptionResult.hasEnoughProductInformation;
      data.status=uncertain?'PENDING_REVIEW':'ACTIVE';data.moderationSource=uncertain?'MANUAL_REVIEW':'AI_VERIFIED';data.moderationNote=uncertain?'Edited listing requires administrator review.':null;data.moderationData={imageChecks:checks,descriptionCleaned:Boolean(descriptionResult.removedContact),recheckedAt:new Date().toISOString()};data.publishedAt=uncertain?null:new Date();
    }
    const finalQuantity=data.quantity??product.quantity;if(finalQuantity===0)data.status='SOLD';else if(data.quantity>0&&product.status==='SOLD'&&!listingChanged){data.status='ACTIVE';data.publishedAt=new Date();}
    const updated=await prisma.product.update({where:{id:product.id},data});
    if(listingChanged&&updated.status==='PENDING_REVIEW')await notifyAdmins({type:'LISTING',title:'Edited product needs review',body:`A seller edited listing ${updated.title}; AI screening routed it to manual review.`,priority:'HIGH'});
    return NextResponse.json({id:updated.id,quantity:updated.quantity,status:updated.status,moderationSource:updated.moderationSource});
  } catch { return NextResponse.json({error:'Unable to update product.'},{status:500}); }
}
export async function DELETE(_req:Request,{params}:{params:Promise<{productId:string}>}){
 const user=await requireUser(['STUDENT','MERCHANT']);if(!user||user.status!=='ACTIVE')return NextResponse.json({error:'Sign in required.'},{status:401});
 try{const {productId}=await params;const result=await prisma.product.updateMany({where:{id:productId,sellerId:user.id,status:{not:'SOLD'}},data:{status:'ARCHIVED'}});return NextResponse.json({ok:result.count===1})}catch{return NextResponse.json({error:'Unable to archive product.'},{status:500})}
}
