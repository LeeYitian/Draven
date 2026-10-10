// 對「正式建置」跑 e2e（T123、T127）：確認打包後的網站（不含 zod、內容在建置時驗證）行為與開發模式一致。
// 用法：npm run e2e:prod [playwright 參數…]，例如 npm run e2e:prod -- tests/e2e/navigation.spec.ts
import { spawnSync } from 'node:child_process';

const run = (command: string, env: Record<string, string> = {}) => {
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// base 設成 '/'：e2e 的網址都是 /#/…；正式站的 /Draven/ 前綴由 vite.config.ts 的 base 負責，與這裡驗證的行為無關
run('npm run build', { VITE_BASE: '/', VITE_NOVEL_URL: 'http://novel.e2e.test' });
run(`npx playwright test ${process.argv.slice(2).join(' ')}`, { E2E_PREVIEW: '1' });
