import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, subscriptionMiddleware, buildingOwnerMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/building/:buildingId', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = await db.query(
      'SELECT * FROM expenses WHERE building_id = $1 ORDER BY date DESC',
      [req.params.buildingId]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/total/:buildingId', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    const db = await getDatabase();
    let result;
    if (month && year) {
      result = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
         WHERE building_id = $1 AND EXTRACT(MONTH FROM date::timestamp) = $2 AND EXTRACT(YEAR FROM date::timestamp) = $3`,
        [req.params.buildingId, Number(month) + 1, String(year)]
      );
    } else {
      result = await db.query(
        'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE building_id = $1',
        [req.params.buildingId]
      );
    }
    res.json({ total: result.rows[0].total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { buildingId, category, description, amount } = req.body;
    if (!buildingId || !category || !description || !amount) {
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
      'INSERT INTO expenses (id, building_id, category, description, amount, date, created_by) VALUES ($1, $2, $3, $4, $5, NOW()::text, $6)',
      [id, buildingId, category, description, amount, req.userId]
    );
    saveDatabase();

    res.status(201).json({
      id, building_id: buildingId, category, description, amount,
      date: new Date().toISOString(), created_by: req.userId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { category, description, amount } = req.body;
    const db = await getDatabase();
    const result = await db.query('SELECT building_id FROM expenses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const buildingId = result.rows[0].building_id;
    const ownResult = await db.query('SELECT admin_id FROM buildings WHERE id = $1', [buildingId]);
    if (ownResult.rows.length === 0 || ownResult.rows[0].admin_id !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    await db.query(
      'UPDATE expenses SET category = $1, description = $2, amount = $3 WHERE id = $4',
      [category, description, amount, req.params.id]
    );
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = await db.query('SELECT building_id FROM expenses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const buildingId = result.rows[0].building_id;
    const ownResult = await db.query('SELECT admin_id FROM buildings WHERE id = $1', [buildingId]);
    if (ownResult.rows.length === 0 || ownResult.rows[0].admin_id !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    await db.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
