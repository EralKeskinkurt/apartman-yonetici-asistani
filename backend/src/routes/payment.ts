import { Router, Response } from 'express';
import { iyzipay, MONTHLY_PRICE, CURRENCY, getCallbackUrl } from '../iyzico';
import { getDatabase, saveDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';
const pending3DS = new Map<string, { userId: number; last4: string }>();
const router = Router();

// ---- Auth gerektirmeyen route'lar ----

router.post('/callback', async (req, res) => {
  try {
    const token = req.body.token;
    if (!token) {
      return res.status(400).json({ error: 'Token gerekli' });
    }

    iyzipay.checkoutForm.retrieve({ token }, async (err: any, result: any) => {
      if (err) {
        console.error('İyzico retrieve error:', err);
        return res.redirect(`${FRONTEND_URL}/subscription?status=fail`);
      }

      if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
        const userId = String(result.conversationId).split('_')[0];
        const db = await getDatabase();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        db.run(
          'UPDATE users SET subscription_tier = ?, subscription_expiry = ?, card_added = 1, card_last4 = ? WHERE id = ?',
          ['active', expiry.toISOString(), result.lastFourDigits || '****', Number(userId)]
        );
        saveDatabase();
        return res.redirect(`${FRONTEND_URL}/subscription?status=success`);
      }

      return res.redirect(`${FRONTEND_URL}/subscription?status=fail`);
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const token = req.body.token;
    if (!token) {
      return res.status(400).json({ error: 'Token gerekli' });
    }

    iyzipay.checkoutForm.retrieve({ token }, async (err: any, result: any) => {
      if (err) {
        console.error('İyzico verify error:', err);
        return res.status(500).json({ error: 'Ödeme doğrulanamadı' });
      }

      if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
        const userId = String(result.conversationId).split('_')[0];
        const db = await getDatabase();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        db.run(
          'UPDATE users SET subscription_tier = ?, subscription_expiry = ?, card_added = 1, card_last4 = ? WHERE id = ?',
          ['active', expiry.toISOString(), result.lastFourDigits || '****', Number(userId)]
        );
        saveDatabase();
        return res.json({ success: true, tier: 'active', cardLast4: result.lastFourDigits });
      }

      return res.json({ success: false, error: result.errorMessage || 'Ödeme başarısız' });
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/threeds-callback', async (req, res) => {
  try {
    const { paymentId, conversationData, conversationId, status } = req.body;

    if (status !== 'success') {
      return res.redirect(`${FRONTEND_URL}/subscription?status=fail`);
    }

    iyzipay.threedsPayment.create({
      locale: 'tr',
      conversationId: conversationId || '',
      paymentId: paymentId || '',
      conversationData: conversationData || '',
    }, async (err: any, result: any) => {
      if (err || result.status !== 'success') {
        console.error('3DS callback error:', err || result.errorMessage);
        return res.redirect(`${FRONTEND_URL}/subscription?status=fail`);
      }

      const pending = pending3DS.get(conversationId || '');
      if (pending) {
        const db = await getDatabase();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        db.run(
          'UPDATE users SET subscription_tier = ?, subscription_expiry = ?, card_added = 1, card_last4 = ? WHERE id = ?',
          ['active', expiry.toISOString(), pending.last4, pending.userId]
        );
        saveDatabase();
        pending3DS.delete(conversationId || '');
      }

      return res.redirect(`${FRONTEND_URL}/subscription?status=success`);
    });
  } catch (error: any) {
    res.redirect(`${FRONTEND_URL}/subscription?status=fail`);
  }
});

// ---- Auth gerektiren route'lar ----

router.use(authMiddleware);

router.post('/create-checkout', async (req: AuthRequest, res: Response) => {
  try {
    const userResult = await dbExec(
      'SELECT id, email, full_name FROM users WHERE id = ?',
      [req.userId]
    );
    if (!userResult.length) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const [userId, email, fullName] = userResult[0] as any[];

    const conversationId = `${userId}_${Date.now()}`;

    const request = {
      locale: 'tr',
      conversationId,
      price: String(MONTHLY_PRICE),
      paidPrice: String(MONTHLY_PRICE),
      currency: CURRENCY,
      basketId: `SUB_${userId}`,
      paymentGroup: 'SUBSCRIPTION',
      callbackUrl: getCallbackUrl('/callback'),
      buyer: {
        id: String(userId),
        name: fullName?.split(' ')[0] || 'Kullanıcı',
        surname: fullName?.split(' ').slice(1).join(' ') || 'Kullanıcı',
        gsmNumber: '+905350000000',
        email: email,
        identityNumber: '11111111111',
        registrationAddress: 'Adres girilmedi',
        ip: req.ip || '127.0.0.1',
        city: 'İstanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: fullName,
        city: 'İstanbul',
        country: 'Turkey',
        address: 'Adres girilmedi',
      },
      billingAddress: {
        contactName: fullName,
        city: 'İstanbul',
        country: 'Turkey',
        address: 'Adres girilmedi',
      },
      basketItems: [{
        id: 'SUBSCRIPTION_MONTHLY',
        name: 'Apartman Asistanı Aylık Abonelik',
        category1: 'Yazılım',
        itemType: 'VIRTUAL',
        price: String(MONTHLY_PRICE),
      }],
    };

    iyzipay.checkoutFormInitialize.create(request, (err: any, result: any) => {
      if (err) {
        console.error('İyzico error:', err);
        res.status(500).json({ error: 'Ödeme başlatılamadı' });
        return;
      }

      if (result.status === 'success') {
        res.json({ checkoutUrl: result.paymentPageUrl, token: result.token });
      } else {
        res.status(400).json({ error: result.errorMessage || 'Ödeme başlatılamadı' });
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pay-with-card', async (req: AuthRequest, res: Response) => {
  try {
    const { cardNumber, expireMonth, expireYear, cvc, cardHolderName } = req.body;
    if (!cardNumber || !expireMonth || !expireYear || !cvc || !cardHolderName) {
      res.status(400).json({ error: 'Kart bilgileri eksik' });
      return;
    }

    const userResult = await dbExec(
      'SELECT id, email, full_name FROM users WHERE id = ?',
      [req.userId]
    );
    if (!userResult.length) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const [userId, email, fullName] = userResult[0] as any[];
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const conversationId = `THREEDS_${userId}_${Date.now()}`;
    const last4 = cardNumber.replace(/\D/g, '').slice(-4);

    const baseRequest = {
      locale: 'tr',
      conversationId,
      price: String(MONTHLY_PRICE),
      paidPrice: String(MONTHLY_PRICE),
      currency: CURRENCY,
      installment: '1',
      basketId: `SUB_${userId}_${Date.now()}`,
      paymentChannel: 'WEB',
      paymentGroup: 'SUBSCRIPTION',
      callbackUrl: getCallbackUrl('/threeds-callback'),
      paymentCard: {
        cardHolderName,
        cardNumber: cardNumber.replace(/\D/g, ''),
        expireMonth: String(expireMonth),
        expireYear: String(expireYear),
        cvc: String(cvc),
        registerCard: '0',
      },
      buyer: {
        id: String(userId),
        name: fullName?.split(' ')[0] || 'Kullanıcı',
        surname: fullName?.split(' ').slice(1).join(' ') || 'Kullanıcı',
        gsmNumber: '+905350000000',
        email,
        identityNumber: '11111111111',
        registrationAddress: 'Adres girilmedi',
        ip,
        city: 'İstanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: fullName,
        city: 'İstanbul',
        country: 'Turkey',
        address: 'Adres girilmedi',
      },
      billingAddress: {
        contactName: fullName,
        city: 'İstanbul',
        country: 'Turkey',
        address: 'Adres girilmedi',
      },
      basketItems: [{
        id: 'SUBSCRIPTION_MONTHLY',
        name: 'Apartman Asistanı Aylık Abonelik',
        category1: 'Yazılım',
        itemType: 'VIRTUAL',
        price: String(MONTHLY_PRICE),
      }],
    };

    iyzipay.payment.create(baseRequest as any, async (err: any, result: any) => {
      if (err) {
        console.error('İyzico payment error:', err);
        res.status(500).json({ error: 'Ödeme işlenemedi' });
        return;
      }

      if (result.status === 'success') {
        const db = await getDatabase();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        db.run(
          'UPDATE users SET subscription_tier = ?, subscription_expiry = ?, card_added = 1, card_last4 = ? WHERE id = ?',
          ['active', expiry.toISOString(), last4, req.userId]
        );
        saveDatabase();
        res.json({ success: true, tier: 'active', cardLast4: last4 });
        return;
      }

      iyzipay.threedsInitialize.create(baseRequest as any, (err2: any, result2: any) => {
        if (err2 || result2.status !== 'success') {
          console.error('İyzico 3DS init error:', err2 || result2.errorMessage);
          res.status(400).json({ error: result2?.errorMessage || '3D Secure başlatılamadı' });
          return;
        }

        pending3DS.set(conversationId, { userId: Number(userId), last4 });
        res.json({ threeds: true, htmlContent: result2.threeDSHtmlContent || result2.htmlContent });
      });
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = db.exec(
      'SELECT subscription_tier, subscription_expiry, trial_end, card_last4 FROM users WHERE id = ?',
      [req.userId]
    );
    if (!result.length || !result[0].values.length) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const row = result[0]?.values?.[0] || [];
    const expiry = row[1] ? new Date(row[1] as string) : null;
    const now = new Date();

    res.json({
      tier: row[0] || 'trial',
      expiry: row[1],
      cardLast4: row[3],
      daysLeft: expiry ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000)) : 0,
      isExpired: expiry ? expiry < now : false,
      monthlyPrice: MONTHLY_PRICE,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    db.run('UPDATE users SET subscription_tier = ?, subscription_expiry = ?, card_added = 0, card_last4 = NULL WHERE id = ?', ['trial', null, req.userId]);
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function dbExec(sql: string, params: any[]): Promise<any[][]> {
  const db = await getDatabase();
  const result = db.exec(sql, params);
  return result.length > 0 ? result[0].values : [];
}

export default router;
