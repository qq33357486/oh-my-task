// API 基础配置
const API_BASE = '';

// 通用 fetch 封装
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',  // 携带 cookie (session)
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  const data = await res.json();
  return data.data;
}

// ==================== 类型定义 ====================

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: 'admin' | 'member';
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

export interface Version {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  locked_at: string | null;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
}

export interface VersionStats {
  totalTasks: number;
  doneTasks: number;
  startDate: string | null;
  plannedDueDate: string | null;
  actualDueDate: string | null;
  delayDays: number;
  deviationDays: number;
  insertedTasks: number;
  progress: number;
}

export interface Task {
  id: string;
  project_id: string;
  version_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: 'planned' | 'in_progress' | 'done';
  estimated_days: number | null;
  start_date: string | null;
  due_date: string | null;
  actual_start: string | null;
  actual_end: string | null;
  sort_order: number;
  inserted: boolean;
  deleted_at: string | null;
  created_at: string;
  children?: Task[];
}

export interface Token {
  id: string;
  name: string;
  token: string;  // 掩码后的
  last_used_at: string | null;
  created_at: string;
}

export interface TokenWithPlain {
  id: string;
  name: string;
  plain_token: string;  // 完整 token（仅创建时返回）
  created_at: string;
}

// ==================== 认证 API ====================

export const authApi = {
  // 登录
  login: (email: string, password: string, captchaToken?: string) =>
    fetchApi<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, captcha_token: captchaToken }),
    }),

  // 注册
  register: (name: string, email: string, password: string, captchaToken?: string) =>
    fetchApi<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, captcha_token: captchaToken }),
    }),

  // 登出
  logout: () =>
    fetchApi<void>('/api/auth/logout', {
      method: 'POST',
    }),

  // 获取当前用户
  me: () =>
    fetchApi<{ user: User }>('/api/auth/me'),

  // 修改密码
  changePassword: (oldPassword: string, newPassword: string) =>
    fetchApi<void>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }),

  // 忘记密码
  forgotPassword: (email: string) =>
    fetchApi<void>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // 重置密码
  resetPassword: (token: string, newPassword: string) =>
    fetchApi<void>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  // 查询注册是否开启（公开接口）
  getRegistrationStatus: () =>
    fetchApi<{ enabled: boolean }>('/api/auth/registration-status'),
};

// ==================== Token API ====================

