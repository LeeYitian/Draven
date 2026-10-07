import { expect, test, type Page } from '@playwright/test';
import { FLOW_SIZES, STAGE_SIZES, openPage, stageOverflow } from './helpers';

// US6a：01 邊界之辯光譜——拖曳、吸附、鍵盤、交叉連結閃動、版面。

const AXIS1 = '#/axis/1';
const thumb = (page: Page) => page.locator('[data-spectrum-thumb]');
const track = (page: Page) => page.locator('[data-spectrum-track]');
const value = async (page: Page) => Number(await thumb(page).getAttribute('aria-valuenow'));

/** 指標中心在軌道上的位置（0–100，以螢幕座標換算，與舞台縮放無關） */
async function thumbPercent(page: Page): Promise<number> {
  const t = (await thumb(page).boundingBox())!;
  const r = (await track(page).boundingBox())!;
  return ((t.x + t.width / 2 - r.x) / r.width) * 100;
}

async function dragTo(page: Page, percent: number, release = true) {
  const t = (await thumb(page).boundingBox())!;
  const r = (await track(page).boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + (r.width * percent) / 100, t.y + t.height / 2, { steps: 8 });
  if (release) await page.mouse.up();
}

test.describe('舞台版：光譜拖曳與吸附', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, { w: 1440, h: 795 }, AXIS1);
  });

  test('預設在 100（德雷文）；位置與軌道端點對齊', async ({ page }) => {
    expect(await value(page)).toBe(100);
    expect(Math.abs((await thumbPercent(page)) - 100)).toBeLessThan(0.5);
  });

  test('拖曳中連續移動、最近立場即時切換；放開吸附到最近立場', async ({ page }) => {
    await dragTo(page, 66, false);
    // 66 在法恩（50）與布倫（75）之間，較近布倫；指標跟著手，不吸附
    expect(Math.abs((await thumbPercent(page)) - 66)).toBeLessThan(1.5);
    await expect(page.locator('[data-stance="bren"]')).toHaveAttribute('data-current');
    await expect(page.locator('[data-spectrum-detail]')).toContainText('基層信徒');
    await expect(thumb(page)).toHaveAttribute('data-dragging');

    await page.mouse.move(
      (await track(page).boundingBox())!.x + 0.58 * (await track(page).boundingBox())!.width,
      (await thumb(page).boundingBox())!.y + 10,
    );
    await expect(page.locator('[data-stance="fane"]')).toHaveAttribute('data-current');

    await page.mouse.up();
    // 吸附 200ms：之後穩定在法恩（50）
    await expect.poll(async () => Math.round(await thumbPercent(page))).toBe(50);
    expect(await value(page)).toBe(50);
    await expect(thumb(page)).not.toHaveAttribute('data-dragging');
  });

  test('拖出軌道兩端：夾在 0–100', async ({ page }) => {
    await dragTo(page, -40, false);
    expect(Math.abs(await thumbPercent(page))).toBeLessThan(0.5);
    await page.mouse.up();
    await expect.poll(() => value(page)).toBe(10);
    await dragTo(page, 180);
    await expect.poll(() => value(page)).toBe(100);
  });

  test('點軌道空白處：跳到該處最近的立場', async ({ page }) => {
    const r = (await track(page).boundingBox())!;
    await page.mouse.click(r.x + r.width * 0.28, r.y + 12);
    await expect.poll(() => value(page)).toBe(30);
    await expect(page.locator('[data-spectrum-detail]')).toContainText('集會領袖');
  });

  test('← → 在光譜上只跳立場；不換事件、不換頁；Tab 離開後 ← → 才換事件', async ({ page }) => {
    await thumb(page).focus();
    await page.keyboard.press('ArrowLeft');
    expect(await value(page)).toBe(75);
    await page.keyboard.press('ArrowLeft');
    expect(await value(page)).toBe(50);
    await expect(page.locator('[data-event][aria-current="step"]')).toHaveAttribute(
      'data-event',
      '1',
    );
    expect(page.url()).toContain('#/axis/1');
    await page.keyboard.press('ArrowRight');
    expect(await value(page)).toBe(75);
    await page.keyboard.press('Home');
    expect(await value(page)).toBe(10);
    await thumb(page).blur();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-event][aria-current="step"]')).toHaveAttribute(
      'data-event',
      '2',
    );
  });

  test('指標在立場之間時，金線從最近的立場指向指標', async ({ page }) => {
    await dragTo(page, 62, false);
    await expect(page.locator('.spectrum__guide')).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator('.spectrum__guide')).toHaveCount(0);
  });

  test('立場的人名可開 Popover，且點人名不會移動指標', async ({ page }) => {
    await page.locator('[data-stance="nor"] [role="button"]').click();
    await expect(page.locator('[data-popover]')).toBeVisible();
    expect(await value(page)).toBe(100);
  });

  test('事件 05「見下方 ↓」：光譜取得焦點並閃動；舞台版不捲動頁面', async ({ page }) => {
    await page.locator('[data-event="5"]').click();
    const link = page.getByRole('button', { name: '見下方 ↓' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator('[data-spectrum-flash]')).toBeVisible();
    await expect(thumb(page)).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('[data-spectrum-flash]')).toHaveCount(0, { timeout: 2000 });
    await link.click();
    await expect(page.locator('[data-spectrum-flash]')).toBeVisible(); // 再點重播
  });
});

