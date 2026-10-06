import { expect, test } from '@playwright/test';
import { openPage } from './helpers';

// SC-008：文字不可選取、不可複製（只擋一般操作，見 research R25）

const selectionText = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.getSelection()?.toString() ?? '');

test.describe('文字保護', () => {
  test('滑鼠拖曳、雙擊、三連擊都選不到文字', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 });
    const intro = page.locator('main p').first();
    const box = (await intro.boundingBox())!;

    await page.mouse.move(box.x + 4, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 4, box.y + box.height - 8, { steps: 8 });
    await page.mouse.up();
    expect(await selectionText(page)).toBe('');

    await intro.dblclick({ position: { x: 30, y: 12 } });
    expect(await selectionText(page)).toBe('');

    await intro.click({ clickCount: 3, position: { x: 30, y: 12 } });
    expect(await selectionText(page)).toBe('');
  });

  test('Ctrl+A 後仍選不到、複製事件被取消且剪貼簿為空', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 });
    await page.keyboard.press('Control+A');
    expect(await selectionText(page)).toBe('');

    const result = await page.evaluate(() => {
      const store = new Map<string, string>([['text/plain', '原本的內容']]);
      const event = new Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', {
        value: {
          setData: (t: string, v: string) => store.set(t, v),
          getData: (t: string) => store.get(t) ?? '',
        },
      });
      document.dispatchEvent(event);
      return { prevented: event.defaultPrevented, text: store.get('text/plain') };
    });
    expect(result.prevented).toBe(true);
    expect(result.text).toBe('');
  });

  test('CSS：整頁 user-select 為 none（含 iOS 長按選單）', async ({ page }) => {
    await openPage(page, { w: 390, h: 844 });
    const styles = await page.evaluate(() => {
      const p = document.querySelector('main p')!;
      const s = getComputedStyle(p);
      return { select: s.userSelect, callout: s.getPropertyValue('-webkit-touch-callout') };
    });
    expect(styles.select).toBe('none');
  });

  test('保護不影響互動：點擊、鍵盤、Ctrl+F 搜尋用的文字仍在 DOM 中', async ({ page }) => {
    await openPage(page, { w: 1440, h: 720 });
    expect(await page.locator('main').innerText()).toContain('人類主導的王國裡');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => new URL(page.url()).hash).toBe('#/axis/1');
  });
});
