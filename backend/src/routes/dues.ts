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
      const result = db.exec(
        `SELECT d.*, f.number as flat_number, f.owner_name, f.owner_phone
         FROM dues d
         JOIN flats f ON d.flat_id = f.id
         WHERE d.building_id = ? AND d.month = ? AND d.year = ?
         ORDER BY f.number`,
        [req.params.buildingId, Number(month), Number(year)]
      );
      const dues = result.length > 0
        ? result[0].values.map((row) => ({
            id: row[0], flat_id: row[1], building_id: row[2], amount: row[3],
            month: row[4], year: row[5], is_paid: row[6], paid_at: row[7],
            created_at: row[8], flat_number: row[9], owner_name: row[10], owner_phone: row[11],
          }))
        : [];
      res.json(dues);
      return;
    }

    const result = db.exec('SELECT * FROM dues WHERE building_id = ? ORDER BY year DESC, month DESC', [
      req.params.buildingId,
    ]);
    const dues = result.length > 0
      ? result[0].values.map((row) => ({
          id: row[0], flat_id: row[1], building_id: row[2], amount: row[3],
          month: row[4], year: row[5], is_paid: row[6], paid_at: row[7], created_at: row[8],
        }))
      : [];
    res.json(dues);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats/:buildingId', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    const db = await getDatabase();
    const result = db.exec(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN is_paid = 1 THEN 1 ELSE 0 END) as paid,
         SUM(amount) as total_amount,
         SUM(CASE WHEN is_paid = 1 THEN amount ELSE 0 END) as paid_amount
       FROM dues
       WHERE building_id = ? AND month = ? AND year = ?`,
      [req.params.buildingId, Number(month), Number(year)]
    );
    const row = result[0].values[0];
    res.json({
      total: row[0], paid: row[1], total_amount: row[2], paid_amount: row[3],
    });
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
      db.run(
        'INSERT INTO dues (id, flat_id, building_id, amount, month, year) VALUES (?, ?, ?, ?, ?, ?)',
        [id, r.flatId, buildingId, r.amount, r.month, r.year]
      );
      created.push({ id, flat_id: r.flatId, building_id: buildingId, amount: r.amount, month: r.month, year: r.year, is_paid: 0, paid_at: null });
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
    db.run('UPDATE dues SET is_paid = 1, paid_at = datetime("now") WHERE id = ?', [
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
    db.run('UPDATE dues SET is_paid = 0, paid_at = NULL WHERE id = ?', [
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
    const buildingResult = db.exec('SELECT monthly_dues FROM buildings WHERE id = ?', [req.params.buildingId]);
    if (!buildingResult.length || !buildingResult[0].values.length) {
      res.status(404).json({ error: 'Building not found' });
      return;
    }
    const monthlyDues = buildingResult[0].values[0][0] as number;
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const existing = db.exec(
      'SELECT id FROM dues WHERE building_id = ? AND month = ? AND year = ?',
      [req.params.buildingId, month, year]
    );
    if (existing.length && existing[0].values.length > 0) {
      res.json({ success: true, message: 'Bu ay için aidatlar zaten oluşturulmuş' });
      return;
    }

    const flatsResult = db.exec('SELECT id FROM flats WHERE building_id = ?', [req.params.buildingId]);
    if (!flatsResult.length || !flatsResult[0].values.length) {
      res.status(400).json({ error: 'No flats found' });
      return;
    }

    const flats = flatsResult[0].values;
    const created: any[] = [];
    for (const flat of flats) {
      const id = generateId();
      db.run(
        'INSERT INTO dues (id, flat_id, building_id, amount, month, year) VALUES (?, ?, ?, ?, ?, ?)',
        [id, flat[0], req.params.buildingId, monthlyDues, month, year]
      );
      created.push({ id, flat_id: flat[0], building_id: req.params.buildingId, amount: monthlyDues, month, year, is_paid: 0 });
    }
    saveDatabase();
    res.status(201).json({ success: true, generated: created.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
