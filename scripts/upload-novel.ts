// 把好讀版的原文與目錄上傳到 Cloudflare KV（不需要重新部署網站）。
// 用法：npm run novel:upload            （上傳 src/content/full.* 與 src/content/toc.yaml）
//       npm run novel:upload -- --dry-run （只檢查，不上傳）
// 前置作業見 specs/002-reader-mode/quickstart.md。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { parseSource } from '../src/features/reader/source.ts';
import { readTocItems, resolveToc } from '../src/features/reader/toc.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CONTENT = join(ROOT, 'contents');
const dryRun = process.argv.includes('--dry-run');

const source = ['full.html'].map((n) => join(CONTENT, n)).find(existsSync);
if (!source) {
  console.error('找不到 contents/full.html');
  process.exit(1);
}
const blocks = parseSource(readFileSync(source, 'utf8'));
console.log(`原文：${source}（${blocks.length} 段）`);

// 目錄：沒有 toc.yaml 時只上傳原文（網站會改用原文自己的標題）
const tocFile = join(CONTENT, 'toc.yaml');
let tocJson: string | null = null;
if (existsSync(tocFile)) {
  const raw: unknown = YAML.parse(readFileSync(tocFile, 'utf8'));
  const items = readTocItems(raw);
  const { entries, problems } = resolveToc(blocks, items);
  for (const p of problems)
    console.warn(`${p.severity === 'error' ? '錯誤' : '警告'}：${p.message}`);
  if (problems.some((p) => p.severity === 'error')) {
    console.error('目錄有找不到錨句的項目，已停止上傳。請先修正 toc.yaml。');
    process.exit(1);
  }
  tocJson = JSON.stringify({ items });
  console.log(`目錄：${entries.length} 項`);
} else {
  console.log('沒有 contents/toc.yaml：不上傳目錄。');
}

if (dryRun) {
  console.log('--dry-run：檢查完成，未上傳。');
  process.exit(0);
}

const put = (key: string, path: string) => {
  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'kv',
      'key',
      'put',
      key,
      `--path=${path}`,
      '--binding=NOVEL',
      '--remote',
      '--config=worker/wrangler.toml',
    ],
    { cwd: ROOT, stdio: 'inherit', shell: true },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
};

put('full', source);
if (tocJson) {
  const tmp = join(mkdtempSync(join(tmpdir(), 'draven-toc-')), 'toc.json');
  writeFileSync(tmp, tocJson);
  put('toc', tmp);
}
console.log('上傳完成。讀者重新整理後就會看到新版（Worker 有 5 分鐘快取）。');
