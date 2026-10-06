// 內容驗證（任務 T029 會擴充為完整版：schema、跨檔參照、行內標記）。
// 目前版本：掃描 src/content/**，確認每個 YAML 檔語法正確。有錯誤就以非零代碼結束（讓建置與 CI 失敗）。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

// 注意：不可用 URL.pathname（Windows 與中文路徑會被百分比編碼），一律用 fileURLToPath。
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CONTENT_DIR = join(ROOT, 'src', 'content');

function listYaml(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listYaml(full);
    return /\.ya?ml$/.test(name) ? [full] : [];
  });
}

const files = listYaml(CONTENT_DIR);
const errors: string[] = [];

for (const file of files) {
  try {
    YAML.parse(readFileSync(file, 'utf8'), { prettyErrors: true });
  } catch (error) {
    errors.push(`${relative(process.cwd(), file)}\n  ${(error as Error).message}`);
  }
}

if (errors.length > 0) {
  console.error(`內容驗證失敗（${errors.length} 個檔案）：\n\n${errors.join('\n\n')}`);
  process.exit(1);
}

console.log(`內容驗證通過：檢查了 ${files.length} 個 YAML 檔。`);
