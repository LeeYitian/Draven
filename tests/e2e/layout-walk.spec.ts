import { expect, test, type Page } from '@playwright/test';
import { FLOW_SIZES, STAGE_SIZES, intersects, openPage, stageOverflow } from './helpers';

// Phase 9：版面走查（T120、T121、SC-001）。
// 01–04 的每個事件 × 視窗矩陣：舞台版沒有任何元素超出舞台、左欄內容不超過下方區、
// 關係圖上的線上文字不壓到節點也不互相重疊；流式版沒有橫向捲動。

const AXES = [1, 2, 3, 4] as const;
const EVENT_COUNT: Record<number, number> = { 1: 6, 2: 6, 3: 7, 4: 6 };

const unlock = (page: Page) =>
  page.addInitScript(() => sessionStorage.setItem('draven:page04Unlocked', 'true'));

const pick = async (page: Page, n: number, flow = false) => {
  const cell = page.locator('[data-event="' + n + '"]');
  if (flow) await cell.dispatchEvent('click');
  else await cell.click();
  await page.waitForTimeout(300);
};

/** 左欄（敘述＋專屬區塊）每個直接內容的下緣都不超過下方區（關係圖）的下緣 */
async function leftColumnFits(page: Page) {
  return page.evaluate(() => {
    const graph = document.querySelector('[data-graph-viewport]')!.getBoundingClientRect();
    const out: string[] = [];
    const parts = [
      '[data-narrative-body]',
      '[data-spectrum]',
      '[data-quotes]',
      '[data-event-extra]',
      '[data-compare]',
    ];
    for (const sel of parts) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // 02 的比較滑桿橫跨兩欄放在下方區之下，不在這個比較範圍內
      if (sel === '[data-compare]') continue;
      if (r.bottom > graph.bottom + 1)
        out.push(sel + ' 下緣 ' + r.bottom.toFixed(0) + ' > ' + graph.bottom.toFixed(0));
    }
    // 旁註欄的伏筆框格也要在下方區內
    for (const slot of document.querySelectorAll('[data-hint-slot]')) {
      const r = slot.getBoundingClientRect();
      if (r.bottom > graph.bottom + 1)
        out.push('伏筆框格 ' + (slot as HTMLElement).dataset.hintSlot);
    }
    const main = document.querySelector('main')!;
    if (main.scrollHeight > main.clientHeight + 1) out.push('main 內容比視窗高');
    return out;
  });
}

/** 線上文字（SVG text）與節點、彼此之間是否互蓋 */
async function labelCollisions(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const hit = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>, pad = 0) =>
      a.left < b.right - pad &&
      b.left < a.right - pad &&
      a.top < b.bottom - pad &&
      b.top < a.bottom - pad;
    const labels = [
      ...document.querySelectorAll(
        '.edge:not([data-state="unrevealed"]):not([data-hidden]) .edge__label',
      ),
    ]
      .filter((l) => getComputedStyle(l).opacity !== '0')
      .map((l) => ({
        id: (l.closest('.edge') as SVGElement).dataset.edge!,
        text: l.textContent!,
        r: rect(l),
      }));
    const nodes = [...document.querySelectorAll('[data-node]:not([data-hidden])')].map((n) => ({
      id: (n as HTMLElement).dataset.node!,
      r: rect(n),
    }));
    const out: string[] = [];
    for (const l of labels)
      for (const n of nodes) if (hit(l.r, n.r, 1)) out.push('「' + l.text + '」壓到節點 ' + n.id);
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++)
        if (hit(labels[i]!.r, labels[j]!.r, 1))
          out.push('「' + labels[i]!.text + '」與「' + labels[j]!.text + '」互蓋');
    return out;
  });
}

for (const axis of AXES) {
  test.describe('0' + axis + ' 版面走查', () => {
    test.beforeEach(async ({ page }) => {
      await unlock(page);
    });

    for (const size of STAGE_SIZES) {
      test(
        '舞台版 ' +
          size.w +
          '×' +
          size.h +
          (size.compact ? '（compact）' : '') +
          '：每個事件都不溢出',
        async ({ page }) => {
          await openPage(page, size, '#/axis/' + axis);
          for (let n = 1; n <= EVENT_COUNT[axis]!; n++) {
            await pick(page, n);
            expect(await stageOverflow(page), '事件 ' + n + ' 舞台溢出').toEqual([]);
            expect(await leftColumnFits(page), '事件 ' + n + ' 左欄').toEqual([]);
          }
        },
      );
    }

    test('舞台版：所有線都畫出時，線上文字不壓到節點、不互相重疊', async ({ page }) => {
      await openPage(page, { w: 1440, h: 720 }, '#/axis/' + axis);
      await pick(page, EVENT_COUNT[axis]!);
      await page.waitForTimeout(2500); // 畫線動畫
      expect(await labelCollisions(page)).toEqual([]);
    });

    for (const size of FLOW_SIZES) {
      test('流式版 ' + size.w + '×' + size.h + '：沒有橫向捲動、節點不重疊', async ({ page }) => {
        await openPage(page, size, '#/axis/' + axis);
        for (const n of [1, EVENT_COUNT[axis]!]) {
          await pick(page, n, true);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
            '事件 ' + n,
          ).toBe(true);
        }
        const rects = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-node]')].map((el) => {
            const r = el.getBoundingClientRect();
            return {
              id: el.dataset.node!,
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
            };
          }),
        );
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++)
            expect(intersects(rects[i]!, rects[j]!, 0), rects[i]!.id + '×' + rects[j]!.id).toBe(
              false,
            );
      });
    }
  });
}

test.describe('00 世界觀導讀與人物誌', () => {
  for (const size of STAGE_SIZES) {
    test('舞台版 ' + size.w + '×' + size.h + '：00 沒有溢出', async ({ page }) => {
      await openPage(page, size, '#/');
      expect(await stageOverflow(page)).toEqual([]);
      await page.getByRole('button', { name: '人物誌' }).first().click();
      await expect(page.getByRole('dialog').first()).toBeVisible();
      await page.waitForTimeout(500);
      expect(await stageOverflow(page)).toEqual([]);
    });
  }
  for (const size of FLOW_SIZES) {
    test('流式版 ' + size.w + '×' + size.h + '：00 沒有橫向捲動', async ({ page }) => {
      await openPage(page, size, '#/');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
    });
  }
});
