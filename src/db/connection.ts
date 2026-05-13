import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { mkdirSync } from 'fs';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger.js';

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
      logger.info('db', '会话表迁移开始', '检测到 sessions 表结构需要修复，开始重建会话表');
      // 备份数据（如果有的话）
      database.exec('DROP TABLE IF EXISTS sessions');
      database.exec(`
        CREATE TABLE sessions (
          sid TEXT NOT NULL PRIMARY KEY,
          sess TEXT NOT NULL,
          expire TEXT NOT NULL DEFAULT ''
        )
      `);
      logger.info('db', '会话表迁移完成', 'sessions 表结构已修复');
    }
  } catch {
    // sessions 表不存在，忽略
  }

  logger.info('db', '数据库初始化完成', '数据库表结构已初始化', {
    db_path: getDbPath(),
  });

  const legacyAdmin = database.prepare(`
    SELECT id, password_hash FROM users
    WHERE email = ? AND role = 'admin'
  `).get('admin@admin.com') as { id: string; password_hash: string } | undefined;
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const projectCount = database.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
  const tokenCount = database.prepare('SELECT COUNT(*) as count FROM user_tokens').get() as { count: number };
  if (
    userCount.count === 1 &&
    projectCount.count === 0 &&
    tokenCount.count === 0 &&
    legacyAdmin &&
    bcrypt.compareSync('admin', legacyAdmin.password_hash)
  ) {
    database.prepare('DELETE FROM users WHERE id = ?').run(legacyAdmin.id);
    logger.warn('db', '默认管理员已清理', '检测到旧版默认管理员账号，已移除并要求重新初始化');
  }
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
