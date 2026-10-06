// 內容檔以 YAML 撰寫，載入後的型別由 src/content/schema.ts（zod）驗證並收斂。
declare module '*.yaml' {
  const data: unknown;
  export default data;
}
