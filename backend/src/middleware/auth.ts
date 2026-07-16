import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database';

const JWT_SECRET = process.env.JWT_SECRET || 'apartment-manager-secret-key';

export interface AuthRequest extends Request {
  userId?: number;
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export async function subscriptionMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  next();
}

export async function buildingOwnerMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.buildingId || req.body.buildingId;
    if (!buildingId) {
      next();
      return;
    }
    const db = await getDatabase();
    const userResult = await db.query(
      'SELECT building_id, role FROM users WHERE id = $1',
      [req.userId]
    );
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const userBuildingId = userResult.rows[0].building_id;
    const userRole = userResult.rows[0].role;

    if (userRole === 'resident' && userBuildingId === buildingId) {
      next();
      return;
    }

    if (userRole === 'admin' && userBuildingId === buildingId) {
      next();
      return;
    }

    res.status(403).json({ error: 'Bu apartmana erişim izniniz yok' });
  } catch (error: any) {
    res.status(500).json({ error: 'Ownership check failed' });
  }
}
