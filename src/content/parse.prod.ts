/**
 * 正式建置用的 parse.ts 替身：資料在建置時已由 YAML 外掛驗證並套好預設值，這裡原樣回傳，
 * 所以 zod 不會進入網站的 JS。型別與 parse.ts 一致。
 */
import type { parseContent as devParse } from './parse.ts';

const same = <T>(raw: unknown) => raw as T;

export const parseContent: typeof devParse = {
  people: same,
  glossary: same,
  hints: same,
  ui: same,
  world: same,
  page: same,
};
