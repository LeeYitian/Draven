import { beforeEach, describe, expect, it } from 'vitest';
import { getAxisPage } from '../../src/content';
import { edgeState, eventMarkedByNodeFocus, nodeState, visibleEdges } from '../../src/store/selectors';
import { resetStoreForTests, useAppStore } from '../../src/store/store';

// 以 01 頁的真實資料驗證關係圖的可見性、亮暗與焦點互斥（contracts/state-and-events.md §3）。
const page = getAxisPage(1)!;
const { edges, nodes } = page.graph;
const idsOf = (list: { id: string }[]) => list.map((e) => e.id).sort();

describe('01 頁：連線依事件累積', () => {
  it('背景關係（養父子）進頁即可見；事件 1 沒有新線', () => {
    expect(idsOf(visibleEdges(edges, 0))).toEqual(['dravin-elian']);
  });

  it('事件 2：加上任命特使與魔法契約', () => {
    expect(idsOf(visibleEdges(edges, 1))).toEqual(
      ['dravin-elian', 'dravin-fane', 'elis-fane'].sort(),
    );
  });

  it('事件 3：加上三條朝堂的線；事件 4：加上同行與挑釁；事件 5 沒有新線；事件 6：全部 9 條', () => {
    expect(visibleEdges(edges, 2)).toHaveLength(6);
    expect(visibleEdges(edges, 3)).toHaveLength(8);
    expect(visibleEdges(edges, 4)).toHaveLength(8);
    expect(visibleEdges(edges, 5)).toHaveLength(9);
    expect(edges).toHaveLength(9);
  });

  it('直接跳到事件 5 時，1–4 的線一併顯示、事件 6 的線還沒畫', () => {
    const visible = visibleEdges(edges, 4);
    expect(visible.some((e) => e.id === 'fane-bren')).toBe(false);
    expect(visible.some((e) => e.id === 'beastmen-elian')).toBe(true);
  });
});

describe('01 頁：事件焦點的亮暗', () => {
  const participants = (n: number) => new Set(page.events[n - 1]!.participants);

  it('事件 3：本事件新畫的三條線 lit，已畫出的其他線 dim，事件 4 之後 unrevealed', () => {
    const focus = { type: 'event', n: 3 } as const;
    const states = Object.fromEntries(edges.map((e) => [e.id, edgeState(e, 2, focus)]));
    expect(states['dravin-old']).toBe('lit');
    expect(states['minor-old']).toBe('lit');
    expect(states['dravin-minor']).toBe('lit');
    expect(states['dravin-fane']).toBe('dim');
    expect(states['dravin-elian']).toBe('dim');
    expect(states['elis-elian']).toBe('unrevealed');
    expect(states['fane-bren']).toBe('unrevealed');
  });

  it('事件 3：德雷文、守舊貴族、小貴族、法恩 focus；其他 dim', () => {
    const focus = { type: 'event', n: 3 } as const;
    const ctx = { participants: participants(3), edges: visibleEdges(edges, 2) };
    const states = Object.fromEntries(nodes.map((n) => [n.id, nodeState(n.id, focus, ctx)]));
    expect(states).toMatchObject({
      dravin: 'focus',
      'old-nobles': 'focus',
      'minor-nobles': 'focus',
      fane: 'focus',
      elis: 'dim',
      elian: 'dim',
      beastmen: 'dim',
      bren: 'dim',
    });
  });

  it('事件 5（邊界之辯）沒有新線：所有已畫出的線都是 dim；露米、諾爾沒有節點也不影響', () => {
    const focus = { type: 'event', n: 5 } as const;
    for (const e of visibleEdges(edges, 4)) expect(edgeState(e, 4, focus)).toBe('dim');
    const nodeIds = new Set(nodes.map((n) => n.id));
    expect(page.events[4]!.participants.filter((id) => !nodeIds.has(id)).sort()).toEqual([
      'nor',
      'rumi',
    ]);
  });
});

describe('01 頁：節點焦點', () => {
  it('點法恩（目前事件 3）：只有已畫出且與法恩相連的線 lit；法恩與其鄰居 focus', () => {
    const focus = { type: 'node', id: 'fane' } as const;
    const visible = visibleEdges(edges, 2);
    const lit = visible.filter((e) => edgeState(e, 2, focus) === 'lit').map((e) => e.id);
    expect(lit.sort()).toEqual(['dravin-fane', 'elis-fane']);
    const ctx = { participants: new Set<string>(), edges: visible };
    expect(nodeState('fane', focus, ctx)).toBe('focus');
    expect(nodeState('dravin', focus, ctx)).toBe('focus');
    expect(nodeState('elis', focus, ctx)).toBe('focus');
    expect(nodeState('old-nobles', focus, ctx)).toBe('dim');
    // 還沒畫的線（法恩→布倫）不會因為聚焦而出現，布倫也不算鄰居
    expect(nodeState('bren', focus, ctx)).toBe('dim');
  });

  it('點法恩：他出場的事件（2、3、5、6）編號變金色，其他事件不標', () => {
    const focus = { type: 'node', id: 'fane' } as const;
    const marked = page.events.filter((e) => eventMarkedByNodeFocus(e, focus)).map((e) => e.n);
    expect(marked).toEqual([2, 3, 5, 6]);
  });

  it('事件焦點時不標記事件列編號', () => {
    for (const e of page.events)
      expect(eventMarkedByNodeFocus(e, { type: 'event', n: e.n })).toBe(false);
  });
});

describe('01 頁：點節點不改 eventIndex（store）', () => {
  beforeEach(() => resetStoreForTests());

  it('事件 3 時點艾利安：eventIndex 仍為 2、事件焦點被取代；再點事件 4 回到事件焦點', () => {
    const s = useAppStore.getState();
    s.selectEvent(1, 3);
    s.focusNode(1, 'elian');
    expect(useAppStore.getState().axis[1].eventIndex).toBe(2);
    expect(useAppStore.getState().axis[1].focus).toEqual({ type: 'node', id: 'elian' });
    useAppStore.getState().selectEvent(1, 4);
    expect(useAppStore.getState().axis[1].focus).toEqual({ type: 'event', n: 4 });
  });

  it('回退：事件 4 → 2 時，事件 3、4 的線不再可見', () => {
    const s = useAppStore.getState();
    s.selectEvent(1, 4);
    s.selectEvent(1, 2);
    const { eventIndex } = useAppStore.getState().axis[1];
    expect(visibleEdges(edges, eventIndex).map((e) => e.id).sort()).toEqual(
      ['dravin-elian', 'dravin-fane', 'elis-fane'].sort(),
    );
  });
});
