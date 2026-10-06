// 內容驗證（任務 T029、T035）。`npm run content:check`：檢查 src/content/** 的 YAML 語法、結構、
// 跨檔參照、行內標記，以及介面文案（ui.yaml）的 key 與程式碼使用是否一致。
// 有「錯誤」就以非零代碼結束（使建置與 CI 失敗）；「警告」只提示。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { validateContent, type ContentBundle, type Issue } from '../src/content/validate.ts';

// 注意：不可用 URL.pathname（Windows 與中文路徑會被百分比編碼），一律用 fileURLToPath。
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CONTENT_DIR = join(ROOT, 'src', 'content');
const SRC_DIR = join(ROOT, 'src');

function walk(dir: string, filter: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full, filter);
    return filter(name) ? [full] : [];
  });
}

const issues: Issue[] = [];
const rel = (file: string) => relative(CONTENT_DIR, file).replace(/\\/g, '/');

function loadYaml(file: string): unknown {
  try {
    return YAML.parse(readFileSync(file, 'utf8'), { prettyErrors: true });
  } catch (error) {
    issues.push({
      severity: 'error',
      file: rel(file),
      path: '',
      message: `YAML 語法錯誤：${(error as Error).message}`,
    });
    return undefined;
  }
}

// ── 讀檔 ─────────────────────────────────────────────────────────
const yamlFiles = walk(CONTENT_DIR, (n) => /\.ya?ml$/.test(n));
const bundle: ContentBundle = { pages: {} };
for (const file of yamlFiles) {
  const name = rel(file);
  const data = loadYaml(file);
  if (data === undefined) continue;
  if (name === 'people.yaml') bundle.people = data;
  else if (name === 'glossary.yaml') bundle.glossary = data;
  else if (name === 'hints.yaml') bundle.hints = data;
  else if (name === 'ui.yaml') bundle.ui = data;
  else if (/^pages\/0[1-4]\.yaml$/.test(name)) bundle.pages![name.slice(6, 8)] = data;
  // pages/00.yaml 等其他檔：結構驗證在對應任務加入；這裡先確認語法正確（上面已 parse）
}

issues.push(...validateContent(bundle));

// ── T035：ui.yaml 的 key 與程式碼使用是否一致 ────────────────────────
function flatten(tree: unknown, prefix = ''): string[] {
  if (typeof tree === 'string') return [prefix];
  if (tree && typeof tree === 'object')
    return Object.entries(tree).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

if (bundle.ui) {
  const defined = new Set(flatten(bundle.ui));
  const used = new Set<string>();
  const usedPrefixes = new Set<string>();
  // 內容載入器本身（src/content/）不算「使用」
  const sourceFiles = walk(SRC_DIR, (n) => /\.(ts|tsx)$/.test(n)).filter(
    (f) => !relative(ROOT, f).replace(/\\/g, '/').startsWith('src/content/'),
  );

  for (const file of sourceFiles) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/\bt\(\s*(['"])([A-Za-z0-9_.]+)\1/g)) {
      used.add(m[2]!);
      if (!defined.has(m[2]!))
        issues.push({
          severity: 'error',
          file: relative(ROOT, file).replace(/\\/g, '/'),
          path: '',
          message: `ui key "${m[2]}" 在 ui.yaml 中沒有定義`,
        });
    }
    // 動態 key：t(`people.tags.${id}`) → 視為使用了 people.tags. 底下的所有 key
    for (const m of code.matchAll(/\bt\(\s*`([A-Za-z0-9_.]*)\$\{/g)) usedPrefixes.add(m[1]!);
  }
  for (const key of defined) {
    if (used.has(key) || [...usedPrefixes].some((p) => key.startsWith(p))) continue;
    issues.push({
      severity: 'warning',
      file: 'ui.yaml',
      path: key,
      message: '這個 ui key 目前沒有被程式碼使用（功能尚未實作，或已不需要）',
    });
  }
}

// ── 輸出 ─────────────────────────────────────────────────────────
const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');
const line = (i: Issue) => `  ${i.file}${i.path ? ` › ${i.path}` : ''}\n    ${i.message}`;

if (warnings.length > 0 && process.argv.includes('--warnings')) {
  console.warn(`警告（${warnings.length}）：\n${warnings.map(line).join('\n')}\n`);
}
if (errors.length > 0) {
  console.error(`內容驗證失敗：${errors.length} 個錯誤\n\n${errors.map(line).join('\n\n')}`);
  process.exit(1);
}
console.log(
  `內容驗證通過：檢查了 ${yamlFiles.length} 個 YAML 檔` +
    (warnings.length > 0 ? `，${warnings.length} 個警告（加 --warnings 查看）` : ''),
);
