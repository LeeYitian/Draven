import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// 憲章 I（文字與程式分離）與 III（設計代幣）的自動檢查：
//  - 程式碼裡不得出現中文字串字面值（文字一律放 src/content/**，用 t()／RichText 取用）
//  - 程式碼裡不得出現 #hex 色碼（顏色一律用 Tailwind 的設計代幣）
const CJK = '[\\u3400-\\u9fff\\uff00-\\uffef]';
const noHardCodedContent = [
  {
    selector: `Literal[value=/${CJK}/]`,
    message: '請勿在程式碼中寫死中文文字：改放 src/content/**（憲章 I），用 t() 或 RichText 取用。',
  },
  {
    selector: `TemplateElement[value.raw=/${CJK}/]`,
    message: '請勿在樣板字串中寫死中文文字：改放 src/content/**（憲章 I）。',
  },
  {
    selector: `JSXText[value=/${CJK}/]`,
    message: '請勿在 JSX 中寫死中文文字：改放 src/content/**（憲章 I）。',
  },
  {
    selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
    message: '請勿寫死 #hex 色碼：使用 Tailwind 設計代幣（例如 bg-accent-100）（憲章 III）。',
  },
];

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'playwright-report',
      'test-results',
      'design',
      'draft',
      'contents',
      'docs',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // 應用程式碼：套用「不得寫死文字／色碼」
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...noHardCodedContent] },
  },
  // 開發專用頁面（元件圖鑑 /__kit）與內容工具（解析／驗證的錯誤訊息是給作者看的診斷，不是畫面文字）：
  // 允許寫中文字串，但仍禁止 #hex 色碼
  {
    files: ['src/dev/**/*.{ts,tsx}', 'src/content/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', noHardCodedContent[3]] },
  },
  // 測試與腳本：允許中文字串（測試資料、錯誤訊息），Node 環境
  {
    files: ['tests/**/*.{ts,tsx}', 'scripts/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
