/**
 * 內容檔的執行期驗證（開發與測試用）：載入時用 zod 檢查結構並套用預設值，欄位寫錯會直接丟出。
 * 正式建置不用這支：vite.config.ts 在 build 時把本檔換成 parse.prod.ts，
 * 內容改由建置時的 YAML 外掛先驗證並套好預設值（scripts/vite-plugin-yaml.ts），
 * 這樣 zod 與全部結構定義不會被打包進網站（任務 T123）。
 */
import {
  AxisPageSchema,
  GlossaryFileSchema,
  HintsFileSchema,
  PeopleFileSchema,
  UiSchema,
  WorldIntroSchema,
} from './schema.ts';

export const parseContent = {
  people: (raw: unknown) => PeopleFileSchema.parse(raw),
  glossary: (raw: unknown) => GlossaryFileSchema.parse(raw),
  hints: (raw: unknown) => HintsFileSchema.parse(raw),
  ui: (raw: unknown) => UiSchema.parse(raw),
  world: (raw: unknown) => WorldIntroSchema.parse(raw),
  page: (raw: unknown) => AxisPageSchema.parse(raw),
};
