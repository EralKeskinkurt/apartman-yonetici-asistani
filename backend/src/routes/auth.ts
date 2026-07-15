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
    const existing = db.exec('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 10);
    db.run(
      'INSERT INTO users (email, password, full_name, trial_end, subscription_expiry) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, fullName, trialEnd.toISOString(), trialEnd.toISOString()]
    );
    const result = db.exec('SELECT last_insert_rowid()');
    const userId = result[0].values[0][0] as number;
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
    const result = db.exec(
      'SELECT id, email, password, full_name, building_id, flat_id, role, subscription_tier, subscription_expiry, trial_end, picture FROM users WHERE email = ?',
      [email]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      res.status(401).json({ error: 'E-posta veya şifre hatalı' });
      return;
    }

    const row = result[0].values[0];
    const user = {
      id: row[0] as number, email: row[1] as string, password: row[2] as string,
      full_name: row[3] as string, building_id: row[4] as string | null,
      flat_id: row[5] as string | null, role: row[6] as string,
      subscription_tier: row[7] as string,
      subscription_expiry: row[8] as string | null, trial_end: row[9] as string | null,
      picture: row[10] as string | undefined,
    };

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

    const buildingResult = db.exec(
      'SELECT id, name FROM buildings WHERE invite_code = ?',
      [inviteCode.trim().toUpperCase()]
    );
    if (!buildingResult.length || !buildingResult[0].values.length) {
      res.status(400).json({ error: 'Geçersiz davet kodu' });
      return;
    }
    const buildingId = buildingResult[0].values[0][0] as string;

    let flatId: string | null = null;
    if (flatNumber) {
      const flatResult = db.exec(
        'SELECT id FROM flats WHERE building_id = ? AND number = ?',
        [buildingId, flatNumber]
      );
      if (flatResult.length && flatResult[0].values.length) {
        flatId = flatResult[0].values[0][0] as string;
        db.run('UPDATE flats SET owner_name = ?, owner_email = ? WHERE id = ?', [fullName, email, flatId]);
      }
    }

    const existing = db.exec('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    db.run(
      'INSERT INTO users (email, password, full_name, building_id, flat_id, role) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, fullName, buildingId, flatId, 'resident']
    );
    const result = db.exec('SELECT last_insert_rowid()');
    const userId = result[0].values[0][0] as number;
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
    const result = db.exec(
      'SELECT id, email, full_name, building_id, flat_id, role, subscription_tier, subscription_expiry, trial_end, picture FROM users WHERE id = ?',
      [req.userId]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const row = result[0].values[0];
    res.json({
      id: row[0], email: row[1], full_name: row[2], building_id: row[3], flat_id: row[4], role: row[5],
      subscription_tier: row[6], subscription_expiry: row[7], trial_end: row[8], picture: row[9],
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
    const result = db.exec('SELECT password FROM users WHERE id = ?', [req.userId]);
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }

    const hashedPassword = result[0].values[0][0] as string;
    const valid = await bcrypt.compare(currentPassword, hashedPassword);
    if (!valid) {
      res.status(400).json({ error: 'Mevcut şifre hatalı' });
      return;
    }

    const newHashed = await bcrypt.hash(newPassword, 12);
    db.run('UPDATE users SET password = ? WHERE id = ?', [newHashed, req.userId]);
    saveDatabase();

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/invite-code', authMiddleware, subscriptionMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const userResult = db.exec('SELECT building_id FROM users WHERE id = ?', [req.userId]);
    if (!userResult.length || !userResult[0].values.length) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const buildingId = userResult[0].values[0][0] as string;
    if (!buildingId) {
      res.status(400).json({ error: 'Önce apartman oluşturmalısınız' });
      return;
    }

    const existingResult = db.exec('SELECT invite_code FROM buildings WHERE id = ?', [buildingId]);
    let code = existingResult[0]?.values[0]?.[0] as string;

    if (!code) {
      code = generateInviteCode();
      db.run('UPDATE buildings SET invite_code = ? WHERE id = ?', [code, buildingId]);
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
    const userResult = db.exec('SELECT building_id FROM users WHERE id = ?', [req.userId]);
    if (!userResult.length || !userResult[0].values.length) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const buildingId = userResult[0].values[0][0] as string;

    const code = generateInviteCode();
    db.run('UPDATE buildings SET invite_code = ? WHERE id = ?', [code, buildingId]);
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

    let userResult = db.exec(
      'SELECT id, email, full_name, building_id, flat_id, role, subscription_tier, subscription_expiry, trial_end FROM users WHERE google_id = ?',
      [googleId]
    );
    if (userResult.length > 0 && userResult[0].values.length > 0) {
      const row = userResult[0].values[0];
      const token = generateToken(row[0] as number);
      res.json({
        token,
        user: { id: row[0], email: row[1], full_name: row[2], building_id: row[3], flat_id: row[4], role: row[5], subscription_tier: row[6], subscription_expiry: row[7], trial_end: row[8], picture },
      });
      return;
    }

    userResult = db.exec('SELECT id FROM users WHERE email = ?', [email]);
    if (userResult.length > 0 && userResult[0].values.length > 0) {
      const userId = userResult[0].values[0][0] as number;
      db.run('UPDATE users SET google_id = ? WHERE id = ?', [googleId, userId]);
      saveDatabase();

      const row = db.exec(
        'SELECT id, email, full_name, building_id, flat_id, role, subscription_tier, subscription_expiry, trial_end FROM users WHERE id = ?',
        [userId]
      )[0].values[0];
      const token = generateToken(row[0] as number);
      res.json({
        token,
        user: { id: row[0], email: row[1], full_name: row[2], building_id: row[3], flat_id: row[4], role: row[5], subscription_tier: row[6], subscription_expiry: row[7], trial_end: row[8], picture },
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(googleId, 12);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 10);

    let buildingId: string | null = null;
    let flatId: string | null = null;

    if (inviteCode) {
      const buildingResult = db.exec(
        'SELECT id FROM buildings WHERE invite_code = ?',
        [inviteCode.trim().toUpperCase()]
      );
      if (buildingResult.length && buildingResult[0].values.length) {
        buildingId = buildingResult[0].values[0][0] as string;

        if (flatNumber) {
          const flatResult = db.exec(
            'SELECT id FROM flats WHERE building_id = ? AND number = ?',
            [buildingId, flatNumber]
          );
          if (flatResult.length && flatResult[0].values.length) {
            flatId = flatResult[0].values[0][0] as string;
            db.run('UPDATE flats SET owner_name = ?, owner_email = ? WHERE id = ?', [fullName, email, flatId]);
          }
        }
      }
    }

    const role = buildingId ? 'resident' : 'admin';
    db.run(
      'INSERT INTO users (email, password, full_name, building_id, flat_id, role, google_id, picture, trial_end, subscription_expiry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, fullName, buildingId, flatId, role, googleId, picture || null, trialEnd.toISOString(), trialEnd.toISOString()]
    );
    const idResult = db.exec('SELECT last_insert_rowid()');
    const userId = idResult[0].values[0][0] as number;
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
