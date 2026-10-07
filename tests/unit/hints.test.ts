import { beforeEach, describe, expect, it } from 'vitest';
import { getAxisPage, hints } from '../../src/content';
import { collectRefs, parseMarkup } from '../../src/content/markup';
import { placeHintAction } from '../../src/features/hints/actions';
import { resetStoreForTests, useAppStore } from '../../src/store/store';
import { useUiStore } from '../../src/store/ui';

const s = () => useAppStore.getState();
const ui = () => useUiStore.getState();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreForTests();
  useUiStore.setState({ hintFeedback: null, announcement: null, hintDragging: false });
});

describe('獲得規則（進入主軸時）', () => {
  const owned = () => s().hints.owned.length;

  it('01→1、02→8、03→2、04→1（打開遮罩後），共 12；每條只獲得一次', () => {
    s().setPage(1);
    expect(owned()).toBe(1);
    s().setPage(2);
    expect(owned()).toBe(9);
    s().setPage(3);
    expect(owned()).toBe(11);
    s().setPage(4);
    expect(owned()).toBe(11); // 04 遮罩沒打開：不獲得
    s().unlockPage04();
    expect(owned()).toBe(12);
    s().setPage(1);
    s().setPage(2);
    expect(owned()).toBe(12);
    expect(new Set(s().hints.owned).size).toBe(12);
  });

  it('不補發：直接進 03 只拿 2 條，沒拿 01、02 的', () => {
    s().setPage(3);
    expect(owned()).toBe(2);
    expect(s().hints.owned).toEqual(['laughing-cry-man', 'divine-language']);
  });

  it('獲得提示：單個顯示關鍵字、多個合併（count）；再次進入不再出現', () => {
    s().setPage(1);
    expect(s().hints.toast).toMatchObject({ count: 1, keywords: ['忘了送的禮物'] });
    s().dismissToast();
    s().setPage(2);
    expect(s().hints.toast?.count).toBe(8);
    s().dismissToast();
    s().setPage(1);
    expect(s().hints.toast).toBeNull();
  });

  it('資料驗證：每條伏筆的回收處文字中，{h:id} 恰有一個，且位於指定的頁與事件（已建立的頁）', () => {
    for (const hint of hints) {
      const page = getAxisPage(hint.recycle.axis);
      if (!page) continue; // 02、04 的內容檔尚未建立
      const event = page.events.find((e) => e.n === hint.recycle.event)!;
      const refs = collectRefs(parseMarkup(event.text)).filter((r) => r.type === 'h' && r.arg === hint.id);
      expect(refs, hint.id).toHaveLength(1);
    }
  });
});

describe('放置判定（placeHintAction）', () => {
  beforeEach(() => {
    s().setPage(3);
    s().setPage(2); // 取得 02 的 8 條（含 spirit-scent、useful-to-witch、bishop-scent）
    s().setPage(1);
  });

  it('沒有選取任何關鍵字：無動作', () => {
    expect(placeHintAction('forgotten-gift')).toBe('none');
    expect(ui().hintFeedback).toBeNull();
  });

  it('答對：鎖定（solved）、清除選取、框格閃動回饋、播報關鍵字', () => {
    s().selectHint('forgotten-gift');
    expect(placeHintAction('forgotten-gift')).toBe('solved');
    expect(s().hints.solved).toContain('forgotten-gift');
    expect(s().hints.selected).toBeNull();
    expect(ui().hintFeedback).toMatchObject({ slotId: 'forgotten-gift', kind: 'solved' });
    expect(ui().announcement?.text).toBe('答對了：忘了送的禮物');
  });

  it('答錯：關鍵字回托盤（選取清除）、不計為已解開、框格震動回饋、播報', () => {
    s().selectHint('spirit-scent');
    expect(placeHintAction('useful-to-witch')).toBe('wrong');
    expect(s().hints.solved).toEqual([]);
    expect(s().hints.selected).toBeNull();
    expect(ui().hintFeedback).toMatchObject({ slotId: 'useful-to-witch', kind: 'wrong' });
    expect(ui().announcement?.text).toBe('不是這個，關鍵字已放回托盤');
  });

  it('已解開的框格不可再放；已解開的關鍵字不可再選', () => {
    s().selectHint('forgotten-gift');
    placeHintAction('forgotten-gift');
    s().selectHint('forgotten-gift');
    expect(s().hints.selected).toBeNull(); // 已解開：選不起來
    s().selectHint('spirit-scent');
    expect(placeHintAction('forgotten-gift')).toBe('none'); // 框格已鎖定
    expect(s().hints.selected).toBe('spirit-scent'); // 選取不受影響
  });

  it('沒獲得的關鍵字選不起來（直接跳頁時其框格只是探索提示）', () => {
    localStorage.clear();
    resetStoreForTests();
    s().setPage(3);
    s().selectHint('second-prophecy'); // 04 才會獲得
    expect(s().hints.selected).toBeNull();
    expect(placeHintAction('divine-language')).toBe('none');
  });

  it('回饋 token 對得上才清除（舊的計時不會清掉新的回饋）', () => {
    ui().giveFeedback('a', 'wrong');
    const first = ui().hintFeedback!.token;
    ui().giveFeedback('b', 'wrong');
    ui().clearFeedback(first);
    expect(ui().hintFeedback?.slotId).toBe('b');
    ui().clearFeedback(ui().hintFeedback!.token);
    expect(ui().hintFeedback).toBeNull();
  });
});

describe('持久化', () => {
  it('已獲得與已解開寫入 localStorage，重新載入後保留', () => {
    s().setPage(1);
    s().selectHint('forgotten-gift');
    placeHintAction('forgotten-gift');
    expect(JSON.parse(localStorage.getItem('draven:hints')!)).toEqual({
      owned: ['forgotten-gift'],
      solved: ['forgotten-gift'],
    });
    resetStoreForTests();
    expect(s().hints.owned).toEqual(['forgotten-gift']);
    expect(s().hints.solved).toEqual(['forgotten-gift']);
    expect(s().hints.selected).toBeNull(); // 選取不持久化
  });

  it('重置進度清掉伏筆與儲存', () => {
    s().setPage(2);
    s().resetProgress();
    expect(s().hints.owned).toEqual([]);
    expect(localStorage.getItem('draven:hints')).toBeNull();
  });
});
