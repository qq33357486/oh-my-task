import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hero } from './copy';

// 测试在 app/ 下跑，图也在 app/ 下。
const assets = join(process.cwd(), 'src/assets');
const shareCard = join(process.cwd(), 'public/share-card.jpg');

/** 每张不超过 200KB；所有图加起来不超过 1MB。 */
const LIMIT_EACH = 200 * 1024;
const LIMIT_TOTAL = 1024 * 1024;

/** 网页里用的八张图。顺序照 design.md 的图片清单。 */
const EIGHT = [
  'hero-ribbons.webp',
  'closing-board.webp',
  'believe-path.webp',
  'step-need.webp',
  'step-doc.webp',
  'step-build.webp',
  'step-accept.webp',
  'step-organize.webp',
];

const sizeOf = (file: string) => readFileSync(file).length;

/** 按文件头认格式。 */
function formatOf(file: string): 'WebP' | 'JPG' | '别的' {
  const head = readFileSync(file).subarray(0, 12);
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'WebP';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'JPG';
  return '别的';
}

describe('网页里用的图', () => {
  it('assets 里就是这八张，没有多的', () => {
    expect(readdirSync(assets).sort()).toEqual([...EIGHT].sort());
  });

  // 按目录里实际有的文件逐个量：多放进来一张超重的假图，这一条会红，并说出是哪一张。
  const present = readdirSync(assets).sort();
  it.each(present)('%s 是 WebP，不超过 200KB', (name) => {
    const file = join(assets, name);
    expect(formatOf(file), `${name} 的格式`).toBe('WebP');
    expect(sizeOf(file), `${name} 的大小`).toBeLessThanOrEqual(LIMIT_EACH);
  });

  it('八张加起来不超过 1MB，连分享卡片的预览图一起也不超过', () => {
    const eight = EIGHT.reduce((sum, name) => sum + sizeOf(join(assets, name)), 0);
    expect(eight).toBeLessThanOrEqual(LIMIT_TOTAL);
    expect(eight + sizeOf(shareCard)).toBeLessThanOrEqual(LIMIT_TOTAL);
  });

  it('分享卡片的预览图是 JPG，不超过 200KB', () => {
    expect(existsSync(shareCard), 'public/share-card.jpg 要在').toBe(true);
    expect(formatOf(shareCard)).toBe('JPG');
    expect(sizeOf(shareCard)).toBeLessThanOrEqual(LIMIT_EACH);
  });
});

describe('网页头部（分享卡片要用的三样）', () => {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  const head = new DOMParser().parseFromString(html, 'text/html').head;
  const meta = (selector: string) => head.querySelector(selector)?.getAttribute('content') ?? null;

  it('网页标题是「DJ Task · 多杰任务系统」', () => {
    expect(head.querySelector('title')?.textContent).toBe('DJ Task · 多杰任务系统');
  });

  it('描述和 og: 系列标签都在，内容对得上', () => {
    expect(meta('meta[name="description"]')).toBe(hero.subtitle);
    expect(meta('meta[property="og:title"]')).toBe('DJ Task · 多杰任务系统');
    expect(meta('meta[property="og:description"]')).toBe(hero.subtitle);
    expect(meta('meta[property="og:type"]')).toBe('website');
  });

  it('预览图指向完整的网址，文件在 public/ 里', () => {
    expect(meta('meta[property="og:image"]')).toBe('https://task.duojie.games/share-card.jpg');
    expect(existsSync(shareCard)).toBe(true);
  });
});
