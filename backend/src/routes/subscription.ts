import { Router, Response } from 'express';
import { getDatabase, saveDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

const MONTHLY_PRICE = 99;
const TRIAL_DAYS = 10;

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = db.exec(
      'SELECT subscription_tier, subscription_expiry, trial_end, card_added FROM users WHERE id = ?',
      [req.userId]
    );
    if (!result.length || !result[0].values.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const row = result[0].values[0];
    const expiry = row[1] ? new Date(row[1] as string) : null;
    const trialEnd = row[2] ? new Date(row[2] as string) : null;
    const now = new Date();

    res.json({
      tier: row[0],
      expiry: row[1],
      trial_end: row[2],
      card_added: row[3],
      daysLeft: expiry ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000)) : 0,
      isExpired: expiry ? expiry < now : false,
      isTrial: row[0] === 'trial',
      monthlyPrice: MONTHLY_PRICE,
      trialDays: TRIAL_DAYS,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/add-card', async (req: AuthRequest, res: Response) => {
  try {
    const { cardNumber, cardHolder, expiryDate } = req.body;
    if (!cardNumber || !cardHolder || !expiryDate) {
      res.status(400).json({ error: 'Kart bilgileri eksik' });
      return;
    }

    const last4 = cardNumber.replace(/\D/g, '').slice(-4);
    const masked = `**** **** **** ${last4}`;

    const db = await getDatabase();
    db.run('UPDATE users SET card_added = 1, card_last4 = ?, card_holder = ?, card_expiry = ? WHERE id = ?',
      [last4, cardHolder, expiryDate, req.userId]);
    saveDatabase();

    res.json({ success: true, masked });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/activate', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const userResult = db.exec('SELECT subscription_tier, card_added FROM users WHERE id = ?', [req.userId]);
    const row = userResult[0].values[0];

    if (!row[1]) {
      res.status(400).json({ error: 'Önce kart eklemelisiniz' });
      return;
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    db.run(
      'UPDATE users SET subscription_tier = ?, subscription_expiry = ? WHERE id = ?',
      ['active', expiry.toISOString(), req.userId]
    );
    saveDatabase();

    res.json({ success: true, expiry: expiry.toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/renew', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const userResult = db.exec(
      'SELECT subscription_tier, subscription_expiry, card_added FROM users WHERE id = ?',
      [req.userId]
    );
    const row = userResult[0].values[0];
    const tier = row[0] as string;
    const expiry = row[1] ? new Date(row[1] as string) : null;
    const cardAdded = row[2];

    if (tier !== 'active') {
      res.status(400).json({ error: 'Aktif abonelik yok' });
      return;
    }

    if (!cardAdded) {
      res.status(400).json({ error: 'Kart bulunamadı' });
      return;
    }

    const newExpiry = expiry ? new Date(expiry) : new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);

    db.run(
      'UPDATE users SET subscription_expiry = ? WHERE id = ?',
      [newExpiry.toISOString(), req.userId]
    );
    saveDatabase();

    res.json({ success: true, expiry: newExpiry.toISOString(), amount: MONTHLY_PRICE });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
