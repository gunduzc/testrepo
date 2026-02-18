import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  // Promote user to EDUCATOR
  const educator = await prisma.user.update({
    where: { email: 'educator@test.com' },
    data: { role: 'EDUCATOR' }
  });
  console.log('Promoted educator:', educator.id);

  // Create a curriculum
  const curriculum = await prisma.curriculum.create({
    data: {
      name: 'Basic Arithmetic',
      description: 'Learn addition, subtraction, multiplication and division',
      authorId: educator.id,
    }
  });
  console.log('Created curriculum:', curriculum.id);

  // Create subjects
  const addition = await prisma.subject.create({
    data: { name: 'Addition', description: 'Adding numbers together', authorId: educator.id }
  });

  const subtraction = await prisma.subject.create({
    data: { name: 'Subtraction', description: 'Subtracting numbers', authorId: educator.id }
  });

  const multiplication = await prisma.subject.create({
    data: { name: 'Multiplication', description: 'Multiplying numbers', authorId: educator.id }
  });

  // Link subjects to curriculum
  await prisma.curriculumSubject.createMany({
    data: [
      { curriculumId: curriculum.id, subjectId: addition.id },
      { curriculumId: curriculum.id, subjectId: subtraction.id },
      { curriculumId: curriculum.id, subjectId: multiplication.id },
    ]
  });

  // Add prerequisites: subtraction requires addition, multiplication requires addition
  await prisma.subjectPrerequisite.createMany({
    data: [
      { subjectId: subtraction.id, prerequisiteId: addition.id },
      { subjectId: multiplication.id, prerequisiteId: addition.id },
    ]
  });

  // Create cards
  const additionCard = await prisma.card.create({
    data: {
      name: 'Simple Addition',
      description: 'Add two numbers between 1 and 20',
      answerType: 'INTEGER',
      functionSource: `function generate() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const sum = a + b;
  return {
    question: "What is " + a + " + " + b + "?",
    answer: { correct: String(sum), type: "INTEGER" },
    solution: a + " + " + b + " = " + sum
  };
}`,
      authorId: educator.id,
    }
  });

  const subtractionCard = await prisma.card.create({
    data: {
      name: 'Simple Subtraction',
      description: 'Subtract two numbers',
      answerType: 'INTEGER',
      functionSource: `function generate() {
  const a = Math.floor(Math.random() * 20) + 10;
  const b = Math.floor(Math.random() * 10) + 1;
  const diff = a - b;
  return {
    question: "What is " + a + " - " + b + "?",
    answer: { correct: String(diff), type: "INTEGER" },
    solution: a + " - " + b + " = " + diff
  };
}`,
      authorId: educator.id,
    }
  });

  const multiplicationCard = await prisma.card.create({
    data: {
      name: 'Times Tables',
      description: 'Multiply single digits',
      answerType: 'INTEGER',
      functionSource: `function generate() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const product = a * b;
  return {
    question: "What is " + a + " × " + b + "?",
    answer: { correct: String(product), type: "INTEGER" },
    solution: a + " × " + b + " = " + product
  };
}`,
      authorId: educator.id,
    }
  });

  // Link cards to subjects
  await prisma.cardSubject.createMany({
    data: [
      { cardId: additionCard.id, subjectId: addition.id, position: 0 },
      { cardId: subtractionCard.id, subjectId: subtraction.id, position: 0 },
      { cardId: multiplicationCard.id, subjectId: multiplication.id, position: 0 },
    ]
  });

  console.log('Created cards:', additionCard.id, subtractionCard.id, multiplicationCard.id);
  console.log('\n=== TEST DATA CREATED ===');
  console.log('Curriculum ID:', curriculum.id);
  console.log('Study URL: http://localhost:3000/study/' + curriculum.id);
  console.log('\nLogin with: educator@test.com / password123');

  await prisma.$disconnect();
}

seed().catch(console.error);
