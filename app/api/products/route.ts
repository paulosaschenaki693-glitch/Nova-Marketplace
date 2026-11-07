import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { inspectDescription, inspectProductImage } from '@/lib/gemini';
import {notifyAdmins} from '@/lib/admin-notifications';
import { isAllowedProductImageUrl } from '@/lib/storage-validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url); const q = url.searchParams.get('q') || undefined; const category = url.searchParams.get('category') || undefined;
    const min = Number(url.searchParams.get('min') || 0); const max = Number(url.searchParams.get('max') || 0);
    const products = await prisma.product.findMany({ where: { status: 'ACTIVE', quantity: { gt: 0 }, seller: { status: 'ACTIVE' }, category: { isActive: true, ...(category ? { slug: category } : {}) }, ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {}), price: { ...(min ? { gte: min } : {}), ...(max ? { lte: max } : {}) } }, include: { images: { orderBy: { sortOrder: 'asc' }, take: 3 }, category: true, seller: { select: { role: true, status: true, shopName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return NextResponse.json(products);
  } catch { return NextResponse.json({ error: 'Unable to load products. Ensure the database is configured.' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'Sign in with an approved seller account to create a listing.' }, { status: 401 });
  try {
    const d = await req.json(); const title = String(d.title || '').trim(); let description = String(d.description || '').trim(); const locationText = String(d.locationText || 'Woldiya University').trim();
    if (!title || title.length > 140 || typeof d.categoryId !== 'string' || !d.categoryId) return NextResponse.json({ error: 'Enter a product title and choose a category.' }, { status: 400 });
    if (description.length > 5000 || locationText.length > 120) return NextResponse.json({ error: 'Description must be 5000 characters or fewer and location 120 characters or fewer.' }, { status: 400 });
    const price = Number(d.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000000) return NextResponse.json({ error: 'Enter a valid product price.' }, { status: 400 });
    const quantity = Number(d.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return NextResponse.json({ error: 'Enter a valid stock quantity.' }, { status: 400 });
    if (!['NEW','LIKE_NEW','GOOD','FAIR'].includes(d.condition || 'GOOD')) return NextResponse.json({ error: 'Choose a valid product condition.' }, { status: 400 });
    if (!Array.isArray(d.images) || d.images.length < 1 || d.images.length > 3 || !d.images.every(isAllowedProductImageUrl)) return NextResponse.json({ error: 'Upload between one and three product images using marketplace storage.' }, { status: 400 });
    const images: string[] = d.images;
    const category = await prisma.category.findFirst({ where: { id: String(d.categoryId), isActive: true }, select: { id: true, listingTemplate: true } });
    if (!category) return NextResponse.json({ error: 'Choose an active marketplace category.' }, { status: 400 });
    const templateFields = Array.isArray(category.listingTemplate) ? category.listingTemplate as Array<{key?:string;label?:string;required?:boolean}> : [];
    const templateValues = d.templateValues && typeof d.templateValues === 'object' ? d.templateValues as Record<string, unknown> : {};
    const missingTemplate = templateFields.filter(field => field.required && (!field.key || !String(templateValues[field.key] ?? '').trim()));
    if (missingTemplate.length) return NextResponse.json({ error: `Complete the required category details: ${missingTemplate.map(field=>field.label||field.key).join(', ')}.` }, { status: 400 });
    let cleaned = { cleanedDescription: description, removedContact: false, removedItems: [], hasEnoughProductInformation: true } as any;
    let source = 'MANUAL_REVIEW'; let decision: 'ACTIVE' | 'PENDING_REVIEW' | 'REJECTED' = 'PENDING_REVIEW'; let moderationData: any = { checks: [], reason: 'AI review not completed.' };
    try {
      cleaned = await inspectDescription(title, description); description = String(cleaned.cleanedDescription || description).slice(0, 5000);
      if (images.length > 0) {
        const imageChecks = await Promise.all(images.map(async imageUrl => {
          try {
            const response = await fetch(imageUrl, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
            if (!response.ok) throw new Error('Image could not be fetched for review.');
            const mime = response.headers.get('content-type')?.split(';')[0] || 'image/webp';
            if (!mime.startsWith('image/')) throw new Error('Stored product file is not an image.');
            const bytes = Buffer.from(await response.arrayBuffer());
            return await inspectProductImage(bytes, mime, title, description);
          } catch {
            return { imageMatches: false, containsContact: false, containsWatermark: false, containsPromotion: false, confidence: 0, reasons: ['Image analysis was unavailable.'] };
          }
        }));
        const blocked = imageChecks.some((c: any) => c.containsContact || c.containsWatermark || c.containsPromotion);
        const uncertain = imageChecks.some((c: any) => !c.imageMatches || Number(c.confidence) < 0.8);
        if (blocked) return NextResponse.json({ error: 'Your product image needs changes.', reasons: imageChecks.flatMap((c: any) => c.reasons || []).concat('Remove phone numbers, contact details, watermarks and promotional graphics from product images, then upload clean photos.') }, { status: 422 });
        if (!uncertain && cleaned.hasEnoughProductInformation) { decision = 'ACTIVE'; source = 'AI_VERIFIED'; }
        else { decision = 'PENDING_REVIEW'; source = 'MANUAL_REVIEW'; }
        moderationData = { imageChecks, removedContactFromDescription: Boolean(cleaned.removedContact), removedItems: cleaned.removedItems || [], descriptionSufficient: Boolean(cleaned.hasEnoughProductInformation) };
      }
    } catch (e) {
      console.error('Gemini product moderation unavailable:', e);
      source = 'MANUAL_REVIEW'; decision = 'PENDING_REVIEW'; moderationData = { reason: 'AI service unavailable; administrator review required.' };
    }
    const p = await prisma.product.create({ data: { sellerId: user.id, categoryId: d.categoryId, title: title.slice(0, 140), description, price, quantity, condition: d.condition || 'GOOD', locationText, status: decision, moderationSource: source, moderationData, moderationNote: decision === 'PENDING_REVIEW' ? 'AI screening requires administrator review.' : null, publishedAt: decision === 'ACTIVE' ? new Date() : null, images: { create: images.map((imageUrl: string, i: number) => ({ imageUrl, sortOrder: i })) } } });
    if(p.status==='PENDING_REVIEW') await notifyAdmins({type:'LISTING',title:'Product needs manual review',body:`A listing from ${user.fullName||user.shopName||'a seller'} needs review. Reason: ${moderationData.reason||'AI screening was uncertain.'}`,priority:'HIGH'});
    return NextResponse.json({ id: p.id, status: p.status, moderationSource: source, descriptionCleaned: Boolean(cleaned.removedContact), removedItems: cleaned.removedItems || [] }, { status: 201 });
  } catch (e) { console.error('Product submission failed:', e); return NextResponse.json({ error: 'Unable to submit listing.' }, { status: 500 }); }
}
