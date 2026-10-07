import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { getPerson, getTerm, t } from '../../content';
import { openPeople } from '../../lib/hash-router';
import { rectToLocal } from '../../lib/localPoint';
import { popoverText, progress as progressOf } from '../../store/selectors';
import { usePopoverStore, type PopoverTarget } from '../../store/popover';
import { useAppStore, type AxisKey } from '../../store/store';
import { useLayout } from '../layout/LayoutProvider';
import { useStageRef } from '../layout/Stage';
import { Callout, Sheet } from '../ui';
import { placePopover } from './placePopover';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 人名／名詞 Popover 的內容。人名依「目前進度」累積（劇透規則在 selectors.popoverText，
 * 04 的內容永遠不會出現）；名詞是固定內容、沒有頁尾。
 */
function PopoverBody({
  target,
  titleId,
  onViewPeople,
}: {
  target: PopoverTarget;
  titleId: string;
  onViewPeople: () => void;
}) {
  const page = useAppStore((s) => s.page);
  const unlocked = useAppStore((s) => s.page04Unlocked);
  const progress = progressOf(page, unlocked);

  if (target.kind === 'term') {
    const term = getTerm(target.id);
    if (!term) return null;
    return (
      <>
        <div className="flex items-baseline gap-2">
          <span id={titleId} className="text-[17px] font-semibold flow:text-[18px]">
            {term.term}
          </span>
          <span className="text-aux text-accent-700">{t('popover.term')}</span>
        </div>
        <p className="m-0 mt-1.5 text-[15px] leading-[1.7] flow:leading-[1.75]">{term.text}</p>
      </>
    );
  }

  const person = getPerson(target.id);
  if (!person) return null;
  const { base, layers } = popoverText(person, progress);
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span id={titleId} className="text-[17px] font-semibold flow:text-[18px]">
          {person.name}
        </span>
        <span className="text-aux text-accent-700">{person.role}</span>
      </div>
      <p className="m-0 mt-1.5 text-[15px] leading-[1.7] flow:leading-[1.75]">
        {base}
        {layers.map((layer) => layer.text).join('')}
      </p>
      <div className="mt-2 flex items-center justify-between border-t border-divider pt-2 text-aux flow:min-h-11">
        <span className="text-neutral-600">{t('popover.progress', { page: pad(progress) })}</span>
        <button
          type="button"
          className="text-accent-800 hover:underline"
          onClick={onViewPeople}
        >
          {t('popover.viewInPeople')}
        </button>
      </div>
    </>
  );
}

/** 舞台版：寬 300、錨點下方 12px、空間不足翻到上方、水平夾在舞台內（placePopover，座標以舞台為基準） */
function StagePopover({
  target,
  onClose,
  onViewPeople,
}: {
  target: PopoverTarget;
  onClose: () => void;
  onViewPeople: () => void;
}) {
  const stageRef = useStageRef();
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // 量到實際高度後直接寫入 DOM 樣式（定位是對外部 DOM 的同步，不經過 React state，也就不會多渲染一次）
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;
    // 錨點跨行時取最後一段（片語末端），下方空間較不會被前一行擋住
    const rects = target.anchor.getClientRects();
    const rect = rects[rects.length - 1] ?? target.anchor.getBoundingClientRect();
    const place = placePopover(rectToLocal(stage, rect), {
      width: card.offsetWidth,
      height: card.offsetHeight,
    });
    card.style.left = `${place.x}px`;
    card.style.top = `${place.y}px`;
    card.style.setProperty('--arrow-x', `${place.arrowX}px`);
    card.dataset.placement = place.placement;
    card.style.visibility = 'visible';
    card.focus({ preventScroll: true });
  }, [target, stageRef]);

  // 點外部關閉（點錨點本身交給錨點的切換）；Esc 關閉並把焦點還給錨點
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = event.target as Node;
      if (cardRef.current?.contains(el) || target.anchor.contains(el)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [target, onClose]);

  return (
    <Callout
      ref={cardRef}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      tone="neutral"
      className="absolute z-(--z-popover) outline-none"
      style={{ left: 0, top: 0, visibility: 'hidden' }}
      data-popover
    >
      <PopoverBody target={target} titleId={titleId} onViewPeople={onViewPeople} />
    </Callout>
  );
}

/** 流式版：底部小卡＋遮罩（Sheet） */
function SheetPopover({
  target,
  onClose,
  onViewPeople,
}: {
  target: PopoverTarget;
  onClose: () => void;
  onViewPeople: () => void;
}) {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => bodyRef.current?.focus({ preventScroll: true }), [target]);
  return (
    <Sheet open onClose={onClose} labelledBy={titleId}>
      <div ref={bodyRef} tabIndex={-1} className="outline-none" data-popover>
        <PopoverBody target={target} titleId={titleId} onViewPeople={onViewPeople} />
      </div>
    </Sheet>
  );
}

/**
 * Popover 單例層（任務 T070）：舞台版放在舞台內最上層，流式版用底部面板。
 * 任何會讓錨點消失或失去意義的變化（換頁、換事件、換版型、開人物誌）都會關閉它。
 */
export function PopoverLayer() {
  const { mode } = useLayout();
  const open = usePopoverStore((s) => s.open);
  const close = usePopoverStore((s) => s.closePopover);
  const page = useAppStore((s) => s.page);
  const peopleOpen = useAppStore((s) => s.peopleOpen);
  const eventIndex = useAppStore((s) => (s.page > 0 ? s.axis[s.page as AxisKey].eventIndex : -1));

  useEffect(() => {
    close();
  }, [mode, page, eventIndex, peopleOpen, close]);

  // Esc：關閉並把焦點還給錨點（流式版的 Sheet 自己也會處理 Esc，這裡只負責還焦點）
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const anchor = open.anchor;
      close();
      if (anchor.isConnected) anchor.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || !open.anchor.isConnected) return null;

  const viewInPeople = () => {
    close();
    openPeople();
  };
  const Card = mode === 'stage' ? StagePopover : SheetPopover;
  return <Card key={open.anchorKey} target={open} onClose={close} onViewPeople={viewInPeople} />;
}
