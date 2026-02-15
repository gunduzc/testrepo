import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, passwordHash: true, role: true }
  });

  console.log('Users and password status:');
  for (const user of users) {
    const hasPassword = !!user.passwordHash;
    let canLogin = false;

    if (user.passwordHash) {
      canLogin = await bcrypt.compare('password123', user.passwordHash);
    }

    console.log(`  ${user.email} - ${user.role} - hasPassword: ${hasPassword} - canLogin with 'password123': ${canLogin}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
