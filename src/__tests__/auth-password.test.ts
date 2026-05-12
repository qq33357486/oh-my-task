import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let TEST_DIR: string;
let TEST_DB_PATH: string;
let app: import('express').Express;
let sessionCookie: string;

const TEST_USER = {
  id: 'password-test-user-1',
  name: 'PasswordTestUser',
  email: 'passwordtest@example.com',
  password: 'OldPassword123'
};

async function resetTestUserPassword(password = TEST_USER.password): Promise<void> {
  const db = new Database(TEST_DB_PATH);
  const hash = await bcrypt.hash(password, 12);
  db.prepare(`
    UPDATE users
    SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL
    WHERE id = ?
  `).run(hash, TEST_USER.id);
  db.close();
}

function getResetState(): { reset_token: string | null; reset_token_expires: string | null } {
  const db = new Database(TEST_DB_PATH);
  const user = db.prepare(`
    SELECT reset_token, reset_token_expires FROM users WHERE id = ?
  `).get(TEST_USER.id) as { reset_token: string | null; reset_token_expires: string | null };
  db.close();
  return user;
}

function setResetCode(code: string, expiresAt: string): void {
  const db = new Database(TEST_DB_PATH);
  db.prepare(`
    UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?
  `).run(code, expiresAt, TEST_USER.id);
  db.close();
}

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-auth-password-test-${Date.now()}`);
  TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

  mkdirSync(join(TEST_DIR, 'data'), { recursive: true });
  process.env.DB_PATH = TEST_DB_PATH;

  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaSql = readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8');
  db.exec(schemaSql);

  const hash = await bcrypt.hash(TEST_USER.password, 12);
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(TEST_USER.id, TEST_USER.name, TEST_USER.email, hash, 'member');
  db.close();

  const serverModule = await import('../api/server.js');
  app = serverModule.default;
});

afterAll(() => {
  try {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch {
    // Windows may keep SQLite handles briefly; ignore cleanup failures in tests.
  }
  delete process.env.DB_PATH;
});

beforeEach(async () => {
  await resetTestUserPassword();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: TEST_USER.email,
      password: TEST_USER.password
    });

  const setCookie = loginRes.headers['set-cookie'];
  if (Array.isArray(setCookie)) {
    sessionCookie = setCookie[0].split(';')[0];
  } else if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }
});

describe('POST /api/auth/forgot-password', () => {
  it('registered email returns 200 and stores a 6-digit reset code', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();

    const user = getResetState();
    expect(user.reset_token).toMatch(/^\d{6}$/);
    expect(user.reset_token_expires).not.toBeNull();
  });

  it('unregistered email also returns 200 without leaking account existence', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();
  });

  it('missing or empty email returns 400', async () => {
    const missingRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({});

    expect(missingRes.status).toBe(400);
    expect(missingRes.body.success).toBe(false);

    const emptyRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: '' });

    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.success).toBe(false);
  });
});

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    setResetCode('123456', new Date(Date.now() + 5 * 60 * 1000).toISOString());
  });

  it('valid email code and strong password updates password', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: TEST_USER.email,
        code: '123456',
        new_password: 'NewPassword456'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: 'NewPassword456'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);

    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

    expect(oldLoginRes.status).toBe(401);
  });

  it('expired code returns 400', async () => {
    setResetCode('654321', new Date(Date.now() - 60 * 1000).toISOString());

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: TEST_USER.email,
        code: '654321',
        new_password: 'NewPassword456'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/验证码|过期/);
  });

  it('used code cannot be reused', async () => {
    const firstRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: TEST_USER.email,
        code: '123456',
        new_password: 'FirstNewPass123'
      });

    expect(firstRes.status).toBe(200);

    const secondRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: TEST_USER.email,
        code: '123456',
        new_password: 'SecondNewPass123'
      });

    expect(secondRes.status).toBe(400);
    expect(secondRes.body.success).toBe(false);
  });

  it('wrong code or unknown email returns a generic 400', async () => {
    const wrongCodeRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: TEST_USER.email,
        code: '000000',
        new_password: 'NewPassword456'
      });

    expect(wrongCodeRes.status).toBe(400);
    expect(wrongCodeRes.body.error).toMatch(/验证码|过期/);

    const unknownEmailRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: 'nonexistent@example.com',
        code: '123456',
        new_password: 'NewPassword456'
      });

    expect(unknownEmailRes.status).toBe(400);
    expect(unknownEmailRes.body.error).toMatch(/验证码|过期/);
  });

  it('missing fields or weak password returns 400', async () => {
    const missingEmailRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ code: '123456', new_password: 'NewPassword456' });

    expect(missingEmailRes.status).toBe(400);
    expect(missingEmailRes.body.success).toBe(false);

    const missingCodeRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: TEST_USER.email, new_password: 'NewPassword456' });

    expect(missingCodeRes.status).toBe(400);
    expect(missingCodeRes.body.success).toBe(false);

    const missingPasswordRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: TEST_USER.email, code: '123456' });

    expect(missingPasswordRes.status).toBe(400);
    expect(missingPasswordRes.body.success).toBe(false);

    const weakPasswordRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: TEST_USER.email,
        code: '123456',
        new_password: 'weak'
      });

    expect(weakPasswordRes.status).toBe(400);
    expect(weakPasswordRes.body.error).toMatch(/密码/);
  });

  it('successful reset clears reset code fields', async () => {
    await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: TEST_USER.email,
        code: '123456',
        new_password: 'CleanTokenPass123'
      });

    const user = getResetState();
    expect(user.reset_token).toBeNull();
    expect(user.reset_token_expires).toBeNull();
  });
});

describe('POST /api/auth/change-password', () => {
  it('correct old password and strong new password returns 200', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({
        old_password: TEST_USER.password,
        new_password: 'ChangedPass789'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: 'ChangedPass789'
      });

    expect(loginRes.status).toBe(200);
  });

  it('wrong old password, missing fields, weak password, and unauthenticated requests fail', async () => {
    const wrongOldRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({
        old_password: 'WrongOldPassword',
        new_password: 'ChangedPass789'
      });

    expect(wrongOldRes.status).toBe(400);

    const missingOldRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({ new_password: 'ChangedPass789' });

    expect(missingOldRes.status).toBe(400);

    const missingNewRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({ old_password: TEST_USER.password });

    expect(missingNewRes.status).toBe(400);

    const weakPasswordRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({
        old_password: TEST_USER.password,
        new_password: 'weak'
      });

    expect(weakPasswordRes.status).toBe(400);

    const unauthRes = await request(app)
      .post('/api/auth/change-password')
      .send({
        old_password: TEST_USER.password,
        new_password: 'NewPassAfterChange1'
      });

    expect(unauthRes.status).toBe(401);
  });
});
