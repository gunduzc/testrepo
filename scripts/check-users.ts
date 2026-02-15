import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // List existing users
  const users = await prisma.user.findMany();
  console.log('Existing users:');
  users.forEach(u => console.log(`  ${u.email} - ${u.role}`));

  // Create test accounts if they don't exist
  const password = await bcrypt.hash('password123', 10);

  const testUsers = [
    { email: 'admin@example.com', name: 'Admin User', role: 'ADMIN' as const },
    { email: 'educator@example.com', name: 'Educator User', role: 'EDUCATOR' as const },
    { email: 'student@example.com', name: 'Student User', role: 'STUDENT' as const },
  ];

  for (const user of testUsers) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          passwordHash: password,
        }
      });
      console.log(`Created: ${user.email}`);
    } else {
      // Update password to ensure it works
      await prisma.user.update({
        where: { email: user.email },
        data: { passwordHash: password }
      });
      console.log(`Updated password for: ${user.email}`);
    }
  }

  // Enroll student in existing curriculum
  const student = await prisma.user.findUnique({ where: { email: 'student@example.com' } });
  const curriculum = await prisma.curriculum.findFirst({ where: { isPublic: true } });

  if (student && curriculum) {
    await prisma.userCurriculumEnrollment.upsert({
      where: { userId_curriculumId: { userId: student.id, curriculumId: curriculum.id } },
      create: { userId: student.id, curriculumId: curriculum.id },
      update: {},
    });
    console.log(`Enrolled student in: ${curriculum.name}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
