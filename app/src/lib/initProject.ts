/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0004/A1、A2、A3）。
 *
 * runInit(
 *   writeFile: (path: string, content: string) => void,
 *   exists: (path: string) => boolean,
 *   readFile: (path: string) => string
 * ): InitResult
 *
 * 注意：三参签名是对调度员草案（两参）的修正——A2 要求宿主 AGENTS.md
 * 原内容逐字保留并在末尾追加，没有 readFile 无法实现也无法测试。
 *
 * 契约：
 * - 纯函数：所有 IO 通过参数注入，路径一律为相对目标目录根的 POSIX 风格
 *   相对路径（如 ".oht/AGENTS.md"、"AGENTS.md"、".oht/roles/checker.md"）。
 * - readFile 只允许在 exists(path) 为 true 时调用；空目录场景不得调用。
 * - 幂等拒绝：exists('.oht') 为 true 时，返回
 *   { ok:false, reason:非空字符串, written:[] }，且 writeFile 零调用。
 * - 成功：ok=true，written 含全部实际写入路径；宿主 AGENTS.md 已存在时，
 *   写入内容 = 原内容逐字在前 + 末尾追加一行含 ".oht/AGENTS.md" 的引用。
 */
export interface InitResult {
  ok: boolean;
  /** 拒绝原因；ok=true 时为 undefined */
  reason?: string;
  /** 实际写入的路径列表（相对目标目录根） */
  written: string[];
}

export function runInit(
  writeFile: (path: string, content: string) => void,
  exists: (path: string) => boolean,
  readFile: (path: string) => string,
): InitResult {
  void writeFile;
  void exists;
  void readFile;
  throw new Error('not implemented');
}
