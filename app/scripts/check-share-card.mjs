// 检查生产构建出来的 index.html 里，分享卡片要用的三样在不在，预览图的文件在不在。
// 微信、QQ 这类地方发链接时带的卡片，靠的就是这几样。
// 用法（在 app/ 下，先 npm run build）：npm run check:share-card
//
// 这里不引用 src/landing/copy.ts（它带着 Vite 处理不了的图片导入，普通的 node 跑不了）：
// 期望的文字照任务夹 design.md 的「文案定稿」手写一份。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const TITLE = 'DJ Task · 多杰任务系统';
const DESCRIPTION = '一套靠文档运转的任务系统：文档全由 AI 写、读、查，你只管决定。';
const IMAGE = 'https://task.duojie.games/share-card.jpg';

const html = readFileSync(join(dist, 'index.html'), 'utf8');

/** 一条一条的 <meta>，属性不分先后。 */
function metaContent(key, value) {
  const tags = html.match(/<meta\b[^>]*>/g) ?? [];
  for (const tag of tags) {
    const attr = (name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    if (attr(key) === value) return attr('content') ?? null;
  }
  return null;
}

const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null;

const checks = [
  ['<title>', title, TITLE],
  ['meta name="description"', metaContent('name', 'description'), DESCRIPTION],
  ['meta property="og:title"', metaContent('property', 'og:title'), TITLE],
  ['meta property="og:description"', metaContent('property', 'og:description'), DESCRIPTION],
  ['meta property="og:image"', metaContent('property', 'og:image'), IMAGE],
  ['meta property="og:type"', metaContent('property', 'og:type'), 'website'],
  ['dist/share-card.jpg', existsSync(join(dist, 'share-card.jpg')) ? '在' : null, '在'],
];

const missing = [];
for (const [what, actual, expected] of checks) {
  const ok = actual === expected;
  if (!ok) missing.push(`${what}：期望「${expected}」，实际「${actual ?? '没有'}」`);
  console.log(`${ok ? 'FOUND  ' : 'MISSING'} ${what}`);
}

if (missing.length > 0) {
  console.error(`\n有 ${missing.length} 样不对：`);
  for (const line of missing) console.error(`  - ${line}`);
  process.exitCode = 1;
} else {
  console.log(`\nALL ${checks.length} SHARE-CARD PIECES ARE IN dist`);
}
