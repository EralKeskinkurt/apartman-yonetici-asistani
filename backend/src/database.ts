import { Pool } from 'pg';

let pool: Pool | null = null;

export async function getDatabase(): Promise<Pool> {
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  await pool.query('SELECT 1');
  await initTables(pool);

  return pool;
}

async function initTables(db: Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      building_id TEXT,
      flat_id TEXT,
      role VARCHAR(20) DEFAULT 'admin',
      subscription_tier VARCHAR(20) DEFAULT 'trial',
      subscription_expiry TIMESTAMP,
      trial_end TIMESTAMP,
      card_added BOOLEAN DEFAULT FALSE,
      card_last4 VARCHAR(4),
      card_holder VARCHAR(255),
      card_expiry VARCHAR(10),
      google_id VARCHAR(255),
      picture TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      address TEXT,
      total_flats INTEGER DEFAULT 0,
      monthly_dues DECIMAL(10,2) DEFAULT 0,
      admin_id INTEGER,
      invite_code VARCHAR(10),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS flats (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL REFERENCES buildings(id),
      floor INTEGER DEFAULT 0,
      number INTEGER NOT NULL,
      owner_name VARCHAR(255),
      owner_phone VARCHAR(20),
      owner_email VARCHAR(255),
      is_rented BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dues (
      id TEXT PRIMARY KEY,
      flat_id TEXT NOT NULL REFERENCES flats(id),
      building_id TEXT NOT NULL REFERENCES buildings(id),
      amount DECIMAL(10,2) NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      is_paid BOOLEAN DEFAULT FALSE,
      paid_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL REFERENCES buildings(id),
      category VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      date TEXT NOT NULL,
      receipt_url TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL REFERENCES buildings(id),
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL REFERENCES buildings(id),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      options TEXT NOT NULL,
      created_by INTEGER,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES polls(id),
      user_id INTEGER NOT NULL,
      option_index INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(poll_id, user_id)
    );
  `);
}

export function saveDatabase() {
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function query(sql: string, params?: any[]): Promise<any[]> {
  const db = await getDatabase();
  const result = await db.query(sql, params);
  return result.rows;
}
