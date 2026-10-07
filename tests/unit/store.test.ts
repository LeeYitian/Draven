import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTests, useAppStore } from '../../src/store/store.ts';

const s = () => useAppStore.getState();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreForTests();
});

describe('換頁與獲得伏筆', () => {
  it('進入 01：獲得 1 條（忘了送的禮物），並出現提示', () => {
    s().setPage(1);
    expect(s().hints.owned).toEqual(['forgotten-gift']);
    expect(s().hints.toast?.keywords).toEqual(['忘了送的禮物']);
  });

  it('進入 02：獲得 8 條，提示合併為一則；再次進入不重複獲得', () => {
    s().setPage(2);
    expect(s().hints.owned).toHaveLength(8);
    expect(s().hints.toast?.count).toBe(8);
    s().setPage(0);
    s().setPage(2);
    expect(s().hints.owned).toHaveLength(8);
  });

  it('只獲得「進入」的那一主軸的伏筆：從 00 直接進 03 只拿到 2 條（不補發 01、02）', () => {
    s().setPage(3);
    expect(s().hints.owned.sort()).toEqual(['divine-language', 'laughing-cry-man']);
  });

  it('04 遮罩沒打開前不獲得 04 的伏筆；打開後才獲得（G-14）', () => {
    s().setPage(4);
    expect(s().hints.owned).toEqual([]);
    expect(s().page04Unlocked).toBe(false);
    s().unlockPage04();
    expect(s().hints.owned).toEqual(['second-prophecy']);
    expect(s().page04Unlocked).toBe(true);
  });

  it('00 頁沒有伏筆；回到 00 進度為 0', () => {
    s().setPage(0);
    expect(s().hints.owned).toEqual([]);
  });

  it('離開 02 時比較滑桿重設為 50（回到乾淨紙色）', () => {
    s().setPage(2);
    s().setCompare(70);
    s().setPage(3);
    expect(s().compareSlider).toBe(50);
  });
});

describe('事件焦點與節點焦點（互斥，以最後一次點擊為準）', () => {
  it('進入主軸時事件 01 為目前事件並有焦點', () => {
    s().setPage(1);
    expect(s().axis[1].eventIndex).toBe(0);
    expect(s().axis[1].focus).toEqual({ type: 'event', n: 1 });
  });

  it('點事件 5：eventIndex=4、焦點為事件 5', () => {
    s().setPage(1);
    s().selectEvent(1, 5);
    expect(s().axis[1].eventIndex).toBe(4);
    expect(s().axis[1].focus).toEqual({ type: 'event', n: 5 });
  });

  it('再點節點：事件焦點失效、eventIndex 不變（仍只畫到事件 5）', () => {
    s().selectEvent(1, 5);
    s().focusNode(1, 'fane');
    expect(s().axis[1].focus).toEqual({ type: 'node', id: 'fane' });
    expect(s().axis[1].eventIndex).toBe(4);
  });

  it('再點同一個已聚焦的節點：回到目前事件的焦點', () => {
    s().selectEvent(1, 3);
    s().focusNode(1, 'fane');
    s().focusNode(1, 'fane');
    expect(s().axis[1].focus).toEqual({ type: 'event', n: 3 });
  });

  it('stepEvent 前進／後退，到邊界不動作，並把焦點設為該事件', () => {
    s().focusNode(1, 'fane');
    s().stepEvent(1, 1, 6);
    expect(s().axis[1].eventIndex).toBe(1);
    expect(s().axis[1].focus).toEqual({ type: 'event', n: 2 });
    s().stepEvent(1, -1, 6);
    s().stepEvent(1, -1, 6);
    expect(s().axis[1].eventIndex).toBe(0);
    for (let i = 0; i < 10; i++) s().stepEvent(1, 1, 6);
    expect(s().axis[1].eventIndex).toBe(5);
  });

  it('各主軸的事件進度互不影響，離開再回來保留', () => {
    s().selectEvent(1, 4);
    s().selectEvent(2, 2);
    expect(s().axis[1].eventIndex).toBe(3);
    expect(s().axis[2].eventIndex).toBe(1);
  });

  it('畫線動畫：向前推進才有新線動畫；回退或原地不播放', () => {
    s().selectEvent(1, 2);
    expect(s().animateEvent).toMatchObject({ axis: 1, n: 2 });
    const token = s().animateEvent!.token;
    s().selectEvent(1, 1); // 回退
    expect(s().animateEvent?.token).toBe(token); // 沒有新動畫
    s().selectEvent(1, 1); // 原地
    expect(s().animateEvent?.token).toBe(token);
  });
});

describe('追蹤', () => {
  it('只能追蹤人物，群體節點不行；一次一人', () => {
    s().trackPerson('fane');
    expect(s().trackedPersonId).toBe('fane');
    s().trackPerson('nobles'); // 群體節點
    expect(s().trackedPersonId).toBe('fane');
    s().trackPerson('elian');
    expect(s().trackedPersonId).toBe('elian');
    s().untrack();
    expect(s().trackedPersonId).toBeNull();
  });

  it('追蹤開始會觸發回饋（計數遞增）', () => {
    const before = s().trackingFeedback;
    s().trackPerson('fane');
    expect(s().trackingFeedback).toBe(before + 1);
  });

  it('寫入 localStorage，重新載入後保留', () => {
    s().trackPerson('fane');
    expect(JSON.parse(localStorage.getItem('draven:tracked')!)).toBe('fane');
  });
});

