import { expect, test } from '@playwright/test';
import { FLOW_SIZES, STAGE_SIZES, layoutFacts, openPage, stageOverflow } from './helpers';

// SC-001：視窗矩陣下 00 無水平捲軸、無內容被裁切；舞台版每頁一屏放得下。

test.describe('舞台版（桌機矩陣）', () => {
  for (const size of STAGE_SIZES) {
    test(`${size.w}×${size.h}：舞台版、倍率與 compact 正確，一屏放得下、無水平捲軸`, async ({
      page,
    }) => {
      await openPage(page, size);
      const facts = await layoutFacts(page);
      expect(facts.layout).toBe('stage');
      expect(facts.compact).toBe(size.compact);
      expect(facts.scale).toBeCloseTo(Math.min(size.w / 1440, size.h / 720), 2);
      expect(facts.horizontalScroll).toBe(false);

      // 舞台置中：左右（或上下）留白相等，並貼齊較緊的那一邊
      const box = await page.locator('[data-stage]').boundingBox();
      expect(box!.x + box!.width / 2).toBeCloseTo(size.w / 2, 0);
      expect(box!.y + box!.height / 2).toBeCloseTo(size.h / 2, 0);

      // 任何元素都不超出 1440×720 舞台
      expect(await stageOverflow(page)).toEqual([]);
    });

    test(`${size.w}×${size.h}：00 的三欄文字沒有被裁切（欄內容 ≤ 欄高）`, async ({ page }) => {
      await openPage(page, size);
      const clipped = await page.evaluate(() => {
        const main = document.querySelector('main')!;
        return [...main.children].map((col) => ({
          scroll: col.scrollHeight,
          client: col.clientHeight,
        }));
      });
      for (const col of clipped) expect(col.scroll).toBeLessThanOrEqual(col.client + 1);
    });
  }

  test('字級補償：1280×600 輔助字 14、內文 17；1440×795 為 13／16', async ({ page }) => {
    await openPage(page, { w: 1280, h: 600 });
    const small = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return [s.getPropertyValue('--fs-aux'), s.getPropertyValue('--fs-body')];
    });
    expect(small).toEqual(['14px', '17px']);
    await openPage(page, { w: 1440, h: 795 });
    const normal = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return [s.getPropertyValue('--fs-aux'), s.getPropertyValue('--fs-body')];
    });
    expect(normal).toEqual(['13px', '16px']);
  });
});

test.describe('流式版（手機／平板／矮視窗矩陣）', () => {
  for (const size of FLOW_SIZES) {
    test(`${size.w}×${size.h}：流式版、無水平捲軸、內容不超出視窗寬`, async ({ page }) => {
      await openPage(page, size);
      const facts = await layoutFacts(page);
      expect(facts.layout).toBe('flow');
      expect(facts.compact).toBe(false);
      expect(facts.horizontalScroll).toBe(false);

      const wide = await page.evaluate(() => {
        const vw = window.innerWidth;
        return [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed';
          })
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 30)}`);
      });
      expect(wide).toEqual([]);
    });

    test(`${size.w}×${size.h}：底部導覽列固定在視窗底部，容器最大寬 640 置中`, async ({ page }) => {
      await openPage(page, size);
      const nav = await page.locator('nav').boundingBox();
      expect(nav!.y + nav!.height).toBeCloseTo(size.h, 0);
      const flow = await page.locator('[data-flow]').boundingBox();
      expect(flow!.width).toBeLessThanOrEqual(640 + 1);
      expect(flow!.width).toBeCloseTo(Math.min(size.w, 640), 0);
    });
  }
});

test.describe('版型切換門檻', () => {
  test('寬 1037 → 舞台版；寬 1023 → 流式版', async ({ page }) => {
    await openPage(page, { w: 1037, h: 720 });
    expect((await layoutFacts(page)).layout).toBe('stage');
    await openPage(page, { w: 1023, h: 800 });
    expect((await layoutFacts(page)).layout).toBe('flow');
  });

  test('直立（高 > 寬）一律流式；倍率 < 0.72 的矮視窗也是流式', async ({ page }) => {
    await openPage(page, { w: 1100, h: 1200 });
    expect((await layoutFacts(page)).layout).toBe('flow');
    await openPage(page, { w: 1200, h: 500 });
    expect((await layoutFacts(page)).layout).toBe('flow');
  });

  test('視窗縮放跨越門檻：即時切換版型並保留目前頁面', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/axis/2');
    expect((await layoutFacts(page)).layout).toBe('stage');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await layoutFacts(page)).layout).toBe('flow');
    expect(new URL(page.url()).hash).toBe('#/axis/2');
    await page.setViewportSize({ width: 1440, height: 720 });
    await expect.poll(async () => (await layoutFacts(page)).layout).toBe('stage');
    expect(new URL(page.url()).hash).toBe('#/axis/2');
  });
});
