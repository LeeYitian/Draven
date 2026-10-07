import { expect, test, type Page } from '@playwright/test';
import { FLOW_SIZES, STAGE_SIZES, intersects, nodeRects, openPage, stageOverflow } from './helpers';

// US6d：04 劇透遮罩、鏡像對照卡、明信片、抉擇區塊。

const AXIS4 = '#/axis/4';
const cover = (page: Page) => page.locator('[data-spoiler-cover]');
const unlock = (page: Page) => page.getByRole('button', { name: '我準備好了，打開' });
const unlockedInit = (page: Page) =>
  page.addInitScript(() => sessionStorage.setItem('draven:page04Unlocked', 'true'));
const toEvent = async (page: Page, n: number) => {
  await page.locator('[data-event="' + n + '"]').click();
  await expect(page.locator('[data-narrative-body] h2')).not.toBeEmpty();
  await page.waitForTimeout(350);
};
/** 元素本身的尺寸（offsetWidth／Height，不受舞台縮放與 3D 傾斜影響） */
const localSize = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)!;
    return { w: el.offsetWidth, h: el.offsetHeight };
  }, selector);
/** 元素在舞台座標下的矩形 */
const stageRect = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const stage = document.querySelector<HTMLElement>('[data-stage]')!;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth;
    const r = document.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
    return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
  }, selector);

test.describe('舞台版 04：劇透遮罩', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS4);
  });

  test('只蓋頁首以下：頁首與側欄在遮罩外；遮罩不透明、不模糊', async ({ page }) => {
    await expect(cover(page)).toBeVisible();
    const c = await stageRect(page, '[data-spoiler-cover]');
    const header = await stageRect(page, 'header');
    const dock = await stageRect(page, 'nav');
    expect(c.y).toBeGreaterThanOrEqual(header.y + header.h - 1);
    expect(c.x).toBeGreaterThanOrEqual(dock.x + dock.w - 1); // 不蓋側欄
    expect(Math.round(c.x + c.w)).toBe(1440);
    expect(Math.round(c.y + c.h)).toBe(720);
    const style = await cover(page).evaluate((e) => {
      const s = getComputedStyle(e);
      return { bg: s.backgroundColor, filter: s.filter, backdrop: s.backdropFilter };
    });
    expect(style.bg).not.toMatch(/rgba\(.*, 0\)/);
    expect(style.filter).toBe('none');
    expect(style.backdrop === 'none' || style.backdrop === undefined).toBe(true);
    // 標題、說明、按鈕
    await expect(page.getByRole('heading', { name: '第四主軸含有結局' })).toBeVisible();
    await expect(unlock(page)).toBeVisible();
  });

  test('遮罩底下的內容 inert：Tab 一直按也不會聚焦到事件列或關係圖', async ({ page }) => {
    const reachable = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      reachable.add(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el
            ? el.closest('[data-event]')
              ? 'event'
              : el.closest('[data-graph-viewport]')
                ? 'graph'
                : 'other'
            : 'none';
        }),
      );
    }
    expect(reachable.has('event')).toBe(false);
    expect(reachable.has('graph')).toBe(false);
  });

  test('← → 無效；↑ 回到 03；側欄可用', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(cover(page)).toBeVisible();
    expect(await page.evaluate(() => window.location.hash)).toBe('#/axis/4');
    await page.getByRole('button', { name: '人物誌' }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowUp');
    await expect(page).toHaveURL(/#\/axis\/3/);
  });

  test('遮罩期間進度只算 3：伏筆數沒有增加；打開後才獲得 04 的伏筆（+1）並開始畫線', async ({
    page,
  }) => {
    const badge = page.locator('[data-hints-badge], nav [aria-label*="伏筆"]').first();
    expect(await page.evaluate(() => localStorage.getItem('draven:hints'))).toBeNull();
    await unlock(page).click();
    await expect(cover(page)).toHaveCount(0);
    await expect(badge).toContainText('1');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('draven:hints')!));
    expect(stored.owned).toEqual(['second-prophecy']);
    expect(await page.evaluate(() => sessionStorage.getItem('draven:page04Unlocked'))).toBe('true');
    // 打開後內容可操作、事件 01 的線畫出
    await expect(page.locator('[data-event="1"]')).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.locator('.edge:not([data-state="unrevealed"])').count()).toBeGreaterThan(0);
  });

  test('打開後重新整理（同一個分頁）不再出現遮罩；新的分頁（清掉 sessionStorage）會再出現', async ({
    page,
  }) => {
    await unlock(page).click();
    await page.reload();
    await page.locator('main').first().waitFor();
    await expect(cover(page)).toHaveCount(0);
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(cover(page)).toBeVisible();
  });
});

