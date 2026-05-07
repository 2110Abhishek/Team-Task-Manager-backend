import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get all projects for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: req.user.id },
          { members: { some: { id: req.user.id } } },
          { ...(req.user.role === 'ADMIN' ? { id: { not: '' } } : {}) }
        ]
      },
      include: {
        owner: { select: { name: true, email: true } },
        members: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } }
      }
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching projects', error: error.message });
  }
});

// Create project
router.post('/', authenticate, async (req, res) => {
  const { name, description } = req.body;

  try {
    const project = await prisma.project.create({
      data: {
        name,
        description,
        ownerId: req.user.id,
        members: {
          connect: { id: req.user.id }
        }
      },
      include: {
        owner: { select: { name: true, email: true } },
        members: { select: { id: true, name: true, email: true } }
      }
    });
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error creating project', error: error.message });
  }
});

// Get project by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { name: true, email: true } },
        members: { select: { id: true, name: true, email: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    // Check if user is member or owner
    const isAuthorized = project.members.some(m => m.id === req.user.id) || 
                         project.ownerId === req.user.id || 
                         req.user.role === 'ADMIN';
    if (!isAuthorized) return res.status(403).json({ message: 'Access denied' });

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching project', error: error.message });
  }
});

// Add member to project (Admin or Owner only)
router.post('/:id/members', authenticate, async (req, res) => {
  const { email } = req.body;

  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only owners or admins can add members' });
    }

    const normalizedEmail = email.toLowerCase();
    const userToAdd = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!userToAdd) return res.status(404).json({ message: 'User not found' });

    const updatedProject = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        members: { connect: { id: userToAdd.id } }
      },
      include: {
        members: { select: { id: true, name: true, email: true } }
      }
    });

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: 'Error adding member', error: error.message });
  }
});

// Delete project (Admin or Owner only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only Global Admins can delete projects' });
    }

    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting project', error: error.message });
  }
});

export default router;