describe('伏筆放置', () => {
  beforeEach(() => s().setPage(2));

  it('選取關鍵字（點兩次取消）', () => {
    s().selectHint('first-cold');
    expect(s().hints.selected).toBe('first-cold');
    s().selectHint('first-cold');
    expect(s().hints.selected).toBeNull();
  });

  it('尚未獲得的關鍵字不能選', () => {
    s().selectHint('divine-language');
    expect(s().hints.selected).toBeNull();
  });

  it('放進正確的框格：答對、鎖定、清除選取', () => {
    s().selectHint('first-cold');
    expect(s().placeHint('first-cold')).toBe('solved');
    expect(s().hints.solved).toEqual(['first-cold']);
    expect(s().hints.selected).toBeNull();
  });

  it('放進錯的框格：答錯、關鍵字回到托盤（取消選取）、不計為已解開', () => {
    s().selectHint('first-cold');
    expect(s().placeHint('not-prince')).toBe('wrong');
    expect(s().hints.solved).toEqual([]);
    expect(s().hints.selected).toBeNull();
  });

  it('沒有選取任何關鍵字時放置：無動作', () => {
    expect(s().placeHint('first-cold')).toBe('none');
  });

  it('已解開的關鍵字不可再選', () => {
    s().selectHint('first-cold');
    s().placeHint('first-cold');
    s().selectHint('first-cold');
    expect(s().hints.selected).toBeNull();
  });

  it('已獲得與已解開寫入 localStorage', () => {
    s().selectHint('first-cold');
    s().placeHint('first-cold');
    const saved = JSON.parse(localStorage.getItem('draven:hints')!);
    expect(saved.solved).toEqual(['first-cold']);
    expect(saved.owned).toHaveLength(8);
  });
});

describe('人物誌狀態', () => {
  it('標籤單選：點另一個取代、再點同一個取消', () => {
    s().setTag('tag:family');
    expect(s().people.tag).toBe('tag:family');
    s().setTag('group:royal');
    expect(s().people.tag).toBe('group:royal');
    s().setTag('group:royal');
    expect(s().people.tag).toBeNull();
  });

  it('點卡片＝中心視角；再點中心卡＝展開；清除中心會一併收合', () => {
    s().centerOn('elian');
    expect(s().people.center).toBe('elian');
    expect(s().people.expanded).toBe(false);
    s().centerOn('elian'); // 再點中心卡
    expect(s().people.expanded).toBe(true);
    s().clearCenter();
    expect(s().people.center).toBeNull();
    expect(s().people.expanded).toBe(false);
  });

  it('點另一個人＝換中心並收合展開', () => {
    s().centerOn('elian');
    s().centerOn('elian');
    s().centerOn('fane');
    expect(s().people.center).toBe('fane');
    expect(s().people.expanded).toBe(false);
  });

  it('劇透顯示只由點擊切換，與進度無關', () => {
    s().setPage(4);
    expect(s().people.spoilerRevealed['dravin:2']).toBeUndefined();
    s().toggleSpoiler('dravin', 2);
    expect(s().people.spoilerRevealed['dravin:2']).toBe(true);
    s().toggleSpoiler('dravin', 2);
    expect(s().people.spoilerRevealed['dravin:2']).toBe(false);
  });

  it('關閉人物誌：重設中心與展開（保留排列方式）', () => {
    s().setSort('world');
    s().centerOn('elian');
    s().resetPeopleView();
    expect(s().people.center).toBeNull();
    expect(s().people.sort).toBe('world');
  });
});

describe('關係圖顯示控制', () => {
  it('圖例開關、線上文字開關、縮放範圍 50–200%，重設', () => {
    s().toggleLegend(1, 'conflict');
    expect(s().axis[1].view.legendOn.conflict).toBe(false);
    expect(s().axis[1].view.edgeLabelsOn).toBeNull(); // 預設：依版型
    s().toggleEdgeLabels(1, true); // 舞台預設開 → 關
    expect(s().axis[1].view.edgeLabelsOn).toBe(false);
    s().toggleEdgeLabels(1, false);
    expect(s().axis[1].view.edgeLabelsOn).toBe(true);
    s().setZoom(1, 5);
    expect(s().axis[1].view.zoom).toBe(2);
    s().setZoom(1, 0.1);
    expect(s().axis[1].view.zoom).toBe(0.5);
    s().resetView(1);
    expect(s().axis[1].view.zoom).toBe(1);
    expect(s().axis[1].view.pan).toEqual([0, 0]);
  });
});

describe('重置進度', () => {
  it('清除追蹤、伏筆、遮罩，並清掉儲存', () => {
    s().setPage(2);
    s().trackPerson('fane');
    s().selectHint('first-cold');
    s().placeHint('first-cold');
    s().unlockPage04();
    s().resetProgress();
    expect(s().trackedPersonId).toBeNull();
    expect(s().hints.owned).toEqual([]);
    expect(s().hints.solved).toEqual([]);
    expect(s().page04Unlocked).toBe(false);
    expect(localStorage.getItem('draven:tracked')).toBeNull();
    expect(sessionStorage.getItem('draven:page04Unlocked')).toBeNull();
  });
});
