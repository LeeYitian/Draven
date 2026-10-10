import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// 好讀版（#/read）：入口、深淺色、目錄、反白記錄進度、內容保護。
// 原文由 page.route 攔截 VITE_NOVEL_URL（playwright.config.ts）並回傳假資料，不依賴本機的 full.html。

const NOVEL_URL = 'http://novel.e2e.test/full';
const TOC_URL = 'http://novel.e2e.test/toc';
// 目錄與原文一樣來自 Worker（KV），所以改目錄不需要 commit
const tocJson = JSON.stringify({
  items: [
    { title: '第一幕', match: '這是第1段測試文字' },
    { title: '第二幕', match: '這是第120段測試文字' },
    { title: '不存在的一章', match: '這句話不在文章裡' },
  ],
});

const paragraphs = Array.from(
  { length: 240 },
  (_, i) =>
    `這是第${i + 1}段測試文字，用來確認閱讀排版與捲動。他想了想，沒有說話，只是看著窗外慢慢暗下來的天色，心裡盤算著明天的事。`,
);
const html = `<p>${paragraphs
  .map((p, i) =>
    i === 3
      ? `${p}<img src="https://s.plurk.com/x/516a706919ab3e97f167.png" class="emoticon" alt="(coin)">`
      : p,
  )
  .join('<br /><br class="double-br" />')}</p>`;

async function mockNovel(page: Page) {
  await page.route(TOC_URL, (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: tocJson,
    }),
  );
  await page.route(NOVEL_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      headers: { 'access-control-allow-origin': '*' },
      body: html,
    }),
  );
}

async function openReader(page: Page) {
  await mockNovel(page);
  await page.goto('/#/read');
  await expect(page.locator('[data-b="0"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** 以程式選取某段的一段文字（等同使用者反白） */
async function select(page: Page, index: number, from = 3, to = 12) {
  await page.evaluate(
    ({ index, from, to }) => {
      const p = document.querySelector(`[data-b="${index}"]`)!;
      p.scrollIntoView({ block: 'center' });
      const r = document.createRange();
      r.setStart(p.firstChild!, from);
      r.setEnd(p.firstChild!, to);
      const s = getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
    },
    { index, from, to },
  );
}

test.describe('入口與返回', () => {
  test('桌機側欄在「伏筆」下方有「好讀版」，點擊進入，返回導覽回到原頁', async ({ page }) => {
    await mockNovel(page);
    await page.setViewportSize({ width: 1440, height: 720 });
    await page.goto('/#/axis/2');
    const nav = page.getByRole('navigation', { name: '主要導覽' });
    const names = await nav
      .getByRole('button')
      .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''));
    expect(names.indexOf('好讀版')).toBe(names.findIndex((n) => n.startsWith('伏筆')) + 1);
    await nav.getByRole('button', { name: '好讀版' }).click();
    await expect(page).toHaveURL(/#\/read$/);
    await expect(page.locator('[data-b="0"]')).toBeVisible();
    await page.getByRole('button', { name: '返回導覽' }).click();
    await expect(page).toHaveURL(/#\/axis\/2$/);
  });

  test('手機底部導覽列：「好讀版」在「重置進度」左方', async ({ page }) => {
    await mockNovel(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/');
    const cells = page.getByRole('navigation', { name: '主要導覽' }).getByRole('button');
    const names = await cells.evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''));
    expect(names.indexOf('重置進度')).toBe(names.indexOf('好讀版') + 1);
    await cells.filter({ hasText: '好讀版' }).click();
    await expect(page).toHaveURL(/#\/read$/);
  });
});

test.describe('閱讀版面', () => {
  test('桌機：行寬約 36 字、有目錄欄；手機：無水平捲軸、目錄以面板開啟', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReader(page);
    await expect(page.getByRole('navigation', { name: '目錄' })).toBeVisible();
    const width = await page
      .locator('[data-b="0"]')
      .evaluate((e) => e.getBoundingClientRect().width);
    const fs = await page
      .locator('[data-b="0"]')
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(width / fs).toBeLessThanOrEqual(36.5);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('navigation', { name: '目錄' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: '目錄' }).click();
    await expect(page.getByRole('dialog', { name: '目錄' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '目錄' })).toHaveCount(0);
  });

  test('表情圖使用專案內的檔案，不外連 plurk', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const external: string[] = [];
    page.on('request', (r) => r.url().includes('plurk.com') && external.push(r.url()));
    await openReader(page);
    const src = await page.locator('.rd-emo').first().getAttribute('src');
    expect(src).toContain('/images/emoticons/516a706919ab3e97f167.png');
    expect(external).toEqual([]);
  });

  test('字級：放大後字更大，且維持目前閱讀位置', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReader(page);
    const size = () =>
      page.locator('.rd-article').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    const before = await size();
    await page.locator('[data-b="100"]').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: '放大字級' }).click();
    expect(await size()).toBeGreaterThan(before);
    const top = await page.locator('[data-b="100"]').evaluate((e) => e.getBoundingClientRect().top);
    expect(top).toBeGreaterThan(-200);
    expect(top).toBeLessThan(900);
  });
});

