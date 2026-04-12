import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import request from 'supertest';

let TEST_DIR: string;
let TEST_DB_PATH: string;
let app: import('express').Express;

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-hcaptcha-fix-test-${Date.now()}`);
  TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

  mkdirSync(join(TEST_DIR, 'data'), { recursive: true });

  process.env.DB_PATH = TEST_DB_PATH;

  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaSql = readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8');
  db.exec(schemaSql);

  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.default.hash('AdminPass123', 12);
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run('admin-1', 'Admin', 'admin@test.com', hash, 'admin');
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
    // ignore
  }
  delete process.env.DB_PATH;
});

describe('Token masking 格式修复', () => {
  it('maskToken 返回 omt_***abc 格式（前4位 + *** + 后3位）', async () => {
    const { maskToken } = await import('../services/token.service.js');

    const token = 'omt_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
    const masked = maskToken(token);

    expect(masked).toMatch(/^omt_\*{3}[a-f0-9]{3}$/);
    expect(masked).toBe('omt_***5d6');
  });

  it('maskToken 对短 token 返回 ****', async () => {
    const { maskToken } = await import('../services/token.service.js');

    expect(maskToken('')).toBe('****');
    expect(maskToken('short')).toBe('****');
    expect(maskToken('omt_ab')).toBe('****');
  });

  it('GET /api/tokens 返回的 token 格式为 omt_***abc', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'AdminPass123' });

    expect(loginRes.status).toBe(200);

    let cookie: string;
    const setCookie = loginRes.headers['set-cookie'];
    if (Array.isArray(setCookie)) {
      cookie = setCookie[0].split(';')[0];
    } else if (setCookie) {
      cookie = setCookie.split(';')[0];
    } else {
      throw new Error('No set-cookie header in login response');
    }

    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', cookie)
      .send({ name: 'mask-test' });

    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get('/api/tokens')
      .set('Cookie', cookie);

    expect(listRes.status).toBe(200);
    const tokenItem = listRes.body.data.tokens.find((t: { name: string }) => t.name === 'mask-test');
    expect(tokenItem).toBeDefined();
    expect(tokenItem.token).toMatch(/^omt_\*{3}[a-f0-9]{3}$/);
  });
});
