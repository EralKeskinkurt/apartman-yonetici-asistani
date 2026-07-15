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

    const countResult = db.exec(
      'SELECT COUNT(*) as total FROM announcements WHERE building_id = ?',
      [req.params.buildingId]
    );
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0;

    const result = db.exec(
      `SELECT * FROM announcements WHERE building_id = ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [req.params.buildingId]
    );
    const announcements = result.length > 0
      ? result[0].values.map((row) => ({
          id: row[0], building_id: row[1], title: row[2],
          content: row[3], created_by: row[4], created_at: row[5],
        }))
      : [];
    res.json({ announcements, total, limit, offset });
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
    const ownResult = db.exec('SELECT admin_id FROM buildings WHERE id = ?', [buildingId]);
    if (!ownResult.length || !ownResult[0].values.length || ownResult[0].values[0][0] !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const id = generateId();
    db.run(
      'INSERT INTO announcements (id, building_id, title, content, created_by) VALUES (?, ?, ?, ?, ?)',
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
    const result = db.exec('SELECT building_id FROM announcements WHERE id = ?', [req.params.id]);
    if (!result.length || !result[0].values.length) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }
    const buildingId = result[0].values[0][0] as string;
    const ownResult = db.exec('SELECT admin_id FROM buildings WHERE id = ?', [buildingId]);
    if (!ownResult.length || !ownResult[0].values.length || ownResult[0].values[0][0] !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    db.run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
