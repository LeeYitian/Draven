import { expect, test, type Page } from '@playwright/test';
import { openPage } from './helpers';

// 觸控模擬（手機版）：點選放置伏筆；關係圖放大前單指仍可捲動頁面（research R12）。

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

/** 用 CDP 送出單指滑動（Playwright 沒有內建滑動 API） */
async function swipe(page: Page, x: number, y: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  const point = (yy: number) => [{ x, y: yy, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(y) });
  const steps = 10;
  for (let i = 1; i <= steps; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(y + (dy * i) / steps),
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settleScroll(page);
}

/**
 * 關係圖視口內沒有節點、連線、按鈕，且離它們夠遠的空白處（取最下面、最右邊的一格）。
 * 節點在手機版可拖曳（touch-action:none），從節點上開始滑會變成拖節點而不是平移圖，所以平移要從空白處起手。
 * 「夠遠」是因為 Chrome 的觸控會自動吸附到附近（約 15–25px 內）的可點目標，貼著節點的縫隙也會被吸過去。
 */
async function emptySpot(page: Page): Promise<{ x: number; y: number }> {
  const spot = await page.evaluate(() => {
    const MARGIN = 36;
    const vp = document.querySelector('[data-graph-viewport]') as HTMLElement;
    const r = vp.getBoundingClientRect();
    const targets = [...vp.querySelectorAll('[data-node-wrapper], button, a')].map((el) =>
      el.getBoundingClientRect(),
    );
    const far = (x: number, y: number) =>
      targets.every(
        (t) => Math.hypot(Math.max(t.left - x, 0, x - t.right), Math.max(t.top - y, 0, y - t.bottom)) >= MARGIN,
      );
    const left = Math.max(r.left, 0) + 12;
    const right = Math.min(r.right, innerWidth) - 12;
    const top = Math.max(r.top, 0) + 130; // 上方留出滑動距離
    const bottom = Math.min(r.bottom, innerHeight) - 12;
    for (let y = bottom; y >= top; y -= 8)
      for (let x = right; x >= left; x -= 8) {
        const hit = document.elementFromPoint(x, y);
        if (hit && vp.contains(hit) && !hit.closest('[data-edge]') && far(x, y)) return { x, y };
      }
    return null;
  });
  if (!spot) throw new Error('關係圖視口內找不到空白處');
  return spot;
}

/** 滑動後會有慣性捲動；等 scrollY 連續穩定才繼續（慣性中的點擊只會被拿來停住捲動） */
async function settleScroll(page: Page) {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate(() => window.scrollY);
    if (now === last) return;
    last = now;
    await page.waitForTimeout(150);
  }
}

test.describe('伏筆：觸控點選放置', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'draven:hints',
        JSON.stringify({ owned: ['forgotten-gift', 'useful-to-witch', 'spirit-scent', 'cold-hand'], solved: [] }),
      ),
    );
    await openPage(page, { w: 390, h: 844 }, '#/axis/3');
    await page.locator('[data-event="6"]').tap();
    await expect(page.locator('[data-narrative-body] h2')).toHaveText('地底大洞');
  });

  test('點「伏筆」開托盤 → 點關鍵字（出現說明條）→ 點正確框格：鎖定並顯示說明', async ({ page }) => {
    await page.locator('nav').getByRole('button', { name: /^伏筆/ }).tap();
    await expect(page.locator('[data-hint-tray]')).toBeVisible();
    await page.locator('[data-hint-keyword="forgotten-gift"]').tap();
    await expect(page.locator('[data-hint-banner]')).toContainText('已選「忘了送的禮物」');
    await page.locator('[data-hint-slot="forgotten-gift"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-hint-slot="forgotten-gift"]')).toContainText('點這裡放入');
    await page.locator('[data-hint-slot="forgotten-gift"]').tap();
    await expect(page.locator('[data-hint-slot="forgotten-gift"]')).toHaveAttribute('data-state', 'solved');
    await expect(page.locator('[data-hint-explain="forgotten-gift"]')).toBeVisible();
    await expect(page.locator('[data-hint-banner]')).toHaveCount(0);
  });

  test('點錯框格：震動、顯示「不是這個」、關鍵字回托盤（說明條消失）', async ({ page }) => {
    await page.locator('nav').getByRole('button', { name: /^伏筆/ }).tap();
    await page.locator('[data-hint-keyword="cold-hand"]').tap();
    await page.locator('[data-hint-slot="spirit-scent"]').scrollIntoViewIfNeeded();
    await page.locator('[data-hint-slot="spirit-scent"]').tap();
    await expect(page.locator('[data-hint-slot="spirit-scent"]')).toContainText('不是這個');
    await expect(page.locator('[data-hint-keyword="cold-hand"]')).toHaveAttribute('data-state', 'idle');
    await expect(page.locator('[data-hint-banner]')).toHaveCount(0);
  });

  test('說明條上的「取消」清除選取', async ({ page }) => {
    await page.locator('nav').getByRole('button', { name: /^伏筆/ }).tap();
    await page.locator('[data-hint-keyword="cold-hand"]').tap();
    await page.locator('[data-hint-banner]').getByRole('button', { name: '取消' }).tap();
    await expect(page.locator('[data-hint-banner]')).toHaveCount(0);
    await expect(page.locator('[data-hint-keyword="cold-hand"]')).toHaveAttribute('data-state', 'idle');
  });

  test('觸控裝置不啟用拖曳（關鍵字滑動不會產生拖曳影像）', async ({ page }) => {
    await page.locator('nav').getByRole('button', { name: /^伏筆/ }).tap();
    const box = (await page.locator('[data-hint-keyword="cold-hand"]').boundingBox())!;
    await swipe(page, box.x + 20, box.y + 15, -120);
    await expect(page.locator('[data-hint-drag-image]')).toHaveCount(0);
  });

  test('註記列：2 列，上一行字距沒有被拉伸（display:block）', async ({ page }) => {
    const rows = page.locator('[data-note-row]');
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) {
      expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe('block');
      const box = (await row.boundingBox())!;
      expect(box.width).toBeGreaterThan(250); // 整列寬度
      expect(box.height).toBeGreaterThanOrEqual(50);
    }
  });
});

