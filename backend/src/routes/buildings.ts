import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, subscriptionMiddleware, buildingOwnerMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = db.exec('SELECT * FROM buildings WHERE admin_id = ?', [req.userId]);
    const buildings = result.length > 0
      ? result[0].values.map((row) => ({
          id: row[0],
          name: row[1],
          address: row[2],
          total_flats: row[3],
          monthly_dues: row[4],
          admin_id: row[5],
          created_at: row[6],
        }))
      : [];
    res.json(buildings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = db.exec('SELECT * FROM buildings WHERE id = ?', [req.params.id]);
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ error: 'Building not found' });
      return;
    }
    const row = result[0].values[0];
    res.json({
      id: row[0],
      name: row[1],
      address: row[2],
      total_flats: row[3],
      monthly_dues: row[4],
      admin_id: row[5],
      created_at: row[6],
    });
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
    db.run(
      'INSERT INTO buildings (id, name, address, total_flats, monthly_dues, admin_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, address, totalFlats, monthlyDues, req.userId]
    );
    db.run('UPDATE users SET building_id = ? WHERE id = ?', [id, req.userId]);
    saveDatabase();

    const result = db.exec('SELECT * FROM buildings WHERE id = ?', [id]);
    const row = result[0].values[0];
    res.status(201).json({
      id: row[0], name: row[1], address: row[2], total_flats: row[3],
      monthly_dues: row[4], admin_id: row[5], created_at: row[6],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', buildingOwnerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, monthlyDues } = req.body;
    const db = await getDatabase();
    db.run(
      'UPDATE buildings SET name = ?, address = ?, monthly_dues = ? WHERE id = ?',
      [name, address, monthlyDues, req.params.id]
    );
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
