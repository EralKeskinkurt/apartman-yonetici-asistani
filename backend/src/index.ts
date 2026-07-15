import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import buildingRoutes from './routes/buildings';
import flatRoutes from './routes/flats';
import duesRoutes from './routes/dues';
import expenseRoutes from './routes/expenses';
import announcementRoutes from './routes/announcements';
import seedRoutes from './routes/seed';
import subscriptionRoutes from './routes/subscription';
import pollRoutes from './routes/polls';
import paymentRoutes from './routes/payment';

if (!process.env.JWT_SECRET) {
  console.warn('UYARI: JWT_SECRET env variable ayarlanmamış. Varsayılan değer kullanılıyor. Production\'da mutlaka ayarlayın.');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8081',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek. 15 dakika sonra tekrar deneyin.' },
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/flats', flatRoutes);
app.use('/api/dues', duesRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/payment', paymentRoutes);

app.use((_err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(_err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
