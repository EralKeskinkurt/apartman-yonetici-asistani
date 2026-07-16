import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, subscriptionMiddleware, buildingOwnerMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/building/:buildingId', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    const db = await getDatabase();

    if (month && year) {
      const result = await db.query(
        `SELECT d.*, f.number as flat_number, f.owner_name, f.owner_phone
         FROM dues d
         JOIN flats f ON d.flat_id = f.id
         WHERE d.building_id = $1 AND d.month = $2 AND d.year = $3
         ORDER BY f.number`,
        [req.params.buildingId, Number(month), Number(year)]
      );
      res.json(result.rows);
      return;
    }

    const result = await db.query('SELECT * FROM dues WHERE building_id = $1 ORDER BY year DESC, month DESC', [
      req.params.buildingId,
    ]);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats/:buildingId', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    const db = await getDatabase();
    const result = await db.query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN is_paid = true THEN 1 ELSE 0 END) as paid,
         SUM(amount) as total_amount,
         SUM(CASE WHEN is_paid = true THEN amount ELSE 0 END) as paid_amount
       FROM dues
       WHERE building_id = $1 AND month = $2 AND year = $3`,
      [req.params.buildingId, Number(month), Number(year)]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch', async (req: AuthRequest, res: Response) => {
  try {
    const { buildingId, records } = req.body;
    if (!buildingId || !records || !Array.isArray(records)) {
      res.status(400).json({ error: 'buildingId and records array required' });
      return;
    }

    const db = await getDatabase();
    const created: any[] = [];
    for (const r of records) {
      const id = generateId();
      await db.query(
        'INSERT INTO dues (id, flat_id, building_id, amount, month, year) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, r.flatId, buildingId, r.amount, r.month, r.year]
      );
      created.push({ id, flat_id: r.flatId, building_id: buildingId, amount: r.amount, month: r.month, year: r.year, is_paid: false, paid_at: null });
    }
    saveDatabase();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/pay', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    await db.query('UPDATE dues SET is_paid = true, paid_at = NOW() WHERE id = $1', [
      req.params.id,
    ]);
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/unpay', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    await db.query('UPDATE dues SET is_paid = false, paid_at = NULL WHERE id = $1', [
      req.params.id,
    ]);
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate/:buildingId', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const buildingResult = await db.query('SELECT monthly_dues FROM buildings WHERE id = $1', [req.params.buildingId]);
    if (buildingResult.rows.length === 0) {
      res.status(404).json({ error: 'Building not found' });
      return;
    }
    const monthlyDues = buildingResult.rows[0].monthly_dues;
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const existing = await db.query(
      'SELECT id FROM dues WHERE building_id = $1 AND month = $2 AND year = $3',
      [req.params.buildingId, month, year]
    );
    if (existing.rows.length > 0) {
      res.json({ success: true, message: 'Bu ay için aidatlar zaten oluşturulmuş' });
      return;
    }

    const flatsResult = await db.query('SELECT id FROM flats WHERE building_id = $1', [req.params.buildingId]);
    if (flatsResult.rows.length === 0) {
      res.status(400).json({ error: 'No flats found' });
      return;
    }

    const flats = flatsResult.rows;
    const created: any[] = [];
    for (const flat of flats) {
      const id = generateId();
      await db.query(
        'INSERT INTO dues (id, flat_id, building_id, amount, month, year) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, flat.id, req.params.buildingId, monthlyDues, month, year]
      );
      created.push({ id, flat_id: flat.id, building_id: req.params.buildingId, amount: monthlyDues, month, year, is_paid: false });
    }
    saveDatabase();
    res.status(201).json({ success: true, generated: created.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
