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
    const result = await db.query(
      'SELECT subscription_tier, subscription_expiry, trial_end, card_added FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const row = result.rows[0];
    const expiry = row.subscription_expiry ? new Date(row.subscription_expiry as string) : null;
    const trialEnd = row.trial_end ? new Date(row.trial_end as string) : null;
    const now = new Date();

    res.json({
      tier: row.subscription_tier,
      expiry: row.subscription_expiry,
      trial_end: row.trial_end,
      card_added: row.card_added,
      daysLeft: expiry ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000)) : 0,
      isExpired: expiry ? expiry < now : false,
      isTrial: row.subscription_tier === 'trial',
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
    await db.query('UPDATE users SET card_added = true, card_last4 = $1, card_holder = $2, card_expiry = $3 WHERE id = $4',
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
    const userResult = await db.query('SELECT subscription_tier, card_added FROM users WHERE id = $1', [req.userId]);
    const row = userResult.rows[0];

    if (!row.card_added) {
      res.status(400).json({ error: 'Önce kart eklemelisiniz' });
      return;
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    await db.query(
      'UPDATE users SET subscription_tier = $1, subscription_expiry = $2 WHERE id = $3',
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
    const userResult = await db.query(
      'SELECT subscription_tier, subscription_expiry, card_added FROM users WHERE id = $1',
      [req.userId]
    );
    const row = userResult.rows[0];
    const tier = row.subscription_tier;
    const expiry = row.subscription_expiry ? new Date(row.subscription_expiry) : null;
    const cardAdded = row.card_added;

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

    await db.query(
      'UPDATE users SET subscription_expiry = $1 WHERE id = $2',
      [newExpiry.toISOString(), req.userId]
    );
    saveDatabase();

    res.json({ success: true, expiry: newExpiry.toISOString(), amount: MONTHLY_PRICE });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
