import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all tasks for user across all projects
router.get('/', authenticate, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { assigneeId: req.user.id },
          { project: { ownerId: req.user.id } },
          { project: { members: { some: { id: req.user.id } } } },
          { ...(req.user.role === 'ADMIN' ? { id: { not: '' } } : {}) }
        ]
      },
      include: {
        project: { select: { name: true } },
        assignee: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
});

// Create task
router.post('/', authenticate, async (req, res) => {
  const { title, description, priority, dueDate, projectId, assigneeId } = req.body;

  try {
    // Check if user is member of project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true }
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    const isAuthorized = project.members.some(m => m.id === req.user.id) || 
                         project.ownerId === req.user.id || 
                         req.user.role === 'ADMIN';
    if (!isAuthorized) return res.status(403).json({ message: 'Access denied' });

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId,
        assigneeId: assigneeId || null
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Error creating task', error: error.message });
  }
});

// Update task status
router.patch('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;

  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { project: true }
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Allow update if owner of project, member of project, or assignee
    const isAuthorized = task.project.ownerId === req.user.id || 
                         task.assigneeId === req.user.id ||
                         (await prisma.project.findUnique({
                           where: { id: task.projectId },
                           include: { members: { where: { id: req.user.id } } }
                         })).members.length > 0;

    if (!isAuthorized) return res.status(403).json({ message: 'Access denied' });

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: { status },
      include: { assignee: { select: { name: true } } }
    });

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Error updating task status', error: error.message });
  }
});

// Delete task
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { project: true }
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Allow deletion if project owner, admin, or project member
    const isMember = await prisma.project.findFirst({
      where: {
        id: task.projectId,
        members: { some: { id: req.user.id } }
      }
    });

    if (task.project.ownerId !== req.user.id && req.user.role !== 'ADMIN' && !isMember) {
      return res.status(403).json({ message: 'Access denied: You must be a project member, owner, or admin to delete this task.' });
    }

    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task', error: error.message });
  }
});

export default router;
