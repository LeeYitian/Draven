import { expect, test, type Page } from '@playwright/test';
import {
  FLOW_SIZES,
  STAGE_SIZES,
  intersects,
  layoutFacts,
  nodeRects,
  openPage,
  stageCenter,
  stageOverflow,
} from './helpers';
import { AXIS_FRAME } from '../../src/lib/stage-metrics';

// US2：01 主軸頁的事件推進、焦點、畫線、拖曳、縮放與版面（所有視窗矩陣）。
// 座標以幾何斷言為主；動畫以「進行中的 DOM 狀態」判斷，不比對像素。

const AXIS1 = '#/axis/1';
const visibleEdgeIds = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<SVGElement>('.edge:not([data-state="unrevealed"])')].map(
      (e) => e.dataset.edge!,
    ),
  );
const currentEvent = (page: Page) =>
  page.locator('[data-event][aria-current="step"]').getAttribute('data-event');

/** 一條線「已畫完」＝可見線段的終點等於完整線段的終點（命中線與可見線同一條線段） */
const edgeDrawn = (page: Page, id: string) =>
  page.evaluate((edgeId) => {
    const g = document.querySelector(`[data-edge="${edgeId}"]`)!;
    const hit = g.querySelector('.edge__hit')!;
    const line = g.querySelector('.edge__line')!;
    return (
      Math.abs(+hit.getAttribute('x2')! - +line.getAttribute('x2')!) < 0.5 &&
      Math.abs(+hit.getAttribute('y2')! - +line.getAttribute('y2')!) < 0.5
    );
  }, id);

test.describe('舞台版 01：事件與焦點', () => {
  test('進頁：事件 01、事件焦點、只有背景關係可見、8 個節點', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    expect(await currentEvent(page)).toBe('1');
    expect(await visibleEdgeIds(page)).toEqual(['dravin-elian']);
    await expect(page.locator('[data-node]')).toHaveCount(8);
    await expect(page.locator('[data-narrative] h2')).toHaveText('政策佈局');
  });

  test('← → 推進事件、敘述換成新事件、連線累積；到邊界不動作', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await currentEvent(page)).toBe('3');
    await expect(page.locator('[data-narrative] h2')).toHaveText('朝堂博弈');
    expect((await visibleEdgeIds(page)).sort()).toEqual(
      ['dravin-elian', 'dravin-fane', 'elis-fane', 'dravin-old', 'minor-old', 'dravin-minor'].sort(),
    );
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    expect(await currentEvent(page)).toBe('6');
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
    expect(await currentEvent(page)).toBe('1');
  });

  test('回退：後面事件的線淡出並不再可見', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-event="6"]').click();
    expect(await visibleEdgeIds(page)).toHaveLength(9);
    await page.locator('[data-event="2"]').click();
    await expect.poll(() => visibleEdgeIds(page)).toHaveLength(3);
    // 淡出後 opacity 為 0
    await page.waitForTimeout(250);
    const opacity = await page
      .locator('[data-edge="fane-bren"]')
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('0');
  });

  test('點事件與點節點互斥；點節點不改事件、不多畫線、不開 Popover', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-event="3"]').click();
    const before = (await visibleEdgeIds(page)).sort();
    await page.locator('[data-node="fane"]').click();
    await expect(page.locator('[data-node="fane"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await currentEvent(page)).toBe('3');
    expect((await visibleEdgeIds(page)).sort()).toEqual(before);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // 該節點出場的事件編號變金色加底線
    await expect(page.locator('[data-event="2"]')).toHaveAttribute('data-marked');
    await expect(page.locator('[data-event="4"]')).not.toHaveAttribute('data-marked', '');
    // 再點事件：節點焦點清除
    await page.locator('[data-event="4"]').click();
    await expect(page.locator('[data-node="fane"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-event][data-marked]')).toHaveCount(0);
  });

  test('節點狀態：事件 3 的參與者是焦點，其餘變暗（不透明度 0.3）', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-event="3"]').click();
    const opacity = (id: string) =>
      page.locator(`[data-node="${id}"]`).evaluate((el) => getComputedStyle(el).opacity);
    await expect.poll(() => opacity('elis')).toBe('0.3');
    expect(await opacity('dravin')).toBe('1');
    expect(await opacity('old-nobles')).toBe('1');
  });
});

