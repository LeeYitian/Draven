import { useEffect, useRef, type RefObject } from 'react';
import { create } from 'zustand';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { useUiStore } from '../../store/ui';

/**
 * 伏筆連動脈衝（設計稿 §4「修改紀錄_方向鍵提示與伏筆連動」）：
 * 頁面上「還沒填的伏筆框格」與側欄「伏筆」按鈕同一時間閃動，讓讀者把兩者聯想在一起。
 * 兩個元素用 Web Animations API 設成同一個 startTime，所以不管誰先掛載都保證同步。
 *
 * 觸發：有未填框格進入可視區、而且托盤沒開；打開托盤或框格被填入／離開畫面就停。
 * 次數：先連播 3 次，之後每 12 秒提示一次。
 */
const PULSE_MS = 2400;
const FIRST_BURST = 3;
const REPEAT_MS = 12_000;

interface PulseState {
  /** 目前在可視區內的未填框格 */
  slots: readonly string[];
  /** 最近一次脈衝（token 遞增；startTime 是兩個元素共用的起點） */
  pulse: { token: number; startTime: number; iterations: number } | null;
  reportSlot(id: string, visible: boolean): void;
  fire(iterations: number): void;
}

let pulseToken = 0;

const useFbPulseStore = create<PulseState>()((set, get) => ({
  slots: [],
  pulse: null,
  reportSlot: (id, visible) => {
    const has = get().slots.includes(id);
    if (visible === has) return;
    set((s) => ({ slots: visible ? [...s.slots, id] : s.slots.filter((x) => x !== id) }));
  },
  fire: (iterations) =>
    set({
      pulse: {
        token: ++pulseToken,
        startTime: Number(document.timeline?.currentTime ?? performance.now()),
        iterations,
      },
    }),
}));

/** 有沒有「框格與側欄按鈕正在互相呼應」（減少動態時用來顯示靜態的 accent 外框） */
export function useFbLinked(): boolean {
  const slots = useFbPulseStore((s) => s.slots.length);
  const trayOpen = useUiStore((s) => s.hintsTrayOpen);
  return slots > 0 && !trayOpen;
}

/** 未填框格：進入可視區時回報，離開、被填入、卸載時撤銷 */
export function useReportEmptySlot(id: string, ref: RefObject<HTMLElement | null>, empty: boolean) {
  const report = useFbPulseStore((s) => s.reportSlot);
  useEffect(() => {
    const el = ref.current;
    if (!empty || !el) {
      report(id, false);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      report(id, true);
      return () => report(id, false);
    }
    const observer = new IntersectionObserver(
      (entries) => report(id, entries[entries.length - 1]?.isIntersecting ?? false),
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      report(id, false);
    };
  }, [id, ref, empty, report]);
}

/** 放在側欄（SideDock／BottomDock）：負責排程，何時播、播幾次 */
export function useFbPulseScheduler() {
  const active = useFbLinked();
  const reduceMotion = useReducedMotion();
  // 框格組合改變（換事件、捲進／捲出畫面）時重新開始，新出現的框格才會和側欄同步
  const slotKey = useFbPulseStore((s) => s.slots.join('|'));
  useEffect(() => {
    if (!active || reduceMotion) return;
    const { fire } = useFbPulseStore.getState();
    fire(FIRST_BURST);
    let interval: number | undefined;
    const settle = window.setTimeout(() => {
      interval = window.setInterval(() => fire(1), REPEAT_MS);
    }, PULSE_MS * FIRST_BURST);
    return () => {
      window.clearTimeout(settle);
      window.clearInterval(interval);
    };
  }, [active, reduceMotion, slotKey]);
}

const keyframes = (): Keyframe[] => [
  {
    offset: 0,
    boxShadow: '0 0 0 0 color-mix(in oklch, var(--color-accent) 55%, transparent)',
    backgroundColor: 'var(--color-accent-100)',
    borderColor: 'var(--color-accent)',
  },
  {
    offset: 0.35,
    boxShadow: '0 0 0 8px color-mix(in oklch, var(--color-accent) 0%, transparent)',
    backgroundColor: 'var(--color-accent-100)',
    borderColor: 'var(--color-accent)',
  },
  { offset: 0.6, boxShadow: '0 0 0 0 transparent', backgroundColor: 'transparent' },
  { offset: 1, boxShadow: '0 0 0 0 transparent', backgroundColor: 'transparent' },
];

/** 套在會閃動的元素上（框格、側欄按鈕）：每次有新的脈衝，就從共同的 startTime 開始播 */
export function useFbPulseTarget<T extends HTMLElement>(enabled: boolean): RefObject<T | null> {
  const ref = useRef<T>(null);
  const pulse = useFbPulseStore((s) => s.pulse);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !pulse || !el || reduceMotion || typeof el.animate !== 'function') return;
    const animation = el.animate(keyframes(), {
      duration: PULSE_MS,
      easing: 'ease-out',
      iterations: pulse.iterations,
    });
    animation.startTime = pulse.startTime;
    return () => animation.cancel();
  }, [pulse, enabled, reduceMotion]);
  return ref;
}
