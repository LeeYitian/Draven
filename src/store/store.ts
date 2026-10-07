/**
 * 全站執行期狀態（data-model §2、contracts/state-and-events.md）。
 * 單一 zustand store、依功能分區（nav／axis／tracking／hints／people／extras）：
 * 動作之間會互相呼叫（換頁會觸發獲得伏筆、離開 02 會重設比較滑桿…），放在一起最直接。
 * 規則本身（劇透、亮暗、可見性）在 selectors.ts 的純函式，這裡只負責「狀態如何改變」。
 */
import { create } from 'zustand';
import { hints as allHints, people as allPeople } from '../content/index.ts';
import type { EdgeKind } from '../content/schema.ts';
import { persistentStorage, sessionOnlyStorage } from '../lib/storage.ts';
import { acquirableHints, slotAnswer, type Focus, type Page } from './selectors.ts';

export type AxisKey = 1 | 2 | 3 | 4;
export type SortMode = 'group' | 'order' | 'world';
export type LegendKey = EdgeKind | 'group';

export interface GraphView {
  zoom: number;
  pan: [number, number];
  legendOn: Record<LegendKey, boolean>;
  /** 線上文字：null＝依版型預設（舞台開、流式關，見 effectiveEdgeLabels）；讀者點過之後記住選擇 */
  edgeLabelsOn: boolean | null;
  layerCollapsed: Record<string, boolean>;
}

export interface AxisState {
  /** 目前事件（0-based） */
  eventIndex: number;
  focus: Focus;
  /** 是否已進入過（第一次進入才播放事件 01 的畫線） */
  entered: boolean;
  view: GraphView;
}

export interface HintsState {
  owned: string[];
  solved: string[];
  selected: string | null;
  toast: { count: number; keywords: string[]; token: number } | null;
}

export interface PeopleState {
  center: string | null;
  expanded: boolean;
  /** 單選篩選：'group:royal'／'axis:2'／'tag:family'；null＝無 */
  tag: string | null;
  sort: SortMode;
  spoilerRevealed: Record<string, boolean>;
}

export interface AppState {
  // nav
  page: Page;
  peopleOpen: boolean;
  navReady: boolean;
  // axis
  axis: Record<AxisKey, AxisState>;
  animateEvent: { axis: AxisKey; n: number; token: number } | null;
  // tracking
  trackedPersonId: string | null;
  trackingFeedback: number;
  // hints
  hints: HintsState;
  // people
  people: PeopleState;
  // extras
  compareSlider: number;
  spectrum: number;
  page04Unlocked: boolean;

