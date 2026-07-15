// @ts-nocheck
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DB_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'apartment.db');
let db: any = null;

export async function getDatabase() {
  if (db) return db;

  const SQL = await initSqlJs();

  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } catch {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');
  initTables(db);
  return db;
}

function initTables(database: any) {
  try { database.run('ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT "trial"'); } catch {}
  try { database.run('ALTER TABLE users ADD COLUMN subscription_expiry TEXT'); } catch {}
  try { database.run('ALTER TABLE users ADD COLUMN trial_end TEXT'); } catch {}
  try { database.run('ALTER TABLE users ADD COLUMN card_added INTEGER DEFAULT 0'); } catch {}
  try { database.run('ALTER TABLE users ADD COLUMN card_last4 TEXT'); } catch {}
  try { database.run('ALTER TABLE users ADD COLUMN card_holder TEXT'); } catch {}
  try { database.run('ALTER TABLE users ADD COLUMN card_expiry TEXT'); } catch {}
  try { database.run('ALTER TABLE users ADD COLUMN flat_id TEXT'); } catch {}
  try { database.run('ALTER TABLE users ADD COLUMN google_id TEXT'); } catch {}
  try { database.run('ALTER TABLE users ADD COLUMN picture TEXT'); } catch {}
  try { database.run('ALTER TABLE buildings ADD COLUMN invite_code TEXT'); } catch {}

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      building_id TEXT,
      flat_id TEXT,
      role TEXT DEFAULT 'admin',
      subscription_tier TEXT DEFAULT 'trial',
      subscription_expiry TEXT,
      trial_end TEXT,
      card_added INTEGER DEFAULT 0,
      card_last4 TEXT,
      card_holder TEXT,
      card_expiry TEXT,
      google_id TEXT,
      picture TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      total_flats INTEGER DEFAULT 0,
      monthly_dues REAL DEFAULT 0,
      admin_id INTEGER,
      invite_code TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS flats (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL,
      floor INTEGER DEFAULT 0,
      number INTEGER NOT NULL,
      owner_name TEXT,
      owner_phone TEXT,
      owner_email TEXT,
      is_rented INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (building_id) REFERENCES buildings(id)
    );

    CREATE TABLE IF NOT EXISTS dues (
      id TEXT PRIMARY KEY,
      flat_id TEXT NOT NULL,
      building_id TEXT NOT NULL,
      amount REAL NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      is_paid INTEGER DEFAULT 0,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (flat_id) REFERENCES flats(id),
      FOREIGN KEY (building_id) REFERENCES buildings(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      receipt_url TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (building_id) REFERENCES buildings(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (building_id) REFERENCES buildings(id)
    );

    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      options TEXT NOT NULL,
      created_by INTEGER,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (building_id) REFERENCES buildings(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      option_index INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (poll_id) REFERENCES polls(id),
      UNIQUE(poll_id, user_id)
    );
  `);
  saveDatabase();
}

export function saveDatabase() {
  if (!db) return;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
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
