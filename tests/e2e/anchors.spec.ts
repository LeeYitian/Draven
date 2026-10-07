import { expect, test, type Page } from '@playwright/test';
import { STAGE_SIZES, intersects, openPage } from './helpers';

// US5：伏筆框格與弧線「永遠跟隨文字」（SC-002）。
// 03 事件 06 有 3 個回收處（受諾爾之託…、法恩用馬蹄鐵敲出火、盤蛇的氣味）。

const EVENT6 = '#/axis/3';
const IDS = ['useful-to-witch', 'forgotten-gift', 'spirit-scent'];

async function openEvent6(page: Page, size: { w: number; h: number }) {
  await openPage(page, size, EVENT6);
  await page.locator('[data-event="6"]').click();
  await expect(page.locator('[data-narrative-body] h2')).toHaveText('地底大洞');
  await expect(page.locator('[data-hint-slot]')).toHaveCount(3);
  await page.waitForTimeout(300); // 量測與弧線穩定
}

interface Measure {
  id: string;
  anchor: { endX: number; lineBottom: number; mid: number };
  slot: { left: number; top: number; right: number; bottom: number };
  dot: { x: number; y: number };
}

/** 全部以「舞台座標」回報：螢幕座標扣掉舞台左上、除以舞台倍率 */
const measure = (page: Page): Promise<Measure[]> =>
  page.evaluate((ids) => {
    const stage = document.querySelector<HTMLElement>('[data-stage]')!;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth;
    const toStage = (x: number, y: number) => ({ x: (x - sr.left) / k, y: (y - sr.top) / k });
    return ids.map((id) => {
      const el = document.querySelector<HTMLElement>(`[data-hint="${id}"]`)!;
      const rects = el.getClientRects();
      const last = rects[rects.length - 1]!;
      const end = toStage(last.right, last.bottom);
      const top = toStage(last.right, last.top);
      const slot = document.querySelector<HTMLElement>(`[data-hint-slot="${id}"]`)!.getBoundingClientRect();
      const a = toStage(slot.left, slot.top);
      const b = toStage(slot.right, slot.bottom);
      const dotRect = document
        .querySelector<SVGCircleElement>(`[data-hint-arc="${id}"] .hint-arc-dot`)!
        .getBoundingClientRect();
      const dot = toStage(dotRect.left + dotRect.width / 2, dotRect.top + dotRect.height / 2);
      return {
        id,
        anchor: { endX: end.x, lineBottom: end.y, mid: (end.y + top.y) / 2 },
        slot: { left: a.x, top: a.y, right: b.x, bottom: b.y },
        dot,
      };
    });
  }, IDS);

/** 斷言：框格與弧線跟著錨點（誤差 ≤ 2 舞台 px），框格互不重疊 */
function expectFollowsText(rows: Measure[]) {
  for (const r of rows) {
    // 弧線起點貼在片語最後一行的末端（x＝末端＋2；y＝行底−6，同行多個時依序錯開 3px，最多 +6）
    expect(Math.abs(r.dot.x - (r.anchor.endX + 2)), `${r.id} 弧線起點 x`).toBeLessThanOrEqual(2);
    const dy = r.dot.y - (r.anchor.lineBottom - 6);
    expect(dy, `${r.id} 弧線起點 y`).toBeGreaterThanOrEqual(-2);
    expect(dy, `${r.id} 弧線起點 y`).toBeLessThanOrEqual(6 + 2);
    // 框格在旁註欄：左緣固定（舞台 x＝112＋470＋6）
    expect(r.slot.left, `${r.id} 框格 x`).toBeCloseTo(112 + 470 + 6, 0);
    // y 對齊錨點所在行（以行中線為中心）；只會被防撞往下推，不會高過錨點行
    const slotMid = r.slot.top + 14;
    expect(slotMid, `${r.id} 框格不高過錨點行`).toBeGreaterThanOrEqual(r.anchor.mid - 2);
    expect(slotMid, `${r.id} 框格離錨點行不遠`).toBeLessThanOrEqual(r.anchor.mid + 2 * 36 + 2);
  }
  // 框格由上到下的順序與錨點一致，且互不相交
  const sorted = [...rows].sort((a, b) => a.anchor.mid - b.anchor.mid);
  expect(sorted.map((r) => r.id)).toEqual([...rows].sort((a, b) => a.slot.top - b.slot.top).map((r) => r.id));
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++)
      expect(intersects(rows[i]!.slot, rows[j]!.slot), `${rows[i]!.id} × ${rows[j]!.id}`).toBe(false);
  // 沒有任何框格被推到比錨點行低很多以外：碰撞時至少留 8px 間距
  const bySlot = [...rows].sort((a, b) => a.slot.top - b.slot.top);
  for (let i = 1; i < bySlot.length; i++)
    expect(bySlot[i]!.slot.top - bySlot[i - 1]!.slot.bottom).toBeGreaterThanOrEqual(8 - 1);
}

