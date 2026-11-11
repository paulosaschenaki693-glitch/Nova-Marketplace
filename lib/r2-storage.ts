import 'server-only';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';

const client = () => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const access = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!account || !access || !secret) throw new Error('Cloudflare R2 is not configured. Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.');
  return new S3Client({ region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: access, secretAccessKey: secret } });
};
const bucket = (kind: 'product'|'student-id'|'payment-proof'|'profile-image') => {
  const name = kind === 'product' || kind === 'profile-image' ? process.env.R2_BUCKET_NAME : process.env.R2_PRIVATE_BUCKET_NAME;
  if (!name) throw new Error(kind === 'product' || kind === 'profile-image' ? 'Set R2_BUCKET_NAME in your environment.' : 'Set R2_PRIVATE_BUCKET_NAME for private verification files.');
  return name;
};
export async function uploadMarketplaceFile(file: File, kind: 'product'|'student-id'|'payment-proof'|'profile-image') {
  if (!file.type.startsWith('image/')) throw new Error('Only image uploads are supported.');
  const input = Buffer.from(await file.arrayBuffer());
  // Keep originals readable at full detail while reducing storage and transfer size.
  const image = sharp(input, { limitInputPixels: 40_000_000 });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error('Invalid image file.');
  const output = await image.rotate().webp({ quality: kind === 'product' ? 82 : 90, effort: 4, smartSubsample: true }).toBuffer();
  const folder = kind === 'product' ? 'products' : kind === 'student-id' ? 'student-ids' : kind === 'payment-proof' ? 'payment-proofs' : 'profile-images';
  const key = `${folder}/${randomUUID()}.webp`;
  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if ((kind === 'product' || kind === 'profile-image') && !publicBase) throw new Error('Set R2_PUBLIC_BASE_URL to the public image domain connected to your R2 bucket.');
  await client().send(new PutObjectCommand({ Bucket: bucket(kind), Key: key, Body: output, ContentType: 'image/webp', CacheControl: kind === 'product' || kind === 'profile-image' ? 'public, max-age=31536000, immutable' : 'private, no-store' }));
  const url = kind === 'product' || kind === 'profile-image' ? `${publicBase}/${key}` : `${kind === 'student-id' ? 'private' : 'private-payment'}://${key.split('/').pop()}`;
  return { url, storageKey: key, bucket: bucket(kind) };
}

export async function privateFileExists(key: string) {
  if (!/^(student-ids|payment-proofs)\/[a-zA-Z0-9-]+\.webp$/.test(key)) return false;
  const folder = key.startsWith('payment-proofs/') ? 'payment-proof' : 'student-id';
  try {
    await client().send(new HeadObjectCommand({ Bucket: bucket(folder), Key: key }));
    return true;
  } catch (error: any) {
    const code = error?.$metadata?.httpStatusCode;
    const name = error?.name;
    if (code === 404 || name === 'NotFound' || name === 'NoSuchKey') return false;
    throw error;
  }
}

export async function downloadPrivateFile(key: string) {
  if (!/^(student-ids|payment-proofs)\/[a-zA-Z0-9-]+\.webp$/.test(key)) return null;
  try {
    const folder = key.startsWith('payment-proofs/') ? 'payment-proof' : 'student-id';
    const result = await client().send(new GetObjectCommand({ Bucket: bucket(folder), Key: key }));
    if (!result.Body) return null;
    const bytes = Buffer.from(await result.Body.transformToByteArray());
    return { bytes, contentType: 'image/webp' };
  } catch { return null; }
}


function validAgreementKey(key: string) {
  return /^seller-agreements\/[a-f0-9-]{36}\.(pdf|jpg|png)$/.test(key);
}

export async function uploadPrivateAgreement(file: File) {
  const rules: Record<string, { ext: string; valid: (b: Buffer) => boolean }> = {
    'application/pdf': { ext: 'pdf', valid: b => b.subarray(0, 5).toString() === '%PDF-' },
    'image/jpeg': { ext: 'jpg', valid: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    'image/png': { ext: 'png', valid: b => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  };
  const rule = rules[file.type];
  if (!rule) throw new Error('Agreement must be a PDF, JPG, or PNG.');
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!rule.valid(bytes)) throw new Error('The file contents do not match the selected document type.');
  const key = `seller-agreements/${randomUUID()}.${rule.ext}`;
  const name = process.env.R2_PRIVATE_BUCKET_NAME;
  if (!name) throw new Error('Set R2_PRIVATE_BUCKET_NAME for seller agreements.');
  await client().send(new PutObjectCommand({ Bucket: name, Key: key, Body: bytes, ContentType: file.type, CacheControl: 'private, no-store' }));
  return { storageKey: key, contentType: file.type, size: bytes.byteLength };
}

export async function privateAgreementExists(key: string) {
  if (!validAgreementKey(key)) return false;
  try {
    await client().send(new HeadObjectCommand({ Bucket: bucket('student-id'), Key: key }));
    return true;
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') return false;
    throw error;
  }
}

export async function downloadPrivateAgreement(key: string) {
  if (!validAgreementKey(key)) return null;
  try {
    const result = await client().send(new GetObjectCommand({ Bucket: bucket('student-id'), Key: key }));
    if (!result.Body) return null;
    return { bytes: Buffer.from(await result.Body.transformToByteArray()), contentType: result.ContentType || 'application/octet-stream' };
  } catch { return null; }
}
