import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, subscriptionMiddleware, buildingOwnerMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/building/:buildingId', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = db.exec('SELECT * FROM flats WHERE building_id = ? ORDER BY number', [
      req.params.buildingId,
    ]);
    const flats = result.length > 0
      ? result[0].values.map((row) => ({
          id: row[0],
          building_id: row[1],
          floor: row[2],
          number: row[3],
          owner_name: row[4],
          owner_phone: row[5],
          owner_email: row[6],
          is_rented: row[7],
          created_at: row[8],
        }))
      : [];
    res.json(flats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = db.exec('SELECT * FROM flats WHERE id = ?', [req.params.id]);
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ error: 'Flat not found' });
      return;
    }
    const row = result[0].values[0];
    res.json({
      id: row[0],
      building_id: row[1],
      floor: row[2],
      number: row[3],
      owner_name: row[4],
      owner_phone: row[5],
      owner_email: row[6],
      is_rented: row[7],
      created_at: row[8],
    });
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
    const ownResult = db.exec('SELECT admin_id FROM buildings WHERE id = ?', [buildingId]);
    if (!ownResult.length || !ownResult[0].values.length || ownResult[0].values[0][0] !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const created: any[] = [];
    for (const f of flatData) {
      const id = generateId();
      db.run(
        'INSERT INTO flats (id, building_id, floor, number, owner_name, owner_phone) VALUES (?, ?, ?, ?, ?, ?)',
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

    const result = db.exec('SELECT building_id FROM flats WHERE id = ?', [req.params.id]);
    if (!result.length || !result[0].values.length) {
      res.status(404).json({ error: 'Flat not found' });
      return;
    }
    const buildingId = result[0].values[0][0] as string;
    const ownResult = db.exec('SELECT admin_id FROM buildings WHERE id = ?', [buildingId]);
    if (!ownResult.length || !ownResult[0].values.length || ownResult[0].values[0][0] !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    db.run(
      'UPDATE flats SET owner_name = ?, owner_phone = ?, owner_email = ?, is_rented = ? WHERE id = ?',
      [ownerName || '', ownerPhone || '', ownerEmail || '', isRented ? 1 : 0, req.params.id]
    );
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
