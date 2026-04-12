import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';
import type { UserToken } from '../types/index.js';

const TOKEN_PREFIX = 'omt_';
const TOKEN_BYTES = 32;

export interface CreateTokenParams {
  user_id: string;
  name: string;
}

export interface TokenWithPlain extends UserToken {
  plain_token?: string;
}

/**
 * 生成安全的随机 Token
 */
export function generateToken(): string {
  const bytes = crypto.randomBytes(TOKEN_BYTES);
  return TOKEN_PREFIX + bytes.toString('hex');
}

/**
 * 创建 Token
 */
export function createToken(params: CreateTokenParams): TokenWithPlain {
  const { user_id, name } = params;
  const db = getDb();

  // 检查同名 Token 是否存在
  const existing = db.prepare(`
    SELECT id FROM user_tokens WHERE user_id = ? AND name = ?
  `).get(user_id, name.trim());

  if (existing) {
    throw new Error('同名的 Token 已存在');
  }

  // 验证名称长度
  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > 50) {
    throw new Error('Token 名称长度需为 1-50 个字符');
  }

  const id = uuidv4();
  const token = generateToken();

  db.prepare(`
    INSERT INTO user_tokens (id, user_id, name, token)
    VALUES (?, ?, ?, ?)
  `).run(id, user_id, trimmedName, token);

  return {
    id,
    user_id,
    name: trimmedName,
    token,
    last_used_at: null,
    created_at: new Date().toISOString(),
    plain_token: token
  };
}

/**
 * 根据 Token 值查找
 */
export function findTokenByValue(tokenValue: string): UserToken | null {
  const db = getDb();
  const token = db.prepare(`
    SELECT * FROM user_tokens WHERE token = ?
  `).get(tokenValue) as UserToken | undefined;

  return token || null;
}

/**
 * 列出用户的所有 Token（返回完整 Token，便于复制）
 */
export function listTokens(userId: string): UserToken[] {
  const db = getDb();
  const tokens = db.prepare(`
    SELECT id, user_id, name, token, last_used_at, created_at
    FROM user_tokens
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId) as UserToken[];

  return tokens;
}

/**
 * 删除 Token
 */
export function deleteToken(tokenId: string, userId: string): boolean {
  const db = getDb();

  const result = db.prepare(`
    DELETE FROM user_tokens WHERE id = ? AND user_id = ?
  `).run(tokenId, userId);

  return result.changes > 0;
}

/**
 * 更新 Token 最后使用时间
 */
export function updateTokenLastUsed(tokenValue: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE user_tokens SET last_used_at = CURRENT_TIMESTAMP
    WHERE token = ?
  `).run(tokenValue);
}

/**
 * 掩码 Token
 * 格式：omt_***abc（前4位 + *** + 后3位）
 */
export function maskToken(token: string): string {
  if (!token || token.length < 8) {
    return '****';
  }
  const prefix = token.substring(0, 4);  // "omt_"
  const suffix = token.substring(token.length - 3);  // 最后3位
  return `${prefix}***${suffix}`;
}
