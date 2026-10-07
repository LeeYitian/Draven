import { expect, test, type Page } from '@playwright/test';
import {
  FLOW_SIZES,
  STAGE_SIZES,
  intersects,
  layoutFacts,
  nodeRects,
  openPage,
  stageOverflow,
} from './helpers';
import { AXIS_FRAME } from '../../src/lib/stage-metrics';

// US6b：02 比較滑桿與時間感、分區關係圖。

const AXIS2 = '#/axis/2';
const handle = (page: Page) => page.locator('[data-compare-handle]');
const track = (page: Page) => page.locator('[data-compare-track]');
const value = async (page: Page) => Number(await handle(page).getAttribute('aria-valuenow'));
const rootAge = (page: Page) =>
  page.evaluate(() => document.documentElement.style.getPropertyValue('--age'));

/** 把手中心在軌道上的位置（0–100） */
async function handlePercent(page: Page) {
  const h = (await handle(page).boundingBox())!;
  const t = (await track(page).boundingBox())!;
  return ((h.x + h.width / 2 - t.x) / t.width) * 100;
}

async function dragHandleTo(page: Page, percent: number, release = true) {
  const h = (await handle(page).boundingBox())!;
  const t = (await track(page).boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + (t.width * percent) / 100, h.y + h.height / 2, { steps: 10 });
  if (release) await page.mouse.up();
}

const bg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('[data-stage]')!).backgroundColor);

test.describe('舞台版 02：版面', () => {
  test('下方區：敘述＋關係圖 290，比較滑桿 1288×147 橫跨兩欄', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS2);
    const g = (await page.locator('[data-graph-viewport]').boundingBox())!;
    const c = (await page.locator('[data-compare]').boundingBox())!;
    const main = (await page.locator('[data-page-main]').boundingBox())!;
    expect(Math.round(g.height)).toBe(AXIS_FRAME.lowerWithCompare.graphHeight);
    expect(Math.round(g.width)).toBe(628);
    expect(Math.round(c.width)).toBe(1288);
    expect(Math.round(c.height)).toBe(147);
    expect(c.y).toBeGreaterThan(g.y + g.height); // 滑桿在關係圖之下
    expect(c.x).toBeLessThan(g.x); // 橫跨兩欄：左緣在關係圖左邊
    expect(Math.abs(c.x + c.width - (g.x + g.width))).toBeLessThanOrEqual(1);
    expect(c.y + c.height).toBeLessThanOrEqual(main.y + main.height);
  });

  for (const size of STAGE_SIZES) {
    test(`${size.w}×${size.h}：6 個事件逐一檢查——沒有溢出舞台、節點互不重疊、分區標籤不壓到節點`, async ({
      page,
    }) => {
      await openPage(page, size, AXIS2);
      for (let n = 1; n <= 6; n++) {
        await page.locator('[data-event="' + n + '"]').click();
        await expect(page.locator('[data-narrative-body] h2')).not.toBeEmpty();
        expect(await stageOverflow(page), '事件 ' + n).toEqual([]);
      }
      const rects = await nodeRects(page);
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++)
          expect(intersects(rects[i]!, rects[j]!, 2), rects[i]!.id + '×' + rects[j]!.id).toBe(
            false,
          );
      const labels = await page
        .locator('[data-zone-label]')
        .evaluateAll((els) => els.map((e) => e.firstChild).map(() => null)); // 取得數量即可
      expect(labels).toHaveLength(2);
      // 層名文字範圍 vs 節點
      const textBoxes = await page.locator('[data-zone-label]').evaluateAll((els) =>
        els.map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }),
      );
      for (const t of textBoxes) for (const n of rects) expect(intersects(t, n), n.id).toBe(false);
      // 比較滑桿的兩欄文字都在滑桿框內
      const c = (await page.locator('[data-compare]').boundingBox())!;
      for (const side of ['left', 'right']) {
        const col = (await page.locator('[data-side="' + side + '"]').boundingBox())!;
        expect(col.y + col.height).toBeLessThanOrEqual(c.y + c.height + 0.5);
      }
    });
  }
});

