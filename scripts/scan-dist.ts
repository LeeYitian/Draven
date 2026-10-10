// 確認打包後的網站（dist/）沒有夾帶小說原文。需要本機有 src/content/full.*（沒有就略過）。
// 用法：npm run build && npm run scan:dist
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSource } from '../src/features/reader/source.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const source = ['full.html', 'full.md', 'full.txt']
  .map((n) => join(ROOT, 'src', 'content', n))
  .find(existsSync);
if (!source) {
  console.log('沒有本機原文，略過 dist 掃描。');
  process.exit(0);
}

const blocks = parseSource(readFileSync(source, 'utf8')).filter((b) => b.norm.length >= 24);
const step = Math.max(1, Math.floor(blocks.length / 40));
const needles = blocks.filter((_, i) => i % step === 0).map((b) => b.norm.slice(8, 24));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const dist = join(ROOT, 'dist');
if (!existsSync(dist)) {
  console.error('找不到 dist/，請先執行 npm run build');
  process.exit(1);
}
const hits: string[] = [];
for (const file of walk(dist).filter((f) => /\.(js|html|css|json|txt)$/.test(f))) {
  const text = readFileSync(file, 'utf8').replace(/\s+/g, '');
  for (const n of needles) if (text.includes(n)) hits.push(`${file}：${n}`);
}
if (hits.length) {
  console.error(`dist/ 含有小說原文（${hits.length} 處）：\n${hits.slice(0, 5).join('\n')}`);
  process.exit(1);
}
console.log(`dist/ 不含小說原文（抽查 ${needles.length} 段）。`);
