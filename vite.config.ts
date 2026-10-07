import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { yamlPlugin } from './scripts/vite-plugin-yaml.ts';

// GitHub Pages 的網址是 https://leeyitian.github.io/Draven/，所以正式建置的 base 必須是 '/Draven/'。
// 倉庫改名或換自訂網域時，只需要改這一個常數（或用環境變數 VITE_BASE 覆寫）。
const PRODUCTION_BASE = '/Draven/';

export default defineConfig(({ mode, command }) => ({
  base: process.env.VITE_BASE ?? (mode === 'production' ? PRODUCTION_BASE : '/'),
  plugins: [react(), tailwindcss(), yamlPlugin()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // 正式建置：內容在建置時已由 YAML 外掛驗證，網站不需要 zod（T123）
      ...(command === 'build'
        ? [
            {
              find: /^\.\/parse\.ts$/,
              replacement: fileURLToPath(new URL('./src/content/parse.prod.ts', import.meta.url)),
            },
          ]
        : []),
    ],
  },
}));
