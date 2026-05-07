import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Count projects where user is owner or member
    const projectCount = await prisma.project.count({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { id: userId } } }
        ]
      }
    });

    // Count tasks assigned to user
    const totalTasks = await prisma.task.count({
      where: { assigneeId: userId }
    });

    const completedTasks = await prisma.task.count({
      where: { assigneeId: userId, status: 'COMPLETED' }
    });

    const pendingTasks = await prisma.task.count({
      where: { assigneeId: userId, status: { in: ['TODO', 'IN_PROGRESS'] } }
    });

    // Overdue tasks (status not COMPLETED and dueDate < now)
    const overdueTasks = await prisma.task.count({
      where: {
        assigneeId: userId,
        status: { not: 'COMPLETED' },
        dueDate: { lt: new Date() }
      }
    });

    // Get recent tasks
    const recentTasks = await prisma.task.findMany({
      where: {
        OR: [
          { assigneeId: userId },
          { project: { ownerId: userId } }
        ]
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { name: true } },
        assignee: { select: { name: true } }
      }
    });

    res.json({
      projectCount,
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      recentTasks
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
});

export default router;
