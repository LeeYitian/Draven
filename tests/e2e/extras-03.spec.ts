import { expect, test, type Page } from '@playwright/test';
import { FLOW_SIZES, STAGE_SIZES, intersects, nodeRects, openPage, stageOverflow } from './helpers';
import { AXIS_FRAME, GRAPH_BARS } from '../../src/lib/stage-metrics';

// US6c：03 三界分層（收合、跨層線改連層頭）與兩則引言。

const AXIS3 = '#/axis/3';
const head = (page: Page, id: string) => page.locator('[data-layer-head="' + id + '"]');
const band = (page: Page, id: string) => page.locator('[data-layer="' + id + '"]');

/** 畫布本地座標下的帶狀區域高度（扣掉舞台縮放與關係圖縮放） */
async function bandHeight(page: Page, id: string) {
  return band(page, id).evaluate((el) => (el as HTMLElement).offsetHeight);
}
// 三層高度要在同一個瞬間一起讀（動畫進行中分開讀會讀到不同時間點）
const bandHeights = (page: Page) =>
  page.evaluate(() =>
    ['human', 'border', 'otherworld'].map(
      (id) => (document.querySelector('[data-layer="' + id + '"]') as HTMLElement).offsetHeight,
    ),
  );
const hiddenNodes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-node][data-hidden]')]
      .map((e) => e.dataset.node!)
      .sort(),
  );
// offsetHeight 是四捨五入的整數，三層各自捨入後的總和可能差 1–2
const expectNear = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2);
// 畫布高度＝圖框高度 − 上下功能列
const CANVAS_HEIGHT = AXIS_FRAME.lower.height - GRAPH_BARS.top - GRAPH_BARS.bottom;
const settle = (page: Page) => page.waitForTimeout(450); // 收合動畫 300ms

