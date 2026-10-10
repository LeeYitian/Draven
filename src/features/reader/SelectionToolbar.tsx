import { Bookmark } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../../content';

/**
 * 反白文字後出現的浮動選項：「記錄閱讀進度」。
 * 位置在選取範圍下方（手機避開系統選單與選取把手）；取消反白或捲動時跟隨／消失。
 * 反白只用來指定位置，內容仍不能複製（見 src/lib/protect-content.ts）。
 */
export interface SelectionPoint {
  /** 段落索引（data-b） */
  index: number;
  /** 反白起點在該段純文字中的字元位置 */
  offset: number;
}

const elementOf = (node: Node): Element | null =>
  node instanceof Element ? node : node.parentElement;

function locate(range: Range, article: HTMLElement): SelectionPoint | null {
  const startBlock = elementOf(range.startContainer)?.closest<HTMLElement>('[data-b]');
  if (startBlock && article.contains(startBlock)) {
    const head = document.createRange();
    head.selectNodeContents(startBlock);
    head.setEnd(range.startContainer, range.startOffset);
    return { index: Number(startBlock.dataset.b), offset: head.toString().length };
  }
  // 起點落在段落之間：改用終點所在的段落
  const endBlock = elementOf(range.endContainer)?.closest<HTMLElement>('[data-b]');
  if (endBlock && article.contains(endBlock))
    return { index: Number(endBlock.dataset.b), offset: 0 };
  return null;
}

function currentRange(article: HTMLElement | null): Range | null {
  const sel = document.getSelection();
  if (!article || !sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  if (sel.toString().trim() === '') return null;
  const range = sel.getRangeAt(0);
  return article.contains(range.commonAncestorContainer) ? range : null;
}

const WIDTH = 168;

export function SelectionToolbar({
  articleRef,
  onMark,
}: {
  articleRef: RefObject<HTMLElement | null>;
  onMark: (point: SelectionPoint) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const mouseDown = useRef(false);

  useEffect(() => {
    let timer = 0;
    const update = () => {
      const range = mouseDown.current ? null : currentRange(articleRef.current);
      if (!range) {
        setPos(null);
        return;
      }
      const rects = range.getClientRects();
      const last = rects[rects.length - 1] ?? range.getBoundingClientRect();
      const coarse = matchMedia('(pointer: coarse)').matches;
      const gap = coarse ? 36 : 10;
      const below = last.bottom + gap;
      const top = below + 48 > window.innerHeight ? Math.max(8, last.top - gap - 48) : below;
      const half = WIDTH / 2 + 8;
      const left = Math.min(Math.max(last.left + last.width / 2, half), window.innerWidth - half);
      setPos({ top, left });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 120);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && articleRef.current?.contains(e.target as Node)) {
        mouseDown.current = true;
        setPos(null);
      }
    };
    const onPointerUp = () => {
      if (!mouseDown.current) return;
      mouseDown.current = false;
      schedule();
    };
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerUp);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('selectionchange', schedule);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [articleRef]);

  if (!pos) return null;

  const mark = () => {
    const article = articleRef.current;
    const range = currentRange(article);
    const point = range && article ? locate(range, article) : null;
    document.getSelection()?.removeAllRanges();
    setPos(null);
    if (point) onMark(point);
  };

  return (
    <div
      className="rd-toolbar"
      role="toolbar"
      aria-label={t('reader.toolbar')}
      style={{ top: pos.top, left: pos.left }}
      // 不讓按鈕搶走焦點，否則點擊前反白就會消失
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="rd-btn" onClick={mark}>
        <Bookmark size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>{t('reader.mark')}</span>
      </button>
    </div>
  );
}
