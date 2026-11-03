/**
 * topics 标签扫描（T0019 App 集成层，无锁定测试——经 A4 App 级链路容错
 * 路径间接覆盖；纯函数部分 parseTopicTag 另有 A2 锁定）。
 *
 * 扫 <根>/.oht/knowledge/topics/*.md（跳过 _ 前缀模板），对每份文档跑
 * parseTopicTag，产出 type → 标签文字映射（键 = 文件名去 .md）。
 * 目录不存在/单文件读取失败一律静默降级：不抛异常、不打断看板与流程图，
 * 缺失的 type 无标签（卡面不显示，符合「无文档或无字段则不显示」契约）。
 *
 * 与 scanTasks.ts 同构对称：tasks 扫描喂看板，topics 扫描喂流程图标签。
 */
import { parseTopicTag } from './topicTag';
import { getDirHandle } from '../fs/fsAccess';

export async function scanTopicTags(
  root: FileSystemDirectoryHandle,
): Promise<Record<string, string>> {
  try {
    const topics = await getDirHandle(root, '.oht/knowledge/topics');
    if (!topics) return {};
    const tags: Record<string, string> = {};
    for await (const entry of topics.values()) {
      if (entry.kind !== 'file') continue;
      if (!entry.name.endsWith('.md')) continue;
      if (entry.name.startsWith('_')) continue; // _template 等内部文件
      try {
        const fileHandle = await topics.getFileHandle(entry.name);
        const text = await (await fileHandle.getFile()).text();
        tags[entry.name.slice(0, -3)] = parseTopicTag(text);
      } catch {
        // 单文件读取失败：该 type 无标签，不影响其余
      }
    }
    return tags;
  } catch {
    return {};
  }
}