test.describe('舞台版：框格跟隨文字（視窗矩陣，含 compact）', () => {
  for (const size of STAGE_SIZES) {
    test(`${size.w}×${size.h}${size.compact ? '（compact）' : ''}：框格與弧線貼著錨點，3 個框格互不相交`, async ({
      page,
    }) => {
      await openEvent6(page, size);
      expectFollowsText(await measure(page));
    });
  }

  test('各尺寸的框格相對於所屬錨點的位置一致（非 compact 的四種尺寸，框格 y－錨點 y 的差 ≤ 2px）', async ({
    browser,
  }) => {
    test.setTimeout(120_000); // 開四個視窗各自等字型與量測，整套跑時機器忙會超過預設的 45 秒
    const offsets: Record<string, number[]> = {};
    for (const size of STAGE_SIZES.filter((s) => !s.compact)) {
      const page = await browser.newPage();
      await openEvent6(page, size);
      for (const r of await measure(page)) (offsets[r.id] ??= []).push(r.slot.top + 14 - r.anchor.mid);
      await page.close();
    }
    for (const [id, list] of Object.entries(offsets)) {
      const spread = Math.max(...list) - Math.min(...list);
      expect(spread, id).toBeLessThanOrEqual(2);
    }
  });
});

test.describe('舞台版：改變文字排版後仍然跟隨', () => {
  test('字級變大（換行改變）→ 框格與弧線重新對齊', async ({ page }) => {
    await openEvent6(page, { w: 1440, h: 720 });
    const before = await measure(page);
    await page.addStyleTag({ content: '[data-narrative-body] p { font-size: 20px !important; }' });
    await page.waitForTimeout(500);
    const after = await measure(page);
    expectFollowsText(after);
    // 確實換行了（錨點位置變了），框格也跟著動
    const moved = after.some((r, i) => Math.abs(r.anchor.mid - before[i]!.anchor.mid) > 5);
    expect(moved).toBe(true);
  });

  test('字型載入完成事件（loadingdone）→ 重新量測：字距改變後框格與弧線跟上', async ({ page }) => {
    await openEvent6(page, { w: 1440, h: 720 });
    // 字距加大使錨點末端右移，但面板尺寸可能不變（ResizeObserver 不會觸發）；靠 loadingdone 重新量測
    await page.addStyleTag({ content: '[data-narrative-body] p { letter-spacing: 1.5px !important; }' });
    await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
    await page.waitForTimeout(300);
    expectFollowsText(await measure(page));
  });

  test('切換事件再回來：框格消失又重新出現，位置仍然正確', async ({ page }) => {
    await openEvent6(page, { w: 1440, h: 720 });
    await page.locator('[data-event="3"]').click();
    await expect(page.locator('[data-narrative-body] h2')).toHaveText('主教發狂');
    await expect(page.locator('[data-hint-slot]')).toHaveCount(1);
    await page.locator('[data-event="6"]').click();
    await expect(page.locator('[data-hint-slot]')).toHaveCount(3);
    await page.waitForTimeout(300);
    expectFollowsText(await measure(page));
  });

  test('跨越版型門檻再回來（舞台→流式→舞台）：框格重新量測並跟隨文字', async ({ page }) => {
    await openEvent6(page, { w: 1440, h: 720 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-note-row]')).toHaveCount(2);
    await page.setViewportSize({ width: 1440, height: 720 });
    await expect(page.locator('[data-hint-layer]')).toHaveCount(1);
    await page.waitForTimeout(400);
    expectFollowsText(await measure(page));
  });

  test('解開一個框格（出現說明文字、框格變高）：下面的框格被推開、仍不重疊', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'draven:hints',
        JSON.stringify({ owned: ['useful-to-witch', 'forgotten-gift', 'spirit-scent'], solved: [] }),
      ),
    );
    await openEvent6(page, { w: 1440, h: 720 });
    await page.locator('nav').first().getByRole('button', { name: /^伏筆/ }).click();
    await page.locator('[data-hint-keyword="useful-to-witch"]').click();
    await page.locator('[data-hint-slot="useful-to-witch"]').click();
    await expect(page.locator('[data-hint-explain="useful-to-witch"]')).toBeVisible();
    await page.waitForTimeout(400);
    const rows = await measure(page);
    // 含說明文字的整個格子（slot＋explain）與下一個框格不相交
    const cell = await page.locator('[data-hint-cell="useful-to-witch"]').boundingBox();
    const next = await page.locator('[data-hint-slot="forgotten-gift"]').boundingBox();
    expect(next!.y).toBeGreaterThanOrEqual(cell!.y + cell!.height - 1);
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++)
        expect(intersects(rows[i]!.slot, rows[j]!.slot)).toBe(false);
  });
});

