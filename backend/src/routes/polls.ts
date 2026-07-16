import { Router, Response } from 'express';
import { getDatabase, generateId, saveDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/building/:buildingId', async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const result = await db.query(
      'SELECT p.*, u.full_name as creator_name FROM polls p LEFT JOIN users u ON p.created_by = u.id WHERE p.building_id = $1 ORDER BY p.created_at DESC',
      [req.params.buildingId]
    );
    const polls = result.rows.map((row) => {
      let options: string[] = [];
      try { options = JSON.parse(row.options as string); } catch {}
      return {
        id: row.id, building_id: row.building_id, title: row.title, description: row.description,
        options, created_by: row.created_by, expires_at: row.expires_at,
        created_at: row.created_at, creator_name: row.creator_name,
        votes: {} as Record<number, number>, totalVotes: 0, myVote: null as number | null,
      };
    });

    for (const poll of polls) {
      const voteResult = await db.query(
        'SELECT option_index, COUNT(*) as count FROM votes WHERE poll_id = $1 GROUP BY option_index',
        [poll.id]
      );
      poll.votes = {};
      poll.totalVotes = 0;
      for (const v of voteResult.rows) {
        poll.votes[v.option_index] = parseInt(v.count);
        poll.totalVotes += parseInt(v.count);
      }

      const myVote = await db.query(
        'SELECT option_index FROM votes WHERE poll_id = $1 AND user_id = $2',
        [poll.id, req.userId]
      );
      poll.myVote = myVote.rows.length ? myVote.rows[0].option_index : null;
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
    const ownResult = await db.query('SELECT admin_id FROM buildings WHERE id = $1', [buildingId]);
    if (ownResult.rows.length === 0 || ownResult.rows[0].admin_id !== req.userId) {
      res.status(403).json({ error: 'Sadece yönetici oylama oluşturabilir' });
      return;
    }

    const id = generateId();
    await db.query(
      'INSERT INTO polls (id, building_id, title, description, options, created_by, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
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
    const pollResult = await db.query('SELECT options, expires_at FROM polls WHERE id = $1', [req.params.id]);
    if (pollResult.rows.length === 0) {
      res.status(404).json({ error: 'Oylama bulunamadı' });
      return;
    }

    const expiresAt = pollResult.rows[0].expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      res.status(400).json({ error: 'Oylama süresi dolmuş' });
      return;
    }

    let options: string[] = [];
    try { options = JSON.parse(pollResult.rows[0].options as string); } catch {}
    if (optionIndex < 0 || optionIndex >= options.length) {
      res.status(400).json({ error: 'Geçersiz seçenek' });
      return;
    }

    const existingVote = await db.query(
      'SELECT id FROM votes WHERE poll_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (existingVote.rows.length > 0) {
      await db.query(
        'UPDATE votes SET option_index = $1 WHERE poll_id = $2 AND user_id = $3',
        [optionIndex, req.params.id, req.userId]
      );
    } else {
      const id = generateId();
      await db.query(
        'INSERT INTO votes (id, poll_id, user_id, option_index) VALUES ($1, $2, $3, $4)',
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
    await db.query(
      'DELETE FROM votes WHERE poll_id = $1 AND user_id = $2',
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
    const pollResult = await db.query('SELECT building_id FROM polls WHERE id = $1', [req.params.id]);
    if (pollResult.rows.length === 0) {
      res.status(404).json({ error: 'Oylama bulunamadı' });
      return;
    }
    const buildingId = pollResult.rows[0].building_id;
    const ownResult = await db.query('SELECT admin_id FROM buildings WHERE id = $1', [buildingId]);
    if (ownResult.rows.length === 0 || ownResult.rows[0].admin_id !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    await db.query('DELETE FROM votes WHERE poll_id = $1', [req.params.id]);
    await db.query('DELETE FROM polls WHERE id = $1', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
