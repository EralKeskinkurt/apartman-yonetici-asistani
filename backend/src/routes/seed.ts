import { Router, Response } from 'express';
import { getDatabase, saveDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const sampleResidents = [
  { name: 'Ahmet Yılmaz', phone: '05321234567', email: 'ahmet@mail.com' },
  { name: 'Ayşe Demir', phone: '05338765432', email: 'ayse@mail.com' },
  { name: 'Mehmet Kaya', phone: '05351112233', email: 'mehmet@mail.com' },
  { name: 'Fatma Çelik', phone: '05392223344', email: 'fatma@mail.com' },
  { name: 'Ali Öztürk', phone: '05413334455', email: 'ali@mail.com' },
  { name: 'Zeynep Aydın', phone: '05424445556', email: 'zeynep@mail.com' },
  { name: 'Mustafa Şahin', phone: '05435556667', email: 'mustafa@mail.com' },
  { name: 'Emine Koç', phone: '05446667778', email: 'emine@mail.com' },
  { name: 'Hüseyin Arslan', phone: '05457778889', email: 'huseyin@mail.com' },
  { name: 'Hatice Polat', phone: '05468889990', email: 'hatice@mail.com' },
];

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const userResult = db.exec('SELECT building_id FROM users WHERE id = ?', [req.userId]);
    if (!userResult.length || !userResult[0].values.length) {
      res.status(400).json({ error: 'User not found' });
      return;
    }
    const buildingId = userResult[0].values[0][0] as string;
    if (!buildingId) {
      res.status(400).json({ error: 'No building found' });
      return;
    }

    const flatResult = db.exec('SELECT id, number FROM flats WHERE building_id = ? ORDER BY number LIMIT 10', [buildingId]);
    if (!flatResult.length) {
      res.status(400).json({ error: 'No flats found' });
      return;
    }

    const flats = flatResult[0].values;
    for (let i = 0; i < flats.length; i++) {
      const flatId = flats[i][0] as string;
      const resident = sampleResidents[i];
      db.run(
        'UPDATE flats SET owner_name = ?, owner_phone = ?, owner_email = ? WHERE id = ?',
        [resident.name, resident.phone, resident.email, flatId]
      );
    }
    saveDatabase();
    res.json({ success: true, message: `${flats.length} residents added` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
