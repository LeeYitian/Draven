import { defineConfig, devices } from '@playwright/test';

// e2e：固定視窗矩陣驗收版面與互動（contracts/layout-and-coordinates.md §7）。
// 以幾何斷言為主，不做像素截圖比對（字型與抗鋸齒差異大，易誤報）。
const PORT = 5180;

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
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
