import { describe, expect, it } from 'vitest';
import { people } from '../../src/content/index.ts';
import type { GraphEdge } from '../../src/content/schema.ts';
import {
  acquirableHints,
  edgeState,
  effectiveEdgeLabels,
  eventMarkedByNodeFocus,
  eventTracked,
  isOnStage,
  nodeState,
  popoverText,
  progress,
  slotAnswer,
  spoilerKey,
  spoilerVisible,
  visibleEdges,
  type Focus,
} from '../../src/store/selectors.ts';

const person = (id: string) => people.find((p) => p.id === id)!;

describe('progress（故事進度）', () => {
  it('等於目前主軸；00＝0', () => {
    expect(progress(0, false)).toBe(0);
    expect(progress(1, false)).toBe(1);
    expect(progress(3, false)).toBe(3);
  });

  it('04 遮罩沒打開前只算到 3（G-14）；打開後才是 4', () => {
    expect(progress(4, false)).toBe(3);
    expect(progress(4, true)).toBe(4);
  });
});

describe('isOnStage（人物卡登場：累積到目前主軸）', () => {
  it('00（進度 0）或直接由 #/people 進入：全部未登場', () => {
    for (const p of people) expect(isOnStage(p, 0)).toBe(false);
  });

  it('德雷文在 01 就登場；維洛在 03 才登場', () => {
    expect(isOnStage(person('dravin'), 1)).toBe(true);
    expect(isOnStage(person('velo'), 2)).toBe(false);
    expect(isOnStage(person('velo'), 3)).toBe(true);
  });

  it('累積：03 時 01、02 出場過的人仍是彩色', () => {
    expect(isOnStage(person('rumi'), 3)).toBe(true); // 01 出場，03 沒出場，仍登場
  });

  it('退回前面的主軸，後面才出場的人變回灰階（不記錄最遠位置）', () => {
    expect(isOnStage(person('snake-god'), 3)).toBe(true);
    expect(isOnStage(person('snake-god'), 1)).toBe(false);
  });

  it('各進度的登場人數（依真實資料）：0→0、1→各主軸累積遞增', () => {
    const counts = [0, 1, 2, 3, 4].map((n) => people.filter((p) => isOnStage(p, n)).length);
    expect(counts[0]).toBe(0);
    expect(counts[4]).toBe(15);
    for (let i = 1; i < counts.length; i++)
      expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
  });
});

describe('popoverText（Popover 只顯示目前主軸之前的內容）', () => {
  const dravin = person('dravin');

  it('00 與 01：只有基本身分', () => {
    expect(popoverText(dravin, 0)).toEqual({ base: dravin.popover[0], layers: [] });
    expect(popoverText(dravin, 1)).toEqual({ base: dravin.popover[0], layers: [] });
  });

  it('02：基本身分＋讀完 01', () => {
    expect(popoverText(dravin, 2).layers.map((l) => l.axis)).toEqual([1]);
  });

  it('04：基本身分＋01、02、03；永遠不含 04', () => {
    const r = popoverText(dravin, 4);
    expect(r.layers.map((l) => l.axis)).toEqual([1, 2, 3]);
    expect(r.layers.map((l) => l.text)).toEqual([
      dravin.popover[1],
      dravin.popover[2],
      dravin.popover[3],
    ]);
  });

  it('空白段落跳過（艾莉絲 03 沒有新內容，04 時只顯示 01、02）', () => {
    const elis = person('elis');
    expect(elis.popover[3]).toBe('');
    expect(popoverText(elis, 4).layers.map((l) => l.axis)).toEqual([1, 2]);
  });

  it('所有人物在任何進度：不洩漏更後面的階段（逐一檢查 15 人×進度 0–4）', () => {
    for (const p of people) {
      for (let prog = 0; prog <= 4; prog++) {
        const r = popoverText(p, prog);
        expect(r.base).toBe(p.popover[0]);
        const maxAxis = Math.max(0, ...r.layers.map((l) => l.axis));
        expect(maxAxis).toBeLessThanOrEqual(Math.max(0, prog - 1)); // 進度 n 最多顯示到「讀完 n-1」
        for (const l of r.layers) expect(l.text).not.toBe('');
      }
    }
  });

  it('人馬預言家在 00–04 都只有基本身分（其餘段落皆空）', () => {
    const seer = person('centaur-seer');
    expect(popoverText(seer, 4).layers).toEqual([]);
  });
});

describe('spoilerVisible（人物誌劇透：只看讀者點擊，不看進度）', () => {
  it('預設一律遮蔽，不論進度', () => {
    expect(spoilerVisible({}, 'dravin', 2)).toBe(false);
  });

  it('只有點擊過才顯示；可再隱藏', () => {
    const revealed = { [spoilerKey('dravin', 2)]: true };
    expect(spoilerVisible(revealed, 'dravin', 2)).toBe(true);
    expect(spoilerVisible({ [spoilerKey('dravin', 2)]: false }, 'dravin', 2)).toBe(false);
  });

  it('不同人物、不同主軸互不影響', () => {
    const revealed = { [spoilerKey('dravin', 2)]: true };
    expect(spoilerVisible(revealed, 'dravin', 4)).toBe(false);
    expect(spoilerVisible(revealed, 'elian', 2)).toBe(false);
  });
});

// ── 關係圖 ────────────────────────────────────────────────────────
const edge = (
  id: string,
  from: string,
  to: string,
  event: number | 'bg',
  kind: GraphEdge['kind'] = 'relation',
): GraphEdge => ({
  id,
  from,
  to,
  label: id,
  kind,
  event,
});
const edges = [
  edge('bg', 'dravin', 'elian', 'bg'),
  edge('e2', 'dravin', 'fane', 2, 'key'),
  edge('e3', 'dravin', 'nobles', 3, 'conflict'),
  edge('e4', 'elis', 'elian', 4),
  edge('e6', 'fane', 'bren', 6),
];

