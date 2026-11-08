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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const sellerRole = url.searchParams.get('seller') || undefined;
    const min = Number(url.searchParams.get('min') || 0);
    const max = Number(url.searchParams.get('max') || 0);

    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        quantity: { gt: 0 },
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
        seller: {
          status: 'ACTIVE',
          ...(sellerRole && ['STUDENT', 'MERCHANT'].includes(sellerRole) ? { role: sellerRole as any } : {}),
        },
        category: {
          isActive: true,
          ...(category ? { slug: category } : {}),
        },
        ...(q ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
        price: {
          ...(min ? { gte: min } : {}),
          ...(max ? { lte: max } : {}),
        },
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' }, take: 3 },
        category: true,
        seller: {
          select: {
            id: true,
            role: true,
            status: true,
            shopName: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 120,
    });

    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ error: 'Unable to load products. Ensure the database is configured.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Sign in with an approved seller account to create a listing.' }, { status: 401 });
  }

  try {
    const d = await req.json();
    const title = String(d.title || '').trim();
    let description = String(d.description || '').trim();
    const locationText = String(d.locationText || 'Woldiya University').trim();
    const contactPhoneInput = String(d.contactPhone || user.phone || '').trim();
    const contactPhone = normalizeEthiopianPhone(contactPhoneInput) || '';
    const telegramHandle = d.telegramHandle ? String(d.telegramHandle).trim().replace(/^@+/, '') : null;

    if (!title || title.length > 140 || typeof d.categoryId !== 'string' || !d.categoryId) {
      return NextResponse.json({ error: 'Enter a product title and choose a category.' }, { status: 400 });
    }
    if (!contactPhone) return NextResponse.json({ error: 'Enter a valid Ethiopian mobile number, such as 09XXXXXXXX or +2519XXXXXXXX.' }, { status: 400 });
    if (d.phonePublicConsent !== true) return NextResponse.json({ error: 'Confirm that you agree to display this phone number publicly on your listing.' }, { status: 400 });
    if (description.length > 5000 || locationText.length > 120) {
      return NextResponse.json({ error: 'Description must be 5000 characters or fewer and location 120 characters or fewer.' }, { status: 400 });
    }

    const price = Number(d.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000000) {
      return NextResponse.json({ error: 'Enter a valid product price.' }, { status: 400 });
    }

    // Determine required coin cost by price tier
    const coinCost = getRequiredCoinsForPrice(price);

    // Pending review coins are reserved, not deducted. Available = owned - reserved.
    const availableCoins = Math.max(0, user.coinBalance - (user.reservedCoinBalance || 0));
    if (availableCoins < coinCost) {
      return NextResponse.json({
        error: `This listing requires ${coinCost} coins. You have ${availableCoins} available (${user.coinBalance} owned, ${user.reservedCoinBalance || 0} reserved). Purchase more coins or wait for pending reviews.`,
        requiredCoins: coinCost,
        currentBalance: user.coinBalance,
        reservedBalance: user.reservedCoinBalance || 0,
        availableBalance: availableCoins,
      }, { status: 402 });
    }

    const quantity = Number(d.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      return NextResponse.json({ error: 'Enter a valid stock quantity.' }, { status: 400 });
    }
    if (!['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'].includes(d.condition || 'GOOD')) {
      return NextResponse.json({ error: 'Choose a valid product condition.' }, { status: 400 });
    }
    if (!Array.isArray(d.images) || d.images.length < 1 || d.images.length > 3 || !d.images.every(isAllowedProductImageUrl)) {
      return NextResponse.json({ error: 'Upload between one and three product images using marketplace storage.' }, { status: 400 });
    }
    const images: string[] = d.images;

    const category = await prisma.category.findFirst({
      where: { id: String(d.categoryId), isActive: true },
      select: { id: true, listingTemplate: true },
    });
    if (!category) return NextResponse.json({ error: 'Choose an active marketplace category.' }, { status: 400 });

    const templateFields = Array.isArray(category.listingTemplate)
      ? category.listingTemplate as Array<{ key?: string; label?: string; required?: boolean }>
      : [];
    const templateValues = d.templateValues && typeof d.templateValues === 'object'
      ? d.templateValues as Record<string, unknown>
      : {};
    const missingTemplate = templateFields.filter(field => field.required && (!field.key || !String(templateValues[field.key] ?? '').trim()));
    if (missingTemplate.length) {
      return NextResponse.json({ error: `Complete the required category details: ${missingTemplate.map(field => field.label || field.key).join(', ')}.` }, { status: 400 });
    }

    let source = 'MANUAL_REVIEW';
    let decision: 'ACTIVE' | 'PENDING_REVIEW' | 'REJECTED' = 'PENDING_REVIEW';
    let moderationData: any = { checks: [], reason: 'AI review completed.' };

    try {
      const descResult = await inspectDescription(title, description);
      description = String(descResult.cleanedDescription || description).slice(0, 5000);

      if (descResult.isProhibitedOrHarmful) {
        return NextResponse.json({
          error: 'Your product description contains prohibited or unsafe content.',
          reasons: descResult.flags || ['Description flagged for unsafe items.'],
        }, { status: 422 });
      }

      if (images.length > 0) {
        const imageChecks = await Promise.all(images.map(async imageUrl => {
          try {
            const response = await fetch(imageUrl, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
            if (!response.ok) throw new Error('Image could not be fetched.');
            const mime = response.headers.get('content-type')?.split(';')[0] || 'image/webp';
            if (!mime.startsWith('image/')) throw new Error('Stored product file is not an image.');
            const bytes = Buffer.from(await response.arrayBuffer());
            return await inspectProductImage(bytes, mime, title, description);
          } catch {
            return { imageMatches: false, containsProhibited: false, containsOffensive: false, confidence: 0, reasons: ['Image analysis was unavailable.'] };
          }
        }));

        const blocked = imageChecks.some((c: any) => c.containsProhibited || c.containsOffensive);
        const uncertain = imageChecks.some((c: any) => !c.imageMatches || Number(c.confidence) < 0.8);

        if (blocked) {
          return NextResponse.json({
            error: 'Product image contains prohibited or inappropriate content. Please upload clean product photos.',
            reasons: imageChecks.flatMap((c: any) => c.reasons || []),
          }, { status: 422 });
        }

        if (!uncertain && descResult.hasEnoughProductInformation) {
          decision = 'ACTIVE';
          source = 'AI_VERIFIED';
        } else {
          decision = 'PENDING_REVIEW';
          source = 'MANUAL_REVIEW';
        }
        moderationData = { imageChecks, descriptionSufficient: Boolean(descResult.hasEnoughProductInformation) };
      }
    } catch (e) {
      console.error('Gemini product moderation fallback:', e);
      source = 'MANUAL_REVIEW';
      decision = 'PENDING_REVIEW';
      moderationData = { reason: 'AI service unavailable; administrator review required.' };
    }

    // Atomic wallet reservation / charge. AI-published ACTIVE listings are charged now;
    // listings awaiting a human review reserve coins and are charged on approval.
    const product = await prisma.$transaction(async tx => {
      const currentSeller = await tx.user.findUnique({ where: { id: user.id }, select: { coinBalance: true, reservedCoinBalance: true } });
      if (!currentSeller || currentSeller.coinBalance - currentSeller.reservedCoinBalance < coinCost) throw new Error('INSUFFICIENT_COINS');
      if (decision === 'ACTIVE') {
        const changed = await tx.$executeRaw`UPDATE "User" SET "coinBalance" = "coinBalance" - ${coinCost} WHERE "id" = ${user.id} AND "coinBalance" - "reservedCoinBalance" >= ${coinCost}`;
        if (changed !== 1) throw new Error('INSUFFICIENT_COINS');
      } else {
        const changed = await tx.$executeRaw`UPDATE "User" SET "reservedCoinBalance" = "reservedCoinBalance" + ${coinCost} WHERE "id" = ${user.id} AND "coinBalance" - "reservedCoinBalance" >= ${coinCost}`;
        if (changed !== 1) throw new Error('INSUFFICIENT_COINS');
      }

      const now = new Date();
      const expiresAt = decision === 'ACTIVE' ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
      const p = await tx.product.create({
        data: {
          sellerId: user.id,
          categoryId: d.categoryId,
          title: title.slice(0, 140),
          description,
          price,
          quantity,
          condition: d.condition || 'GOOD',
          locationText,
          contactPhone,
          contactPhonePublic: true,
          telegramHandle,
          coinCost,
          status: decision,
          moderationSource: source,
          moderationData,
          moderationNote: decision === 'PENDING_REVIEW' ? 'AI screening requires administrator review.' : null,
          publishedAt: decision === 'ACTIVE' ? now : null,
          expiresAt,
          coinReserved: decision === 'PENDING_REVIEW',
          coinChargedAt: decision === 'ACTIVE' ? now : null,
          images: { create: images.map((imageUrl: string, i: number) => ({ imageUrl, sortOrder: i })) },
        },
      });

      if (decision === 'ACTIVE') {
        await tx.coinTransaction.create({ data: { userId: user.id, amount: -coinCost, type: 'LISTING_FEE', description: `Listing fee for "${title.slice(0, 45)}" (ETB ${price.toLocaleString()})`, referenceId: p.id } });
      }
      await tx.notification.create({
        data: {
          userId: user.id,
          type: 'LISTING',
          title: decision === 'ACTIVE' ? 'Your listing is live' : 'Your listing is awaiting review',
          body: decision === 'ACTIVE'
            ? `${coinCost} coins were charged. Your listing is active for 30 days.`
            : `${coinCost} coins are reserved while an administrator reviews your listing. Coins are deducted only if approved and released if rejected.`,
          priority: decision === 'ACTIVE' ? 'NORMAL' : 'HIGH',
        },
      });

      return p;
    });

    if (product.status === 'PENDING_REVIEW') {
      await notifyAdmins({
        type: 'LISTING',
        title: 'Product needs manual review',
        body: `A listing from ${user.fullName || user.shopName || 'a seller'} needs review.`,
        priority: 'HIGH',
        path: '/admin/listings',
      });
    }

    return NextResponse.json({
      id: product.id,
      status: product.status,
      coinCost: product.coinCost,
      moderationSource: source,
    }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === 'INSUFFICIENT_COINS') {
      return NextResponse.json({ error: 'Insufficient coin balance.' }, { status: 402 });
    }
    console.error('Product submission failed:', e);
    return NextResponse.json({ error: 'Unable to submit listing.' }, { status: 500 });
  }
}
