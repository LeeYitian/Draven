import { expect, test, type Page } from '@playwright/test';
import { openPage } from './helpers';

// 方向鍵合約（contracts/state-and-events.md §2）的端對端驗證：
// ← → 推進事件、↑ ↓ 換頁；元件自己處理方向鍵時（光譜、比較滑桿）不可同時換事件。

const hash = (page: Page) => new URL(page.url()).hash;
const currentEvent = (page: Page) =>
  page.locator('[data-event][aria-current="step"]').getAttribute('data-event');

test.describe('方向鍵（舞台版）', () => {
  test('← → 推進事件並聚焦該事件；↑ ↓ 換頁，事件進度保留', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/axis/1');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await currentEvent(page)).toBe('3');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => hash(page)).toBe('#/axis/2');
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => hash(page)).toBe('#/axis/1');
    expect(await currentEvent(page)).toBe('3');
  });

  test('點節點聚焦後按 →：事件推進並改回事件焦點', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/axis/1');
    await page.locator('[data-node="fane"]').click();
    await expect(page.locator('[data-node="fane"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowRight');
    expect(await currentEvent(page)).toBe('2');
    await expect(page.locator('[data-node="fane"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('00 頁按 ← →：不動作（只有主軸頁有事件）', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/');
    await page.keyboard.press('ArrowRight');
    expect(hash(page)).toBe('#/');
    await expect(page.locator('main h1')).toHaveText('世界觀導讀');
  });

  test('元件自己處理方向鍵時不換事件：role=slider、[data-no-arrows]、input 取得焦點的情況', async ({
    page,
  }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/axis/1');
    // 邊界之辯光譜（Phase 8）完成前，用占位元件驗證合約
    await page.evaluate(() => {
      const make = (html: string) => {
        const holder = document.createElement('div');
        holder.innerHTML = html;
        holder.style.cssText = 'position:fixed;left:0;top:0;z-index:999';
        document.body.append(holder);
      };
      make('<div id="slider" role="slider" tabindex="0" aria-valuenow="50">s</div>');
      make('<div id="noarrows" data-no-arrows tabindex="0">n</div>');
      make('<input id="field" />');
    });
    for (const id of ['#slider', '#noarrows', '#field']) {
      await page.locator(id).focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      expect(await currentEvent(page), id).toBe('1');
      expect(hash(page), id).toBe('#/axis/1');
    }
    // 焦點移開後恢復
    await page.locator('#field').blur();
    await page.keyboard.press('ArrowRight');
    expect(await currentEvent(page)).toBe('2');
  });

  test('已被元件處理（preventDefault）的方向鍵，全域處理器略過', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/axis/1');
    await page.evaluate(() => {
      document.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'ArrowRight') e.preventDefault();
        },
        true,
      );
    });
    await page.keyboard.press('ArrowRight');
    expect(await currentEvent(page)).toBe('1');
  });

  test('帶修飾鍵的方向鍵不處理（Alt+← 是瀏覽器上一頁）', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/axis/1');
    await page.keyboard.press('Shift+ArrowRight');
    expect(await currentEvent(page)).toBe('1');
  });

  test('第一次進入主軸顯示方向鍵提示，3 秒後消失，重新整理後不再出現', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/axis/1');
    await expect(page.locator('[data-keys-hint]')).toBeVisible();
    await expect(page.locator('[data-keys-hint]')).toHaveCount(0, { timeout: 5000 });
    await page.reload();
    await page.locator('main').first().waitFor();
    await expect(page.locator('[data-keys-hint]')).toHaveCount(0);
  });
});

test.describe('方向鍵（流式版）', () => {
  test('不處理方向鍵：保留原生捲動，事件不變', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, '#/axis/1');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    expect(await currentEvent(page)).toBe('1');
    expect(hash(page)).toBe('#/axis/1');
  });
});
