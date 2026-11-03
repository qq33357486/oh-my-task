/**
 * lib.dom 未收录的 File System Access API 入口（Chrome/Edge）。
 * 句柄类型 FileSystemHandle 等已在 lib.dom 中。
 */
interface Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
}

/**
 * T0022/A1：测试环境的最小 node API 类型（vitest 跑在 node 侧，测试文件
 * 直读源文本用 node:fs/node:path/process；项目不装 @types/node——零新增
 * 依赖，此处按实际用到的面写最小声明，仅服务测试，不进产物）。
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
  export function existsSync(path: string): boolean;
  export function statSync(path: string): { size: number };
}

declare module 'node:path' {
  export function resolve(...segments: string[]): string;
}

declare const process: { cwd(): string };