export const tokenApi = {
  // 获取 Token 列表
  list: () => fetchApi<{ tokens: Token[] }>('/api/tokens'),
  
  // 创建 Token
  create: (name: string) => fetchApi<{ token: TokenWithPlain }>('/api/tokens', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  
  // 删除 Token
  delete: (id: string) => fetchApi<void>(`/api/tokens/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== 项目 API ====================

export const projectApi = {
  list: () => fetchApi<Project[]>('/api/projects'),
  get: (id: string) => fetchApi<Project>(`/api/projects/${id}`),
  create: (name: string, description?: string) => 
    fetchApi<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  update: (id: string, data: { name?: string; description?: string }) => 
    fetchApi<Project>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => 
    fetchApi<void>(`/api/projects/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== 版本 API ====================

export const versionApi = {
  list: (projectId: string) => fetchApi<Version[]>(`/api/versions?project_id=${projectId}`),
  get: (id: string) => fetchApi<Version>(`/api/versions/${id}`),
  getStats: (id: string) => fetchApi<VersionStats>(`/api/versions/${id}/stats`),
  create: (projectId: string, name: string, description?: string, startDate?: string, dueDate?: string) => 
    fetchApi<Version>('/api/versions', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, name, description, start_date: startDate, due_date: dueDate }),
    }),
  update: (id: string, data: { name?: string; description?: string; start_date?: string; due_date?: string }) => 
    fetchApi<Version>(`/api/versions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => 
    fetchApi<void>(`/api/versions/${id}`, {
      method: 'DELETE',
    }),
  archive: (id: string) => 
    fetchApi<{ name: string; tasks_archived: number }>(`/api/versions/${id}/archive`, {
      method: 'POST',
    }),
};

// ==================== 任务 API ====================

export const taskApi = {
  list: (params?: { project_id?: string; version_id?: string | null; parent_id?: string | null; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.append('project_id', params.project_id);
    if (params?.version_id !== undefined) searchParams.append('version_id', params.version_id === null ? 'null' : params.version_id);
    if (params?.parent_id !== undefined) searchParams.append('parent_id', params.parent_id === null ? 'null' : params.parent_id);
    if (params?.status) searchParams.append('status', params.status);
    return fetchApi<Task[]>(`/api/tasks?${searchParams}`);
  },
  
  get: (id: string) => fetchApi<Task>(`/api/tasks/${id}`),
  
  create: (data: { project_id: string; title: string; version_id?: string; parent_id?: string; description?: string; estimated_days?: number }) => 
    fetchApi<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Task> & { reason?: string }) => 
    fetchApi<Task>(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) => 
    fetchApi<void>(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),
  
  reorder: (taskIds: string[], parentId?: string | null) => 
    fetchApi<void>('/api/tasks/reorder', {
      method: 'PUT',
      body: JSON.stringify({ task_ids: taskIds, parent_id: parentId }),
    }),
  
  activate: (id: string) =>
    fetchApi<Task>(`/api/tasks/${id}/activate`, {
      method: 'POST',
    }),
  
  complete: (id: string) => 
    fetchApi<Task>(`/api/tasks/${id}/complete`, {
      method: 'POST',
    }),
  
  addNote: (id: string, note: string) => 
    fetchApi<void>(`/api/tasks/${id}/history`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
};

// ==================== 调度 API ====================

export const scheduleApi = {
  autoSchedule: (projectId: string, startDate: string) => 
    fetchApi<{ changes: Array<{ task_id: string; title: string; new_start: string; new_due: string | null }> }>('/api/schedule/auto', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, start_date: startDate }),
    }),
  
  calculateEndDates: (tasks: Array<{ id: string; estimated_days?: number | null; status: string; actual_end?: string | null }>, startDate?: string) => 
    fetchApi<Array<{ id: string; startDate: string; endDate: string }>>('/api/schedule/calculate-end-dates', {
      method: 'POST',
      body: JSON.stringify({ tasks, start_date: startDate }),
    }),
};

// ==================== 用户管理 API ====================

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export const userApi = {
  // 获取用户列表（分页）
  list: (page: number = 1, pageSize: number = 10) =>
    fetchApi<{ users: User[]; pagination: Pagination }>(`/api/users?page=${page}&page_size=${pageSize}`),

  // 删除用户
  delete: (id: string) =>
    fetchApi<void>(`/api/users/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== 系统配置 API ====================

export interface SystemConfig {
  server_url: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  registration_enabled: string;
  hcaptcha_site_key: string;
  hcaptcha_secret_key: string;
}

export const configApi = {
  // 获取所有配置
  get: () => fetchApi<SystemConfig>('/api/config'),
  
  // 更新所有配置
  update: (config: Partial<SystemConfig>) =>
    fetchApi<SystemConfig>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  
  // 更新单个配置项
  set: (key: string, value: string) =>
    fetchApi<{ key: string; value: string }>(`/api/config/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
};

// ==================== 管理员统计 API ====================

export interface NewUsersStats {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface DAUData {
  date: string;
  count: number;
}

export interface RetentionStats {
  day1: number | null;
  day7: number | null;
}

export interface AdminStats {
  newUsers: NewUsersStats;
  dau: DAUData[];
  retention: RetentionStats;
}

export const adminApi = {
  // 获取管理员统计
  getStats: () => fetchApi<AdminStats>('/api/admin/stats'),
};

// 兼容旧 API
export const api = {
  getProjects: () => projectApi.list(),
  getProject: (id: string) => projectApi.get(id),
  
  getVersions: (projectId: string) => versionApi.list(projectId),
  getVersion: (id: string) => versionApi.get(id),
  getVersionStats: (id: string) => versionApi.getStats(id),
  updateVersion: (id: string, data: { start_date?: string; due_date?: string; name?: string; description?: string }) => 
    versionApi.update(id, data),
  
  getTasks: (params?: { project_id?: string; version_id?: string | null; parent_id?: string | null; status?: string }) => 
    taskApi.list(params),
  getTask: (id: string) => taskApi.get(id),
  updateTask: (id: string, data: Partial<Task>) => taskApi.update(id, data),
  reorderTasks: (taskIds: string[], parentId?: string | null) => taskApi.reorder(taskIds, parentId),
  deleteTask: (id: string) => taskApi.delete(id),
  
  autoSchedule: (projectId: string, startDate: string) => scheduleApi.autoSchedule(projectId, startDate),
  calculateEndDates: (tasks: Array<{ id: string; estimated_days?: number | null; status: string; actual_end?: string | null }>, startDate?: string) => 
    scheduleApi.calculateEndDates(tasks, startDate),
  
  getUsers: () => fetchApi<User[]>('/api/users'),
  getMe: () => authApi.me(),
  
  deleteProject: (id: string) => projectApi.delete(id),
  deleteVersion: (id: string) => versionApi.delete(id),
};
