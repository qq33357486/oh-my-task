import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据库文件路径
function getDbPath(): string {
  return process.env.DB_PATH || join(__dirname, '../../data/data.db');
}

// 单例数据库连接
let db: Database.Database | null = null;
let currentDbPath: string | null = null;

/**
 * 获取数据库连接
 */
export function getDb(): Database.Database {
  const dbPath = getDbPath();
  if (!db || currentDbPath !== dbPath) {
    if (db) {
      try { db.close(); } catch { /* ignore */ }
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    currentDbPath = dbPath;
  }
  return db;
}

/**
 * 初始化数据库（创建表）
 */
export function initDb(): void {
  // 确保数据目录存在
  const dbDir = dirname(getDbPath());
  mkdirSync(dbDir, { recursive: true });

  const database = getDb();
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  database.exec(schema);

  // 修复 sessions 表：确保列结构与 better-sqlite3-session-store 兼容
  // 如果表存在但缺少 expire 列，需要重建
  try {
    const columns = database.prepare('PRAGMA table_info(sessions)').all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    if (!columnNames.includes('expire') || columnNames.includes('expired')) {
      console.log('Migrating sessions table to match better-sqlite3-session-store schema...');
      // 备份数据（如果有的话）
      database.exec('DROP TABLE IF EXISTS sessions');
      database.exec(`
        CREATE TABLE sessions (
          sid TEXT NOT NULL PRIMARY KEY,
          sess TEXT NOT NULL,
          expire TEXT NOT NULL DEFAULT ''
        )
      `);
      console.log('Sessions table migrated successfully');
    }
  } catch {
    // sessions 表不存在，忽略
  }

  console.log('Database initialized successfully');
}

/**
 * 关闭数据库连接
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    currentDbPath = null;
  }
}

export default getDb;