test.describe('舞台版 02：比較滑桿', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, AXIS2);
  });

  test('預設 50／50；把手在中線；乾淨紙色（沒有 age 標記）', async ({ page }) => {
    expect(await value(page)).toBe(50);
    expect(Math.abs((await handlePercent(page)) - 50)).toBeLessThan(0.5);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-aged'))).toBe(
      false,
    );
  });

  test('拖到 72%：寬側 20px、窄側 opacity 0.35 且只剩首句；放開不回彈', async ({ page }) => {
    await dragHandleTo(page, 72);
    expect(Math.abs((await handlePercent(page)) - 72)).toBeLessThan(1.5);
    await expect(page.locator('[data-side="left"]')).toHaveAttribute('data-emphasis', 'wide');
    await expect(page.locator('[data-side="right"]')).toHaveAttribute('data-emphasis', 'narrow');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const q = document.querySelector('[data-side="left"] .compare__quote')!;
          return parseFloat(getComputedStyle(q).fontSize);
        }),
      )
      .toBeGreaterThanOrEqual(19.9);
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.querySelector('[data-side="right"]')!).opacity,
        ),
      )
      .toBe('0.35');
    await expect(page.locator('[data-side="right"]')).toContainText('⋯');
    await page.waitForTimeout(500);
    expect(Math.abs((await handlePercent(page)) - 72)).toBeLessThan(1.5); // 不回彈
  });

  test('拖出兩端：夾在 20–80', async ({ page }) => {
    await dragHandleTo(page, 99);
    expect(await value(page)).toBe(80);
    await dragHandleTo(page, 1);
    expect(await value(page)).toBe(20);
  });

  test('← → 每次 10%；不換事件、不換頁；離開把手後 ← → 才換事件', async ({ page }) => {
    await handle(page).focus();
    await page.keyboard.press('ArrowRight');
    expect(await value(page)).toBe(60);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect(await value(page)).toBe(40);
    await expect(page.locator('[data-event][aria-current="step"]')).toHaveAttribute(
      'data-event',
      '1',
    );
    expect(page.url()).toContain('#/axis/2');
    await handle(page).blur();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-event][aria-current="step"]')).toHaveAttribute(
      'data-event',
      '2',
    );
  });

  test('點文字區不會移動把手（只有把手與中線可拖）', async ({ page }) => {
    const t = (await track(page).boundingBox())!;
    await page.mouse.click(t.x + t.width * 0.8, t.y + 60);
    expect(await value(page)).toBe(50);
  });

  test('兩欄引言裡的人名可開 Popover', async ({ page }) => {
    await page.locator('[data-side="left"] [role="button"]').first().click();
    await expect(page.locator('[data-popover]')).toBeVisible();
  });
});

test.describe('舞台版 02：時間感', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, AXIS2);
  });

  test('往左與預設：沒有任何變化；往右：紙色變黃、出現暈影、內容 sepia', async ({ page }) => {
    const clean = await bg(page);
    await dragHandleTo(page, 30);
    expect(await bg(page)).toBe(clean);
    expect(await page.locator('.age-vignette').evaluate((e) => getComputedStyle(e).display)).toBe(
      'none',
    );
    expect(
      await page
        .locator('[data-page-main] > div')
        .first()
        .evaluate((e) => getComputedStyle(e).filter),
    ).toBe('none');

    await dragHandleTo(page, 65);
    expect(Number(await rootAge(page))).toBeCloseTo(0.5, 1);
    const mid = await bg(page);
    expect(mid).not.toBe(clean);
    expect(await page.locator('.age-vignette').evaluate((e) => getComputedStyle(e).display)).toBe(
      'block',
    );

    await dragHandleTo(page, 80);
    expect(await rootAge(page)).toBe('1');
    expect(
      await page
        .locator('[data-page-main] > div')
        .first()
        .evaluate((e) => getComputedStyle(e).filter),
    ).toBe('sepia(0.35)');
    expect(await bg(page)).not.toBe(mid); // 比 65% 更黃
  });

  test('側欄不套用 sepia（只受紙色與暈影影響）；Popover 也不套用', async ({ page }) => {
    await dragHandleTo(page, 80);
    expect(
      await page
        .locator('nav')
        .first()
        .evaluate((e) => getComputedStyle(e).filter),
    ).toBe('none');
    // 暈影在 main 之外、側欄與頁面之上、Popover 之下
    const z = await page.evaluate(() => ({
      vignette: Number(getComputedStyle(document.querySelector('.age-vignette')!).zIndex),
    }));
    expect(z.vignette).toBe(15);
    await page.locator('[data-side="left"] [role="button"]').first().click();
    await expect(page.locator('[data-popover]')).toBeVisible();
    expect(await page.locator('[data-popover]').evaluate((e) => getComputedStyle(e).filter)).toBe(
      'none',
    );
  });

  test('在 80% 的陳舊紙色上，內文仍夠讀（對比 ≥ 4.5:1，含 sepia 濾鏡後）', async ({ page }) => {
    await dragHandleTo(page, 80);
    const ratios = await page.evaluate(() => {
      // color-mix() 的計算值是 oklch(…) 之類的字串；借 canvas 轉成 sRGB 的 0–255
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const parse = (c: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
      };
      const ratio = (fg: number[], bgc: number[]) => {
        const [a, b] = [lum(fg), lum(bgc)].sort((x, y) => y - x);
        return (a! + 0.05) / (b! + 0.05);
      };
      const paper = parse(
        getComputedStyle(document.querySelector('[data-stage]')!).backgroundColor,
      );
      const body = parse(
        getComputedStyle(document.querySelector('[data-narrative-body] p')!).color,
      );
      // sepia 會讓文字略偏暖，這裡用 sepia(0.35) 的近似矩陣再算一次
      const sep = (c: number[]) => {
        const [r, g, b] = c as [number, number, number];
        const k = 0.35;
        return [
          (0.393 * r + 0.769 * g + 0.189 * b) * k + r * (1 - k),
          (0.349 * r + 0.686 * g + 0.168 * b) * k + g * (1 - k),
          (0.272 * r + 0.534 * g + 0.131 * b) * k + b * (1 - k),
        ];
      };
      return { body: ratio(sep(body), sep(paper)) };
    });
    expect(ratios.body).toBeGreaterThanOrEqual(4.5);
  });

  test('離開 02（換到 03 或 01）：--age、標記、暈影全部清除，紙色恢復', async ({ page }) => {
    const clean = await bg(page);
    await dragHandleTo(page, 80);
    expect(await bg(page)).not.toBe(clean);
    await page.keyboard.press('ArrowDown'); // 換到 03（焦點在把手上時 ↑↓ 不換頁，先讓它失焦）
    await handle(page).blur();
    await page.keyboard.press('ArrowDown');
    await expect(page).toHaveURL(/#\/axis\/3/);
    expect(await rootAge(page)).toBe('');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-aged'))).toBe(
      false,
    );
    expect(await bg(page)).toBe(clean);
    await page.keyboard.press('ArrowUp');
    await expect(page).toHaveURL(/#\/axis\/2/);
    expect(await value(page)).toBe(50); // 回來時把手回到中間
    expect(await rootAge(page)).toBe('0');
  });
});

