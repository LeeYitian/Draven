import { ArrowLeft, Bookmark, List, Moon, Sun, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../content';
import { closeReader } from '../../lib/hash-router';
import { useEffectiveTheme, useReaderStore, type FontSize } from '../../store/reader';
import { Article } from './Article';
import { createBookmark, locateBookmark } from './bookmark';
import { loadNovel, NoSourceError } from './loadNovel';
import { SelectionToolbar, type SelectionPoint } from './SelectionToolbar';
import type { Block } from './source';
import { currentEntry, resolveToc, type TocEntry, type TocItem } from './toc';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; blocks: Block[]; toc: TocItem[] }
  | { status: 'error'; noSource: boolean };

interface Toast {
  text: string;
  action?: { label: string; run: () => void };
}

const BAR_PROBE = 72;
const WIDE = '(min-width: 1100px)';

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function useWide(): boolean {
  const [wide, setWide] = useState(
    () => typeof matchMedia === 'function' && matchMedia(WIDE).matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(WIDE);
    const onChange = () => setWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return wide;
}

function blockElement(article: HTMLElement | null, index: number): HTMLElement | null {
  return article?.querySelector<HTMLElement>(`[data-b="${index}"]`) ?? null;
}

function flash(el: HTMLElement) {
  el.removeAttribute('data-flash');
  void el.offsetWidth; // 重新觸發動畫
  el.setAttribute('data-flash', '');
  window.setTimeout(() => el.removeAttribute('data-flash'), 1800);
}

function TocList({
  entries,
  current,
  onSelect,
}: {
  entries: readonly TocEntry[];
  current: number;
  onSelect: (entry: TocEntry) => void;
}) {
  if (entries.length === 0) return <p className="rd-toc__empty">{t('reader.tocEmpty')}</p>;
  return (
    <ol>
      {entries.map((entry, i) => (
        <li key={i}>
          <button
            type="button"
            className="rd-toc__item"
            data-level={entry.level}
            aria-current={i === current ? 'true' : undefined}
            disabled={entry.index === null}
            title={entry.index === null ? t('reader.tocMissing') : undefined}
            onClick={() => onSelect(entry)}
          >
            {entry.title}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** 原出處與著作權聲明：固定在目錄區塊的最底端（桌機側欄、手機目錄面板） */
function Notice() {
  return (
    <footer className="rd-footer">
      <p>
        {t('reader.footer.source')}
        <a href={t('reader.footer.url')} target="_blank" rel="noopener noreferrer">
          {t('reader.footer.url')}
        </a>
      </p>
      <p>{t('reader.footer.notice')}</p>
    </footer>
  );
}

export default function ReaderPage() {
  const theme = useEffectiveTheme();
  const fontSize = useReaderStore((s) => s.fontSize);
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const setTheme = useReaderStore((s) => s.setTheme);
  const bookmark = useReaderStore((s) => s.bookmark);
  const setBookmark = useReaderStore((s) => s.setBookmark);
  const wide = useWide();

  const rootRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; load: Load } | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const tocCloseRef = useRef<HTMLButtonElement>(null);
  const tocOpenerRef = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [topIndex, setTopIndex] = useState(0);
  const [percent, setPercent] = useState(0);

  // 頁面底色與 color-scheme 跟著主題；離開時還原
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-reader', '');
    root.setAttribute('data-reader-theme', theme);
    return () => {
      root.removeAttribute('data-reader');
      root.removeAttribute('data-reader-theme');
    };
  }, [theme]);

  // 分頁標題：「德雷文 · 好讀版」；離開時還原
  useEffect(() => {
    const previous = document.title;
    document.title = `${t('site.title')} · ${t('reader.title')}`;
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    loadNovel().then(
      (novel) => alive && setResult({ attempt, load: { status: 'ready', ...novel } }),
      (error: unknown) =>
        alive &&
        setResult({ attempt, load: { status: 'error', noSource: error instanceof NoSourceError } }),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);
  const load: Load = result?.attempt === attempt ? result.load : { status: 'loading' };

  const blocks = load.status === 'ready' ? load.blocks : null;
  const tocItems = load.status === 'ready' ? load.toc : undefined;
  const toc = useMemo(() => (blocks ? resolveToc(blocks, tocItems) : null), [blocks, tocItems]);
  const entries = toc?.entries ?? [];
  const bookmarkIndex = useMemo(
    () => (blocks && bookmark ? locateBookmark(blocks, bookmark) : null),
    [blocks, bookmark],
  );

  useEffect(() => {
    if (!import.meta.env.DEV || !toc) return;
    for (const p of toc.problems) console.warn(`[reader/toc] ${p.message}`);
  }, [toc]);

  // 捲動位置：進度條與目前章節（不用 React state 追每一次捲動）
  useEffect(() => {
    if (!blocks) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      rootRef.current?.style.setProperty('--rd-p', String(ratio));
      setPercent(Math.round(ratio * 100));
      for (let y = BAR_PROBE; y < BAR_PROBE + 120; y += 20) {
        const el = document
          .elementFromPoint(window.innerWidth / 2, y)
          ?.closest<HTMLElement>('[data-b]');
        if (el) {
          setTopIndex(Number(el.dataset.b));
          return;
        }
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [blocks]);

  const scrollToBlock = useCallback((index: number, block: ScrollLogicalPosition) => {
    const el = blockElement(articleRef.current, index);
    if (!el) return;
    el.scrollIntoView?.({ block, behavior: reducedMotion() ? 'auto' : 'smooth' });
    flash(el);
  }, []);

  // 開啟時回到上次記錄的位置（只做一次；等字型就緒再捲，避免版面位移）
  const resumed = useRef(false);
  useEffect(() => {
    if (!blocks || resumed.current) return;
    resumed.current = true;
    const saved = useReaderStore.getState().bookmark;
    if (!saved) return;
    const index = locateBookmark(blocks, saved);
    let cancelled = false;
    const show = (next: Toast) => void Promise.resolve().then(() => !cancelled && setToast(next));
    if (index === null) {
      show({ text: t('reader.notFound') });
      return () => {
        cancelled = true;
        resumed.current = false;
      };
    }
    // 先立刻捲到位置；字型載入完（版面可能位移）若讀者還沒自己捲動，再校正一次
    const jump = () =>
      blockElement(articleRef.current, index)?.scrollIntoView?.({
        block: 'center',
        behavior: 'auto',
      });
    jump();
    const landed = window.scrollY;
    const el = blockElement(articleRef.current, index);
    if (el) flash(el);
    show({
      text: t('reader.resumed'),
      action: { label: t('reader.fromStart'), run: () => window.scrollTo?.({ top: 0 }) },
    });
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => window.setTimeout(r, 1500))]).then(() => {
      if (!cancelled && Math.abs(window.scrollY - landed) < 2) jump();
    });
    return () => {
      cancelled = true;
      resumed.current = false; // StrictMode 重掛載後仍要執行一次
    };
  }, [blocks]);

  // 目錄面板（窄螢幕）：Esc 關閉；開啟時焦點進面板，關閉後回到目錄按鈕
  useEffect(() => {
    if (!tocOpen) return;
    const opener = tocOpenerRef.current;
    tocCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTocOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [tocOpen]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), toast.action ? 6000 : 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const saveBookmark = useCallback(
    (point: SelectionPoint) => {
      if (!blocks) return;
      const next = createBookmark(blocks, point.index, point.offset);
      if (!next) return;
      setBookmark(next);
      setToast({ text: t('reader.marked') });
    },
    [blocks, setBookmark],
  );

  const markCurrent = () => saveBookmark({ index: topIndex, offset: 0 });

  const selectEntry = (entry: TocEntry) => {
    if (entry.index === null) return;
    setTocOpen(false);
    scrollToBlock(entry.index, 'start');
  };

  const current = currentEntry(entries, topIndex);
  const sizeStep = (delta: number) => {
    const next = Math.min(3, Math.max(0, fontSize + delta)) as FontSize;
    if (next === fontSize) return;
    // 調整字級後，維持目前閱讀位置
    const anchor = blockElement(articleRef.current, topIndex);
    setFontSize(next);
    requestAnimationFrame(() => anchor?.scrollIntoView?.({ block: 'start', behavior: 'auto' }));
  };

  const dark = theme === 'dark';

  return (
    <div ref={rootRef} className="rd" data-reader-theme={theme} data-size={fontSize}>
      <header className="rd-bar">
        <button
          type="button"
          className="rd-btn"
          aria-label={t('reader.back')}
          onClick={closeReader}
        >
          <ArrowLeft size={20} strokeWidth={1.5} aria-hidden="true" />
          <span className="rd-btn__label" aria-hidden="true">
            {t('reader.back')}
          </span>
        </button>
        <h1 className="rd-bar__title">{t('reader.title')}</h1>
        {!wide && (
          <button
            type="button"
            className="rd-btn"
            ref={tocOpenerRef}
            aria-haspopup="dialog"
            aria-expanded={tocOpen}
            aria-label={t('reader.toc')}
            onClick={() => setTocOpen(true)}
          >
            <List size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="rd-btn"
          aria-label={t('reader.markHere')}
          title={t('reader.markHere')}
          disabled={!blocks}
          onClick={markCurrent}
        >
          <Bookmark size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rd-btn"
          aria-label={t('reader.fontSmaller')}
          disabled={fontSize === 0}
          onClick={() => sizeStep(-1)}
        >
          <span aria-hidden="true" style={{ fontSize: 13 }}>
            A-
          </span>
        </button>
        <button
          type="button"
          className="rd-btn"
          aria-label={t('reader.fontLarger')}
          disabled={fontSize === 3}
          onClick={() => sizeStep(1)}
        >
          <span aria-hidden="true" style={{ fontSize: 18 }}>
            A+
          </span>
        </button>
        <button
          type="button"
          className="rd-btn"
          aria-label={dark ? t('reader.themeToLight') : t('reader.themeToDark')}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          {dark ? (
            <Sun size={20} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Moon size={20} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
        <div
          className="rd-progress"
          role="progressbar"
          aria-label={t('reader.progress', { n: percent })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        />
      </header>

      <div className="rd-layout">
        {wide && (
          <div className="rd-toc">
            <nav className="rd-toc__nav" aria-label={t('reader.tocTitle')}>
              <h2 className="rd-toc__title">{t('reader.tocTitle')}</h2>
              <TocList entries={entries} current={current} onSelect={selectEntry} />
            </nav>
            <Notice />
          </div>
        )}

        <main className="rd-main">
          {load.status === 'loading' && (
            <div className="rd-state" role="status">
              {t('reader.loading')}
            </div>
          )}
          {load.status === 'error' && (
            <div className="rd-state" role="alert">
              <strong>{t('reader.error')}</strong>
              <span>{load.noSource ? t('reader.noSource') : t('reader.errorHint')}</span>
              {!load.noSource && (
                <button type="button" className="rd-btn" onClick={() => setAttempt((n) => n + 1)}>
                  {t('reader.retry')}
                </button>
              )}
            </div>
          )}
          <article
            ref={articleRef}
            className="rd-article"
            data-reader-article
            aria-label={t('reader.article')}
            hidden={!blocks}
          >
            {blocks && <Article blocks={blocks} bookmarkIndex={bookmarkIndex} />}
          </article>
        </main>
      </div>

      {!wide && tocOpen && (
        <div className="rd-sheet" role="dialog" aria-modal="true" aria-label={t('reader.tocTitle')}>
          <div className="rd-sheet__scrim" onClick={() => setTocOpen(false)} />
          <div className="rd-sheet__panel">
            <div className="rd-sheet__head">
              <span>{t('reader.tocTitle')}</span>
              <button
                ref={tocCloseRef}
                type="button"
                className="rd-btn"
                aria-label={t('reader.tocClose')}
                onClick={() => setTocOpen(false)}
              >
                <X size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <div className="rd-sheet__body">
              <TocList entries={entries} current={current} onSelect={selectEntry} />
            </div>
            <Notice />
          </div>
        </div>
      )}

      <SelectionToolbar articleRef={articleRef} onMark={saveBookmark} />

      {toast && (
        <div className="rd-toast" role="status">
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="rd-btn"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      <p className="rd-print-note">{t('reader.printBlocked')}</p>
    </div>
  );
}