test.describe('舞台版：拖曳放置', () => {
  const seed = (page: Page) =>
    page.addInitScript(() =>
      localStorage.setItem(
        'draven:hints',
        JSON.stringify({
          owned: ['useful-to-witch', 'forgotten-gift', 'spirit-scent', 'cold-hand'],
          solved: [],
        }),
      ),
    );

  async function dragKeyword(page: Page, keywordId: string, slotId: string, release = true) {
    const kb = (await page.locator(`[data-hint-keyword="${keywordId}"]`).boundingBox())!;
    await page.mouse.move(kb.x + 20, kb.y + 15);
    await page.mouse.down();
    await page.mouse.move(kb.x + 80, kb.y - 80, { steps: 6 });
    const sb = (await page.locator(`[data-hint-slot="${slotId}"]`).boundingBox())!;
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 6 });
    if (release) await page.mouse.up();
  }

  test('拖到正確框格：鎖定、顯示說明、關鍵字在托盤變 ✓', async ({ page }) => {
    await seed(page);
    await openEvent6(page, { w: 1440, h: 720 });
    await page.locator('nav').first().getByRole('button', { name: /^伏筆/ }).click();
    await dragKeyword(page, 'forgotten-gift', 'forgotten-gift');
    await expect(page.locator('[data-hint-slot="forgotten-gift"]')).toHaveAttribute('data-state', 'solved');
    await expect(page.locator('[data-hint-explain="forgotten-gift"]')).toContainText('馬蹄鐵吊飾');
    await expect(page.locator('[data-hint-keyword="forgotten-gift"]')).toHaveAttribute('data-state', 'solved');
    await expect(page.locator('[data-hint-drag-image]')).toHaveCount(0);
  });

  test('拖曳中：原位留虛線空位、所有空框格顯示「放開以放入」、拖曳影像跟著指標', async ({ page }) => {
    await seed(page);
    await openEvent6(page, { w: 1440, h: 720 });
    await page.locator('nav').first().getByRole('button', { name: /^伏筆/ }).click();
    await dragKeyword(page, 'forgotten-gift', 'spirit-scent', false);
    await expect(page.locator('[data-hint-keyword="forgotten-gift"]')).toHaveAttribute('data-hole');
    await expect(page.locator('[data-hint-drag-image]')).toBeVisible();
    for (const id of IDS) await expect(page.locator(`[data-hint-slot="${id}"]`)).toContainText('放開以放入');
    const sb = (await page.locator('[data-hint-slot="spirit-scent"]').boundingBox())!;
    const img = (await page.locator('[data-hint-drag-image]').boundingBox())!;
    expect(Math.abs(img.x + img.width / 2 - (sb.x + sb.width / 2))).toBeLessThan(120);
    await page.mouse.up();
  });

  test('拖到錯誤框格：框格震動「不是這個」、關鍵字回托盤；300ms 後恢復', async ({ page }) => {
    await seed(page);
    await openEvent6(page, { w: 1440, h: 720 });
    await page.locator('nav').first().getByRole('button', { name: /^伏筆/ }).click();
    await dragKeyword(page, 'cold-hand', 'forgotten-gift', false);
    // 「答錯」只維持 300ms：放開前先掛 MutationObserver 記下框格狀態的每一次變化，不靠斷言去搶時間
    await page.evaluate(() => {
      const slot = document.querySelector('[data-hint-slot="forgotten-gift"]')!;
      const log: { state: string | null; text: string }[] = [];
      (window as unknown as { __slotLog: typeof log }).__slotLog = log;
      new MutationObserver(() =>
        log.push({ state: slot.getAttribute('data-state'), text: slot.textContent ?? '' }),
      ).observe(slot, { attributes: true, childList: true, subtree: true, characterData: true });
    });
    await page.mouse.up();
    await expect(page.locator('[data-hint-keyword="cold-hand"]')).toHaveAttribute('data-state', 'idle');
    await expect(page.locator('[data-hint-slot="forgotten-gift"]')).toHaveAttribute('data-state', 'empty', {
      timeout: 2000,
    });
    const log = await page.evaluate(
      () => (window as unknown as { __slotLog: { state: string; text: string }[] }).__slotLog,
    );
    const wrong = log.filter((entry) => entry.state === 'wrong');
    expect(wrong.length, '框格出現過「答錯」狀態').toBeGreaterThan(0);
    expect(wrong.some((entry) => entry.text.includes('不是這個'))).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('draven:hints')!).solved)).toEqual([]);
  });

  test('放在沒有框格的地方：關鍵字回托盤、取消選取；拖曳中按 Esc 取消', async ({ page }) => {
    await seed(page);
    await openEvent6(page, { w: 1440, h: 720 });
    await page.locator('nav').first().getByRole('button', { name: /^伏筆/ }).click();
    const kb = (await page.locator('[data-hint-keyword="cold-hand"]').boundingBox())!;
    await page.mouse.move(kb.x + 20, kb.y + 15);
    await page.mouse.down();
    await page.mouse.move(kb.x + 200, kb.y - 200, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('[data-hint-keyword="cold-hand"]')).toHaveAttribute('data-state', 'idle');
    await expect(page.locator('[data-hint-drag-image]')).toHaveCount(0);
    // Esc 取消
    await page.mouse.move(kb.x + 20, kb.y + 15);
    await page.mouse.down();
    await page.mouse.move(kb.x + 200, kb.y - 200, { steps: 6 });
    await expect(page.locator('[data-hint-drag-image]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-hint-drag-image]')).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator('[data-hint-keyword="cold-hand"]')).toHaveAttribute('data-state', 'idle');
  });

  test('拖曳中視窗縮放：取消拖曳，關鍵字回托盤', async ({ page }) => {
    await seed(page);
    await openEvent6(page, { w: 1440, h: 720 });
    await page.locator('nav').first().getByRole('button', { name: /^伏筆/ }).click();
    await dragKeyword(page, 'cold-hand', 'forgotten-gift', false);
    await expect(page.locator('[data-hint-drag-image]')).toBeVisible();
    await page.setViewportSize({ width: 1366, height: 700 });
    await expect(page.locator('[data-hint-drag-image]')).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator('[data-hint-keyword="cold-hand"]')).toHaveAttribute('data-state', 'idle');
  });

  test('托盤：高 168、貼底、不蓋側欄與頁首、背後沒有遮罩；有升起動畫', async ({ page }) => {
    await seed(page);
    await openPage(page, { w: 1440, h: 720 }, EVENT6);
    await page.locator('nav').first().getByRole('button', { name: /^伏筆/ }).click();
    const name = await page.locator('[data-hint-tray]').evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('tray-in');
    await page.waitForTimeout(400);
    const tray = (await page.locator('[data-hint-tray]').boundingBox())!;
    expect(tray.height).toBeCloseTo(168, 0);
    expect(tray.y + tray.height).toBeCloseTo(720, 0);
    expect(tray.x).toBeCloseTo(73, 0); // 不蓋側欄（72＋邊線）
    expect(await page.locator('.scrim').count()).toBe(0);
    // 頁首仍可見、側欄的頁面按鈕仍可點
    await expect(page.locator('header h1')).toBeVisible();
    await page.locator('nav').first().getByRole('button', { name: /02/ }).click();
    await expect.poll(() => new URL(page.url()).hash).toBe('#/axis/2');
  });
});

