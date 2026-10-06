import type { Plugin } from 'vite';
import YAML from 'yaml';

/**
 * 讓 `import data from './x.yaml'` 可用：建置時把 YAML 轉成 JSON 模組。
 * 內容檔（src/content/**）是作者維護的文字，這裡只負責「載入」；
 * 結構與跨檔參照的驗證在 scripts/content-check.ts（任務 T029）。
 */
export function yamlPlugin(): Plugin {
  return {
    name: 'draven-yaml',
    transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!/\.ya?ml$/.test(file)) return null;
      try {
        const data = YAML.parse(code, { prettyErrors: true });
        return { code: `export default ${JSON.stringify(data ?? null)};`, map: null };
      } catch (error) {
        this.error(`YAML 解析失敗：${file}\n${(error as Error).message}`);
      }
    },
  };
}
