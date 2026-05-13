import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let TEST_DIR: string;
let TEST_DB_PATH: string;
let app: import('express').Express;

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-security-test-${Date.now()}`);
  TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

  mkdirSync(join(TEST_DIR, 'data'), { recursive: true });
  process.env.DB_PATH = TEST_DB_PATH;
  process.env.OMT_LOGIN_RATE_LIMIT_MAX = '2';

  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8'));
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
    // Ignore Windows file lock cleanup failures in tests.
  }
  delete process.env.DB_PATH;
  delete process.env.OMT_LOGIN_RATE_LIMIT_MAX;
});

async function registerUser(email: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'UserPass123' });
  return {
    cookie: res.headers['set-cookie']?.[0] || '',
    user: res.body.data.user as { id: string; email: string; role: string },
  };
}

async function createProject(cookie: string, name: string) {
  const res = await request(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name });
  return res.body.data as { id: string; name: string };
}

async function createTask(cookie: string, projectId: string, title: string) {
  const res = await request(app)
    .post('/api/tasks')
    .set('Cookie', cookie)
    .send({ project_id: projectId, title, estimated_days: 1 });
  return res.body.data as { id: string; title: string };
}

describe('security hardening', () => {
  it('adds browser security headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('blocks cross-site browser writes', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://attacker.example')
      .send({ email: 'nobody@example.com', password: 'WrongPass123' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('rate limits repeated login attempts by email and IP', async () => {
    const email = `rate-${Date.now()}@test.com`;
    await registerUser(email);

    for (let i = 0; i < 2; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .send({ email, password: 'WrongPass123' });
      expect(res.status).toBe(401);
    }

    const limited = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ email, password: 'WrongPass123' });

    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('prevents schedule APIs from modifying another user project', async () => {
    const user1 = await registerUser(`owner-${Date.now()}@test.com`);
    const user2 = await registerUser(`intruder-${Date.now()}@test.com`);
    const project = await createProject(user1.cookie, 'Private project');
    const task = await createTask(user1.cookie, project.id, 'Private task');

    const autoRes = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user2.cookie)
      .send({ project_id: project.id, start_date: '2026-05-13' });

    expect(autoRes.status).toBe(404);

    const rescheduleRes = await request(app)
      .post('/api/schedule/reschedule')
      .set('Cookie', user2.cookie)
      .send({ task_id: task.id, new_start_date: '2026-05-14' });

    expect(rescheduleRes.status).toBe(404);
  });

  it('rejects oversized schedule batches and invalid statuses', async () => {
    const user = await registerUser(`bulk-${Date.now()}@test.com`);
    const tooManyTasks = Array.from({ length: 1001 }, (_, index) => ({
      id: `task-${index}`,
      estimated_days: 1,
      status: 'planned',
    }));

    const tooMany = await request(app)
      .post('/api/schedule/calculate-end-dates')
      .set('Cookie', user.cookie)
      .send({ start_date: '2026-05-13', tasks: tooManyTasks });

    expect(tooMany.status).toBe(400);

    const invalidStatus = await request(app)
      .post('/api/schedule/calculate-end-dates')
      .set('Cookie', user.cookie)
      .send({
        start_date: '2026-05-13',
        tasks: [{ id: 'task-1', estimated_days: 1, status: 'bad_status' }],
      });

    expect(invalidStatus.status).toBe(400);
  });
});