test.describe('01 光譜：版面', () => {
  for (const size of STAGE_SIZES) {
    test(`舞台版 ${size.w}×${size.h}：光譜在舞台內、不與關係圖相交，各立場的引言都放得下`, async ({
      page,
    }) => {
      await openPage(page, size, AXIS1);
      await page.locator('[data-event="5"]').click();
      for (const key of ['Home', 'ArrowRight', 'ArrowRight', 'ArrowRight']) {
        await thumb(page).focus();
        await page.keyboard.press(key);
        expect(await stageOverflow(page)).toEqual([]);
        const s = (await page.locator('[data-spectrum]').boundingBox())!;
        const g = (await page.locator('[data-graph-viewport]').boundingBox())!;
        expect(s.x + s.width).toBeLessThanOrEqual(g.x);
        // 光譜整塊在視窗內（下緣不被裁掉）
        expect(s.y + s.height).toBeLessThanOrEqual(size.h);
      }
    });
  }

  for (const size of FLOW_SIZES) {
    test(`流式版 ${size.w}×${size.h}：光譜不超出視窗寬、名字不互相重疊`, async ({ page }) => {
      await openPage(page, size, AXIS1);
      await page.locator('[data-spectrum]').scrollIntoViewIfNeeded();
      const s = (await page.locator('[data-spectrum]').boundingBox())!;
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + s.width).toBeLessThanOrEqual(size.w + 0.5);
      const names = await page.locator('.spectrum__name').evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { left: r.left, right: r.right };
        }),
      );
      for (let i = 1; i < names.length; i++)
        expect(names[i]!.left).toBeGreaterThanOrEqual(names[i - 1]!.right);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
    });
  }
});

test.describe('流式版：觸控', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('「見下方 ↓」先捲到光譜再閃動；點軌道選立場；軌道設定 pan-y、把手 none', async ({
    page,
  }) => {
    await openPage(page, { w: 390, h: 844 }, AXIS1);
    expect(await track(page).evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
    expect(await thumb(page).evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');

    await page.locator('[data-event="5"]').tap();
    await page.getByRole('button', { name: '見下方 ↓' }).tap();
    await expect(page.locator('[data-spectrum-flash]')).toBeVisible();
    const box = (await page.locator('[data-spectrum]').boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);

    const r = (await track(page).boundingBox())!;
    await page.touchscreen.tap(r.x + r.width * 0.3, r.y + 12);
    await expect.poll(() => value(page)).toBe(30);
  });
});
