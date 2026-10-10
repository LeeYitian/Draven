// 下載原文裡用到的 plurk 表情圖到 public/images/emoticons/（好讀版不從 plurk 外連圖片）。
// 用法：node scripts/fetch-emoticons.ts          （掃描本機 src/content/full.{html,md,txt}，只下載缺少的）
// 之後把 public/images/emoticons/ 的新圖片一起 commit。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'public', 'images', 'emoticons');
const SOURCES = ['full.html', 'full.md', 'full.txt'].map((n) => join(ROOT, 'src', 'content', n));

const sourceFile = SOURCES.find((f) => existsSync(f));
if (!sourceFile) {
  console.error('找不到 src/content/full.html（或 .md／.txt）。');
  process.exit(1);
}

const html = readFileSync(sourceFile, 'utf8');
const urls = new Map<string, string>();
for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
  const tag = m[0];
  if (!/class\s*=\s*"[^"]*emoticon/i.test(tag)) continue;
  const src = /\bsrc\s*=\s*"([^"]+)"/i.exec(tag)?.[1];
  if (!src) continue;
  const file = src.split('?')[0]!.split('/').pop()!;
  if (!/^[\w.-]+\.(png|jpe?g|gif|webp)$/i.test(file)) continue;
  if (!/^https:\/\/([\w-]+\.)*plurk\.com\//i.test(src)) {
    console.warn(`略過非 plurk 來源：${src}`);
    continue;
  }
  urls.set(file, src);
}

mkdirSync(OUT, { recursive: true });
let downloaded = 0;
let failed = 0;
for (const [file, url] of urls) {
  const target = join(OUT, file);
  if (existsSync(target)) continue;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    downloaded++;
    console.log(`下載 ${file}`);
  } catch (error) {
    failed++;
    console.error(`失敗 ${file}：${(error as Error).message}`);
  }
}
console.log(
  `共 ${urls.size} 種表情圖：新下載 ${downloaded}、失敗 ${failed}、已存在 ${urls.size - downloaded - failed}。`,
);
process.exit(failed ? 1 : 0);
