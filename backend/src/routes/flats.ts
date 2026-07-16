import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, subscriptionMiddleware, buildingOwnerMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/building/:buildingId', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = await db.query('SELECT * FROM flats WHERE building_id = $1 ORDER BY number', [
      req.params.buildingId,
    ]);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = await db.query('SELECT * FROM flats WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Flat not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch', async (req: AuthRequest, res: Response) => {
  try {
    const { buildingId, flats: flatData } = req.body;
    if (!buildingId || !flatData || !Array.isArray(flatData)) {
      res.status(400).json({ error: 'buildingId and flats array required' });
      return;
    }

    const db = await getDatabase();
    const ownResult = await db.query('SELECT admin_id FROM buildings WHERE id = $1', [buildingId]);
    if (ownResult.rows.length === 0 || ownResult.rows[0].admin_id !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const created: any[] = [];
    for (const f of flatData) {
      const id = generateId();
      await db.query(
        'INSERT INTO flats (id, building_id, floor, number, owner_name, owner_phone) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, buildingId, f.floor, f.number, f.ownerName || '', f.ownerPhone || '']
      );
      created.push({ id, building_id: buildingId, ...f });
    }
    saveDatabase();

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { ownerName, ownerPhone, ownerEmail, isRented } = req.body;
    const db = await getDatabase();

    const result = await db.query('SELECT building_id FROM flats WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Flat not found' });
      return;
    }
    const buildingId = result.rows[0].building_id;
    const ownResult = await db.query('SELECT admin_id FROM buildings WHERE id = $1', [buildingId]);
    if (ownResult.rows.length === 0 || ownResult.rows[0].admin_id !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    await db.query(
      'UPDATE flats SET owner_name = $1, owner_phone = $2, owner_email = $3, is_rented = $4 WHERE id = $5',
      [ownerName || '', ownerPhone || '', ownerEmail || '', !!isRented, req.params.id]
    );
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
