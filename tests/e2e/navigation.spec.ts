import { expect, test, type Page } from '@playwright/test';
import { openPage } from './helpers';

// US1：換頁（舞台版：頁面指示與 ↑↓ 鍵；流式版：底部導覽列與頁面選單），無轉場。

const hash = (page: Page) => new URL(page.url()).hash;

test.describe('舞台版換頁', () => {
  test('↓ 依序進入 01–04，↑ 回上一頁；邊界不動作', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 });
    for (const expected of ['#/axis/1', '#/axis/2', '#/axis/3', '#/axis/4', '#/axis/4']) {
      await page.keyboard.press('ArrowDown');
      await expect.poll(() => hash(page)).toBe(expected);
    }
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => hash(page)).toBe('#/axis/3');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
    await expect.poll(() => hash(page)).toBe('#/');
  });

  test('側欄頁面指示：點擊換頁，目前頁標示 aria-current', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 });
    const nav = page.locator('nav');
    await nav.getByRole('button', { name: /03/ }).click();
    await expect.poll(() => hash(page)).toBe('#/axis/3');
    await expect(nav.getByRole('button', { name: /03/ })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('button', { name: /00/ })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('00 的四條主軸：整列可點進入該主軸', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 });
    await page
      .locator('main')
      .getByRole('button', { name: /魔女集會與時間考驗/ })
      .click();
    await expect.poll(() => hash(page)).toBe('#/axis/2');
  });

  test('換頁沒有轉場：按下後下一個畫面立刻就是新頁，頁面上沒有進行中的動畫', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 });
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => hash(page)).toBe('#/axis/1');
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === 'running' &&
              (a.effect as KeyframeEffect | null)?.target?.closest('main'),
          ).length,
    );
    expect(running).toBe(0);
  });

  test('瀏覽器上一頁／下一頁與網址同步', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => hash(page)).toBe('#/axis/2');
    await page.goBack();
    await expect.poll(() => hash(page)).toBe('#/axis/1');
    await page.goForward();
    await expect.poll(() => hash(page)).toBe('#/axis/2');
  });

  test('直接開啟未知網址回到 00', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 }, '#/nowhere');
    await expect(page.locator('main h1')).toHaveText('世界觀導讀');
  });
});

test.describe('流式版換頁', () => {
  test('底部導覽列：「頁面」開啟選單，選擇後換頁並關閉', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 });
    await page.locator('nav').getByRole('button', { name: /頁面/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /03/ }).click();
    await expect.poll(() => hash(page)).toBe('#/axis/3');
    await expect(dialog).toBeHidden();
  });

  test('不處理方向鍵（保留原生捲動）', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 });
    await page.keyboard.press('ArrowDown');
    expect(hash(page)).toBe('#/');
  });

  test('點 00 的主軸列進入該主軸', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 });
    await page
      .locator('main')
      .getByRole('button', { name: /母愛與地龍契約/ })
      .scrollIntoViewIfNeeded();
    await page
      .locator('main')
      .getByRole('button', { name: /母愛與地龍契約/ })
      .click();
    await expect.poll(() => hash(page)).toBe('#/axis/4');
  });
});