test.describe('舞台版 01：畫線動畫', () => {
  /**
   * 在頁面內按一次 →，之後每個影格記錄指定線「可見長度 ÷ 完整長度」與箭頭不透明度，共 durationMs。
   * 全程在頁面內執行，避免 Playwright 往返延遲吃掉動畫。
   */
  const recordAfterStep = (page: Page, ids: string[], durationMs: number) =>
    page.evaluate(
      async ({ edgeIds, duration }) => {
        const len = (el: Element) =>
          Math.hypot(
            +el.getAttribute('x2')! - +el.getAttribute('x1')!,
            +el.getAttribute('y2')! - +el.getAttribute('y1')!,
          );
        const read = () =>
          edgeIds.map((id) => {
            const g = document.querySelector(`[data-edge="${id}"]`)!;
            return {
              ratio: len(g.querySelector('.edge__line')!) / len(g.querySelector('.edge__hit')!),
              arrow: +getComputedStyle(g.querySelector('.edge__arrow')!).opacity,
            };
          });
        const frames: { t: number; edges: ReturnType<typeof read> }[] = [];
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
        );
        const start = performance.now();
        await new Promise<void>((done) => {
          const tick = () => {
            const t = performance.now() - start;
            frames.push({ t, edges: read() });
            if (t < duration) requestAnimationFrame(tick);
            else done();
          };
          requestAnimationFrame(tick);
        });
        return frames;
      },
      { edgeIds: ids, duration: durationMs },
    );

  test('向前推進：新線的可見長度逐步增加到完整；箭頭在線畫完之後才出現', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    const frames = await recordAfterStep(page, ['dravin-fane'], 900);
    const ratios = frames.map((f) => f.edges[0]!.ratio);
    // 有中間值（不是瞬間完成），單調不減，最後完整
    expect(ratios.some((r) => r > 0.05 && r < 0.95)).toBe(true);
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]!).toBeGreaterThanOrEqual(ratios[i - 1]! - 1e-6);
    expect(ratios.at(-1)!).toBeCloseTo(1, 2);
    // 線還沒畫完的影格，箭頭不可見
    for (const f of frames) if (f.edges[0]!.ratio < 0.9) expect(f.edges[0]!.arrow).toBeLessThan(0.5);
    expect(frames.at(-1)!.edges[0]!.arrow).toBeGreaterThan(0.9);
    // 總時長約 400ms（容許影格與緩動誤差）
    const done = frames.find((f) => f.edges[0]!.ratio >= 0.99)!;
    expect(done.t).toBeGreaterThan(300);
    expect(done.t).toBeLessThan(600);
  });

  test('同一事件的多條線依序畫：第二條在第一條畫完（含 120ms 間隔）之後才開始', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.keyboard.press('ArrowRight'); // 事件 2
    await expect.poll(() => edgeDrawn(page, 'elis-fane'), { timeout: 3000 }).toBe(true);
    // 事件 3 依資料順序：威壓 → 倒戈 → 共享
    const frames = await recordAfterStep(page, ['dravin-old', 'minor-old', 'dravin-minor'], 1900);
    const firstDone = frames.find((f) => f.edges[0]!.ratio >= 0.99)!;
    const secondStart = frames.find((f) => f.edges[1]!.ratio > 0.02)!;
    const secondDone = frames.find((f) => f.edges[1]!.ratio >= 0.99)!;
    const thirdStart = frames.find((f) => f.edges[2]!.ratio > 0.02)!;
    expect(secondStart.t).toBeGreaterThanOrEqual(firstDone.t - 50);
    expect(thirdStart.t).toBeGreaterThanOrEqual(secondDone.t - 50);
    expect(frames.at(-1)!.edges.every((e) => e.ratio > 0.99)).toBe(true);
  });

  test('一次跳到事件 5：事件 3、4 的線立即出現（不播動畫）', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-event="5"]').click();
    for (const id of ['dravin-old', 'minor-old', 'dravin-minor', 'elis-elian', 'beastmen-elian'])
      expect(await edgeDrawn(page, id), id).toBe(true);
  });

  test('prefers-reduced-motion：直接顯示，不播放', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-event="2"]').click();
    expect(await edgeDrawn(page, 'dravin-fane')).toBe(true);
    await context.close();
  });
});