test.describe('獲得提示', () => {
  test('進入 02：貼出「獲得 8 個新伏筆」，徽章 8 並閃動；3 秒後消失', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/axis/2');
    const toast = page.locator('[data-hint-toast]');
    await expect(toast).toContainText('獲得 8 個新伏筆');
    await expect(page.locator('nav').first().getByLabel('已獲得 8 個伏筆')).toHaveText('8');
    await expect(page.locator('nav [data-flash]').first()).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 5000 });
  });

  test('滑鼠停在提示上時不消失；移開後才消失', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/axis/2');
    const toast = page.locator('[data-hint-toast]');
    await toast.hover();
    await page.waitForTimeout(3600);
    await expect(toast).toBeVisible();
    await page.mouse.move(700, 600);
    await expect(toast).toHaveCount(0, { timeout: 5000 });
  });
});

// ── 手機版註記列（T100）：display:block，上一行字距不被拉開 ───────────────
test.describe('流式版註記列', () => {
  /** 註記列正上方那一行的平均字寬（逐字量測，依行分組取最後一行） */
  const lineAbove = (page: Page, rowIndex: number) =>
    page.evaluate((index) => {
      const row = document.querySelectorAll<HTMLElement>('[data-note-row]')[index]!;
      const paragraph = row.closest('p')!;
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      const lines = new Map<number, { left: number; right: number; count: number }>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        // 只看註記列之前的文字
        if (row.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) break;
        if (row.contains(node)) continue;
        const text = node.textContent ?? '';
        for (let i = 0; i < text.length; i++) {
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getBoundingClientRect();
          if (r.width === 0) continue;
          const key = Math.round(r.top);
          const line = lines.get(key) ?? { left: Infinity, right: -Infinity, count: 0 };
          line.left = Math.min(line.left, r.left);
          line.right = Math.max(line.right, r.right);
          line.count += 1;
          lines.set(key, line);
        }
      }
      const last = lines.get(Math.max(...lines.keys()))!;
      const fontSize = parseFloat(getComputedStyle(paragraph).fontSize);
      return { avg: (last.right - last.left) / last.count, count: last.count, fontSize };
    }, rowIndex);

  for (const width of [320, 360, 390, 640]) {
    test(`寬 ${width}：每個註記列上方那一行的平均字寬 ≈ 字級（沒有被兩端對齊拉伸），且不是孤字行`, async ({
      page,
    }) => {
      await openPage(page, { w: width, h: 844 }, EVENT6);
      await page.locator('[data-event="6"]').click();
      await expect(page.locator('[data-note-row]')).toHaveCount(2);
      for (const index of [0, 1]) {
        const { avg, count, fontSize } = await lineAbove(page, index);
        expect(avg, `註記列 ${index}`).toBeLessThanOrEqual(fontSize + 2);
        expect(avg, `註記列 ${index}`).toBeGreaterThanOrEqual(fontSize - 2);
        expect(count, `註記列 ${index} 上方一行的字數`).toBeGreaterThanOrEqual(2);
      }
      const rows = await page.locator('[data-note-row]').evaluateAll((els) =>
        els.map((el) => ({ display: getComputedStyle(el).display, width: el.getBoundingClientRect().width })),
      );
      const p = (await page.locator('[data-narrative-body] p').boundingBox())!;
      for (const row of rows) {
        expect(row.display).toBe('block');
        expect(row.width).toBeCloseTo(p.width, 0); // 整列寬度
      }
    });
  }

  test('元件圖鑑 #/__kit 的「伏筆註記列」比較區：四種寬度都渲染出 2 個註記列', async ({ page }) => {
    test.skip(!!process.env.E2E_PREVIEW, '元件圖鑑只在開發模式存在，正式建置會移除');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/#/__kit');
    await page.locator('[data-kit-note-sample]').first().waitFor();
    const counts = await page
      .locator('[data-kit-note-sample]')
      .evaluateAll((els) => els.map((el) => el.querySelectorAll('[data-note-row]').length));
    expect(counts).toEqual([2, 2, 2, 2]);
  });
});
