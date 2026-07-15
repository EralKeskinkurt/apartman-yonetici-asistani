import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, subscriptionMiddleware, buildingOwnerMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/building/:buildingId', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = db.exec(
      'SELECT * FROM expenses WHERE building_id = ? ORDER BY date DESC',
      [req.params.buildingId]
    );
    const expenses = result.length > 0
      ? result[0].values.map((row) => ({
          id: row[0], building_id: row[1], category: row[2],
          description: row[3], amount: row[4], date: row[5],
          receipt_url: row[6], created_by: row[7], created_at: row[8],
        }))
      : [];
    res.json(expenses);
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
      result = db.exec(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
         WHERE building_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`,
        [req.params.buildingId, String(Number(month) + 1).padStart(2, '0'), String(year)]
      );
    } else {
      result = db.exec(
        'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE building_id = ?',
        [req.params.buildingId]
      );
    }
    res.json({ total: result[0].values[0][0] });
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
    const ownResult = db.exec('SELECT admin_id FROM buildings WHERE id = ?', [buildingId]);
    if (!ownResult.length || !ownResult[0].values.length || ownResult[0].values[0][0] !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const id = generateId();
    db.run(
      'INSERT INTO expenses (id, building_id, category, description, amount, date, created_by) VALUES (?, ?, ?, ?, ?, datetime("now"), ?)',
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
    const result = db.exec('SELECT building_id FROM expenses WHERE id = ?', [req.params.id]);
    if (!result.length || !result[0].values.length) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const buildingId = result[0].values[0][0] as string;
    const ownResult = db.exec('SELECT admin_id FROM buildings WHERE id = ?', [buildingId]);
    if (!ownResult.length || !ownResult[0].values.length || ownResult[0].values[0][0] !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    db.run(
      'UPDATE expenses SET category = ?, description = ?, amount = ? WHERE id = ?',
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
    const result = db.exec('SELECT building_id FROM expenses WHERE id = ?', [req.params.id]);
    if (!result.length || !result[0].values.length) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const buildingId = result[0].values[0][0] as string;
    const ownResult = db.exec('SELECT admin_id FROM buildings WHERE id = ?', [buildingId]);
    if (!ownResult.length || !ownResult[0].values.length || ownResult[0].values[0][0] !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    db.run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
