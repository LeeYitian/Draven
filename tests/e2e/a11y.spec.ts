import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openPage } from './helpers';

// Phase 9 · T122：無障礙。axe（WCAG 2.x A／AA）在各頁與各種開啟狀態下不得有任何違規；
// 另外檢查合約：鍵盤走得完、對話框與 inert 行為、aria-live、角色與名稱。

const STAGE = { w: 1440, h: 795 };
const FLOW = { w: 390, h: 844 };

const unlock = (page: Page) =>
  page.addInitScript(() => sessionStorage.setItem('draven:page04Unlocked', 'true'));

async function scan(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const summary = result.violations.map(
    (v) =>
      v.id +
      '（' +
      v.nodes.length +
      '）' +
      v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | '),
  );
  expect(summary, label).toEqual([]);
}

for (const [mode, size] of [
  ['舞台版', STAGE],
  ['流式版', FLOW],
] as const) {
  test.describe('axe：' + mode, () => {
    for (const hash of ['#/', '#/axis/1', '#/axis/2', '#/axis/3', '#/axis/4']) {
      test(hash + ' 一進頁', async ({ page }) => {
        await unlock(page);
        await openPage(page, size, hash);
        await page.waitForTimeout(2800); // 獲得提示（3 秒）與畫線動畫
        await scan(page, mode + ' ' + hash);
      });
    }

    test('每個主軸推進到最後一個事件（所有線與引言都出現）', async ({ page }) => {
      await unlock(page);
      for (const [hash, last] of [
        ['#/axis/1', 6],
        ['#/axis/2', 6],
        ['#/axis/3', 7],
        ['#/axis/4', 6],
      ] as const) {
        await openPage(page, size, hash);
        await page.locator('[data-event="' + last + '"]').dispatchEvent('click');
        await page.waitForTimeout(2800);
        await scan(page, mode + ' ' + hash + ' 事件 ' + last);
      }
    });

    test('04 劇透遮罩', async ({ page }) => {
      await openPage(page, size, '#/axis/4');
      await page.waitForTimeout(500);
      await scan(page, mode + ' 04 遮罩');
    });

    test('Popover、人物誌、伏筆托盤', async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem(
          'draven:hints',
          JSON.stringify({
            owned: ['forgotten-gift', 'useful-to-witch', 'cold-hand'],
            solved: ['cold-hand'],
          }),
        ),
      );
      await openPage(page, size, '#/axis/1');
      await page.waitForTimeout(500);
      await page.locator('.link-name').first().dispatchEvent('click');
      await expect(page.locator('[data-popover]')).toBeVisible();
      await scan(page, mode + ' Popover');
      await page.keyboard.press('Escape');

      await page
        .locator('nav')
        .getByRole('button', { name: /^伏筆/ })
        .first()
        .dispatchEvent('click');
      await expect(page.locator('[data-hint-tray]')).toBeVisible();
      await page.waitForTimeout(400);
      await scan(page, mode + ' 伏筆托盤');
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: '人物誌' }).first().dispatchEvent('click');
      await expect(page.locator('[data-people-drawer]')).toBeVisible();
      await page.waitForTimeout(600);
      await scan(page, mode + ' 人物誌');
      await page.locator('[data-person="elian"]').first().dispatchEvent('click');
      await page.waitForTimeout(1400);
      await scan(page, mode + ' 人物誌中心視角');
    });
  });
}

test.describe('axe：02 最舊的紙色與其他狀態', () => {
  test('02 把手拉到最左（age=1）：對比仍達標', async ({ page }) => {
    await openPage(page, STAGE, '#/axis/2');
    await page.locator('[data-compare-handle]').focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    await scan(page, '02 age=1');
  });

  test('01 光譜拖到中間、03 收合三層', async ({ page }) => {
    await openPage(page, STAGE, '#/axis/1');
    await page.locator('[data-event="5"]').click(); // 光譜從事件 05 起才出現
    await page.waitForTimeout(400); // 等敘述淡入完成，axe 才不會量到半透明的文字
    await page.locator('[data-spectrum-thumb]').focus();
    await page.keyboard.press('ArrowLeft');
    await scan(page, '01 光譜');
    await openPage(page, STAGE, '#/axis/3');
    await page.getByRole('button', { name: '只看地底' }).click();
    await page.waitForTimeout(500);
    await scan(page, '03 只看地底');
  });
});

