import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password.js';
import { validateEmail, normalizeEmail } from '../utils/validation.js';
import { sendEmail } from '../utils/email.js';
import type { User } from '../types/index.js';

export interface CreateUserParams {
  email: string;
  password: string;
  code: string;
}

// 内存验证码存储：email -> { code, expiresAt }
const emailCodeStore = new Map<string, { code: string; expiresAt: number }>();

/**
 * 发送邮箱注册验证码
 */
export async function sendEmailCode(email: string): Promise<void> {
  if (!validateEmail(email)) {
    throw new Error('邮箱格式无效');
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟
  emailCodeStore.set(normalizeEmail(email), { code, expiresAt });

  await sendEmail(
    email,
    '注册验证码 - oh-my-task',
    `您的注册验证码是：${code}\n验证码 5 分钟内有效，请勿泄露给他人。`
  );
}

/**
 * 校验邮箱验证码（通过后从 store 中删除）
 */
export function verifyEmailCode(email: string, code: string): void {
  const normalized = normalizeEmail(email);
  const entry = emailCodeStore.get(normalized);
  if (!entry) {
    throw new Error('验证码不存在或已过期，请重新发送');
  }
  if (Date.now() > entry.expiresAt) {
    emailCodeStore.delete(normalized);
    throw new Error('验证码已过期，请重新发送');
  }
  if (entry.code !== code) {
    throw new Error('验证码错误');
  }
  emailCodeStore.delete(normalized);
}

// 供测试直接写入验证码
export function _setEmailCodeForTest(email: string, code: string): void {
  emailCodeStore.set(normalizeEmail(email), { code, expiresAt: Date.now() + 5 * 60 * 1000 });
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface ChangePasswordParams {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

export interface ResetPasswordParams {
  email: string;
  code: string;
  newPassword: string;
}

// ========== 认证相关 ==========

/**
 * 创建用户（邮箱+验证码+密码，name 自动取邮箱前缀）
 */
export async function createUser(params: CreateUserParams): Promise<User> {
  const { email, password } = params;

  // 验证邮箱
  if (!validateEmail(email)) {
    throw new Error('邮箱格式无效');
  }

  // 验证密码强度
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.errors.join(', '));
  }

  const normalizedEmail = normalizeEmail(email);
  const db = getDb();

  // 检查邮箱是否已存在
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    throw new Error('邮箱已被使用');
  }

  // 哈希密码
  const passwordHash = await hashPassword(password);

  // name 取邮箱前缀
  const name = normalizedEmail.split('@')[0];

  // 创建用户（第一个注册的普通用户自动成为 admin）
  const id = uuidv4();
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const role = userCount.count === 0 ? 'admin' : 'member';

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, normalizedEmail, passwordHash, role);

  return getUserById(id) as User;
}

/**
 * 用户登录
 */
export async function loginUser(params: LoginParams): Promise<User> {
  const { email, password } = params;
  const normalizedEmail = normalizeEmail(email);
  const db = getDb();

  // 查找用户
  const user = db.prepare(`
    SELECT * FROM users WHERE email = ?
  `).get(normalizedEmail) as User | undefined;

  if (!user || !user.password_hash) {
    throw new Error('邮箱或密码错误');
  }

  // 验证密码
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('邮箱或密码错误');
  }

  return user;
}

/**
 * 根据ID获取用户
 */
export function getUserById(id: string): User | null {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  return user || null;
}

/**
 * 根据邮箱获取用户
 */
export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email)) as User | undefined;
  return user || null;
}

/**
 * 返回公开用户信息（移除敏感字段）
 */
export function toPublicUser(user: User): Omit<User, 'password_hash' | 'reset_token' | 'reset_token_expires'> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

// ========== 用户管理相关 ==========

/**
 * 获取所有用户（分页）
 */
export function getAllUsers(page: number = 1, pageSize: number = 10): { users: User[]; total: number } {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  
  const users = db.prepare(`
    SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(pageSize, offset) as User[];
  
  const countResult = db.prepare('SELECT COUNT(*) as total FROM users').get() as { total: number };
  
  return { users, total: countResult.total };
}

/**
 * 修改密码
 */
export async function changePassword(params: ChangePasswordParams): Promise<boolean> {
  const { userId, oldPassword, newPassword } = params;
  const db = getDb();
  
  const user = getUserById(userId);
  if (!user || !user.password_hash) {
    throw new Error('用户不存在');
  }

  const isValid = await verifyPassword(oldPassword, user.password_hash);
  if (!isValid) {
    throw new Error('原密码错误');
  }

  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.errors.join(', '));
  }

  const passwordHash = await hashPassword(newPassword);
  
  db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(passwordHash, userId);

  return true;
}

/**
 * 生成密码重置令牌
 */
export async function sendPasswordResetCode(email: string): Promise<boolean> {
  if (!validateEmail(email)) {
    throw new Error('邮箱格式无效');
  }

  const db = getDb();
  const normalizedEmail = normalizeEmail(email);
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as User | undefined;
  if (!user) {
    return false;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?
  `).run(code, expiresAt, user.id);

  await sendEmail(
    normalizedEmail,
    '密码重置验证码 - oh-my-task',
    `您的密码重置验证码是：${code}\n验证码 5 分钟内有效，请勿泄露给他人。`
  );

  return true;
}

/**
 * 使用重置令牌重置密码
 */
export async function resetPassword(params: ResetPasswordParams): Promise<boolean> {
  const { email, code, newPassword } = params;
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);

  const user = db.prepare(`
    SELECT * FROM users WHERE email = ?
  `).get(normalizedEmail) as User | undefined;

  if (!user || !user.reset_token || user.reset_token !== code) {
    throw new Error('验证码错误或已过期');
  }

  if (!user.reset_token_expires || new Date(user.reset_token_expires) <= new Date()) {
    throw new Error('验证码错误或已过期');
  }

  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.errors.join(', '));
  }

  const passwordHash = await hashPassword(newPassword);
  
  db.prepare(`
    UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(passwordHash, user.id);

  return true;
}

/**
 * 删除用户
 */
export function deleteUser(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}
