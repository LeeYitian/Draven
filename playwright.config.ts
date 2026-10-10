import { defineConfig, devices } from '@playwright/test';

// e2e：固定視窗矩陣驗收版面與互動（contracts/layout-and-coordinates.md §7）。
// 以幾何斷言為主，不做像素截圖比對（字型與抗鋸齒差異大，易誤報）。
// E2E_PREVIEW=1（npm run e2e:prod）：改對打包後的網站（vite preview）跑，其餘與開發模式相同
const PREVIEW = !!process.env.E2E_PREVIEW;
const PORT = PREVIEW ? 4180 : 5180;
// 好讀版的 e2e 不依賴本機原文：網址由測試用 page.route 攔截並回傳假資料（tests/e2e/reader.spec.ts）
const NOVEL_ENV = { VITE_NOVEL_URL: 'http://novel.e2e.test' };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // 第一次載入時 Vite 要即時編譯，並行跑時比較慢
  timeout: 45_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: PREVIEW
      ? `npm run preview -- --port ${PORT} --strictPort`
      : `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // preview 要用和建置時一樣的 base（e2e-prod 建置時設 VITE_BASE=/），否則會去 /Draven/ 找檔案
    env: PREVIEW ? { VITE_BASE: '/', ...NOVEL_ENV } : NOVEL_ENV,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