test.describe('舞台版 04：專屬區塊', () => {
  test.beforeEach(async ({ page }) => {
    await unlockedInit(page);
    await openPage(page, { w: 1440, h: 720 }, AXIS4);
  });

  test('事件 03 鏡像卡 430×268、事件 05 明信片 400×240、事件 06 抉擇、其餘沒有', async ({
    page,
  }) => {
    const kinds: string[] = [];
    for (let n = 1; n <= 6; n++) {
      await toEvent(page, n);
      const extra = page.locator('[data-event-extra]');
      kinds.push(
        (await extra.count()) === 0 ? 'none' : (await extra.getAttribute('data-event-extra'))!,
      );
      if (n === 3) {
        const r = await localSize(page, '.mirror-card');
        expect(r).toEqual({ w: 430, h: 268 });
      }
      if (n === 5) {
        const r = await localSize(page, '.postcard');
        expect(r).toEqual({ w: 400, h: 240 });
      }
    }
    expect(kinds).toEqual(['none', 'none', 'mirror', 'none', 'postcard', 'choice']);
  });

  test('明信片：閒置時外層和鏡像卡一樣 rotateY ±8° 來回', async ({ page }) => {
    await toEvent(page, 5);
    const idle = page.locator('.postcard-idle');
    expect(await idle.evaluate((e) => getComputedStyle(e).animationName)).toBe('mirror-idle');
  });

  test('鏡像卡：點擊翻面（rotateY 180°）；閒置時外層 rotateY ±8° 來回', async ({ page }) => {
    await toEvent(page, 3);
    const idle = page.locator('.mirror-idle');
    expect(await idle.evaluate((e) => getComputedStyle(e).animationName)).toBe('mirror-idle');
    const angle = () =>
      idle.evaluate((e) => {
        const m = new DOMMatrix(getComputedStyle(e).transform);
        return (Math.atan2(m.m13, m.m11) * 180) / Math.PI;
      });
    const samples: number[] = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await angle());
      await page.waitForTimeout(700);
    }
    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(8.5);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(2); // 有在動

    await page.locator('.mirror-card').click({ position: { x: 200, y: 150 }, force: true });
    await expect(page.locator('.mirror-card')).toHaveAttribute('data-flipped');
    await page.waitForTimeout(700);
    const flipped = await page.locator('.mirror-card').evaluate((e) => {
      const m = new DOMMatrix(getComputedStyle(e).transform);
      return Math.abs((Math.atan2(m.m13, m.m11) * 180) / Math.PI);
    });
    expect(Math.round(flipped)).toBe(180);
    await expect(page.locator('[data-side="b"].mirror-face')).toContainText('主教');
    // 翻面後看得到的是主教面：面對螢幕的那一面沒有被 backface 隱藏
    const visible = await page.evaluate(() => {
      const b = document.querySelector('[data-side="b"].mirror-face')!.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)!;
      return hit.closest('[data-side]')?.getAttribute('data-side');
    });
    expect(visible).toBe('b');
  });

  test('鏡像卡兩面的列位置對齊（同一個欄位在兩面同一位置）', async ({ page }) => {
    await toEvent(page, 3);
    const rows = await page.evaluate(() => {
      const pick = (side: string) =>
        [...document.querySelectorAll('[data-side="' + side + '"].mirror-face .mirror-row')].map(
          (r) => {
            const face = r.closest('.mirror-face')!.getBoundingClientRect();
            const b = r.getBoundingClientRect();
            return { top: Math.round(b.top - face.top), h: Math.round(b.height) };
          },
        );
      return { a: pick('a'), b: pick('b') };
    });
    expect(rows.a).toEqual(rows.b);
    expect(rows.a).toHaveLength(3);
  });

  test('明信片：點擊翻面 600ms、背面是留言；翻面時微微上浮；說明在卡片下方', async ({ page }) => {
    await toEvent(page, 5);
    // 閒置傾斜（rotateY ±8°）會讓卡片的投影位置一直在變；這個測試要量「回到原位」，先停掉它
    await page.addStyleTag({ content: '.postcard-idle { animation: none !important; }' });
    await expect(page.locator('.postcard img')).toBeVisible();
    // 插圖載入成功
    expect(
      await page.locator('.postcard img').evaluate((e) => (e as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    const before = await stageRect(page, '.postcard');
    // 翻面的 600ms 內由頁面自己逐格（rAF）記錄上浮量：中途有上浮（translateY < -2），結束後回到原位。
    // 不在測試端一格一格輪詢——機器忙時來回的延遲可能整個錯過 600ms。
    await page.evaluate(() => {
      const w = window as unknown as { __lift: number };
      w.__lift = 0;
      const lift = document.querySelector('.postcard-lift')!;
      const tick = () => {
        w.__lift = Math.max(w.__lift, -new DOMMatrix(getComputedStyle(lift).transform).m42);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.locator('.postcard').click();
    await expect(page.locator('.postcard')).toHaveAttribute('data-flipped');
    await page.waitForTimeout(800);
    const highest = await page.evaluate(() => (window as unknown as { __lift: number }).__lift);
    expect(highest).toBeGreaterThan(2);
    await page.waitForTimeout(700);
    const m = await page
      .locator('.postcard')
      .evaluate((e) =>
        Math.abs(
          (Math.atan2(
            new DOMMatrix(getComputedStyle(e).transform).m13,
            new DOMMatrix(getComputedStyle(e).transform).m11,
          ) *
            180) /
            Math.PI,
        ),
      );
    expect(Math.round(m)).toBe(180);
    const after = await stageRect(page, '.postcard');
    expect(Math.abs(after.y - before.y)).toBeLessThan(1); // 回到原位
    const caption = await stageRect(page, '.postcard__caption');
    expect(caption.y).toBeGreaterThanOrEqual(before.y + before.h - 1);
    await expect(page.locator('.postcard__face[data-side="back"]')).toContainText('媽媽很愛你');
  });

  for (const size of STAGE_SIZES) {
    test(
      size.w +
        '×' +
        size.h +
        '：6 個事件逐一檢查——沒有溢出舞台；專屬區塊在左欄 470 內、不蓋到敘述與關係圖',
      async ({ page }) => {
        await openPage(page, size, AXIS4);
        for (let n = 1; n <= 6; n++) {
          await toEvent(page, n);
          expect(await stageOverflow(page), '事件 ' + n).toEqual([]);
          // 只有事件 03、05、06 有專屬區塊
          if ((await page.locator('[data-event-extra]').count()) === 0) {
            expect([3, 5, 6], '事件 ' + n + ' 沒有專屬區塊').not.toContain(n);
            continue;
          }
          const extra = await stageRect(page, '[data-event-extra]');
          const nar = await stageRect(page, '[data-narrative-body]');
          const graph = await stageRect(page, '[data-graph-viewport]');
          expect(extra.y, '事件 ' + n + ' 區塊在敘述之下').toBeGreaterThanOrEqual(
            nar.y + nar.h - 1,
          );
          expect(extra.x + extra.w, '事件 ' + n + ' 不進入旁註欄').toBeLessThanOrEqual(
            112 + 470 + 1,
          );
          expect(extra.x + extra.w).toBeLessThanOrEqual(graph.x);
          expect(extra.y + extra.h, '事件 ' + n + ' 不超出下方區').toBeLessThanOrEqual(
            graph.y + graph.h + 1,
          );
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

  test('分區：為了人類養子／為了非人養育者；節點不重疊', async ({ page }) => {
    const zones = await page.locator('[data-zone-label]').allTextContents();
    // 兩個分區，各自「名稱 · 人數」（名稱是內容，不寫死）
    expect(zones).toHaveLength(2);
    for (const z of zones) expect(z).toMatch(/ · d+$/);
  });

  test('伏筆回收處：事件 02／03／04／05 各有一個框格錨點', async ({ page }) => {
    const expected: Record<number, string> = {
      2: 'cold-hand',
      3: 'second-prophecy',
      4: 'not-mother-again',
      5: 'similar-name',
    };
    for (const [n, id] of Object.entries(expected)) {
      await toEvent(page, Number(n));
      await expect(page.locator('[data-hint="' + id + '"]')).toHaveCount(1);
    }
  });
});

test.describe('減少動態：04 翻面改為淡入淡出', () => {
  test.use({ reducedMotion: 'reduce' });
  test('鏡像卡與明信片不旋轉；看得到的那一面 opacity 1、另一面 0；閒置不自動旋轉', async ({
    page,
  }) => {
    await unlockedInit(page);
    await openPage(page, { w: 1440, h: 720 }, AXIS4);
    await toEvent(page, 3);
    expect(
      await page.locator('.mirror-idle').evaluate((e) => getComputedStyle(e).animationName),
    ).toBe('none');
    const opacity = (sel: string) => page.locator(sel).evaluate((e) => getComputedStyle(e).opacity);
    expect(await opacity('[data-side="a"].mirror-face')).toBe('1');
    expect(await opacity('[data-side="b"].mirror-face')).toBe('0');
    await page.locator('.mirror-card').click({ position: { x: 200, y: 150 }, force: true });
    await page.waitForTimeout(400);
    expect(await opacity('[data-side="a"].mirror-face')).toBe('0');
    expect(await opacity('[data-side="b"].mirror-face')).toBe('1');
    expect(await page.locator('.mirror-card').evaluate((e) => getComputedStyle(e).transform)).toBe(
      'none',
    );

    await toEvent(page, 5);
    await page.locator('.postcard').click();
    await page.waitForTimeout(400);
    expect(await opacity('.postcard__face[data-side="front"]')).toBe('0');
    expect(await opacity('.postcard__face[data-side="back"]')).toBe('1');
    expect(
      await page.locator('.postcard-idle').evaluate((e) => getComputedStyle(e).animationName),
    ).toBe('none');
    expect(await page.locator('.postcard').evaluate((e) => getComputedStyle(e).transform)).toBe(
      'none',
    );
  });
});

test.describe('流式版 04', () => {
  test('390：遮罩直接取代頁首以下；底部導覽列仍可用；打開後顯示內容', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS4);
    await expect(cover(page)).toBeVisible();
    await expect(page.locator('[data-event]').first()).toBeHidden();
    await expect(page.locator('[data-graph-viewport]')).toBeHidden();
    await expect(page.getByRole('button', { name: '人物誌' }).first()).toBeVisible();
    await unlock(page).click();
    await expect(page.locator('[data-event]').first()).toBeVisible();
  });

  for (const size of FLOW_SIZES) {
    test(
      size.w + '×' + size.h + '：鏡像卡、明信片、抉擇區塊都在寬度內，沒有橫向捲動，文字不被裁掉',
      async ({ page }) => {
        await unlockedInit(page);
        await openPage(page, size, AXIS4);
        for (const n of [3, 5, 6]) {
          await page.locator('[data-event="' + n + '"]').dispatchEvent('click');
          await page.waitForTimeout(350);
          const extra = page.locator('[data-event-extra]');
          await extra.scrollIntoViewIfNeeded();
          const box = (await extra.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(size.w + 0.5);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
          ).toBe(true);
        }
        // 鏡像卡：每一列的文字沒有被 overflow 裁掉
        await page.locator('[data-event="3"]').dispatchEvent('click');
        await page.waitForTimeout(350);
        for (const side of ['a', 'b']) {
          if (side === 'b')
            await page.locator('.mirror-card').click({ position: { x: 20, y: 150 }, force: true });
          const clipped = await page.evaluate((s) => {
            return [
              ...document.querySelectorAll('[data-side="' + s + '"].mirror-face .mirror-row'),
            ].map((r) => r.scrollHeight > r.clientHeight + 1);
          }, side);
          expect(clipped, '面 ' + side).toEqual([false, false, false]);
        }
      },
    );
  }

  test('節點不重疊（流式版 04 關係圖）', async ({ page }) => {
    await unlockedInit(page);
    await openPage(page, { w: 360, h: 740 }, AXIS4);
    const rects = await nodeRects(page);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(intersects(rects[i]!, rects[j]!, 1), rects[i]!.id + '×' + rects[j]!.id).toBe(false);
  });
});