test.describe('舞台版 03：三界分層', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, AXIS3);
    await page.locator('[data-event="7"]').click(); // 事件 07 起所有線都畫出
    await page.waitForTimeout(2500);
  });

  test('三個層頭：層名＋人數；層高加起來等於畫布高度', async ({ page }) => {
    await expect(head(page, 'human')).toContainText('人間 · 6');
    await expect(head(page, 'border')).toContainText('地底交界 · 4');
    await expect(head(page, 'otherworld')).toContainText('異界 · 1');
    const heights = await bandHeights(page);
    expectNear(
      heights.reduce((a, b) => a + b, 0),
      CANVAS_HEIGHT,
    );
    for (const id of ['human', 'border', 'otherworld'])
      await expect(head(page, id)).toHaveAttribute('aria-expanded', 'true');
  });

  test('點層頭收合：該層高 46、節點隱藏、其他層補滿、總高不變；再點展開', async ({ page }) => {
    await head(page, 'otherworld').click();
    await settle(page);
    await expect(head(page, 'otherworld')).toHaveAttribute('aria-expanded', 'false');
    await expect(head(page, 'otherworld')).toContainText('異界 · 1 · 已收合');
    const heights = await bandHeights(page);
    expect(heights[2]).toBe(46);
    expectNear(
      heights.reduce((a, b) => a + b, 0),
      CANVAS_HEIGHT,
    );
    expect(await hiddenNodes(page)).toEqual(['snake-god']);
    // 其他層變高
    expect(heights[0]).toBeGreaterThan(0);

    await head(page, 'otherworld').click();
    await settle(page);
    expect(await hiddenNodes(page)).toEqual([]);
    expect((await bandHeights(page))[2]).toBeGreaterThan(46);
  });

  test('跨層的線：一端在已收合層 → 改連到層頭邊緣，終點加小圓點；兩端都收合 → 不畫', async ({
    page,
  }) => {
    // 收合「異界」：shadow-snake、bishop-snake 兩條線各剩一個圓點
    await head(page, 'otherworld').click();
    await settle(page);
    for (const id of ['shadow-snake', 'bishop-snake']) {
      await expect(page.locator('[data-edge="' + id + '"] .edge__dot')).toHaveCount(1);
      await expect(page.locator('[data-edge="' + id + '"]')).not.toHaveAttribute('data-hidden');
    }
    // 圓點落在層頭的邊緣（異界帶狀區域的上緣）
    const check = await page.evaluate(() => {
      const dot = document.querySelector(
        '[data-edge="shadow-snake"] .edge__dot',
      ) as SVGCircleElement;
      const layer = document.querySelector('[data-layer="otherworld"]') as HTMLElement;
      return {
        cy: dot.cy.baseVal.value,
        top: layer.offsetTop,
        bottom: layer.offsetTop + layer.offsetHeight,
      };
    });
    expect(Math.abs(check.cy - check.top) < 4 || Math.abs(check.cy - check.bottom) < 4).toBe(true);
    // 一般的線沒有圓點
    await expect(page.locator('[data-edge="elian-shadow"] .edge__dot')).toHaveCount(0);

    // 再收合「地底交界」：shadow-snake 兩端都收合 → 隱藏
    await head(page, 'border').click();
    await settle(page);
    await expect(page.locator('[data-edge="shadow-snake"]')).toHaveAttribute('data-hidden');
  });

  test('收合中的層：節點不可聚焦（aria-hidden／tabindex=-1）', async ({ page }) => {
    await head(page, 'human').click({ position: { x: 120, y: 14 } });
    await settle(page);
    const node = page.locator('[data-node="dravin"]');
    await expect(node).toHaveAttribute('aria-hidden', 'true');
    await expect(node).toHaveAttribute('tabindex', '-1');
  });

  test('動畫中途每一格都是合法版面：節點與連線一路跟著動（層高加起來始終 457）', async ({
    page,
  }) => {
    await head(page, 'human').click({ position: { x: 120, y: 14 } });
    const samples: number[] = [];
    for (let i = 0; i < 6; i++) {
      samples.push((await bandHeights(page)).reduce((a, b) => a + b, 0));
      await page.waitForTimeout(40);
    }
    for (const s of samples) expectNear(s, CANVAS_HEIGHT);
  });

  test('同一對人物的兩條相反的線（傳授召喚儀式／扣留）分在兩側、不疊在一起', async ({ page }) => {
    const lines = await page.evaluate(() => {
      const get = (id: string) => {
        const l = document.querySelector('[data-edge="' + id + '"] .edge__line') as SVGLineElement;
        return {
          x1: l.x1.baseVal.value,
          y1: l.y1.baseVal.value,
          x2: l.x2.baseVal.value,
          y2: l.y2.baseVal.value,
        };
      };
      return { a: get('lioran-bishop'), b: get('bishop-lioran') };
    });
    const dist = Math.hypot(lines.a.x1 - lines.b.x2, lines.a.y1 - lines.b.y2);
    expect(dist).toBeGreaterThan(8); // 兩條線的距離 ≈ 14（各偏 7）
  });
});