test.describe('舞台版 01：拖曳、縮放、圖例', () => {
  const center = async (page: Page, id: string) => {
    const box = (await page.locator(`[data-node="${id}"]`).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  test('拖曳節點：連線跟著節點；放開後回到原位', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-event="6"]').click();
    await page.waitForTimeout(3500); // 等畫線結束
    const from = await center(page, 'fane');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 60, from.y + 40, { steps: 6 });
    const during = await center(page, 'fane');
    expect(during.x).toBeLessThan(from.x - 40);
    // 連線終點跟著節點（線的端點在節點附近）
    const edgeEnd = await page.evaluate(() => {
      const hit = document.querySelector('[data-edge="dravin-fane"] .edge__hit') as SVGElement;
      const owner = hit.ownerSVGElement!;
      const svg = owner.getBoundingClientRect();
      const k = svg.width / owner.width.baseVal.value;
      return {
        x: svg.left + +hit.getAttribute('x2')! * k,
        y: svg.top + +hit.getAttribute('y2')! * k,
      };
    });
    expect(Math.hypot(edgeEnd.x - during.x, edgeEnd.y - during.y)).toBeLessThan(140);
    await page.mouse.up();
    await expect
      .poll(async () => {
        const c = await center(page, 'fane');
        return Math.hypot(c.x - from.x, c.y - from.y);
      }, { timeout: 2000 })
      .toBeLessThan(1);
    // 拖曳不等於點擊：焦點仍是事件焦點
    await expect(page.locator('[data-node="fane"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('圖例：關掉「衝突」→ 衝突線隱藏；關掉「群體」→ 三個群體節點隱藏', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-event="6"]').click();
    await page.getByRole('button', { name: '衝突', exact: true }).click();
    await expect(page.locator('[data-edge="dravin-old"]')).toHaveAttribute('data-hidden');
    expect(
      await page.locator('[data-edge="dravin-old"]').evaluate((el) => getComputedStyle(el).opacity),
    ).toBe('0');
    await page.getByRole('button', { name: '群體', exact: true }).click();
    await expect(page.locator('[data-node][data-hidden]')).toHaveCount(3);
  });

  test('線段標籤：關閉後文字不可見；hover 該線時暫時顯示', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-event="6"]').click();
    await page.waitForTimeout(3500);
    await page.getByRole('button', { name: '線段標籤' }).click();
    const labelOpacity = () =>
      page
        .locator('[data-edge="dravin-fane"] .edge__label')
        .evaluate((el) => getComputedStyle(el).opacity);
    await expect.poll(labelOpacity).toBe('0');
    const box = (await page.locator('[data-edge="dravin-fane"] .edge__hit').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(labelOpacity).toBe('1');
  });

  test('縮放：＋ 到 125% 圖層放大；Ctrl＋滾輪縮放；100% 以外可拖曳平移；重設還原', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    const layerTransform = () =>
      page.locator('[data-graph-layer]').evaluate((el) => getComputedStyle(el).transform);
    await page.getByRole('button', { name: '放大' }).click();
    await expect(page.locator('[data-zoom-level]')).toHaveText('125%');
    expect(await layerTransform()).toMatch(/^matrix\(1\.25,/);

    // Ctrl＋滾輪（觸控板雙指的等效事件）
    const viewport = (await page.locator('[data-graph-viewport]').boundingBox())!;
    await page.mouse.move(viewport.x + 200, viewport.y + 200);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');
    const zoomed = await page.locator('[data-zoom-level]').innerText();
    expect(parseInt(zoomed)).toBeGreaterThan(125);

    // 平移：在空白處拖曳
    const before = await layerTransform();
    await page.mouse.move(viewport.x + 300, viewport.y + 240);
    await page.mouse.down();
    await page.mouse.move(viewport.x + 250, viewport.y + 200, { steps: 5 });
    await page.mouse.up();
    expect(await layerTransform()).not.toBe(before);

    await page.getByRole('button', { name: '重設' }).click();
    await expect(page.locator('[data-zoom-level]')).toHaveText('100%');
    expect(await layerTransform()).toBe('matrix(1, 0, 0, 1, 0, 0)');
  });

  test('縮放後拖曳平移不會誤觸節點聚焦', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.getByRole('button', { name: '放大' }).click();
    const c = await center(page, 'dravin');
    await page.mouse.move(c.x + 140, c.y + 120);
    await page.mouse.down();
    await page.mouse.move(c.x + 100, c.y + 100, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator('[data-node][aria-pressed="true"]')).toHaveCount(0);
  });
});

test.describe('舞台版 01：版面幾何（視窗矩陣）', () => {
  for (const size of STAGE_SIZES) {
    test(`${size.w}×${size.h}：節點中心在設計座標、互不重疊、不壓到控制項與圖例、不超出舞台`, async ({
      page,
    }) => {
      await openPage(page, size, AXIS1);
      expect(await stageOverflow(page)).toEqual([]);

      // 節點中心：圖框左 772、上緣＝下方區 y；設計座標以 628×457 為準，依畫布高度等比（邊框畫在最上層，不佔畫布）
      const { y: top, height } = AXIS_FRAME.lower;
      const dravin = await stageCenter(page, '[data-node-wrapper="dravin"]');
      expect(dravin.x).toBeCloseTo(772 + 314, 0);
      expect(dravin.y).toBeCloseTo(top + (80 * height) / 457, 0);
      const bren = await stageCenter(page, '[data-node-wrapper="bren"]');
      expect(bren.x).toBeCloseTo(772 + 558, 0);
      expect(bren.y).toBeCloseTo(top + (376 * height) / 457, 0);

      const rects = await nodeRects(page);
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++)
          expect(intersects(rects[i]!, rects[j]!, 4), `${rects[i]!.id} × ${rects[j]!.id}`).toBe(false);

      // 控制項與圖例的矩形
      const overlays = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '[data-graph-legend], [data-graph-viewport] ~ div.absolute.top-2\\.5',
          ),
        ].map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }),
      );
      expect(overlays.length).toBeGreaterThanOrEqual(2);
      for (const overlay of overlays)
        for (const rect of rects) expect(intersects(overlay, rect), rect.id).toBe(false);
    });

    test(`${size.w}×${size.h}：敘述文字在 470 寬內，事件列 6 等分且不被裁切`, async ({ page }) => {
      await openPage(page, size, AXIS1);
      for (let n = 1; n <= 6; n++) {
        await page.locator(`[data-event="${n}"]`).click();
        await page.waitForTimeout(250);
        const overflow = await page.evaluate(() => {
          const body = document.querySelector<HTMLElement>('[data-narrative-body]')!;
          return body.scrollWidth - body.clientWidth;
        });
        expect(overflow).toBeLessThanOrEqual(0);
      }
      const widths = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-event]')].map((e) => e.offsetWidth),
      );
      expect(new Set(widths).size).toBe(1);
      expect(widths[0]).toBeCloseTo((1288 - 8 * 5) / 6, 0);
    });
  }
});