  syncNav(page: Page, peopleOpen: boolean): void;
  setPage(page: Page): void;
  selectEvent(axis: AxisKey, n: number): void;
  stepEvent(axis: AxisKey, delta: 1 | -1, eventCount: number): void;
  focusNode(axis: AxisKey, nodeId: string): void;
  setZoom(axis: AxisKey, zoom: number): void;
  setPan(axis: AxisKey, pan: [number, number]): void;
  resetView(axis: AxisKey): void;
  toggleLegend(axis: AxisKey, key: LegendKey): void;
  /** current 是畫面目前實際的開關狀態（含版型預設），切換成相反 */
  toggleEdgeLabels(axis: AxisKey, current: boolean): void;
  setLayerCollapsed(axis: AxisKey, collapsed: Record<string, boolean>): void;
  trackPerson(id: string): void;
  untrack(): void;
  selectHint(id: string | null): void;
  placeHint(slotHintId: string): 'solved' | 'wrong' | 'none';
  dismissToast(): void;
  setTag(tag: string): void;
  centerOn(id: string): void;
  clearCenter(): void;
  setExpanded(expanded: boolean): void;
  setSort(sort: SortMode): void;
  toggleSpoiler(personId: string, axis: number): void;
  resetPeopleView(): void;
  setCompare(value: number): void;
  setSpectrum(value: number): void;
  unlockPage04(): void;
  resetProgress(): void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const peopleIds = new Set(allPeople.map((p) => p.id));

const initialView = (): GraphView => ({
  zoom: 1,
  pan: [0, 0],
  legendOn: { key: true, relation: true, conflict: true, group: true },
  edgeLabelsOn: null,
  layerCollapsed: {},
});
const initialAxis = (): AxisState => ({
  eventIndex: 0,
  focus: { type: 'event', n: 1 },
  entered: false,
  view: initialView(),
});
const initialPeople = (): PeopleState => ({
  center: null,
  expanded: false,
  tag: null,
  sort: 'group',
  spoilerRevealed: {},
});

interface SavedHints {
  owned: string[];
  solved: string[];
}

function createInitialState(): Omit<AppState, keyof Actions> {
  const saved = persistentStorage.get<SavedHints>('hints', { owned: [], solved: [] });
  return {
    page: 0,
    peopleOpen: false,
    navReady: false,
    axis: { 1: initialAxis(), 2: initialAxis(), 3: initialAxis(), 4: initialAxis() },
    animateEvent: null,
    trackedPersonId: persistentStorage.get<string | null>('tracked', null),
    trackingFeedback: 0,
    hints: { owned: saved.owned, solved: saved.solved, selected: null, toast: null },
    people: initialPeople(),
    compareSlider: 50,
    spectrum: 100,
    page04Unlocked: sessionOnlyStorage.get('page04Unlocked', false),
  };
}
type Actions = {
  [
    K in keyof AppState as AppState[K] extends (...args: never[]) => unknown ? K : never
  ]: AppState[K];
};

let animationToken = 0;
let toastToken = 0;

export const useAppStore = create<AppState>()((set, get) => {
  /** 只改某一主軸的狀態 */
  const patchAxis = (
    axis: AxisKey,
    patch: Partial<AxisState> | ((a: AxisState) => Partial<AxisState>),
  ) =>
    set((s) => ({
      axis: {
        ...s.axis,
        [axis]: { ...s.axis[axis], ...(typeof patch === 'function' ? patch(s.axis[axis]) : patch) },
      },
    }));
  const patchView = (axis: AxisKey, patch: Partial<GraphView>) =>
    patchAxis(axis, (a) => ({ view: { ...a.view, ...patch } }));

  /** 獲得該主軸的伏筆；回傳是否有新獲得（用於提示） */
  const acquire = (axis: AxisKey) => {
    const fresh = acquirableHints(allHints, axis, get().hints.owned);
    if (fresh.length === 0) return;
    set((s) => ({
      hints: {
        ...s.hints,
        owned: [...s.hints.owned, ...fresh.map((h) => h.id)],
        toast: { count: fresh.length, keywords: fresh.map((h) => h.keyword), token: ++toastToken },
      },
    }));
  };

  /** 進入某主軸：獲得伏筆；第一次進入時播放事件 01 的畫線。04 遮罩沒打開前什麼都不做（G-14） */
  const enter = (page: Page) => {
    if (page === 0) return;
    const axis = page as AxisKey;
    if (axis === 4 && !get().page04Unlocked) return;
    acquire(axis);
    if (!get().axis[axis].entered) {
      patchAxis(axis, { entered: true });
      set({ animateEvent: { axis, n: get().axis[axis].eventIndex + 1, token: ++animationToken } });
    }
  };

  const initial = createInitialState();

  return {
    ...initial,

    // ── nav ───────────────────────────────────────────────────
    syncNav(page, peopleOpen) {
      const prev = get();
      if (prev.peopleOpen && !peopleOpen) get().resetPeopleView();
      set({ peopleOpen, navReady: true });
      if (page !== prev.page || !prev.navReady) get().setPage(page);
    },
    setPage(page) {
      const prev = get().page;
      set({ page });
      if (prev === 2 && page !== 2) set({ compareSlider: 50 }); // 離開 02：回到乾淨紙色
      enter(page);
    },

    // ── axis：事件與焦點 ────────────────────────────────────────
    selectEvent(axis, n) {
      const prev = get().axis[axis].eventIndex;
      patchAxis(axis, { eventIndex: n - 1, focus: { type: 'event', n } });
      if (n - 1 > prev) set({ animateEvent: { axis, n, token: ++animationToken } });
    },
    stepEvent(axis, delta, eventCount) {
      const next = clamp(get().axis[axis].eventIndex + delta, 0, eventCount - 1);
      if (next === get().axis[axis].eventIndex) return;
      get().selectEvent(axis, next + 1);
    },
    focusNode(axis, nodeId) {
      const { focus, eventIndex } = get().axis[axis];
      const same = focus?.type === 'node' && focus.id === nodeId;
      // 點節點：事件焦點失效、eventIndex 不變；再點同一個節點＝回到目前事件的焦點
      patchAxis(axis, {
        focus: same ? { type: 'event', n: eventIndex + 1 } : { type: 'node', id: nodeId },
      });
    },

    // ── axis：關係圖顯示 ────────────────────────────────────────
    setZoom: (axis, zoom) => patchView(axis, { zoom: clamp(zoom, ZOOM_MIN, ZOOM_MAX) }),
    setPan: (axis, pan) => patchView(axis, { pan }),
    resetView: (axis) => patchView(axis, { zoom: 1, pan: [0, 0] }),
    toggleLegend: (axis, key) =>
      patchView(axis, {
        legendOn: {
          ...get().axis[axis].view.legendOn,
          [key]: !get().axis[axis].view.legendOn[key],
        },
      }),
    toggleEdgeLabels: (axis, current) => patchView(axis, { edgeLabelsOn: !current }),
    setLayerCollapsed: (axis, collapsed) => patchView(axis, { layerCollapsed: collapsed }),

    // ── tracking ──────────────────────────────────────────────
    trackPerson(id) {
      if (!peopleIds.has(id)) return; // 群體節點不可追蹤
      set((s) => ({ trackedPersonId: id, trackingFeedback: s.trackingFeedback + 1 }));
    },
    untrack: () => set({ trackedPersonId: null }),

    // ── hints ─────────────────────────────────────────────────
    selectHint(id) {
      const { hints } = get();
      if (id === null || hints.selected === id) return set({ hints: { ...hints, selected: null } });
      if (!hints.owned.includes(id) || hints.solved.includes(id)) return; // 沒獲得或已解開：不可選
      set({ hints: { ...hints, selected: id } });
    },
    placeHint(slotHintId) {
      const { hints } = get();
      if (!hints.selected) return 'none';
      const correct = slotAnswer(slotHintId, hints.selected);
      set({
        hints: {
          ...hints,
          selected: null,
          solved: correct ? [...hints.solved, hints.selected] : hints.solved,
        },
      });
      return correct ? 'solved' : 'wrong';
    },
    dismissToast: () => set((s) => ({ hints: { ...s.hints, toast: null } })),

    // ── people ────────────────────────────────────────────────
    setTag: (tag) =>
      set((s) => ({ people: { ...s.people, tag: s.people.tag === tag ? null : tag } })),
    centerOn(id) {
      const { center } = get().people;
      // 點中心卡本體＝原地展開；點另一個人＝換中心並收合
      set((s) => ({ people: { ...s.people, center: id, expanded: center === id } }));
    },
    clearCenter: () => set((s) => ({ people: { ...s.people, center: null, expanded: false } })),
    setExpanded: (expanded) => set((s) => ({ people: { ...s.people, expanded } })),
    setSort: (sort) => set((s) => ({ people: { ...s.people, sort } })),
    toggleSpoiler(personId, axis) {
      const key = `${personId}:${axis}`;
      set((s) => ({
        people: {
          ...s.people,
          spoilerRevealed: { ...s.people.spoilerRevealed, [key]: !s.people.spoilerRevealed[key] },
        },
      }));
    },
    resetPeopleView: () => set((s) => ({ people: { ...initialPeople(), sort: s.people.sort } })),

    // ── extras ────────────────────────────────────────────────
    setCompare: (value) => set({ compareSlider: value }),
    setSpectrum: (value) => set({ spectrum: value }),
    unlockPage04() {
      set({ page04Unlocked: true });
      if (get().page === 4) enter(4); // 打開遮罩後才獲得 04 的伏筆
    },

    // ── 重置 ──────────────────────────────────────────────────
    resetProgress() {
      persistentStorage.remove('tracked');
      persistentStorage.remove('hints');
      sessionOnlyStorage.remove('page04Unlocked');
      set((s) => ({
        trackedPersonId: null,
        hints: { owned: [], solved: [], selected: null, toast: null },
        page04Unlocked: false,
        axis: { 1: initialAxis(), 2: initialAxis(), 3: initialAxis(), 4: initialAxis() },
        animateEvent: null,
        people: { ...initialPeople(), sort: s.people.sort },
      }));
    },
  };
});

// ── 持久化：只在相關欄位改變時寫入；空值就移除，避免殘留 ──────────────────────
useAppStore.subscribe((state, prev) => {
  if (state.trackedPersonId !== prev.trackedPersonId) {
    if (state.trackedPersonId === null) persistentStorage.remove('tracked');
    else persistentStorage.set('tracked', state.trackedPersonId);
  }
  if (state.hints.owned !== prev.hints.owned || state.hints.solved !== prev.hints.solved) {
    if (state.hints.owned.length === 0 && state.hints.solved.length === 0)
      persistentStorage.remove('hints');
    else persistentStorage.set('hints', { owned: state.hints.owned, solved: state.hints.solved });
  }
  if (state.page04Unlocked !== prev.page04Unlocked) {
    if (state.page04Unlocked) sessionOnlyStorage.set('page04Unlocked', true);
    else sessionOnlyStorage.remove('page04Unlocked');
  }
});

/** 測試用：把 store 還原成（讀取目前儲存後的）初始狀態 */
export function resetStoreForTests() {
  const fresh = createInitialState();
  useAppStore.setState(fresh);
}
