import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getMedia(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null;
}

function subscribe(onChange: () => void): () => void {
  const media = getMedia();
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

const getSnapshot = () => getMedia()?.matches ?? false;
const getServerSnapshot = () => false;

/**
 * 使用者是否要求「減少動態」。JS 驅動的動畫（畫線、彈簧、閃動）在回傳 true 時直接設為終態；
 * CSS 動畫已在 components.css 以 @media (prefers-reduced-motion) 處理。
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 非 React 程式碼（例如 runSpring 的呼叫端）用 */
export function prefersReducedMotion(): boolean {
  return getSnapshot();
}
