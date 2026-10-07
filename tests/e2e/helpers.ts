import type { Page } from '@playwright/test';

/** 驗收視窗矩陣（contracts/layout-and-coordinates.md §7）。倍率 s = min(寬/1440, 高/720)。 */
export const STAGE_SIZES: Array<{ w: number; h: number; compact: boolean }> = [
  { w: 1920, h: 950, compact: false },
  { w: 1536, h: 740, compact: false },
  { w: 1440, h: 795, compact: false },
  { w: 1366, h: 640, compact: true },
  { w: 1280, h: 600, compact: true },
  { w: 2560, h: 1300, compact: false },
];

export const FLOW_SIZES: Array<{ w: number; h: number }> = [
  { w: 390, h: 844 },
  { w: 360, h: 740 },
  { w: 320, h: 640 },
  { w: 768, h: 1024 }, // 平板直立
  { w: 844, h: 390 }, // 橫向手機
  { w: 1024, h: 480 }, // 倍率過小 → 流式
];

/** 開啟頁面並等字型載入完成（字型載入會改變換行，量測前必須等） */
export async function openPage(page: Page, size: { w: number; h: number }, hash = '#/') {
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.goto(`/${hash}`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('main').first().waitFor();
}

export interface LayoutFacts {
  layout: string | undefined;
  compact: boolean;
  scale: number;
  horizontalScroll: boolean;
}

export function layoutFacts(page: Page): Promise<LayoutFacts> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const stage = document.querySelector<HTMLElement>('[data-stage]');
    const scale = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
    return {
      layout: root.dataset.layout,
      compact: root.hasAttribute('data-compact'),
      scale,
      horizontalScroll: root.scrollWidth > window.innerWidth + 1,
    };
  });
}

/**
 * 舞台版：回傳「舞台座標」下超出舞台範圍的元素。
 * 以元素自己的矩形換算（扣掉舞台縮放 k），不計 overflow:hidden 之外被刻意裁切的元素。
 */
export function stageOverflow(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-stage]')!;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth;
    const out: string[] = [];
    for (const el of stage.querySelectorAll<HTMLElement>('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest('.sr-only')) continue; // 螢幕閱讀器專用的視覺隱藏元素（1×1、刻意裁切）
      const right = (r.right - sr.left) / k;
      const bottom = (r.bottom - sr.top) / k;
      const left = (r.left - sr.left) / k;
      const top = (r.top - sr.top) / k;
      if (
        right > stage.offsetWidth + 0.5 ||
        bottom > stage.offsetHeight + 0.5 ||
        left < -0.5 ||
        top < -0.5
      ) {
        out.push(
          `${el.tagName}.${String(el.className).slice(0, 30)} (${left.toFixed(0)},${top.toFixed(0)})→(${right.toFixed(0)},${bottom.toFixed(0)})`,
        );
      }
    }
    return out;
  });
}

export interface Rect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 關係圖所有節點的螢幕矩形（縮放後；兩兩比較是否重疊與縮放倍率無關） */
export function nodeRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-node]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.node!, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }),
  );
}

export const intersects = (a: Omit<Rect, 'id'>, b: Omit<Rect, 'id'>, gap = 0) =>
  a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;

/** 以舞台座標回報元素中心（舞台版）：(client − 舞台左上) ÷ 舞台倍率 */
export function stageCenter(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const stage = document.querySelector<HTMLElement>('[data-stage]')!;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth;
    const r = document.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - sr.left) / k, y: (r.top + r.height / 2 - sr.top) / k };
  }, selector);
}
