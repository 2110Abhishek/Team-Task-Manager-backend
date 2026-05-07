import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const task = await prisma.task.findFirst();
  if (!task) {
    console.log('No tasks found');
    return;
  }
  console.log('Found task:', task.title);
  // We won't actually delete it here, just verifying we can find it
}

main().catch(console.error).finally(() => prisma.$disconnect());
