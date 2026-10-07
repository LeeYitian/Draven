import { useEffect } from 'react';

/**
 * 效能退化開關：裝置記憶體很小或使用者要求節省資料時，不套用整頁的 sepia 濾鏡（最吃效能的一層），
 * 紙色與暈影仍然保留。濾鏡本身由 CSS 的 html[data-age-lite] 關閉。
 */
export function shouldUseLiteAge(): boolean {
  if (typeof window === 'undefined') return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const saveData = window.matchMedia?.('(prefers-reduced-data: reduce)').matches ?? false;
  return saveData || (memory !== undefined && memory <= 2);
}

/**
 * 02 的「時間感」：把陳舊度 age（0–1）寫成根元素上的 CSS 變數 --age，樣式全在 CSS（components.css）：
 * ① 紙色（--color-bg 往 accent-200 混合）② 邊緣暈影 ③ 內容 sepia。
 * 呼叫端傳入的 age 已量化（1/50 階梯），所以拖曳時只有階梯改變才會更新整頁樣式。
 * 元件卸載（離開 02）時移除變數與標記，頁面立刻回到乾淨紙色。
 */
export function useAge(age: number): void {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--age', String(age));
    if (age > 0) root.setAttribute('data-aged', '');
    else root.removeAttribute('data-aged');
  }, [age]);

  useEffect(() => {
    const root = document.documentElement;
    if (shouldUseLiteAge()) root.setAttribute('data-age-lite', '');
    return () => {
      root.style.removeProperty('--age');
      root.removeAttribute('data-aged');
      root.removeAttribute('data-age-lite');
    };
  }, []);
}
