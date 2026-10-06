import { useSyncExternalStore } from 'react';

/**
 * 自寫 hash 路由（research R17、contracts/state-and-events.md §1）。
 * GitHub Pages 沒有 SPA 回退，hash 路由不需要任何伺服器設定。
 *
 *   #/            00 世界觀導讀（未知路徑一律回這裡）
 *   #/axis/1…4    主軸 01–04
 *   #/people      人物誌抽屜：疊在 returnTo 頁面上；直接進入時 returnTo = '#/'
 *   #/__kit       開發專用元件圖鑑（正式版不渲染）
 *
 * 開發旗標（?editor=1、?debug=anchors、?allowSelect=1）寫在 # 之前，不影響路由。
 */
export type AxisNumber = 1 | 2 | 3 | 4;
export type Route =
  { name: 'home' } | { name: 'axis'; axis: AxisNumber } | { name: 'people' } | { name: 'kit' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0]!.replace(/\/+$/, '');
  if (path === '' || path === '/') return { name: 'home' };
  if (path === '/people') return { name: 'people' };
  if (path === '/__kit' || path.startsWith('/__kit/')) return { name: 'kit' };
  const axis = /^\/axis\/([1-4])$/.exec(path);
  if (axis) return { name: 'axis', axis: Number(axis[1]) as AxisNumber };
  return { name: 'home' };
}

export function formatRoute(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'axis':
      return `#/axis/${route.axis}`;
    case 'people':
      return '#/people';
    case 'kit':
      return '#/__kit';
  }
}

/** 頁碼（0＝00 導讀、1–4＝主軸）→ 路由 */
export function routeForPage(page: number): Route {
  return page >= 1 && page <= 4 ? { name: 'axis', axis: page as AxisNumber } : { name: 'home' };
}

/** 路由 → 頁碼；人物誌與圖鑑不是「頁」，回傳 null */
export function pageOfRoute(route: Route): 0 | 1 | 2 | 3 | 4 | null {
  if (route.name === 'home') return 0;
  if (route.name === 'axis') return route.axis;
  return null;
}

interface AppHistoryState {
  fromApp: true;
  returnTo: string;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

let attached = false;
function attach() {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
}

export function subscribe(listener: () => void): () => void {
  attach();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentHash(): string {
  return location.hash || '#/';
}

export function currentRoute(): Route {
  return parseHash(location.hash);
}

/** 換頁（不會重複堆疊相同頁面） */
export function navigate(route: Route): void {
  const target = formatRoute(route);
  if (currentHash() === target) return;
  history.pushState(null, '', target);
  notify();
}

/** 目前頁面關閉人物誌後要回到哪裡 */
export function getReturnTo(): string {
  const state = history.state as Partial<AppHistoryState> | null;
  return state?.returnTo ?? '#/';
}

/** 開啟人物誌：記住開啟前的頁面，讓「上一頁」＝關閉人物誌 */
export function openPeople(): void {
  if (parseHash(location.hash).name === 'people') return;
  const state: AppHistoryState = { fromApp: true, returnTo: currentHash() };
  history.pushState(state, '', '#/people');
  notify();
}

/** 關閉人物誌：回到 returnTo。直接進入 #/people 時沒有上一頁可回，改導向 returnTo（00） */
export function closePeople(): void {
  const state = history.state as Partial<AppHistoryState> | null;
  if (state?.fromApp) {
    history.back(); // popstate 會通知訂閱者
    return;
  }
  history.replaceState(null, '', getReturnTo());
  notify();
}

/** React：目前的 hash 字串（穩定的原始值，避免 useSyncExternalStore 無限重繪） */
export function useHash(): string {
  return useSyncExternalStore(subscribe, currentHash, () => '#/');
}
