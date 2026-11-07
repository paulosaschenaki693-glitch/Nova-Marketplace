import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/auth';

type TemplateField = { key: string; label: string; required: boolean; placeholder?: string };

function normalizeTemplate(value: unknown): TemplateField[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error('A category template can contain up to 20 fields.');
  const keys = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Each template field must be an object.');
    const field = item as Record<string, unknown>;
    const key = typeof field.key === 'string' ? field.key.trim() : '';
    const label = typeof field.label === 'string' ? field.label.trim() : '';
    const placeholder = typeof field.placeholder === 'string' ? field.placeholder.trim() : '';
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(key) || !label || label.length > 80 || placeholder.length > 120) {
      throw new Error('Each template field needs a valid key and a label (maximum 80 characters).');
    }
    if (keys.has(key)) throw new Error('Template field keys must be unique.');
    keys.add(key);
    return { key, label, required: field.required === true, ...(placeholder ? { placeholder } : {}) };
  });
}

export async function GET() {
  try {
    const admin = await requireUser(['ADMIN']);
    const categories = await prisma.category.findMany({
      where: admin ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const body = await req.json();
    const nameEn = String(body.nameEn || '').trim();
    const nameAm = String(body.nameAm || nameEn).trim();
    const slug = String(body.slug || nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).trim().toLowerCase();
    if (!nameEn || nameEn.length > 80 || nameAm.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'Enter a valid category name and URL slug.' }, { status: 400 });
    }
    const listingTemplate = normalizeTemplate(body.listingTemplate ?? []);
    const sortOrder = Number(body.sortOrder ?? 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      return NextResponse.json({ error: 'Category order must be a whole number from 0 to 10000.' }, { status: 400 });
    }
    const category = await prisma.category.create({
      data: { nameEn, nameAm, slug, sortOrder, isActive: true, listingTemplate },
    });
    await prisma.adminAuditLog.create({
      data: { adminId: admin.id, action: 'CREATE', entityType: 'Category', entityId: category.id, reason: `Created category ${nameEn}` },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create category. Check whether its slug already exists.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const body = await req.json();
    if (typeof body.id !== 'string' || !body.id) return NextResponse.json({ error: 'Category ID is required.' }, { status: 400 });
    const data: Prisma.CategoryUpdateInput = {};
    if (body.nameEn !== undefined) {
      const value = String(body.nameEn).trim();
      if (!value || value.length > 80) return NextResponse.json({ error: 'Enter a category name up to 80 characters.' }, { status: 400 });
      data.nameEn = value;
    }
    if (body.nameAm !== undefined) {
      const value = String(body.nameAm).trim();
      if (value.length > 80) return NextResponse.json({ error: 'Amharic category name must be 80 characters or fewer.' }, { status: 400 });
      data.nameAm = value;
    }
    if (body.slug !== undefined) {
      const value = String(body.slug).trim().toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return NextResponse.json({ error: 'Enter a valid URL slug.' }, { status: 400 });
      data.slug = value;
    }
    if (body.sortOrder !== undefined) {
      const value = Number(body.sortOrder);
      if (!Number.isInteger(value) || value < 0 || value > 10000) return NextResponse.json({ error: 'Category order must be a whole number from 0 to 10000.' }, { status: 400 });
      data.sortOrder = value;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.listingTemplate !== undefined) data.listingTemplate = normalizeTemplate(body.listingTemplate);
    const category = await prisma.category.update({ where: { id: body.id }, data });
    await prisma.adminAuditLog.create({
      data: { adminId: admin.id, action: 'UPDATE', entityType: 'Category', entityId: category.id, reason: 'Updated category settings' },
    });
    return NextResponse.json(category);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update category. Check that the slug is unique.' }, { status: 400 });
  }
}