test.describe('流式版 02', () => {
  for (const size of FLOW_SIZES) {
    test(`${size.w}×${size.h}：比較滑桿全寬並排、窄側 ≥ 96px、拉到最右 age=1；沒有橫向捲動`, async ({
      page,
    }) => {
      await openPage(page, size, AXIS2);
      expect((await layoutFacts(page)).layout).toBe('flow');
      const compare = page.locator('[data-compare]');
      await compare.scrollIntoViewIfNeeded();
      const c = (await compare.boundingBox())!;
      const main = (await page.locator('main').first().boundingBox())!;
      expect(Math.abs(c.width - main.width)).toBeLessThanOrEqual(1); // 全寬 100%
      const left = (await page.locator('[data-side="left"]').boundingBox())!;
      const right = (await page.locator('[data-side="right"]').boundingBox())!;
      expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1); // 並排、不堆疊
      expect(left.x).toBeLessThan(right.x);

      await handle(page).focus();
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
      expect(await rootAge(page)).toBe('1');
      const r2 = (await page.locator('[data-side="right"]').boundingBox())!;
      expect(r2.width).toBeGreaterThanOrEqual(95.5); // 窄側 ≥ 96
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
      const l2 = (await page.locator('[data-side="left"]').boundingBox())!;
      expect(l2.width).toBeGreaterThanOrEqual(95.5);
      expect(Number(await rootAge(page))).toBe(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
    });
  }

  test('暈影在流式版是 position: fixed；容器 touch-action: pan-y、把手 none', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS2);
    expect(await page.locator('.age-vignette').evaluate((e) => getComputedStyle(e).position)).toBe(
      'fixed',
    );
    expect(await track(page).evaluate((e) => getComputedStyle(e).touchAction)).toBe('pan-y');
    expect(await handle(page).evaluate((e) => getComputedStyle(e).touchAction)).toBe('none');
    // 流式版：節點互不重疊、分區標籤不壓到節點
    const rects = await nodeRects(page);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(intersects(rects[i]!, rects[j]!, 2), rects[i]!.id + '×' + rects[j]!.id).toBe(false);
  });

  test('拖曳把手改變時間感：往右時紙色變黃', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS2);
    const flowBg = () =>
      page.evaluate(() => getComputedStyle(document.querySelector('[data-flow]')!).backgroundColor);
    const clean = await flowBg();
    await handle(page).scrollIntoViewIfNeeded();
    const h = (await handle(page).boundingBox())!;
    const t = (await track(page).boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width * 0.95, h.y + h.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(await rootAge(page)).toBe('1');
    expect(await flowBg()).not.toBe(clean);
  });
});

test.describe('02 觸控', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('在滑桿的文字區垂直滑動會捲動頁面（不被當成拖曳）', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS2);
    await page.locator('[data-compare]').scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    const c = (await page.locator('[data-side="left"]').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const x = c.x + c.width / 2;
    const y0 = c.y + 30;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: y0, id: 1 }],
    });
    for (let i = 1; i <= 10; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y0 + i * 12, id: 1 }],
      });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(before - 20); // 往下滑＝頁面往上捲（這一頁已在最底，不能再往下捲）
    expect(await value(page)).toBe(50); // 把手沒動
  });
});
