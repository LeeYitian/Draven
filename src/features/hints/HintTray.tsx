import { ChevronDown } from 'lucide-react';
import { useEffect } from 'react';
import { useLayout } from '../../components/layout/LayoutProvider';
import { useOptionalStageRef } from '../../components/layout/Stage';
import { getHint, hints as allHints, t } from '../../content';
import { MOTION } from '../../lib/stage-metrics';
import { usePresence } from '../../lib/usePresence';
import { useAppStore } from '../../store/store';
import { useUiStore } from '../../store/ui';
import { HintKeyword } from './HintKeyword';
import { useHintDrag } from './useHintDrag';

const NO_STAGE = { current: null };

/**
 * 已獲得的關鍵字清單：已解開的排在前面（✓、不可拖），其餘依原伏筆編號。
 * 舞台版與流式版共用同一份資料與選取狀態。
 */
function useKeywords() {
  const owned = useAppStore((s) => s.hints.owned);
  const solved = useAppStore((s) => s.hints.solved);
  const selected = useAppStore((s) => s.hints.selected);
  const list = allHints
    .filter((h) => owned.includes(h.id))
    .sort((a, b) => Number(solved.includes(b.id)) - Number(solved.includes(a.id)) || a.n - b.n);
  return { list, solved, selected, ownedCount: owned.length };
}

/** 選中時按 Esc 取消選取（流式版另有說明條上的「取消」） */
function useEscapeDeselect(selected: string | null) {
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') useAppStore.getState().selectHint(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);
}

function Keywords({ large, drag }: { large: boolean; drag: ReturnType<typeof useHintDrag> }) {
  const { list, solved, selected } = useKeywords();
  const select = useAppStore((s) => s.selectHint);
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-2 overflow-y-auto" data-hint-keywords>
      {list.map((hint) => {
        const isSolved = solved.includes(hint.id);
        return (
          <HintKeyword
            key={hint.id}
            hint={hint}
            state={isSolved ? 'solved' : selected === hint.id ? 'selected' : 'idle'}
            large={large}
            hole={drag.image?.id === hint.id ? { width: drag.image.width } : null}
            onToggle={select}
            dragHandlers={drag.handlersFor(hint.id, isSolved)}
            consumeClick={drag.consumeClick}
          />
        );
      })}
    </div>
  );
}

/** 拖曳影像：跟著指標的關鍵字（舞台座標；不接收指標事件，才不會擋住命中測試） */
function DragImage({ drag }: { drag: ReturnType<typeof useHintDrag> }) {
  if (!drag.image) return null;
  const hint = getHint(drag.image.id);
  return (
    <div
      data-hint-drag-image
      className="pointer-events-none absolute z-(--z-toast) flex h-9 items-center rounded-md border-[1.5px] border-accent bg-bg px-3.5 text-[16px] shadow-lg"
      style={{
        left: drag.image.x,
        top: drag.image.y,
        transform: 'rotate(-2deg)',
        cursor: 'grabbing',
      }}
    >
      {hint?.keyword}
    </div>
  );
}

function CountLine() {
  const { ownedCount, solved } = useKeywords();
  return (
    <span className="text-aux text-neutral-700">
      {solved.length > 0
        ? t('hints.countSolved', { n: ownedCount, solved: solved.length })
        : t('hints.count', { n: ownedCount })}
    </span>
  );
}

/**
 * 伏筆托盤（任務 T092）。
 * 舞台版：高 168、從底部升起、不蓋側欄與頁首、背後沒有遮罩；可拖曳關鍵字到頁面上的框格。
 * 流式版：導覽列上方的底部面板，只用點選；選取時頁面上方出現說明條（見 SelectionBanner）。
 */
export function HintTray() {
  const { mode } = useLayout();
  const open = useUiStore((s) => s.hintsTrayOpen);
  const setOpen = useUiStore((s) => s.setHintsTray);
  const { present, closing } = usePresence(open, MOTION.drawerTray);
  const { list, selected } = useKeywords();
  const stageRef = useOptionalStageRef();
  const drag = useHintDrag({ stageRef: stageRef ?? NO_STAGE, enabled: mode === 'stage' });
  useEscapeDeselect(selected);

  if (!present) return mode === 'flow' ? <SelectionBanner /> : null;

  if (mode === 'flow') {
    return (
      <>
        <SelectionBanner />
        <section
          aria-label={t('hints.title')}
          data-hint-tray
          data-closing={closing}
          className="tray-anim fixed inset-x-0 bottom-[76px] z-(--z-tray) mx-auto flex max-w-[640px] flex-col gap-3 rounded-t-lg border-t border-accent bg-bg px-6 pt-3 pb-4 [box-shadow:var(--shadow-up)]"
        >
          <div className="mx-auto h-1 w-9 rounded-sm bg-neutral-300" aria-hidden="true" />
          <div className="flex items-baseline gap-2.5">
            <h2 className="m-0 font-heading text-[22px] font-medium">{t('hints.title')}</h2>
            <CountLine />
            <span className="flex-1" />
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-divider"
              aria-label={t('hints.collapse')}
              onClick={() => setOpen(false)}
            >
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          {list.length === 0 ? (
            <p className="m-0 text-aux text-neutral-600">{t('hints.empty')}</p>
          ) : (
            <Keywords large drag={drag} />
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <section
        aria-label={t('hints.title')}
        data-hint-tray
        data-closing={closing}
        className="tray-anim absolute right-0 bottom-0 z-(--z-tray) box-border flex h-[168px] flex-col gap-3 border-t border-accent bg-bg px-8 pt-4 pb-[18px] shadow-lg"
        style={{ left: 73 }}
      >
        <div className="flex items-baseline gap-3.5">
          <h2 className="m-0 font-heading text-[24px] font-medium">{t('hints.title')}</h2>
          <span className="text-[15px] text-accent-800">{t('hints.howTo')}</span>
          <span className="flex-1" />
          <CountLine />
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center self-center rounded-md border border-divider hover:bg-accent-100"
            aria-label={t('hints.collapse')}
            onClick={() => setOpen(false)}
          >
            <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        {list.length === 0 ? (
          <p className="m-0 text-aux text-neutral-600">{t('hints.empty')}</p>
        ) : (
          <Keywords large={false} drag={drag} />
        )}
      </section>
      <DragImage drag={drag} />
    </>
  );
}

/** 流式版：選取關鍵字時頁面上方的說明條「已選『…』，點頁面上的框格放入。取消」 */
function SelectionBanner() {
  const { mode } = useLayout();
  const selected = useAppStore((s) => s.hints.selected);
  const select = useAppStore((s) => s.selectHint);
  if (mode !== 'flow' || !selected) return null;
  return (
    <div
      role="status"
      data-hint-banner
      className="fixed inset-x-3 top-3 z-(--z-toast) mx-auto max-w-[616px] rounded-md border border-accent bg-bg px-3.5 py-2.5 text-[13px] leading-[1.6] shadow-md"
    >
      {t('hints.selectedBanner', { keyword: getHint(selected)?.keyword ?? '' })}
      <button type="button" className="ml-1 text-accent-800 underline" onClick={() => select(null)}>
        {t('common.cancel')}
      </button>
    </div>
  );
}
