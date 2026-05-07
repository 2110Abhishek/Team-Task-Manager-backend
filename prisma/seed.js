import bcrypt from 'bcryptjs';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@taskflow.com' },
    update: {},
    create: {
      email: 'admin@taskflow.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  // Create Project
  const project = await prisma.project.create({
    data: {
      name: 'Q2 Marketing Campaign',
      description: 'Main marketing activities for Q2 2026 launch.',
      ownerId: admin.id,
      members: {
        connect: { id: admin.id }
      },
      tasks: {
        create: [
          { title: 'Social Media Strategy', description: 'Draft strategy for IG and LinkedIn', priority: 'HIGH', status: 'COMPLETED' },
          { title: 'Landing Page Copy', description: 'Write copy for the new campaign page', priority: 'MEDIUM', status: 'IN_PROGRESS' },
          { title: 'Budget Approval', description: 'Get CFO approval for ad spend', priority: 'HIGH', status: 'TODO' },
        ]
      }
    }
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
