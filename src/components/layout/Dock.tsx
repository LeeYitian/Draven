import { Eye, ScrollText, Users, X } from 'lucide-react';
import { useState, type ReactNode, type Ref } from 'react';
import { getAxisPage, getPerson, t } from '../../content';
import { ResetProgress } from '../../features/world/ResetProgress';
import { useFbLinked, useFbPulseScheduler, useFbPulseTarget } from '../../features/hints/fbPulse';
import { navigate, openPeople, openReader, routeForPage } from '../../lib/hash-router';
import { useAppStore } from '../../store/store';
import { useUiStore } from '../../store/ui';
import { Bookmark, BookOpenIcon, DisplayNum, Kbd, Sheet } from '../ui';
import { useLayout } from './LayoutProvider';

/**
 * 浮動側欄（舞台版，72px）／底部導覽列（流式版）：人物誌入口、伏筆入口（附數量徽章）、
 * 追蹤中的人物與取消、頁面指示。兩種版型共用同一份狀態。
 */
const pad = (n: number) => String(n).padStart(2, '0');
const PAGES = [0, 1, 2, 3, 4] as const;

function useDock() {
  const page = useAppStore((s) => s.page);
  const peopleOpen = useAppStore((s) => s.peopleOpen);
  const owned = useAppStore((s) => s.hints.owned.length);
  const toastToken = useAppStore((s) => s.hints.toast?.token ?? 0);
  const trackedId = useAppStore((s) => s.trackedPersonId);
  const feedback = useAppStore((s) => s.trackingFeedback);
  const untrack = useAppStore((s) => s.untrack);
  const trayOpen = useUiStore((s) => s.hintsTrayOpen);
  const toggleTray = useUiStore((s) => s.toggleHintsTray);
  const tracked = trackedId ? getPerson(trackedId) : undefined;
  // 伏筆連動脈衝：頁面上有未填框格時，「伏筆」按鈕與框格同步閃動
  useFbPulseScheduler();
  const linked = useFbLinked();
  return {
    page,
    peopleOpen,
    owned,
    toastToken,
    tracked,
    feedback,
    untrack,
    trayOpen,
    toggleTray,
    linked,
  };
}

export function Dock() {
  const { mode } = useLayout();
  return mode === 'stage' ? <SideDock /> : <BottomDock />;
}

// ── 舞台版：側欄 ───────────────────────────────────────────────────
const itemClass =
  'relative flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-md border border-transparent text-neutral-800 hover:bg-accent-100 active:bg-accent-200 data-[active]:border-accent data-[active]:text-accent-800';

function DockItem({
  icon,
  label,
  active,
  onClick,
  buttonRef,
  linked,
  children,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  /** 伏筆連動脈衝的目標（只有「伏筆」按鈕需要） */
  buttonRef?: Ref<HTMLButtonElement>;
  linked?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={itemClass}
      data-fb-linked={linked || undefined}
      data-active={active || undefined}
      aria-pressed={active}
      onClick={onClick}
    >
      {icon}
      <span className="text-aux">{label}</span>
      {children}
    </button>
  );
}

function HintsBadge({ count, token }: { count: number; token: number }) {
  if (count === 0) return null;
  return (
    <span
      key={token}
      data-flash={token > 0 ? '' : undefined}
      aria-label={t('dock.hintsBadge', { n: count })}
      className="tnum absolute top-0.5 right-1 h-5 min-w-5 rounded-full border border-accent bg-bg px-1 text-center text-aux leading-[18px] text-accent-800"
    >
      {count}
    </span>
  );
}