test.describe('舞台版 03：引言', () => {
  test('兩則引言只在事件 07 出現（showFromEvent）；說話者沒被追蹤就沒有書籤', async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, AXIS3);
    await expect(page.locator('[data-quote]')).toHaveCount(0);
    await page.locator('[data-event="7"]').click();
    await expect(page.locator('[data-quote]')).toHaveCount(2);
    await expect(page.locator('[data-quote="promise"]')).toContainText(
      '我會讓陛下把教會的歷史公諸於世',
    );
    await expect(page.locator('[data-quote="trade-off"]')).toContainText('還沒學會取捨');
    await expect(page.locator('[data-quote] .bookmark')).toHaveCount(0);
  });

  test('追蹤艾利安：兩則引言左上掛書籤；事件 07 的引言標示為目前', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('draven:tracked', JSON.stringify('elian')));
    await openPage(page, { w: 1440, h: 795 }, AXIS3);
    await page.locator('[data-event="7"]').click();
    await expect(page.locator('[data-quote] .bookmark')).toHaveCount(2);
    await expect(page.locator('[data-quote][data-current]')).toHaveCount(2);
  });

  test('說話者名字可開 Popover', async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, AXIS3);
    await page.locator('[data-event="7"]').click();
    await page.locator('[data-quote="promise"] .quote__who [role="button"]').click();
    await expect(page.locator('[data-popover]')).toBeVisible();
  });

  for (const size of STAGE_SIZES) {
    test(
      size.w +
        '×' +
        size.h +
        '：7 個事件逐一檢查——沒有溢出舞台；引言區在左欄內、不蓋到敘述與關係圖',
      async ({ page }) => {
        await openPage(page, size, AXIS3);
        for (let n = 1; n <= 7; n++) {
          await page.locator('[data-event="' + n + '"]').click();
          await expect(page.locator('[data-narrative-body] h2')).not.toBeEmpty();
          await page.waitForTimeout(250);
          expect(await stageOverflow(page), '事件 ' + n).toEqual([]);
          if (n < 7) {
            await expect(page.locator('[data-quotes]'), '事件 ' + n + ' 還沒有引言').toHaveCount(0);
            continue;
          }
          const q = (await page.locator('[data-quotes]').boundingBox())!;
          const nar = (await page.locator('[data-narrative-body]').boundingBox())!;
          const g = (await page.locator('[data-graph-frame]').boundingBox())!;
          expect(q.y, '引言區在敘述之下（事件 ' + n + '）').toBeGreaterThanOrEqual(
            nar.y + nar.height - 1,
          );
          expect(q.x + q.width).toBeLessThanOrEqual(g.x);
          // 引言區貼著下方區底部，不會超出
          expect(q.y + q.height).toBeLessThanOrEqual(g.y + g.height + 1);
        }
        const rects = await nodeRects(page);
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++)
            expect(intersects(rects[i]!, rects[j]!, 2), rects[i]!.id + '×' + rects[j]!.id).toBe(
              false,
            );
      },
    );
  }

  test('敘述很長時引言區可在區塊內捲動（overflow-y: auto）', async ({ page }) => {
    await openPage(page, { w: 1366, h: 640 }, AXIS3);
    await page.locator('[data-event="7"]').click();
    await page.waitForTimeout(300);
    const info = await page.locator('[data-quotes]').evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      scrollable: el.scrollHeight >= el.clientHeight,
    }));
    expect(info.overflowY).toBe('auto');
    expect(info.scrollable).toBe(true);
  });
});

test.describe('流式版 03', () => {
  for (const size of FLOW_SIZES) {
    test(
      size.w + '×' + size.h + '：三層可收合、節點不重疊、引言在關係圖之前、沒有橫向捲動',
      async ({ page }) => {
        await openPage(page, size, AXIS3);
        await expect(page.locator('[data-layer-head]')).toHaveCount(3);
        const rects = await nodeRects(page);
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++)
            expect(intersects(rects[i]!, rects[j]!, 1), rects[i]!.id + '×' + rects[j]!.id).toBe(
              false,
            );
        await head(page, 'human').scrollIntoViewIfNeeded();
        await head(page, 'human').click();
        await settle(page);
        await expect(head(page, 'human')).toHaveAttribute('aria-expanded', 'false');
        expect(await bandHeight(page, 'human')).toBe(46);
        await page.locator('[data-event="7"]').dispatchEvent('click'); // 引言只在事件 07 出現
        await page.waitForTimeout(350);
        const g = (await page.locator('[data-graph-viewport]').boundingBox())!;
        const q = (await page.locator('[data-quotes]').boundingBox())!;
        expect(q.y + q.height).toBeLessThanOrEqual(g.y + 1); // 引言（專屬區塊）在關係圖上方
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        ).toBe(true);
      },
    );
  }

});

test.describe('減少動態', () => {
  test.use({ reducedMotion: 'reduce' });
  test('收合直接到位（不經動畫）', async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, AXIS3);
    await head(page, 'otherworld').click();
    await page.waitForTimeout(60);
    expect(await bandHeight(page, 'otherworld')).toBe(46);
  });
});