describe('visibleEdges（累積）', () => {
  it('背景關係進頁即可見；其餘依事件累積', () => {
    expect(visibleEdges(edges, 0).map((e) => e.id)).toEqual(['bg']);
    expect(visibleEdges(edges, 1).map((e) => e.id)).toEqual(['bg', 'e2']);
    expect(visibleEdges(edges, 4).map((e) => e.id)).toEqual(['bg', 'e2', 'e3', 'e4']);
  });

  it('直接點事件 5（index 4）時 1–4 的線一併顯示，事件 6 的線還沒畫', () => {
    expect(visibleEdges(edges, 4).some((e) => e.id === 'e6')).toBe(false);
  });
});

describe('edgeState', () => {
  const ev = (n: number): Focus => ({ type: 'event', n });

  it('尚未到的事件：unrevealed', () => {
    expect(edgeState(edges[4]!, 3, ev(4))).toBe('unrevealed');
  });

  it('事件焦點：該事件新畫的線 lit，其餘（含背景）dim', () => {
    expect(edgeState(edges[1]!, 2, ev(3))).toBe('dim');
    expect(edgeState(edges[2]!, 2, ev(3))).toBe('lit');
    expect(edgeState(edges[0]!, 2, ev(3))).toBe('dim');
  });

  it('事件沒有新線（例如 01 事件 5）：已畫出的線全部 dim', () => {
    for (const e of visibleEdges(edges, 4)) expect(edgeState(e, 4, ev(5))).toBe('dim');
  });

  it('節點焦點：與該節點相連且已畫出的線 lit，其餘 dim；不會多畫後面的線', () => {
    const focus: Focus = { type: 'node', id: 'fane' };
    expect(edgeState(edges[1]!, 4, focus)).toBe('lit'); // dravin→fane
    expect(edgeState(edges[4]!, 4, focus)).toBe('unrevealed'); // fane→bren 屬事件 6，尚未畫出
    expect(edgeState(edges[3]!, 4, focus)).toBe('dim');
  });

  it('沒有焦點：normal', () => {
    expect(edgeState(edges[1]!, 2, null)).toBe('normal');
  });
});

describe('nodeState', () => {
  const participants = new Set(['dravin', 'fane']);

  it('事件焦點：參與者 focus、其他 dim', () => {
    const focus: Focus = { type: 'event', n: 5 };
    expect(nodeState('dravin', focus, { participants, edges: [] })).toBe('focus');
    expect(nodeState('elian', focus, { participants, edges: [] })).toBe('dim');
  });

  it('節點焦點：自己與（已畫出連線的）鄰居 focus，其他 dim', () => {
    const focus: Focus = { type: 'node', id: 'fane' };
    const visible = visibleEdges(edges, 4);
    expect(nodeState('fane', focus, { participants, edges: visible })).toBe('focus');
    expect(nodeState('dravin', focus, { participants, edges: visible })).toBe('focus');
    expect(nodeState('elis', focus, { participants, edges: visible })).toBe('dim');
    expect(nodeState('bren', focus, { participants, edges: visible })).toBe('dim'); // 與 fane 的線尚未畫出
  });

  it('沒有焦點：normal', () => {
    expect(nodeState('dravin', null, { participants, edges: [] })).toBe('normal');
  });
});

describe('追蹤與節點焦點的事件標記', () => {
  const event = { participants: ['dravin', 'fane'] };

  it('eventTracked：被追蹤者出場的事件', () => {
    expect(eventTracked(event, 'fane')).toBe(true);
    expect(eventTracked(event, 'elian')).toBe(false);
    expect(eventTracked(event, null)).toBe(false);
  });

  it('eventMarkedByNodeFocus：只在節點焦點時標記該節點出場的事件', () => {
    expect(eventMarkedByNodeFocus(event, { type: 'node', id: 'fane' })).toBe(true);
    expect(eventMarkedByNodeFocus(event, { type: 'node', id: 'elian' })).toBe(false);
    expect(eventMarkedByNodeFocus(event, { type: 'event', n: 1 })).toBe(false);
    expect(eventMarkedByNodeFocus(event, null)).toBe(false);
  });
});

describe('伏筆', () => {
  it('slotAnswer：關鍵字與框格同一條伏筆才算答對', () => {
    expect(slotAnswer('gift', 'gift')).toBe(true);
    expect(slotAnswer('gift', 'name')).toBe(false);
  });

  it('acquirableHints：進入主軸時獲得該主軸的、尚未擁有的伏筆（不補發之前主軸的）', () => {
    const list = [
      { id: 'a', acquire: 1 },
      { id: 'b', acquire: 2 },
      { id: 'c', acquire: 2 },
      { id: 'd', acquire: 3 },
    ];
    expect(acquirableHints(list, 2, []).map((h) => h.id)).toEqual(['b', 'c']);
    expect(acquirableHints(list, 2, ['b']).map((h) => h.id)).toEqual(['c']);
    expect(acquirableHints(list, 3, []).map((h) => h.id)).toEqual(['d']);
    expect(acquirableHints(list, 0, [])).toEqual([]);
  });
});

describe('effectiveEdgeLabels（線上文字預設）', () => {
  it('沒選過：預設顯示；選過就照選擇', () => {
    expect(effectiveEdgeLabels(null)).toBe(true); // 沒選過：預設顯示（舞台、手機都一樣）
    expect(effectiveEdgeLabels(true)).toBe(true);
    expect(effectiveEdgeLabels(false)).toBe(false);
  });
});
