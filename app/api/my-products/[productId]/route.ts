import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { inspectDescription, inspectProductImage } from '@/lib/gemini';
import { notifyAdmins } from '@/lib/admin-notifications';
import { isAllowedProductImageUrl } from '@/lib/storage-validation';
import { getRequiredCoinsForPrice } from '@/lib/coins';
import { normalizeEthiopianPhone } from '@/lib/phone';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function PATCH(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Sign in with an approved seller account.' }, { status: 401 });
  }

  try {
    const { productId } = await params;
    const body = await req.json();

    const product = await prisma.product.findFirst({
      where: { id: productId, sellerId: user.id, status: { not: 'ARCHIVED' } },
    });
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    if (product.status === 'EXPIRED' && body.action !== 'renew') return NextResponse.json({ error: 'This listing has expired. Renew it before editing or republishing.' }, { status: 409 });

    if (body.action === 'renew') {
      if (product.status !== 'EXPIRED') return NextResponse.json({ error: 'Only expired listings can be renewed.' }, { status: 409 });
      const renewed = await prisma.$transaction(async tx => {
        const debit = await tx.$executeRaw`UPDATE "User" SET "coinBalance" = "coinBalance" - ${product.coinCost} WHERE "id" = ${user.id} AND "coinBalance" - "reservedCoinBalance" >= ${product.coinCost}`;
        if (debit !== 1) throw new Error('INSUFFICIENT_COINS');
        const changed = await tx.product.updateMany({ where: { id: product.id, sellerId: user.id, status: 'EXPIRED' }, data: { status: 'ACTIVE', publishedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), moderationNote: null, coinChargedAt: new Date(), coinReserved: false } });
        if (changed.count !== 1) throw new Error('LISTING_RENEW_CONFLICT');
        await tx.coinTransaction.create({ data: { userId: user.id, amount: -product.coinCost, type: 'LISTING_FEE', description: `30-day renewal for listing: ${product.title.slice(0,45)}`, referenceId: product.id } });
        await tx.notification.create({ data: { userId: user.id, type: 'LISTING', title: 'Listing renewed', body: `${product.title} is active for another 30 days. ${product.coinCost} coins were deducted.`, priority: 'NORMAL' } });
        return true;
      });
      return NextResponse.json({ ok: renewed, status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    }

    const data: any = {};
    if (body.contactPhone !== undefined && body.phonePublicConsent !== true && product.contactPhonePublic !== true) return NextResponse.json({ error: 'Confirm public display of your contact phone number.' }, { status: 400 });
    if (body.quantity !== undefined) {
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) {
        return NextResponse.json({ error: 'Invalid quantity.' }, { status: 400 });
      }
      data.quantity = quantity;
    }

    let listingChanged = false;
    for (const key of ['title', 'description', 'categoryId', 'locationText', 'contactPhone', 'telegramHandle']) {
      if (body[key] !== undefined) {
        const value = body[key] ? String(body[key]).trim() : '';
        if (key === 'title' && (!value || value.length > 140)) return NextResponse.json({ error: 'Product title must be 1–140 characters.' }, { status: 400 });
        if (key === 'description' && value.length > 5000) return NextResponse.json({ error: 'Description must be 5000 characters or fewer.' }, { status: 400 });
        if (key === 'categoryId' && !value) return NextResponse.json({ error: 'Choose a product category.' }, { status: 400 });
        if (key === 'locationText' && value.length > 120) return NextResponse.json({ error: 'Location must be 120 characters or fewer.' }, { status: 400 });
        if (key === 'contactPhone' && !normalizeEthiopianPhone(value)) return NextResponse.json({ error: 'Enter a valid Ethiopian mobile number, such as 09XXXXXXXX or +2519XXXXXXXX.' }, { status: 400 });
        if (key === 'contactPhone') {
          data.contactPhonePublic = true;
          data.contactPhone = normalizeEthiopianPhone(value);
        } else if (key === 'telegramHandle') {
          data[key] = value ? value.replace(/^@+/, '') : null;
        } else {
          data[key] = value;
        }
        if (['title', 'description', 'categoryId'].includes(key)) {
          listingChanged = true;
        }
      }
    }

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price <= 0 || price > 100000000) return NextResponse.json({ error: 'Enter a valid price.' }, { status: 400 });
      data.price = price;
      data.coinCost = getRequiredCoinsForPrice(price);
      listingChanged = true;
    }

    if (body.condition !== undefined) {
      if (!['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'].includes(body.condition)) return NextResponse.json({ error: 'Invalid product condition.' }, { status: 400 });
      data.condition = body.condition;
      listingChanged = true;
    }

    let imageUrls: string[] | undefined;
    if (body.images !== undefined) {
      if (!Array.isArray(body.images) || body.images.length > 3 || body.images.some((x: unknown) => !isAllowedProductImageUrl(x))) {
        return NextResponse.json({ error: 'Use up to three valid product images.' }, { status: 400 });
      }
      imageUrls = body.images;
      data.images = { deleteMany: {}, create: body.images.map((imageUrl: string, i: number) => ({ imageUrl, sortOrder: i })) };
      listingChanged = true;
    }

    const targetCategoryId = String(data.categoryId ?? product.categoryId);
    const category = await prisma.category.findFirst({ where: { id: targetCategoryId, isActive: true }, select: { id: true, listingTemplate: true } });
    if (!category) return NextResponse.json({ error: 'Choose an active marketplace category.' }, { status: 400 });

    if (body.templateValues !== undefined || data.categoryId !== undefined) {
      const fields = Array.isArray(category.listingTemplate) ? category.listingTemplate as Array<{ key?: string; label?: string; required?: boolean }> : [];
      const values = body.templateValues && typeof body.templateValues === 'object' ? body.templateValues as Record<string, unknown> : {};
      const missing = fields.filter(field => field.required && (!field.key || !String(values[field.key] ?? '').trim()));
      if (missing.length) return NextResponse.json({ error: `Complete the required category details: ${missing.map(field => field.label || field.key).join(', ')}.` }, { status: 400 });
      const rawDescription = String(body.description ?? product.description);
      const general = rawDescription.split('\n').filter(line => !fields.some(field => field.label && line.startsWith(`${field.label}:`))).join('\n').trim();
      const templateDescription = fields.map(field => `${field.label}: ${String(values[field.key || ''] ?? '').trim()}`).filter(line => !line.endsWith(': '));
      data.description = [...templateDescription, general].filter(Boolean).join('\n');
      listingChanged = true;
    }

    if (listingChanged) {
      const title = String(data.title ?? product.title);
      const descriptionResult = await inspectDescription(title, String(data.description ?? product.description));
      if (descriptionResult.isProhibitedOrHarmful) return NextResponse.json({ error: 'The edited description contains prohibited or unsafe content.', reasons: descriptionResult.flags || [] }, { status: 422 });
      data.description = String(descriptionResult.cleanedDescription || data.description || product.description).slice(0, 5000);

      const images = imageUrls ?? (await prisma.productImage.findMany({ where: { productId: product.id }, orderBy: { sortOrder: 'asc' }, take: 3 })).map(x => x.imageUrl);
      if (images.length === 0 || images.some((url: string) => !isAllowedProductImageUrl(url))) {
        return NextResponse.json({ error: 'Upload valid images to Nova storage before saving.' }, { status: 422 });
      }

      const checks = await Promise.all(images.map(async (url: string) => {
        try {
          const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
          if (!response.ok) throw new Error('Image fetch failed');
          const mime = response.headers.get('content-type')?.split(';')[0] || 'image/webp';
          if (!mime.startsWith('image/')) throw new Error('Stored product file is not an image.');
          return await inspectProductImage(Buffer.from(await response.arrayBuffer()), mime, title, String(data.description));
        } catch {
          return { imageMatches: false, containsProhibited: false, containsOffensive: false, confidence: 0, reasons: ['Image analysis unavailable'] };
        }
      }));

      const blocked = checks.some((c: any) => c.containsProhibited || c.containsOffensive);
      if (blocked) {
        return NextResponse.json({ error: 'Your edited image contains prohibited or inappropriate content. Please replace the photo.', reasons: checks.flatMap((c: any) => c.reasons || []) }, { status: 422 });
      }

      const uncertain = checks.some((c: any) => !c.imageMatches || Number(c.confidence) < 0.8) || !descriptionResult.hasEnoughProductInformation;
      data.status = uncertain ? 'PENDING_REVIEW' : 'ACTIVE';
      data.moderationSource = uncertain ? 'MANUAL_REVIEW' : 'AI_VERIFIED';
      data.moderationNote = uncertain ? 'Edited listing requires administrator review.' : null;
      data.moderationData = { imageChecks: checks, recheckedAt: new Date().toISOString() };
      data.publishedAt = uncertain ? null : (product.publishedAt || new Date());
      data.expiresAt = uncertain ? null : (product.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    }

    const finalQuantity = data.quantity ?? product.quantity;
    if (finalQuantity === 0) data.status = 'SOLD';
    else if (data.quantity > 0 && product.status === 'SOLD' && !listingChanged) {
      const stillWithinPaidPeriod = !product.expiresAt || product.expiresAt > new Date();
      data.status = stillWithinPaidPeriod ? 'ACTIVE' : 'EXPIRED';
      // Restocking the same item does not silently grant another 30 days.
      // Its original paid listing period remains unchanged.
    } else if (product.status === 'SOLD' && listingChanged) {
      // A materially edited sold listing is a new publication and must pay again.
      data.coinChargedAt = null;
      data.coinReserved = false;
    }

    const updated = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${product.id} FOR UPDATE`;
      const currentProduct = await tx.product.findUniqueOrThrow({ where: { id: product.id } });
      if (currentProduct.updatedAt.getTime() !== product.updatedAt.getTime()) throw new Error('LISTING_CONFLICT');
      const nextStatus = data.status || currentProduct.status;
      const targetCost = Number(data.coinCost ?? currentProduct.coinCost);
      const now = new Date();
      let reservationActive = currentProduct.coinReserved;

      if (reservationActive && targetCost !== currentProduct.coinCost) {
        const delta = targetCost - currentProduct.coinCost;
        const adjusted = await tx.$executeRaw`UPDATE "User" SET "reservedCoinBalance" = "reservedCoinBalance" + ${delta} WHERE "id" = ${currentProduct.sellerId} AND "reservedCoinBalance" + ${delta} >= 0 AND "coinBalance" - "reservedCoinBalance" >= GREATEST(${delta}, 0)`;
        if (adjusted !== 1) throw new Error('INSUFFICIENT_COINS');
      }

      const feeNotYetCharged = !currentProduct.coinChargedAt || (currentProduct.status === 'SOLD' && listingChanged);
      if (feeNotYetCharged && nextStatus === 'PENDING_REVIEW' && !reservationActive) {
        const reserved = await tx.$executeRaw`UPDATE "User" SET "reservedCoinBalance" = "reservedCoinBalance" + ${targetCost} WHERE "id" = ${currentProduct.sellerId} AND "coinBalance" - "reservedCoinBalance" >= ${targetCost}`;
        if (reserved !== 1) throw new Error('INSUFFICIENT_COINS');
        reservationActive = true;
      }

      if (feeNotYetCharged && nextStatus === 'ACTIVE') {
        const charged = reservationActive
          ? await tx.$executeRaw`UPDATE "User" SET "coinBalance" = "coinBalance" - ${targetCost}, "reservedCoinBalance" = "reservedCoinBalance" - ${targetCost} WHERE "id" = ${currentProduct.sellerId} AND "coinBalance" >= ${targetCost} AND "reservedCoinBalance" >= ${targetCost}`
          : await tx.$executeRaw`UPDATE "User" SET "coinBalance" = "coinBalance" - ${targetCost} WHERE "id" = ${currentProduct.sellerId} AND "coinBalance" - "reservedCoinBalance" >= ${targetCost}`;
        if (charged !== 1) throw new Error('INSUFFICIENT_COINS');
        await tx.coinTransaction.create({ data: { userId: currentProduct.sellerId, amount: -targetCost, type: 'LISTING_FEE', description: `Listing fee for approved listing: ${currentProduct.title.slice(0,45)}`, referenceId: currentProduct.id } });
        reservationActive = false;
        data.coinChargedAt = now;
      }

      if (reservationActive && ['SOLD', 'ARCHIVED'].includes(nextStatus)) {
        const released = await tx.$executeRaw`UPDATE "User" SET "reservedCoinBalance" = "reservedCoinBalance" - ${targetCost} WHERE "id" = ${currentProduct.sellerId} AND "reservedCoinBalance" >= ${targetCost}`;
        if (released !== 1) throw new Error('COIN_RESERVATION_CONFLICT');
        reservationActive = false;
      }

      data.coinReserved = reservationActive;
      if (nextStatus === 'ACTIVE' && currentProduct.status !== 'ACTIVE') {
        data.publishedAt = now;
        data.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
      return tx.product.update({ where: { id: product.id }, data });
    });
    if (listingChanged && updated.status === 'PENDING_REVIEW') {
      await notifyAdmins({ type: 'LISTING', title: 'Edited product needs review', body: `A seller edited listing ${updated.title}; routed to review.`, priority: 'HIGH' });
    }

    return NextResponse.json({ id: updated.id, quantity: updated.quantity, status: updated.status, moderationSource: updated.moderationSource });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_COINS') return NextResponse.json({ error: 'You do not have enough available coins to submit or activate this listing. Purchase more coins and try again.' }, { status: 402 });
    if (error instanceof Error && error.message.includes('CONFLICT')) return NextResponse.json({ error: 'This listing or wallet changed during the request. Refresh and try again.' }, { status: 409 });
    console.error('[my-products.PATCH]', error);
    return NextResponse.json({ error: 'Unable to update product.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  try {
    const { productId } = await params;
    const product = await prisma.product.findFirst({ where: { id: productId, sellerId: user.id, status: { notIn: ['SOLD', 'ARCHIVED'] } } });
    if (!product) return NextResponse.json({ error: 'Listing not found or cannot be archived.' }, { status: 404 });
    await prisma.$transaction(async tx => {
      const result = await tx.product.updateMany({ where: { id: product.id, sellerId: user.id, status: { notIn: ['SOLD', 'ARCHIVED'] } }, data: { status: 'ARCHIVED', coinReserved: false } });
      if (result.count !== 1) throw new Error('LISTING_ARCHIVE_CONFLICT');
      if (product.coinReserved) {
        const released = await tx.$executeRaw`UPDATE "User" SET "reservedCoinBalance" = "reservedCoinBalance" - ${product.coinCost} WHERE "id" = ${user.id} AND "reservedCoinBalance" >= ${product.coinCost}`;
        if (released !== 1) throw new Error('COIN_RESERVATION_CONFLICT');
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unable to archive product.' }, { status: 500 });
  }
}
