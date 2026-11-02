/**
 * 任务卡扫描（T0003）：扫 <根>/.oht/tasks/*.md，跳过 _*.md（模板/锁等）。
 * 每个文件独立 parseCard：单卡解析失败不抛、不影响其他卡，
 * 由调用方按 card.ok 降级显示。无 .oht/ 时 hasOht=false。
 */
import { parseCard, type ParsedCard } from './parseCard';
import { getDirHandle } from '../fs/fsAccess';

export interface ScannedCard {
  /** 文件名（不含路径），用于失败卡展示 */
  file: string;
  card: ParsedCard;
}

export interface ScanResult {
  /** 根目录下是否存在 .oht/ */
  hasOht: boolean;
  cards: ScannedCard[];
}

export async function scanTasks(root: FileSystemDirectoryHandle): Promise<ScanResult> {
  const oht = await getDirHandle(root, '.oht');
  if (!oht) return { hasOht: false, cards: [] };
  const tasks = await getDirHandle(oht, 'tasks');
  if (!tasks) return { hasOht: true, cards: [] };

  const cards: ScannedCard[] = [];
  for await (const entry of tasks.values()) {
    if (entry.kind !== 'file') continue;
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name.startsWith('_')) continue; // 模板等内部文件
    try {
      const fileHandle = await tasks.getFileHandle(entry.name);
      const text = await (await fileHandle.getFile()).text();
      cards.push({ file: entry.name, card: parseCard(text) });
    } catch {
      // 单文件读取失败也按解析失败降级，不阻断其余卡
      cards.push({
        file: entry.name,
        card: parseCard(''),
      });
    }
  }
  cards.sort((a, b) => a.file.localeCompare(b.file, 'zh-CN'));
  return { hasOht: true, cards };
}
