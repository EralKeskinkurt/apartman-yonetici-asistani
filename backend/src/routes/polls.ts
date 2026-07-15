import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/building/:buildingId', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = db.exec(
      'SELECT p.*, u.full_name as creator_name FROM polls p LEFT JOIN users u ON p.created_by = u.id WHERE p.building_id = ? ORDER BY p.created_at DESC',
      [req.params.buildingId]
    );
    const polls = result.length > 0
      ? result[0].values.map((row) => {
          let options: string[] = [];
          try { options = JSON.parse(row[4] as string); } catch {}
          return {
            id: row[0], building_id: row[1], title: row[2], description: row[3],
            options, created_by: row[5], expires_at: row[6],
            created_at: row[7], creator_name: row[8],
          };
        })
      : [];

    for (const poll of polls) {
      const voteResult = db.exec(
        'SELECT option_index, COUNT(*) as count FROM votes WHERE poll_id = ? GROUP BY option_index',
        [poll.id]
      );
      poll.votes = {};
      poll.totalVotes = 0;
      if (voteResult.length && voteResult[0].values.length) {
        for (const v of voteResult[0].values) {
          const idx = v[0] as number;
          poll.votes[idx] = v[1] as number;
          poll.totalVotes += v[1] as number;
        }
      }

      const myVote = db.exec(
        'SELECT option_index FROM votes WHERE poll_id = ? AND user_id = ?',
        [poll.id, req.userId]
      );
      poll.myVote = myVote.length && myVote[0].values.length
        ? myVote[0].values[0][0] as number
        : null;
    }

    res.json(polls);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { buildingId, title, description, options, expiresAt } = req.body;
    if (!buildingId || !title || !options || !Array.isArray(options) || options.length < 2) {
      res.status(400).json({ error: 'Geçersiz veri (başlık ve en az 2 seçenek gerekli)' });
      return;
    }

    const db = await getDatabase();
    const ownResult = db.exec('SELECT admin_id FROM buildings WHERE id = ?', [buildingId]);
    if (!ownResult.length || !ownResult[0].values.length || ownResult[0].values[0][0] !== req.userId) {
      res.status(403).json({ error: 'Sadece yönetici oylama oluşturabilir' });
      return;
    }

    const id = generateId();
    db.run(
      'INSERT INTO polls (id, building_id, title, description, options, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, buildingId, title, description || '', JSON.stringify(options), req.userId, expiresAt || null]
    );
    saveDatabase();

    res.status(201).json({
      id, building_id: buildingId, title, description: description || '',
      options, created_by: req.userId, expires_at: expiresAt || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/vote', async (req: AuthRequest, res: Response) => {
  try {
    const { optionIndex } = req.body;
    if (optionIndex === undefined || optionIndex === null) {
      res.status(400).json({ error: 'Seçenek gerekli' });
      return;
    }

    const db = await getDatabase();
    const pollResult = db.exec('SELECT options, expires_at FROM polls WHERE id = ?', [req.params.id]);
    if (!pollResult.length || !pollResult[0].values.length) {
      res.status(404).json({ error: 'Oylama bulunamadı' });
      return;
    }

    const expiresAt = pollResult[0].values[0][1] as string | null;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      res.status(400).json({ error: 'Oylama süresi dolmuş' });
      return;
    }

    let options: string[] = [];
    try { options = JSON.parse(pollResult[0].values[0][0] as string); } catch {}
    if (optionIndex < 0 || optionIndex >= options.length) {
      res.status(400).json({ error: 'Geçersiz seçenek' });
      return;
    }

    const existingVote = db.exec(
      'SELECT id FROM votes WHERE poll_id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (existingVote.length && existingVote[0].values.length) {
      db.run(
        'UPDATE votes SET option_index = ? WHERE poll_id = ? AND user_id = ?',
        [optionIndex, req.params.id, req.userId]
      );
    } else {
      const id = generateId();
      db.run(
        'INSERT INTO votes (id, poll_id, user_id, option_index) VALUES (?, ?, ?, ?)',
        [id, req.params.id, req.userId, optionIndex]
      );
    }
    saveDatabase();

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/vote', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = db.exec(
      'DELETE FROM votes WHERE poll_id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const pollResult = db.exec('SELECT building_id FROM polls WHERE id = ?', [req.params.id]);
    if (!pollResult.length || !pollResult[0].values.length) {
      res.status(404).json({ error: 'Oylama bulunamadı' });
      return;
    }
    const buildingId = pollResult[0].values[0][0] as string;
    const ownResult = db.exec('SELECT admin_id FROM buildings WHERE id = ?', [buildingId]);
    if (!ownResult.length || !ownResult[0].values.length || ownResult[0].values[0][0] !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    db.run('DELETE FROM votes WHERE poll_id = ?', [req.params.id]);
    db.run('DELETE FROM polls WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