test.describe('流式版 01', () => {
  for (const size of FLOW_SIZES) {
    test(`${size.w}×${size.h}：無水平捲軸、節點不重疊且在圖框內、事件列可橫向滑動`, async ({ page }) => {
      await openPage(page, size, AXIS1);
      const facts = await layoutFacts(page);
      expect(facts.layout).toBe('flow');
      expect(facts.horizontalScroll).toBe(false);

      const frame = await page.evaluate(() => {
        const r = document.querySelector<HTMLElement>('[data-graph-viewport]')!.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      });
      const rects = await nodeRects(page);
      for (const r of rects) {
        expect(r.left, `${r.id} 左`).toBeGreaterThanOrEqual(frame.left - 1);
        expect(r.right, `${r.id} 右`).toBeLessThanOrEqual(frame.right + 1);
      }
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++)
          expect(intersects(rects[i]!, rects[j]!, 0), `${rects[i]!.id} × ${rects[j]!.id}`).toBe(false);

      const scroller = page.getByRole('group', { name: '事件進程' });
      expect(await scroller.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
    });
  }

  test('上一個／下一個推進事件；目前事件在事件列中置中', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS1);
    const next = page.getByRole('button', { name: '下一個 →' });
    for (let i = 0; i < 4; i++) await next.click();
    expect(await currentEvent(page)).toBe('5');
    await page.waitForTimeout(600); // 等 smooth scroll
    const offset = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('[role="group"][aria-label="事件進程"]')!;
      const cell = bar.querySelector<HTMLElement>('[aria-current="step"]')!;
      const b = bar.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      return c.left + c.width / 2 - (b.left + b.width / 2);
    });
    expect(Math.abs(offset)).toBeLessThan(6);
  });

  test('事件列黏在頁面頂端（捲動後仍在視窗最上方）', async ({ page }) => {
    // 矮視窗才有足夠的捲動距離讓事件列碰到頂端
    await openPage(page, { w: 360, h: 560 }, AXIS1);
    await page.evaluate(() => window.scrollTo(0, 700));
    const top = await page.evaluate(
      () =>
        document
          .querySelector<HTMLElement>('[role="group"][aria-label="事件進程"]')!
          .parentElement!.getBoundingClientRect().top,
    );
    expect(Math.abs(top)).toBeLessThan(1);
  });

  test('點節點聚焦且不拖曳（節點位置不變）；點事件格切換事件', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS1);
    await page.locator('[data-event="3"]').click();
    await page.locator('[data-node="dravin"]').scrollIntoViewIfNeeded();
    const before = (await page.locator('[data-node="fane"]').boundingBox())!;
    await page.locator('[data-node="fane"]').click();
    await expect(page.locator('[data-node="fane"]')).toHaveAttribute('aria-pressed', 'true');
    const after = (await page.locator('[data-node="fane"]').boundingBox())!;
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(await currentEvent(page)).toBe('3');
  });

  test('線段標籤預設關閉；縮放按鈕可用；點圖例可開關線種', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS1);
    await expect(page.getByRole('button', { name: '線段標籤' })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: '放大' }).click();
    await expect(page.locator('[data-zoom-level]')).toHaveText('125%');
    await page.getByRole('button', { name: '衝突', exact: true }).click();
    await expect(page.getByRole('button', { name: '衝突', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });

  test('縮放 100% 時圖框允許頁面垂直捲動（touch-action: pan-y）；放大後改為 none', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS1);
    const action = () =>
      page.locator('[data-graph-viewport]').evaluate((el) => getComputedStyle(el).touchAction);
    expect(await action()).toBe('pan-y');
    await page.getByRole('button', { name: '放大' }).click();
    expect(await action()).toBe('none');
  });
});