test.describe('深淺色', () => {
  test('起始跟隨系統；手動切換後記住', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await openReader(page);
    await expect(page.locator('.rd')).toHaveAttribute('data-reader-theme', 'dark');
    await page.getByRole('button', { name: '切換為淺色模式' }).click();
    await expect(page.locator('.rd')).toHaveAttribute('data-reader-theme', 'light');
    await page.reload();
    await expect(page.locator('.rd')).toHaveAttribute('data-reader-theme', 'light');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`axe：${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: scheme });
      await openReader(page);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(result.violations.map((v) => `${v.id}：${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    });
  }
});

test.describe('目錄', () => {
  test('目錄來自 Worker：點項目捲到錨句所在段落；找不到的項目停用', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReader(page);
    const nav = page.getByRole('navigation', { name: '目錄' });
    await expect(nav.getByRole('button')).toHaveCount(3);
    await expect(nav.getByRole('button', { name: '不存在的一章' })).toBeDisabled();
    await nav.getByRole('button', { name: '第二幕' }).click();
    await expect
      .poll(() => page.locator('[data-b="119"]').evaluate((e) => e.getBoundingClientRect().top))
      .toBeLessThan(200);
    await expect(nav.getByRole('button', { name: '第二幕' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('目錄取不到（404）不影響閱讀，目錄為空', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockNovel(page);
    await page.unroute(TOC_URL);
    await page.route(TOC_URL, (route) =>
      route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' }),
    );
    await page.goto('/#/read');
    await expect(page.locator('[data-b="0"]')).toBeVisible();
    await expect(page.getByText('這份內容還沒有目錄')).toBeVisible();
  });
});

test.describe('記錄閱讀進度', () => {
  test('反白 → 浮動選項 → 記錄；重新整理後捲回該段', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReader(page);
    await select(page, 150);
    const mark = page.getByRole('button', { name: '記錄閱讀進度' });
    await expect(mark).toBeVisible();
    await mark.click();
    await expect(page.getByText('已記錄閱讀進度')).toBeVisible();
    await expect(page.locator('[data-b="150"]')).toHaveAttribute('data-bookmark', 'true');
    await expect(mark).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('已回到上次閱讀的位置')).toBeVisible();
    const box = await page.locator('[data-b="150"]').evaluate((e) => e.getBoundingClientRect());
    expect(box.top).toBeGreaterThan(0);
    expect(box.bottom).toBeLessThan(844);
  });

  test('取消反白後浮動選項消失；「從頭開始」回到頂端', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReader(page);
    await select(page, 60);
    await expect(page.getByRole('button', { name: '記錄閱讀進度' })).toBeVisible();
    await page.evaluate(() => getSelection()!.removeAllRanges());
    await expect(page.getByRole('button', { name: '記錄閱讀進度' })).toHaveCount(0);

    await select(page, 60);
    await page.getByRole('button', { name: '記錄閱讀進度' }).click();
    await page.reload();
    await page.getByRole('button', { name: '從頭開始' }).click();
    expect(await page.evaluate(() => scrollY)).toBeLessThan(5);
  });

  test('來源更新後仍以文字找回；找不到時提示並停在開頭', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReader(page);
    await select(page, 80);
    await page.getByRole('button', { name: '記錄閱讀進度' }).click();

    // 在開頭插入一段新內容 → 段落索引全部位移，仍應找回
    await page.unroute(NOVEL_URL);
    await page.route(NOVEL_URL, (route) =>
      route.fulfill({
        contentType: 'text/plain; charset=utf-8',
        headers: { 'access-control-allow-origin': '*' },
        body: `<p>新增的開頭。<br /><br />${paragraphs.join('<br /><br />')}</p>`,
      }),
    );
    await page.reload();
    await expect(page.locator('[data-b="81"]')).toHaveAttribute('data-bookmark', 'true');

    // 全文換成完全不同的內容 → 找不到
    await page.unroute(NOVEL_URL);
    await page.route(NOVEL_URL, (route) =>
      route.fulfill({
        contentType: 'text/plain; charset=utf-8',
        headers: { 'access-control-allow-origin': '*' },
        body: '<p>完全不同的一篇文章。<br /><br />只有兩段。</p>',
      }),
    );
    await page.reload();
    await expect(page.getByText(/找不到上次的閱讀位置/)).toBeVisible();
  });
});

