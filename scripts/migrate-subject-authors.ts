/**
 * Migration script: Assign authors to existing subjects
 *
 * For each subject without an author:
 * - Find the curriculum it belongs to
 * - Use the curriculum's author as the subject's author
 * - If no curriculum, find any educator or admin to assign
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating subject authors...');

  // Find subjects without authors
  const subjectsWithoutAuthor = await prisma.subject.findMany({
    where: { authorId: null },
    include: {
      curriculumSubjects: {
        include: {
          curriculum: true,
        },
      },
    },
  });

  console.log(`Found ${subjectsWithoutAuthor.length} subjects without authors`);

  for (const subject of subjectsWithoutAuthor) {
    let authorId: string | null = null;

    // Try to get author from the first curriculum this subject belongs to
    if (subject.curriculumSubjects.length > 0) {
      authorId = subject.curriculumSubjects[0].curriculum.authorId;
      console.log(`Subject "${subject.name}" -> using curriculum author`);
    }

    // If no curriculum, find any educator or admin
    if (!authorId) {
      const fallbackUser = await prisma.user.findFirst({
        where: {
          role: { in: ['EDUCATOR', 'ADMIN'] },
        },
      });
      if (fallbackUser) {
        authorId = fallbackUser.id;
        console.log(`Subject "${subject.name}" -> using fallback user ${fallbackUser.email}`);
      }
    }

    if (authorId) {
      await prisma.subject.update({
        where: { id: subject.id },
        data: { authorId },
      });
      console.log(`  Updated subject "${subject.name}" with author ${authorId}`);
    } else {
      console.warn(`  WARNING: Could not find author for subject "${subject.name}"`);
    }
  }

  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
