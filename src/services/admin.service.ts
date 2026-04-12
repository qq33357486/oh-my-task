import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';

/**
 * 记录用户活动
 */
export function recordUserActivity(userId: string, action: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO user_activity (id, user_id, action, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).run(uuidv4(), userId, action);
}

/**
 * 获取用户新增统计（日/周/月）
 */
export function getNewUsersStats(): { daily: number; weekly: number; monthly: number } {
  const db = getDb();

  // 日新增
  const daily = (db.prepare(`
    SELECT COUNT(*) as count FROM users
    WHERE created_at >= date('now')
  `).get() as { count: number }).count;

  // 周新增
  const weekly = (db.prepare(`
    SELECT COUNT(*) as count FROM users
    WHERE created_at >= date('now', '-7 days')
  `).get() as { count: number }).count;

  // 月新增
  const monthly = (db.prepare(`
    SELECT COUNT(*) as count FROM users
    WHERE created_at >= date('now', '-30 days')
  `).get() as { count: number }).count;

  return { daily, weekly, monthly };
}

/**
 * 获取近 7 天 DAU（日活用户数）
 */
export function getDAU(): Array<{ date: string; count: number }> {
  const db = getDb();
  const result: Array<{ date: string; count: number }> = [];

  for (let i = 6; i >= 0; i--) {
    const dateStr = `date('now', '-${i} days')`;
    const day = (db.prepare(`
      SELECT ${dateStr} as date
    `).get() as { date: string }).date;

    const count = (db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count FROM user_activity
      WHERE created_at >= ${dateStr} AND created_at < ${dateStr === "date('now')" ? "date('now', '+1 day')" : `date('now', '-${i - 1} days')`}
    `).get() as { count: number }).count;

    result.push({ date: day, count });
  }

  return result;
}

/**
 * 获取用户留存率
 */
export function getRetentionStats(): { day1: number | null; day7: number | null } {
  const db = getDb();

  // 找到 N 天前注册的用户，看他们今天是否活跃
  // Day 1 留存：昨天注册的用户今天是否活跃
  const day1Result = (db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN a.user_id IS NOT NULL THEN 1 ELSE 0 END) as retained
    FROM users u
    LEFT JOIN (
      SELECT DISTINCT user_id FROM user_activity
      WHERE created_at >= date('now')
    ) a ON u.id = a.user_id
    WHERE u.created_at >= date('now', '-1 day') AND u.created_at < date('now')
  `).get() as { total: number; retained: number });

  // Day 7 留存：7 天前注册的用户今天是否活跃
  const day7Result = (db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN a.user_id IS NOT NULL THEN 1 ELSE 0 END) as retained
    FROM users u
    LEFT JOIN (
      SELECT DISTINCT user_id FROM user_activity
      WHERE created_at >= date('now')
    ) a ON u.id = a.user_id
    WHERE u.created_at >= date('now', '-8 days') AND u.created_at < date('now', '-7 days')
  `).get() as { total: number; retained: number });

  const day1 = day1Result.total > 0 ? Math.round((day1Result.retained / day1Result.total) * 100) : null;
  const day7 = day7Result.total > 0 ? Math.round((day7Result.retained / day7Result.total) * 100) : null;

  return { day1, day7 };
}
