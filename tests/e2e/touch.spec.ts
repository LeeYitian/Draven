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
    const box2 = (await viewport.boundingBox())!;
    const panBefore = await page.locator('[data-graph-layer]').evaluate((el) => getComputedStyle(el).transform);
    await swipe(page, box2.x + box2.width - 20, box2.y + box2.height - 20, -100);
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scrolled, 0); // 頁面不捲
    const panAfter = await page.locator('[data-graph-layer]').evaluate((el) => getComputedStyle(el).transform);
    expect(panAfter).not.toBe(panBefore); // 圖被平移
  });

  test('節點在手機版不能拖曳（點節點只聚焦）', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, '#/axis/1');
    const node = page.locator('[data-node="dravin"]');
    await node.scrollIntoViewIfNeeded();
    await node.tap();
    await expect(node).toHaveAttribute('aria-pressed', 'true');
    expect(await node.evaluate((el) => (el as HTMLElement).style.touchAction)).not.toBe('none');
  });
});