test.describe('鍵盤與語意合約', () => {
  test('Tab 能走遍 00：每個可互動元素都聚焦得到、有可辨識的名稱、有可見的焦點框', async ({
    page,
  }) => {
    await openPage(page, STAGE, '#/');
    const seen: { name: string; outline: string }[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const name = el.getAttribute('aria-label') || el.textContent?.trim() || '';
        const s = getComputedStyle(el);
        return {
          name,
          outline: s.outlineStyle + ' ' + s.outlineWidth,
          tag: el.tagName,
          role: el.getAttribute('role'),
        };
      });
      if (!info) continue;
      seen.push({ name: info.name, outline: info.outline });
      expect(info.name.length, '沒有名稱的可聚焦元素：' + JSON.stringify(info)).toBeGreaterThan(0);
    }
    expect(seen.length).toBeGreaterThan(10);
    // 焦點框：Tab 聚焦時（focus-visible）一律有外框
    expect(seen.every((s) => s.outline.startsWith('solid') && !s.outline.endsWith(' 0px'))).toBe(
      true,
    );
  });

  test('事件列是一組有名稱的按鈕，目前事件標 aria-current；關係圖節點是 button 並有名稱', async ({
    page,
  }) => {
    await openPage(page, STAGE, '#/axis/1');
    const bar = page.getByRole('group', { name: '事件進程' });
    await expect(bar.getByRole('button')).toHaveCount(6);
    await expect(bar.locator('[aria-current="step"]')).toHaveCount(1);
    const nodes = page.locator('[data-node]');
    expect(await nodes.count()).toBe(8);
    for (const n of await nodes.all()) {
      expect(await n.getAttribute('role')).toBe('button');
      expect(((await n.getAttribute('aria-label')) ?? '').length).toBeGreaterThan(0);
    }
  });

  test('光譜與比較滑桿是 slider：有名稱、aria-valuenow、aria-valuetext', async ({ page }) => {
    await openPage(page, STAGE, '#/axis/1');
    await page.locator('[data-event="5"]').click(); // 光譜從事件 05 起才出現
    const spectrum = page.getByRole('slider', { name: '邊界之辯光譜' });
    await expect(spectrum).toHaveAttribute('aria-valuenow', '100');
    expect(await spectrum.getAttribute('aria-valuetext')).toContain('德雷文');
    await openPage(page, STAGE, '#/axis/2');
    const compare = page.getByRole('slider', { name: /兩種面對時間/ });
    await expect(compare).toHaveAttribute('aria-valuenow', '50');
    expect(await compare.getAttribute('aria-valuetext')).toContain('50%');
  });

  test('人物誌開啟時底下的頁面 inert：Tab 不會跑到底下；Esc 關閉後焦點回到開啟它的按鈕', async ({
    page,
  }) => {
    await openPage(page, STAGE, '#/axis/1');
    const opener = page.getByRole('button', { name: '人物誌' }).first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const drawer = page.locator('[data-people-drawer]');
    await expect(drawer).toBeVisible();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(
        () =>
          !!document.activeElement?.closest('[data-people-drawer]') ||
          document.activeElement === document.body,
      );
      expect(inside, '第 ' + (i + 1) + ' 次 Tab 跑到抽屜外').toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('Popover 是 dialog，Esc 關閉並把焦點還給觸發的文字', async ({ page }) => {
    await openPage(page, STAGE, '#/axis/1');
    const link = page.locator('.link-name').first();
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-popover]')).toBeVisible();
    expect(await page.locator('[data-popover]').getAttribute('role')).toBe('dialog');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-popover]')).toHaveCount(0);
    await expect(link).toBeFocused();
  });

  test('aria-live：事件切換時敘述區是 polite 播報；伏筆答對／答錯有播報區文字', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'draven:hints',
        JSON.stringify({
          owned: ['forgotten-gift', 'cold-hand', 'useful-to-witch', 'spirit-scent'],
          solved: [],
        }),
      ),
    );
    await openPage(page, STAGE, '#/axis/3');
    expect(await page.locator('[data-narrative-body]').getAttribute('aria-live')).toBe('polite');
    await page.locator('[data-event="6"]').click();
    await page.waitForTimeout(400);
    await page.locator('nav').getByRole('button', { name: /^伏筆/ }).first().click();
    await page.locator('[data-hint-keyword="forgotten-gift"]').click();
    await page.locator('[data-hint-slot="forgotten-gift"]').click();
    await expect(
      page.locator('[role="status"], [aria-live]').filter({ hasText: '答對了' }).first(),
    ).toBeAttached();
    await page.locator('[data-hint-keyword="cold-hand"]').click();
    await page.locator('[data-hint-slot="spirit-scent"]').click();
    await expect(
      page.locator('[aria-live]').filter({ hasText: '不是這個' }).first(),
    ).toBeAttached();
  });

  test('04 遮罩：區塊有名稱；底下內容 inert；Tab 第一個落點是遮罩的按鈕', async ({ page }) => {
    await openPage(page, STAGE, '#/axis/4');
    await expect(page.getByRole('region', { name: '劇透提醒' })).toBeVisible();
    const reachable: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      reachable.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el?.closest('[data-spoiler-cover]')
            ? 'cover'
            : el?.closest('nav')
              ? 'nav'
              : (el?.tagName ?? 'none');
        }),
      );
    }
    expect(reachable).toContain('cover');
    expect(reachable.filter((r) => r !== 'cover' && r !== 'nav' && r !== 'BODY')).toEqual([]);
  });

  test('流式版觸控目標：底部導覽列與事件格、按鈕高度 ≥ 44px', async ({ page }) => {
    await openPage(page, FLOW, '#/axis/1');
    const heights = await page.evaluate(() => {
      const pick = (sel: string) =>
        [...document.querySelectorAll<HTMLElement>(sel)].map(
          (e) => [sel, e.getBoundingClientRect().height] as const,
        );
      return [...pick('nav button'), ...pick('[data-event]')];
    });
    for (const [sel, h] of heights) expect(h, sel).toBeGreaterThanOrEqual(44);
  });

  test('減少動態：頁面載入後沒有進行中的動畫（時間感、翻面、閃動除外的自動播放全部停止）', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await unlock(page);
    await openPage(page, STAGE, '#/axis/4');
    await page.locator('[data-event="3"]').click();
    await page.waitForTimeout(800);
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter(
          (a) => a.playState === 'running' && (a.effect?.getTiming().iterations ?? 1) === Infinity,
        )
        .map((a) => (a as CSSAnimation).animationName),
    );
    expect(running).toEqual([]);
  });
});
