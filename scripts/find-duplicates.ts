import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const curricula = await prisma.curriculum.findMany({
    where: { name: { contains: 'Arithmetic' } },
    select: { id: true, name: true, createdAt: true }
  });
  console.log('Found curricula with "Arithmetic" in name:');
  curricula.forEach(c => console.log(`  ${c.id} - "${c.name}" - ${c.createdAt}`));

  // If there are duplicates, delete all but the first one
  if (curricula.length > 1) {
    const toDelete = curricula.slice(1);
    for (const c of toDelete) {
      console.log(`Deleting duplicate: ${c.id}`);
      await prisma.curriculum.delete({ where: { id: c.id } });
    }
    console.log('Duplicates removed.');
  } else {
    console.log('No duplicates found.');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
