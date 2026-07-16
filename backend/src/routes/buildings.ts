import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, subscriptionMiddleware, buildingOwnerMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = await db.query('SELECT * FROM buildings WHERE admin_id = $1', [req.userId]);
    const buildings = result.rows;
    res.json(buildings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = await db.query('SELECT * FROM buildings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Building not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, totalFlats, monthlyDues } = req.body;
    if (!name || !address || !totalFlats || !monthlyDues) {
      res.status(400).json({ error: 'All fields required' });
      return;
    }

    const db = await getDatabase();
    const id = generateId();
    await db.query(
      'INSERT INTO buildings (id, name, address, total_flats, monthly_dues, admin_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, name, address, totalFlats, monthlyDues, req.userId]
    );
    await db.query('UPDATE users SET building_id = $1 WHERE id = $2', [id, req.userId]);
    saveDatabase();

    const result = await db.query('SELECT * FROM buildings WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, monthlyDues } = req.body;
    const db = await getDatabase();
    await db.query(
      'UPDATE buildings SET name = $1, address = $2, monthly_dues = $3 WHERE id = $4',
      [name, address, monthlyDues, req.params.id]
    );
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
