import 'server-only';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';

const client = () => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const access = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!account || !access || !secret) throw new Error('Cloudflare R2 is not configured. Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.');
  return new S3Client({ region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: access, secretAccessKey: secret } });
};
const bucket = (kind: 'product'|'student-id'|'payment-proof') => {
  const name = kind === 'product' ? process.env.R2_BUCKET_NAME : process.env.R2_PRIVATE_BUCKET_NAME;
  if (!name) throw new Error(kind === 'product' ? 'Set R2_BUCKET_NAME in your environment.' : 'Set R2_PRIVATE_BUCKET_NAME for private verification files.');
  return name;
};
export async function uploadMarketplaceFile(file: File, kind: 'product'|'student-id'|'payment-proof') {
  if (!file.type.startsWith('image/')) throw new Error('Only image uploads are supported.');
  const input = Buffer.from(await file.arrayBuffer());
  // Keep originals readable at full detail while reducing storage and transfer size.
  const image = sharp(input, { limitInputPixels: 40_000_000 });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error('Invalid image file.');
  const output = await image.rotate().webp({ quality: kind === 'product' ? 82 : 90, effort: 4, smartSubsample: true }).toBuffer();
  const folder = kind === 'product' ? 'products' : kind === 'student-id' ? 'student-ids' : 'payment-proofs';
  const key = `${folder}/${randomUUID()}.webp`;
  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (kind === 'product' && !publicBase) throw new Error('Set R2_PUBLIC_BASE_URL to the public image domain connected to your R2 bucket.');
  await client().send(new PutObjectCommand({ Bucket: bucket(kind), Key: key, Body: output, ContentType: 'image/webp', CacheControl: kind === 'product' ? 'public, max-age=31536000, immutable' : 'private, no-store' }));
  const url = kind === 'product' ? `${publicBase}/${key}` : `${kind === 'student-id' ? 'private' : 'private-payment'}://${key.split('/').pop()}`;
  return { url, storageKey: key, bucket: bucket(kind) };
}
export async function downloadPrivateFile(key: string) {
  if (!/^(student-ids|payment-proofs)\/[a-zA-Z0-9-]+\.webp$/.test(key)) return null;
  try {
    const result = await client().send(new GetObjectCommand({ Bucket: bucket('student-id'), Key: key }));
    if (!result.Body) return null;
    const bytes = Buffer.from(await result.Body.transformToByteArray());
    return { bytes, contentType: 'image/webp' };
  } catch { return null; }
}
