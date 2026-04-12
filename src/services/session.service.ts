import session from 'express-session';
import BetterSqlite3Store from 'better-sqlite3-session-store';
import { getDb } from '../db/connection.js';

const SQLiteStore = BetterSqlite3Store(session);

/**
 * 创建 Session 中间件
 */
export function createSessionMiddleware() {
  return session({
    store: new SQLiteStore({
      client: getDb(),
      expired: {
        clear: true,
        intervalMs: 900000 // 15分钟清理过期 session
      },
      table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'omt-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
    },
    name: 'omt_session_id'
  });
}
