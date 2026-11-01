import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const categories = [
    ['Electronics', 'ኤሌክትሮኒክስ', 'electronics', 1],
    ['Books', 'መጽሐፍት', 'books', 2],
    ['Clothing', 'ልብስ', 'clothing', 3],
    ['Stationery', 'የጽሕፈት መሣሪያዎች', 'stationery', 4],
    ['Others', 'ሌሎች', 'others', 5],
  ] as const;
  for (const [nameEn, nameAm, slug, sortOrder] of categories) {
    await prisma.category.upsert({ where: { slug }, update: { nameEn, nameAm, sortOrder, isActive: true }, create: { nameEn, nameAm, slug, sortOrder } });
  }
  console.log('Seeded marketplace categories. Create Firebase Auth accounts separately; do not seed password-based demo users.');
}
main().finally(() => prisma.$disconnect());