test.describe('關係圖的觸控捲動規則（R12）', () => {
  test('縮放 100%：單指在圖上垂直滑動 → 頁面捲動；放大後 → 改為平移、頁面不捲', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, '#/axis/1');
    const viewport = page.locator('[data-graph-viewport]');
    await viewport.scrollIntoViewIfNeeded();
    expect(await viewport.evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
    const before = await page.evaluate(() => window.scrollY);
    const box = (await viewport.boundingBox())!;
    // 在圖的空白處（右下角）向上滑
    await swipe(page, box.x + box.width - 20, box.y + box.height - 20, -180);
    const after = await page.evaluate(() => window.scrollY);
    expect(after - before).toBeGreaterThan(40); // 頁面有捲動

    // 用 CDP 送出的觸控序列之後，Playwright 的 tap 會被瀏覽器忽略（測試工具的限制，不是頁面的問題），
    // 所以這裡直接對按鈕送 click；按鈕本身的觸控點擊已在上面的「伏筆」測試以 tap 驗證過
    const zoomIn = page.getByRole('button', { name: '放大' });
    await zoomIn.dispatchEvent('click');
    await expect
      .poll(() => viewport.evaluate((el) => getComputedStyle(el).touchAction))
      .toBe('none');
    const scrolled = await page.evaluate(() => window.scrollY);
    // 放大後角落可能正好壓到節點（節點可拖曳，會變成拖節點），所以從空白處起手
    const start = await emptySpot(page);
    const panBefore = await page.locator('[data-graph-layer]').evaluate((el) => getComputedStyle(el).transform);
    await swipe(page, start.x, start.y, -100);
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scrolled, 0); // 頁面不捲
    const panAfter = await page.locator('[data-graph-layer]').evaluate((el) => getComputedStyle(el).transform);
    expect(panAfter).not.toBe(panBefore); // 圖被平移
  });

  test('節點在手機版可以拖曳：點節點仍是聚焦；按住拖動時節點跟著手指、頁面不捲，放開後彈回', async ({
    page,
  }) => {
    await openPage(page, { w: 390, h: 844 }, '#/axis/1');
    const node = page.locator('[data-node="dravin"]');
    await node.scrollIntoViewIfNeeded();
    // 可拖曳的節點把觸控交給自己（touch-action:none），不然手指一動就變成頁面捲動
    expect(await node.evaluate((el) => (el as HTMLElement).style.touchAction)).toBe('none');
    await node.tap();
    await expect(node).toHaveAttribute('aria-pressed', 'true');

    // 沒有點選的拖曳：用 CDP 送出觸控序列（放在最後，之後 Playwright 的 tap 會被瀏覽器忽略）
    const home = (await node.boundingBox())!;
    const scrollY = await page.evaluate(() => window.scrollY);
    const x = home.x + home.width / 2;
    const y = home.y + home.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const point = (xx: number, yy: number) => [{ x: xx, y: yy, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x, y) });
    for (let i = 1; i <= 10; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(x - (2 * i), y - 6 * i),
      });
    await expect
      .poll(async () => (await node.boundingBox())!.y, { message: '節點應跟著手指往上移' })
      .toBeLessThan(home.y - 30);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY); // 頁面沒有被捲動
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // 放開後以彈簧回到原位
    await expect
      .poll(async () => Math.abs((await node.boundingBox())!.y - home.y), { timeout: 3000 })
      .toBeLessThan(2);
  });
});
