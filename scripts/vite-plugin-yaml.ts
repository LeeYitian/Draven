import type { Plugin } from 'vite';
import YAML from 'yaml';
import {
  AxisPageSchema,
  GlossaryFileSchema,
  HintsFileSchema,
  PeopleFileSchema,
  WorldIntroSchema,
} from '../src/content/schema.ts';

/**
 * 讓 `import data from './x.yaml'` 可用：把 YAML 轉成 JSON 模組。
 * 內容檔（src/content/**）是作者維護的文字，這裡負責「載入」；
 * 結構與跨檔參照的完整驗證在 scripts/content-check.ts（任務 T029）。
 *
 * 正式建置（vite build）時，這裡額外用 zod 驗證並套好預設值再輸出，
 * 網站執行時就不需要 zod（src/content/parse.prod.ts 原樣回傳；任務 T123）。
 */
const schemaOf = (file: string) => {
  const rel = file.replace(/\\/g, '/').split('/src/content/')[1] ?? '';
  if (rel === 'people.yaml') return PeopleFileSchema;
  if (rel === 'glossary.yaml') return GlossaryFileSchema;
  if (rel === 'hints.yaml') return HintsFileSchema;
  if (rel === 'pages/00.yaml') return WorldIntroSchema;
  if (/^pages\/0[1-4]\.yaml$/.test(rel)) return AxisPageSchema;
  return null; // ui.yaml 是任意深度的字串樹，不需要預設值
};

export function yamlPlugin(): Plugin {
  let build = false;
  return {
    name: 'draven-yaml',
    configResolved(config) {
      build = config.command === 'build';
    },
    transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!/\.ya?ml$/.test(file)) return null;
      try {
        let data: unknown = YAML.parse(code, { prettyErrors: true });
        const schema = build ? schemaOf(file) : null;
        if (schema) data = schema.parse(data);
        return { code: `export default ${JSON.stringify(data ?? null)};`, map: null };
      } catch (error) {
        this.error(`內容檔處理失敗：${file}\n${(error as Error).message}`);
      }
    },
  };
}
