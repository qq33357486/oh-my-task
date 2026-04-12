/**
 * 开发环境一键启动脚本
 * 用法: npm run dev:all
 * 功能: 自动清理端口、启动后端和前端
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const API_PORT = 3000;
const WEB_PORT = 5173;

function killPort(port: number): void {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = result.trim().split('\n');
      const pids = new Set<string>();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
      for (const pid of pids) {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch {}
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
    }
  } catch {}
}

async function main() {
  console.log('🚀 oh-my-task 开发环境启动\n');

  // 清理端口
  console.log('🧹 清理端口...');
  killPort(API_PORT);
  killPort(WEB_PORT);
  await new Promise(r => setTimeout(r, 1000));

  // 启动后端
  console.log('📦 启动后端...');
  const backend = spawn('npx', ['tsx', 'src/index.ts'], { cwd: rootDir, stdio: 'inherit', shell: true });

  await new Promise(r => setTimeout(r, 2000));

  // 启动前端
  console.log('🎨 启动前端...');
  const frontend = spawn('npm', ['run', 'dev'], { cwd: join(rootDir, 'web'), stdio: 'inherit', shell: true });

  console.log(`\n✅ 启动完成！\n   后端: http://localhost:${API_PORT}\n   前端: http://localhost:${WEB_PORT}\n\n按 Ctrl+C 停止\n`);

  process.on('SIGINT', () => {
    console.log('\n🛑 停止服务...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  });
}

main().catch(console.error);
