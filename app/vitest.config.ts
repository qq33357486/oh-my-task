import { defineConfig, mergeConfig } from 'vitest/config';
// 带上扩展名：以后 Vite 换成原生的配置加载方式以后，不带扩展名的导入会不认。
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
