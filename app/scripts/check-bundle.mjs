// 检查生产构建出来的脚本包里，是不是真有框架文件的内容。
// 新模块只有被页面引用了才会进构建包，所以内置内容变了以后要跑一次。
// 用法（在 app/ 下，先 npm run build）：npm run check:bundle
//
// 这里不直接引用 src/framework/manifest.ts：它带着 Vite 的 ?raw 导入，普通的 node 跑不了。
// 框架名单在源码里是手写的 10 个路径，这里按同一条规矩从磁盘上找：
// .omt/AGENTS.md、.omt/工作流/默认工作流.md，加三个拷问技能目录下的全部文件。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(process.cwd(), '..');
const EXPECTED = 10;

function walk(rel) {
  return readdirSync(join(repoRoot, rel), { withFileTypes: true }).flatMap((entry) => {
    const child = `${rel}/${entry.name}`;
    return entry.isDirectory() ? walk(child) : [child];
  });
}

const frameworkFiles = [
  '.omt/AGENTS.md',
  '.omt/工作流/默认工作流.md',
  ...['grill-with-docs', 'grilling', 'domain-modeling'].flatMap((skill) => walk(`.agents/skills/${skill}`)),
];

const assets = join(process.cwd(), 'dist', 'assets');
const bundles = readdirSync(assets).filter((name) => name.endsWith('.js'));
if (bundles.length === 0) {
  console.error('PROBLEM: dist/assets 里没有脚本包，先跑 npm run build');
  process.exit(1);
}
const text = bundles.map((name) => readFileSync(join(assets, name), 'utf8')).join('\n');

// 构建可能把非 ASCII 字符写成 \uXXXX 转义，两种写法都找。
const BACKSLASH = String.fromCharCode(92);
const escaped = (s) => [...s].map((c) => BACKSLASH + 'u' + c.charCodeAt(0).toString(16).toUpperCase()).join('');
const has = (needle) => text.includes(needle) || text.includes(escaped(needle)) || text.includes(escaped(needle).toLowerCase());

// 每个框架文件取正文里居中的一行当样本。先断言数量对得上，再说通过。
let missing = 0;
for (const path of frameworkFiles) {
  const content = readFileSync(join(repoRoot, path), 'utf8');
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length >= 12 && !l.includes('`'));
  const sample = lines[Math.floor(lines.length / 2)] ?? content.slice(0, 20);
  const ok = has(sample);
  if (!ok) missing++;
  console.log(ok ? 'FOUND  ' : 'MISSING', path);
}
const verdict =
  frameworkFiles.length === EXPECTED && missing === 0
    ? `ALL ${frameworkFiles.length} FRAMEWORK FILES ARE IN THE BUNDLE`
    : `PROBLEM: ${missing} of ${frameworkFiles.length} framework files missing from the bundle (expected ${EXPECTED})`;
console.log(verdict);
process.exit(frameworkFiles.length === EXPECTED && missing === 0 ? 0 : 1);
