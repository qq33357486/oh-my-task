import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 框架文件在 app/ 之外（.omt/、.agents/skills/），开发服务器要放行仓库根才读得到。
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [repoRoot],
      // 放行仓库根以后，这几样不能跟着被读到。写 deny 会把 Vite 的默认值整个换掉，所以要自己写回来。
      // Vite 拿文件的绝对路径来匹配：不带斜杠的模式它会自动加上「**/」，带斜杠的照原样用，所以后两项自己写全。
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.zcode/**'],
    },
  },
});
