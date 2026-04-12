import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { initDb } from '../db/connection.js';
import { createSessionMiddleware } from '../services/session.service.js';
import { authMiddleware } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import tokensRouter from './routes/tokens.js';
import usersRouter from './routes/users.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import versionsRouter from './routes/versions.js';
import scheduleRouter from './routes/schedule.js';
import configRouter from './routes/config.js';
import adminRouter from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.API_PORT || 3000;

// CORS 配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// JSON body parser
app.use(express.json());

// Session 中间件（SQLite session store）
app.use(createSessionMiddleware());

// 健康检查端点（无需认证）
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 认证路由（无需认证）
app.use('/api/auth', authRouter);

// API 路由（需要认证）
app.use('/api/tokens', authMiddleware, tokensRouter);
app.use('/api/users', authMiddleware, usersRouter);
app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/versions', authMiddleware, versionsRouter);
app.use('/api/tasks', authMiddleware, tasksRouter);
app.use('/api/schedule', authMiddleware, scheduleRouter);
app.use('/api/config', authMiddleware, configRouter);
app.use('/api/admin', authMiddleware, adminRouter);

// 静态文件服务（前端生产构建产物）
// 支持两种部署模式：
// 1. 开发模式：web/dist 在项目根目录的 web/ 下（../../web/dist）
// 2. Docker 生产模式：web/dist 在 app/web/dist 下，通过 WEB_DIST_PATH 环境变量指定
const webDistPath = process.env.WEB_DIST_PATH || join(__dirname, '../../web/dist');
if (existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  // 仅对非 API 路由返回 index.html（SPA fallback）
  app.get('*', (_req, res) => {
    if (_req.path.startsWith('/api/')) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.sendFile(join(webDistPath, 'index.html'));
  });
}

// 全局错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;
  res.status(statusCode).json({ success: false, error: err.message || 'Internal server error' });
});

// 启动服务器
export function startApiServer(): void {
  initDb();

  app.listen(PORT, () => {
    console.log(`API Server running on http://localhost:${PORT}`);
    if (existsSync(webDistPath)) {
      console.log(`Web UI available at http://localhost:${PORT}`);
    }
  });
}

export default app;
