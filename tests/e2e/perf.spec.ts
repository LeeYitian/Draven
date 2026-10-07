import { expect, test, type Page } from '@playwright/test';
import { openPage } from './helpers';

// Phase 9 · T123：拖曳與畫線的流暢度。
// 在無頭 Chromium（軟體繪圖、沒有 GPU）量 requestAnimationFrame 的平均幀率，門檻訂得很寬（≥ 30 fps）：
// 目的是抓「某次改動讓互動掉到幾 fps」這種嚴重退步，不是量真機的精確數字（SC-005 的 50 fps 要在真機的 Chrome Performance 量）。

const MIN_FPS = 30;

/** 在 body() 執行期間量 rAF 的平均幀率 */
async function measureFps(page: Page, body: () => Promise<void>): Promise<number> {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__frames = [];
    w.__stop = false;
    const tick = (t: number) => {
      w.__frames.push(t);
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await body();
  return page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    const f = w.__frames;
    return f.length < 2 ? 0 : ((f.length - 1) * 1000) / (f[f.length - 1]! - f[0]!);
  });
}

test.describe('互動流暢度（無頭 Chromium 的粗略下限）', () => {
  test('01：連按 → 推進事件，關係線一條一條畫出', async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, '#/axis/1');
    await page.waitForTimeout(1500);
    const fps = await measureFps(page, async () => {
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(700);
      }
    });
    console.log('事件推進＋畫線 fps ≈', fps.toFixed(0));
    expect(fps).toBeGreaterThanOrEqual(MIN_FPS);
  });

  test('01：拖曳關係圖節點', async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, '#/axis/1');
    await page.locator('[data-event="6"]').click();
    await page.waitForTimeout(2500);
    const node = (await page.locator('[data-node="dravin"]').boundingBox())!;
    const fps = await measureFps(page, async () => {
      await page.mouse.move(node.x + node.width / 2, node.y + node.height / 2);
      await page.mouse.down();
      for (let i = 0; i < 60; i++) {
        await page.mouse.move(
          node.x + node.width / 2 + Math.sin(i / 6) * 90,
          node.y + node.height / 2 + i * 2,
        );
      }
      await page.mouse.up();
      await page.waitForTimeout(500);
    });
    console.log('拖曳節點 fps ≈', fps.toFixed(0));
    expect(fps).toBeGreaterThanOrEqual(MIN_FPS);
  });

  test('02：拖曳比較滑桿（整頁紙色、暈影與 sepia 即時跟著變）', async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, '#/axis/2');
    const h = (await page.locator('[data-compare-handle]').boundingBox())!;
    const t = (await page.locator('[data-compare-track]').boundingBox())!;
    const fps = await measureFps(page, async () => {
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
      await page.mouse.down();
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i <= 40; i++)
          await page.mouse.move(t.x + t.width * (0.2 + (0.6 * i) / 40), h.y + 10);
        for (let i = 40; i >= 0; i--)
          await page.mouse.move(t.x + t.width * (0.2 + (0.6 * i) / 40), h.y + 10);
      }
      await page.mouse.up();
    });
    console.log('拖曳比較滑桿 fps ≈', fps.toFixed(0));
    expect(fps).toBeGreaterThanOrEqual(MIN_FPS);
  });

  test('03：收合與展開三界（300ms 動畫期間節點與連線每格重算）', async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, '#/axis/3');
    await page.locator('[data-event="7"]').click();
    await page.waitForTimeout(2500);
    const fps = await measureFps(page, async () => {
      for (let i = 0; i < 4; i++) {
        await page.getByRole('button', { name: '只看地底' }).click();
        await page.waitForTimeout(450);
      }
    });
    console.log('收合三界 fps ≈', fps.toFixed(0));
    expect(fps).toBeGreaterThanOrEqual(MIN_FPS);
  });
});