function SideDock() {
  const d = useDock();
  const pulseRef = useFbPulseTarget<HTMLButtonElement>(d.linked);
  return (
    <nav
      aria-label={t('dock.nav')}
      className="absolute inset-y-0 left-0 z-(--z-dock) flex w-[72px] flex-col items-center gap-1.5 border-r border-divider pt-5 pb-[18px]"
    >
      <DockItem
        icon={<Users size={20} strokeWidth={1.5} />}
        label={t('dock.people')}
        active={d.peopleOpen}
        onClick={openPeople}
      />
      <DockItem
        icon={<ScrollText size={20} strokeWidth={1.5} />}
        label={t('dock.hints')}
        active={d.trayOpen}
        onClick={d.toggleTray}
        buttonRef={pulseRef}
        linked={d.linked}
      >
        <HintsBadge count={d.owned} token={d.toastToken} />
      </DockItem>
      <DockItem
        icon={<BookOpenIcon size={20} strokeWidth={1.5} />}
        label={t('dock.reader')}
        onClick={openReader}
      />

      {d.tracked && (
        <>
          <div className="my-1.5 w-8 border-t border-divider" />
          <div
            key={d.feedback}
            data-flash={d.feedback > 0 ? '' : undefined}
            className="flex w-[60px] flex-col items-center gap-0.5 rounded-md border border-accent px-1 pt-2 pb-1"
          >
            <span className="flex items-center gap-[3px] text-aux text-accent-800">
              <Bookmark className="h-2.5! w-[7px]!" />
              {t('tracking.badge')}
            </span>
            <span className="text-center text-body leading-[1.35] font-semibold [overflow-wrap:anywhere]">
              {d.tracked.name}
            </span>
            <button
              type="button"
              aria-label={t('tracking.cancel')}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-700 hover:bg-accent-200"
              onClick={d.untrack}
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        </>
      )}

      <div className="flex-1" />
      <div className="flex flex-col items-center gap-0.5 font-heading text-[18px]">
        {PAGES.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={t('dock.goPage', { page: pad(n) })}
            aria-current={d.page === n ? 'page' : undefined}
            className="tnum flex h-[30px] w-11 items-center justify-center rounded-md border border-transparent text-neutral-600 hover:bg-accent-100 aria-[current=page]:border-accent aria-[current=page]:text-ink"
            onClick={() => navigate(routeForPage(n))}
          >
            {pad(n)}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex flex-col items-center gap-1.5" aria-label={t('keys.pages')}>
        <div className="flex gap-1">
          <Kbd size="sm" nudge="first">
            ↑
          </Kbd>
          <Kbd size="sm" nudge="late">
            ↓
          </Kbd>
        </div>
        <span className="text-aux text-neutral-700">{t('keys.switchAxis')}</span>
      </div>
      <div className="mt-2">
        <ResetProgress placement="dock" />
      </div>
    </nav>
  );
}

// ── 流式版：底部導覽列 ─────────────────────────────────────────────
const cellClass =
  'relative flex min-h-11 flex-col items-center justify-center gap-[3px] text-neutral-800 active:bg-accent-100';

function BottomDock() {
  const d = useDock();
  const pulseRef = useFbPulseTarget<HTMLButtonElement>(d.linked);
  const setPagesMenu = useUiStore((s) => s.setPagesMenu);
  const pagesMenuOpen = useUiStore((s) => s.pagesMenuOpen);
  const [trackSheet, setTrackSheet] = useState(false);

  return (
    <>
      <nav aria-label={t('dock.nav')} className="fixed inset-x-0 bottom-0 z-(--z-dock) bg-bg">
        <div className="mx-auto grid h-[76px] max-w-[640px] grid-cols-6 border-t border-divider pb-3">
          <button
            type="button"
            className={cellClass}
            aria-pressed={d.peopleOpen}
            onClick={openPeople}
          >
            <Users size={20} strokeWidth={1.5} />
            <span className="text-aux">{t('dock.people')}</span>
          </button>
          <button
            ref={pulseRef}
            type="button"
            className={cellClass}
            aria-pressed={d.trayOpen}
            data-fb-linked={d.linked || undefined}
            data-active={d.trayOpen || undefined}
            onClick={d.toggleTray}
          >
            <ScrollText size={20} strokeWidth={1.5} />
            <span className="text-aux">{t('dock.hints')}</span>
            <HintsBadge count={d.owned} token={d.toastToken} />
          </button>
          {d.tracked ? (
            <button
              type="button"
              key={d.feedback}
              data-flash={d.feedback > 0 ? '' : undefined}
              className={`${cellClass} mx-1 mt-2 rounded-md border border-accent`}
              onClick={() => setTrackSheet(true)}
            >
              <span className="text-[15px] leading-[1.2] font-semibold">{d.tracked.name}</span>
              <span className="text-aux text-accent-800">{t('tracking.badge')}</span>
            </button>
          ) : (
            <div className={`${cellClass} text-neutral-600`}>
              <Eye size={20} strokeWidth={1.5} />
              <span className="text-aux">{t('dock.untracked')}</span>
            </div>
          )}
          <button
            type="button"
            className={cellClass}
            aria-haspopup="dialog"
            onClick={() => setPagesMenu(true)}
          >
            <DisplayNum className="text-[21px] text-accent-700">{pad(d.page)}</DisplayNum>
            <span className="text-aux">{t('dock.pages')}</span>
          </button>
          <button type="button" className={cellClass} onClick={openReader}>
            <BookOpenIcon size={20} strokeWidth={1.5} />
            <span className="text-aux">{t('dock.reader')}</span>
          </button>
          <ResetProgress placement="cell" />
        </div>
      </nav>

      <Sheet
        open={pagesMenuOpen}
        onClose={() => setPagesMenu(false)}
        labelledBy="pages-menu-title"
        bottomOffset={76}
      >
        <div id="pages-menu-title" className="mb-2 font-heading text-[22px]">
          {t('dock.pagesMenu')}
        </div>
        <ul>
          {PAGES.map((n) => (
            <li key={n}>
              <button
                type="button"
                aria-current={d.page === n ? 'page' : undefined}
                className="flex min-h-11 w-full items-center gap-3 border-b border-divider text-left aria-[current=page]:text-accent-800"
                onClick={() => {
                  navigate(routeForPage(n));
                  setPagesMenu(false);
                }}
              >
                <DisplayNum className="w-8 text-[24px]">{pad(n)}</DisplayNum>
                <span className="text-body">
                  {n === 0
                    ? t('dock.goPage', { page: pad(0) })
                    : (getAxisPage(n)?.title ?? t('dock.goPage', { page: pad(n) }))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={trackSheet} onClose={() => setTrackSheet(false)} bottomOffset={76} tone="accent">
        <div className="mb-3 text-[16px] font-semibold">
          {d.tracked ? t('tracking.now', { name: d.tracked.name }) : null}
        </div>
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            d.untrack();
            setTrackSheet(false);
          }}
        >
          {t('tracking.cancel')}
        </button>
      </Sheet>
    </>
  );
}
