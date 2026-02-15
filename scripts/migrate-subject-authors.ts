/**
 * Migration script: Assign authors to existing subjects
 *
 * NOTE: This script was for migrating subjects when authorId was optional.
 * Now that authorId is required, this script is deprecated but kept for reference.
 *
 * If you need to run this, temporarily make authorId optional in the schema first.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migration script for subject authors.');
  console.log('NOTE: This script is deprecated - authorId is now required on subjects.');
  console.log('All subjects should already have an authorId assigned.');

  // Count subjects for verification
  const count = await prisma.subject.count();
  console.log(`Total subjects in database: ${count}`);

  await prisma.$disconnect();
}

main().catch(console.error);
