import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, subscriptionMiddleware, buildingOwnerMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/building/:buildingId', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const limit = Math.min(parseInt(req.query.limit as string) || 6, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM announcements WHERE building_id = $1',
      [req.params.buildingId]
    );
    const total = countResult.rows.length > 0 ? countResult.rows[0].total : 0;

    const result = await db.query(
      'SELECT * FROM announcements WHERE building_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.params.buildingId, limit, offset]
    );
    res.json({ announcements: result.rows, total, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { buildingId, title, content } = req.body;
    if (!buildingId || !title || !content) {
      res.status(400).json({ error: 'All fields required' });
      return;
    }

    const db = await getDatabase();
    const ownResult = await db.query('SELECT admin_id FROM buildings WHERE id = $1', [buildingId]);
    if (ownResult.rows.length === 0 || ownResult.rows[0].admin_id !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const id = generateId();
    await db.query(
      'INSERT INTO announcements (id, building_id, title, content, created_by) VALUES ($1, $2, $3, $4, $5)',
      [id, buildingId, title, content, req.userId]
    );
    saveDatabase();

    res.status(201).json({
      id, building_id: buildingId, title, content,
      created_by: req.userId, created_at: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = await db.query('SELECT building_id FROM announcements WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }
    const buildingId = result.rows[0].building_id;
    const ownResult = await db.query('SELECT admin_id FROM buildings WHERE id = $1', [buildingId]);
    if (ownResult.rows.length === 0 || ownResult.rows[0].admin_id !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    await db.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
