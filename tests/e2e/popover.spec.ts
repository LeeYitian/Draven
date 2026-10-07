import { expect, test, type Page } from '@playwright/test';
import { STAGE_SIZES, openPage, stageCenter } from './helpers';

// US3：Popover 的定位與關閉、追蹤標記與取消。

const AXIS1 = '#/axis/1';

/** 螢幕上的矩形換成舞台座標 */
const stageRect = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const stage = document.querySelector<HTMLElement>('[data-stage]')!;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth;
    const r = document.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
    return {
      left: (r.left - sr.left) / k,
      top: (r.top - sr.top) / k,
      right: (r.right - sr.left) / k,
      bottom: (r.bottom - sr.top) / k,
      width: r.width / k,
      height: r.height / k,
    };
  }, selector);

const openDravin = async (page: Page) => {
  await page.locator('[data-narrative] [role="button"]', { hasText: '德雷文' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
};

test.describe('舞台版 Popover', () => {
  for (const size of STAGE_SIZES) {
    test(`${size.w}×${size.h}：寬 300、在錨點下方 12px、完全在舞台內`, async ({ page }) => {
      await openPage(page, size, AXIS1);
      await openDravin(page);
      const anchor = await stageRect(page, '[data-narrative] [role="button"][aria-expanded="true"]');
      const card = await stageRect(page, '[data-popover]');
      expect(card.width).toBeCloseTo(300, 0);
      expect(card.top).toBeCloseTo(anchor.bottom + 12, 0);
      expect(card.left).toBeGreaterThanOrEqual(16 - 0.5);
      expect(card.right).toBeLessThanOrEqual(1440 - 16 + 0.5);
      expect(card.bottom).toBeLessThanOrEqual(720 - 16);
      await expect(page.locator('[data-popover]')).toHaveAttribute('data-placement', 'below');
    });
  }

  test('空間不足時翻到錨點上方，仍在舞台內', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    // 把一個人名移到舞台下緣附近（固定定位），模擬「下方放不下」
    await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>('[data-narrative] [role="button"]')!;
      link.style.cssText = 'position:fixed;left:300px;bottom:30px;display:inline-block';
    });
    await page.locator('[data-narrative] [role="button"]').first().click();
    const card = await stageRect(page, '[data-popover]');
    const anchor = await stageRect(page, '[data-narrative] [role="button"][aria-expanded="true"]');
    await expect(page.locator('[data-popover]')).toHaveAttribute('data-placement', 'above');
    expect(card.bottom).toBeCloseTo(anchor.top - 12, 0);
    expect(card.top).toBeGreaterThanOrEqual(16 - 0.5);
  });

  test('靠右邊緣時水平夾在舞台內（右側留 16）', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>('[data-narrative] [role="button"]')!;
      link.style.cssText = 'position:fixed;right:4px;top:300px;display:inline-block';
    });
    await page.locator('[data-narrative] [role="button"]').first().click();
    const card = await stageRect(page, '[data-popover]');
    expect(card.right).toBeLessThanOrEqual(1440 - 16 + 0.5);
  });

  test('開啟時錨點為選中樣式、焦點進入 Popover；Esc 關閉並回到錨點', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await openDravin(page);
    await expect(page.locator('[data-popover]')).toBeFocused();
    const bg = await page
      .locator('[data-narrative] [role="button"][aria-expanded="true"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-narrative] [role="button"]').first()).toBeFocused();
  });

  test('點外部關閉；再點同一人名也關閉；點另一個人名直接切換', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-event="2"]').click();
    await expect(page.locator('[data-narrative] h2')).toHaveText('異族入朝');
    const links = page.locator('[data-narrative] [role="button"]');
    await links.filter({ hasText: '法恩' }).first().click();
    await expect(page.getByRole('dialog')).toContainText('法恩');
    await links.filter({ hasText: '艾莉絲' }).first().click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toContainText('艾莉絲');
    await links.filter({ hasText: '艾莉絲' }).first().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await links.filter({ hasText: '法恩' }).first().click();
    await page.mouse.click(700, 650); // 舞台左下的空白處
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('進度內容：01 的德雷文只有基本身分與「依目前進度 01」；00 頁為 00', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await openDravin(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('人類王國的國王，推動多族共榮。');
    await expect(dialog).toContainText('依目前進度 01');
    await expect(dialog).not.toContainText('身負雙頭蛇詛咒'); // 讀完 02 才有
    await page.keyboard.press('Escape');
    await page.locator('nav').getByRole('button', { name: /00/ }).click();
    await page.locator('main [role="button"]', { hasText: '德雷文' }).first().click();
    await expect(page.getByRole('dialog')).toContainText('依目前進度 00');
  });

  test('名詞 Popover：固定內容、沒有進度頁尾；關係圖節點不開 Popover', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.locator('[data-narrative] [role="button"]', { hasText: '交流特使' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('派往各族領地交流的使者');
    await expect(dialog).not.toContainText('依目前進度');
    await page.keyboard.press('Escape');
    await page.locator('[data-node="dravin"]').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('「在人物誌查看 →」關閉 Popover 並前往 #/people', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await openDravin(page);
    await page.getByRole('button', { name: '在人物誌查看 →' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe('#/people');
  });

  test('換事件（→）時 Popover 關閉', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await openDravin(page);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('流式版 Popover', () => {
  test('底部面板：貼齊視窗底部、附遮罩；點遮罩關閉', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS1);
    await page.locator('[role="button"]', { hasText: '德雷文' }).first().scrollIntoViewIfNeeded();
    await page.locator('[data-narrative-body] [role="button"], section [role="button"]', { hasText: '德雷文' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.y + box.height).toBeCloseTo(844, 0);
    expect(box.width).toBeCloseTo(390, 0);
    await page.mouse.click(195, 100); // 遮罩（面板上方）
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('面板開啟時，其下方的頁面不會被誤點（遮罩攔截）', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS1);
    await page.locator('section [role="button"]', { hasText: '德雷文' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.mouse.click(195, 60);
    expect(await page.locator('[data-event][aria-current="step"]').getAttribute('data-event')).toBe('1');
  });
});

test.describe('追蹤人物', () => {
  const trackFane = (page: Page) =>
    page.addInitScript(() => localStorage.setItem('draven:tracked', JSON.stringify('fane')));

  test('追蹤法恩：他出場的事件（2、3、5、6）右上掛書籤；關係圖與 00 不標亮', async ({ page }) => {
    await trackFane(page);
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    const tracked = await page.locator('[data-event][data-tracked]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-event')),
    );
    expect(tracked).toEqual(['2', '3', '5', '6']);
    // 書籤在事件格右上角
    const pos = await page.locator('[data-event="2"]').evaluate((el) => {
      const after = getComputedStyle(el, '::after');
      return { right: after.right, top: after.top, width: after.width };
    });
    expect(pos).toEqual({ right: '10px', top: '-1px', width: '10px' });
    // 節點沒有追蹤標記；00 頁也沒有
    await expect(page.locator('[data-node][data-tracked]')).toHaveCount(0);
    await page.locator('nav').getByRole('button', { name: /00/ }).click();
    await expect(page.locator('main [data-tracked]')).toHaveCount(0);
  });

  test('側欄追蹤區塊顯示姓名；按 × 取消後書籤消失、儲存清除', async ({ page }) => {
    await trackFane(page);
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    const nav = page.locator('nav').first();
    await expect(nav).toContainText('追蹤中');
    await expect(nav).toContainText('法恩');
    await nav.getByRole('button', { name: '取消追蹤' }).click();
    await expect(page.locator('[data-event][data-tracked]')).toHaveCount(0);
    await expect(nav).not.toContainText('追蹤中');
    expect(await page.evaluate(() => localStorage.getItem('draven:tracked'))).toBeNull();
  });

  test('追蹤狀態在重新整理與換頁後保留', async ({ page }) => {
    await trackFane(page);
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await page.reload();
    await page.locator('main').first().waitFor();
    await expect(page.locator('[data-event][data-tracked]')).toHaveCount(4);
  });

  test('儲存的值不是人物（群體 id）時忽略：不追蹤、不掛書籤', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('draven:tracked', JSON.stringify('beastmen')),
    );
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    await expect(page.locator('[data-event][data-tracked]')).toHaveCount(0);
    await expect(page.locator('nav').first()).not.toContainText('追蹤中');
  });

  test('流式版：導覽列顯示追蹤者；點開面板可取消', async ({ page }) => {
    await trackFane(page);
    await openPage(page, { w: 390, h: 844 }, AXIS1);
    const nav = page.locator('nav');
    await expect(nav).toContainText('法恩');
    await expect(page.locator('[data-event][data-tracked]')).toHaveCount(4);
    await nav.getByRole('button', { name: /法恩/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: '取消追蹤' }).click();
    await expect(page.locator('[data-event][data-tracked]')).toHaveCount(0);
  });

  test('舞台座標：事件格書籤不影響事件格寬度（仍 6 等分）', async ({ page }) => {
    await trackFane(page);
    await openPage(page, { w: 1440, h: 720 }, AXIS1);
    const a = await stageCenter(page, '[data-event="1"]');
    const b = await stageCenter(page, '[data-event="2"]');
    expect(b.x - a.x).toBeCloseTo((1288 - 8 * 5) / 6 + 8, 0);
  });
});