test.describe('內容保護與出處', () => {
  test('導覽頁文字仍不可選取；好讀版只在文章區可反白，但不能複製', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReader(page);
    await select(page, 10);
    expect(await page.evaluate(() => getSelection()!.toString())).not.toBe('');

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
      const ctx = new Event('contextmenu', { bubbles: true, cancelable: true });
      document.querySelector('[data-b="10"]')!.dispatchEvent(ctx);
      const drag = new Event('dragstart', { bubbles: true, cancelable: true });
      document.querySelector('[data-b="10"]')!.dispatchEvent(drag);
      return {
        copy: event.defaultPrevented,
        text: store.get('text/plain'),
        ctx: ctx.defaultPrevented,
        drag: drag.defaultPrevented,
      };
    });
    expect(result).toEqual({ copy: true, text: '', ctx: true, drag: true });

    // 文章區以外（頂列）依然不可選取
    expect(
      await page.evaluate(() => getComputedStyle(document.querySelector('.rd-bar')!).userSelect),
    ).toBe('none');
  });

  test('列印時不輸出內文', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReader(page);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.rd-article')).toBeHidden();
    await expect(page.locator('.rd-print-note')).toBeVisible();
  });

  test('桌機：出處聲明在目錄側欄最底端；分頁標題為「德雷文 · 好讀版」', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReader(page);
    await expect(page).toHaveTitle('德雷文 · 好讀版');
    const link = page.locator('.rd-toc .rd-footer a');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://www.plurk.com/p/3ivkr0zpza');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(page.locator('.rd-toc .rd-footer')).toContainText('著作權屬原作者所有');
    // 文章結尾不再有聲明；聲明貼在側欄底部
    await expect(page.locator('main .rd-footer')).toHaveCount(0);
    const box = await page
      .locator('.rd-toc .rd-footer')
      .evaluate((e) => e.getBoundingClientRect().bottom);
    expect(box).toBeGreaterThan(880);
  });

  test('手機：出處聲明在目錄面板最底端', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReader(page);
    await expect(page.locator('.rd-footer')).toHaveCount(0);
    await page.getByRole('button', { name: '目錄' }).click();
    const footer = page.getByRole('dialog', { name: '目錄' }).locator('.rd-footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('a')).toHaveAttribute('href', 'https://www.plurk.com/p/3ivkr0zpza');
  });
});

test.describe('載入失敗', () => {
  test('顯示錯誤與重試，重試成功後顯示內文', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    let fail = true;
    await page.route(NOVEL_URL, (route) =>
      fail
        ? route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: '' })
        : route.fulfill({
            contentType: 'text/plain; charset=utf-8',
            headers: { 'access-control-allow-origin': '*' },
            body: html,
          }),
    );
    await page.goto('/#/read');
    await expect(page.getByRole('alert')).toContainText('無法載入內容');
    fail = false;
    await page.getByRole('button', { name: '重試' }).click();
    await expect(page.locator('[data-b="0"]')).toBeVisible();
  });
});
