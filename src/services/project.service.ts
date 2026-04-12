import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import type { Project } from '../types/index.js';

/**
 * 获取用户的所有项目
 */
export function listProjects(userId: string): Project[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM projects
    WHERE owner_id = ?
    ORDER BY created_at DESC
  `).all(userId) as Project[];
}

/**
 * 根据 ID 获取项目（验证归属）
 */
export function getProjectById(id: string, userId: string): Project | null {
  const db = getDb();
  const project = db.prepare(`
    SELECT * FROM projects
    WHERE id = ? AND owner_id = ?
  `).get(id, userId) as Project | undefined;
  return project || null;
}

/**
 * 创建项目（同一用户下名称唯一）
 */
export function createProject(name: string, description: string | undefined, ownerId: string): Project {
  const db = getDb();

  // 检查同一用户下是否已有同名项目
  const existing = db.prepare(`
    SELECT id FROM projects WHERE owner_id = ? AND name = ?
  `).get(ownerId, name);

  if (existing) {
    const err = new Error('项目名称已存在') as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO projects (id, name, description, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, description || null, ownerId, now, now);

  return getProjectById(id, ownerId)!;
}

/**
 * 更新项目（验证归属，名称唯一性）
 */
export function updateProject(id: string, updates: { name?: string; description?: string }, userId: string): Project | null {
  const db = getDb();

  // 验证归属
  const existing = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND owner_id = ?
  `).get(id, userId);

  if (!existing) {
    return null;
  }

  const project = getProjectById(id, userId);
  if (!project) return null;

  const name = updates.name ?? project.name;
  const description = updates.description ?? project.description;

  // 如果更新了名称，检查同一用户下是否已有同名项目（排除自身）
  if (updates.name && updates.name !== project.name) {
    const nameConflict = db.prepare(`
      SELECT id FROM projects WHERE owner_id = ? AND name = ? AND id != ?
    `).get(userId, updates.name, id);

    if (nameConflict) {
      const err = new Error('项目名称已存在') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?
  `).run(name, description, now, id);

  return getProjectById(id, userId);
}

/**
 * 删除项目（级联删除所有任务和版本，验证归属）
 */
export function deleteProject(id: string, userId: string): boolean {
  const db = getDb();

  // 验证归属
  const existing = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND owner_id = ?
  `).get(id, userId);

  if (!existing) {
    return false;
  }

  // 删除项目下所有任务的历史记录
  db.prepare(`
    DELETE FROM task_history WHERE task_id IN
    (SELECT id FROM tasks WHERE project_id = ?)
  `).run(id);

  // 删除项目下所有任务
  db.prepare('DELETE FROM tasks WHERE project_id = ?').run(id);

  // 删除项目下所有版本
  db.prepare('DELETE FROM versions WHERE project_id = ?').run(id);

  // 删除项目本身
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * 检查项目归属
 */
export function checkProjectOwnership(projectId: string, userId: string): boolean {
  const db = getDb();
  const project = db.prepare(`
    SELECT owner_id FROM projects WHERE id = ?
  `).get(projectId) as { owner_id: string } | undefined;

  if (!project) return false;
  return project.owner_id === userId;
}
