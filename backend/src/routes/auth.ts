import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase, saveDatabase, generateId, generateInviteCode } from '../database';
import { authMiddleware, subscriptionMiddleware, generateToken, AuthRequest } from '../middleware/auth';

const router = Router();

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Şifre en az 6 karakter olmalı';
  if (password.length > 128) return 'Şifre çok uzun';
  return null;
}

function sanitize(str: string): string {
  return str.trim().replace(/[<>]/g, '').slice(0, 200);
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    let { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      res.status(400).json({ error: 'Tüm alanlar gerekli' });
      return;
    }

    email = sanitize(email).toLowerCase();
    fullName = sanitize(fullName);

    if (!validateEmail(email)) {
      res.status(400).json({ error: 'Geçerli bir e-posta girin' });
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    const db = await getDatabase();
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 10);
    const result = await db.query(
      'INSERT INTO users (email, password, full_name, trial_end, subscription_expiry) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [email, hashedPassword, fullName, trialEnd.toISOString(), trialEnd.toISOString()]
    );
    const userId = result.rows[0].id;
    saveDatabase();

    const token = generateToken(userId);
    res.status(201).json({
      token,
      user: { id: userId, email, full_name: fullName, building_id: null, role: 'admin', subscription_tier: 'trial', subscription_expiry: trialEnd.toISOString(), trial_end: trialEnd.toISOString() },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'E-posta ve şifre gerekli' });
      return;
    }

    email = sanitize(email).toLowerCase();

    const db = await getDatabase();
    const result = await db.query(
      'SELECT id, email, password, full_name, building_id, flat_id, role, subscription_tier, subscription_expiry, trial_end, picture FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'E-posta veya şifre hatalı' });
      return;
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'E-posta veya şifre hatalı' });
      return;
    }

    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, building_id: user.building_id, flat_id: user.flat_id, role: user.role, subscription_tier: user.subscription_tier, subscription_expiry: user.subscription_expiry, trial_end: user.trial_end, picture: user.picture } });
  } catch (error: any) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/resident-register', async (req: Request, res: Response) => {
  try {
    let { email, password, fullName, inviteCode, flatNumber } = req.body;

    if (!email || !password || !fullName || !inviteCode) {
      res.status(400).json({ error: 'Tüm alanlar gerekli (e-posta, şifre, ad soyad, davet kodu)' });
      return;
    }

    email = sanitize(email).toLowerCase();
    fullName = sanitize(fullName);

    if (!validateEmail(email)) {
      res.status(400).json({ error: 'Geçerli bir e-posta girin' });
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    const db = await getDatabase();

    const buildingResult = await db.query(
      'SELECT id, name FROM buildings WHERE invite_code = $1',
      [inviteCode.trim().toUpperCase()]
    );
    if (buildingResult.rows.length === 0) {
      res.status(400).json({ error: 'Geçersiz davet kodu' });
      return;
    }
    const buildingId = buildingResult.rows[0].id;

    let flatId: string | null = null;
    if (flatNumber) {
      const flatResult = await db.query(
        'SELECT id FROM flats WHERE building_id = $1 AND number = $2',
        [buildingId, flatNumber]
      );
      if (flatResult.rows.length > 0) {
        flatId = flatResult.rows[0].id;
        await db.query('UPDATE flats SET owner_name = $1, owner_email = $2 WHERE id = $3', [fullName, email, flatId]);
      }
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (email, password, full_name, building_id, flat_id, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [email, hashedPassword, fullName, buildingId, flatId, 'resident']
    );
    const userId = result.rows[0].id;
    saveDatabase();

    const token = generateToken(userId);
    res.status(201).json({
      token,
      user: { id: userId, email, full_name: fullName, building_id: buildingId, flat_id: flatId, role: 'resident', subscription_tier: 'none' },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = await db.query(
      'SELECT id, email, full_name, building_id, flat_id, role, subscription_tier, subscription_expiry, trial_end, picture FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const row = result.rows[0];
    res.json({
      id: row.id, email: row.email, full_name: row.full_name, building_id: row.building_id, flat_id: row.flat_id, role: row.role,
      subscription_tier: row.subscription_tier, subscription_expiry: row.subscription_expiry, trial_end: row.trial_end, picture: row.picture,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.put('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    const db = await getDatabase();
    const result = await db.query('SELECT password FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }

    const hashedPassword = result.rows[0].password;
    const valid = await bcrypt.compare(currentPassword, hashedPassword);
    if (!valid) {
      res.status(400).json({ error: 'Mevcut şifre hatalı' });
      return;
    }

    const newHashed = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [newHashed, req.userId]);
    saveDatabase();

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/invite-code', authMiddleware, subscriptionMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const userResult = await db.query('SELECT building_id FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const buildingId = userResult.rows[0].building_id;
    if (!buildingId) {
      res.status(400).json({ error: 'Önce apartman oluşturmalısınız' });
      return;
    }

    const existingResult = await db.query('SELECT invite_code FROM buildings WHERE id = $1', [buildingId]);
    let code = existingResult.rows[0]?.invite_code;

    if (!code) {
      code = generateInviteCode();
      await db.query('UPDATE buildings SET invite_code = $1 WHERE id = $2', [code, buildingId]);
      saveDatabase();
    }

    res.json({ inviteCode: code, buildingId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/regenerate-invite', authMiddleware, subscriptionMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const userResult = await db.query('SELECT building_id FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const buildingId = userResult.rows[0].building_id;

    const code = generateInviteCode();
    await db.query('UPDATE buildings SET invite_code = $1 WHERE id = $2', [code, buildingId]);
    saveDatabase();

    res.json({ inviteCode: code });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken: googleToken, inviteCode, flatNumber } = req.body;
    if (!googleToken) {
      res.status(400).json({ error: 'Google token gerekli' });
      return;
    }

    let email: string;
    let fullName: string;
    let googleId: string;
    let picture: string | undefined;

    const verifyRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${googleToken}`);
    if (verifyRes.ok) {
      const profile: any = await verifyRes.json();
      email = (profile.email as string).toLowerCase();
      fullName = (profile.name as string) || email.split('@')[0];
      googleId = profile.sub as string;
      picture = profile.picture as string | undefined;
    } else {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      if (!userRes.ok) {
        res.status(400).json({ error: 'Geçersiz Google token' });
        return;
      }
      const profile: any = await userRes.json();
      email = (profile.email as string).toLowerCase();
      fullName = (profile.name as string) || email.split('@')[0];
      googleId = profile.sub as string;
      picture = profile.picture as string | undefined;
    }

    const db = await getDatabase();

    let userResult = await db.query(
      'SELECT id, email, full_name, building_id, flat_id, role, subscription_tier, subscription_expiry, trial_end FROM users WHERE google_id = $1',
      [googleId]
    );
    if (userResult.rows.length > 0) {
      const row = userResult.rows[0];
      const token = generateToken(row.id);
      res.json({
        token,
        user: { id: row.id, email: row.email, full_name: row.full_name, building_id: row.building_id, flat_id: row.flat_id, role: row.role, subscription_tier: row.subscription_tier, subscription_expiry: row.subscription_expiry, trial_end: row.trial_end, picture },
      });
      return;
    }

    userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userId]);
      saveDatabase();

      const rowResult = await db.query(
        'SELECT id, email, full_name, building_id, flat_id, role, subscription_tier, subscription_expiry, trial_end FROM users WHERE id = $1',
        [userId]
      );
      const row = rowResult.rows[0];
      const token = generateToken(row.id);
      res.json({
        token,
        user: { id: row.id, email: row.email, full_name: row.full_name, building_id: row.building_id, flat_id: row.flat_id, role: row.role, subscription_tier: row.subscription_tier, subscription_expiry: row.subscription_expiry, trial_end: row.trial_end, picture },
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(googleId, 12);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 10);

    let buildingId: string | null = null;
    let flatId: string | null = null;

    if (inviteCode) {
      const buildingResult = await db.query(
        'SELECT id FROM buildings WHERE invite_code = $1',
        [inviteCode.trim().toUpperCase()]
      );
      if (buildingResult.rows.length > 0) {
        buildingId = buildingResult.rows[0].id;

        if (flatNumber) {
          const flatResult = await db.query(
            'SELECT id FROM flats WHERE building_id = $1 AND number = $2',
            [buildingId, flatNumber]
          );
          if (flatResult.rows.length > 0) {
            flatId = flatResult.rows[0].id;
            await db.query('UPDATE flats SET owner_name = $1, owner_email = $2 WHERE id = $3', [fullName, email, flatId]);
          }
        }
      }
    }

    const role = buildingId ? 'resident' : 'admin';
    const result = await db.query(
      'INSERT INTO users (email, password, full_name, building_id, flat_id, role, google_id, picture, trial_end, subscription_expiry) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
      [email, hashedPassword, fullName, buildingId, flatId, role, googleId, picture || null, trialEnd.toISOString(), trialEnd.toISOString()]
    );
    const userId = result.rows[0].id;
    saveDatabase();

    const token = generateToken(userId);
    res.status(201).json({
      token,
      user: { id: userId, email, full_name: fullName, building_id: buildingId, flat_id: flatId, role, subscription_tier: 'trial', subscription_expiry: trialEnd.toISOString(), trial_end: trialEnd.toISOString(), picture },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
