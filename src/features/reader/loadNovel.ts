import { parseSource, type Block } from './source.ts';
import { readTocItems, type TocItem } from './toc.ts';

/**
 * 取得小說全文與目錄。
 *  - 有設定 VITE_NOVEL_URL（Worker 的根網址）：向 `${網址}/full` 與 `${網址}/toc` 取得（正式環境；
 *    原文與目錄都不在 repo、也不在網站的靜態檔裡）。目錄取不到不影響閱讀，退回原文自己的標題。
 *  - 沒設定且在開發模式：讀本機 src/content/full.{html,md,txt} 與 toc.yaml
 * 結果快取在記憶體；失敗時清掉快取，讓「重試」可以再試。
 */
export interface Novel {
  blocks: Block[];
  toc: TocItem[];
}

let cache: Promise<Novel> | null = null;

export class NoSourceError extends Error {}

async function fetchNovel(): Promise<Novel> {
  const base = import.meta.env.VITE_NOVEL_URL?.replace(/\/+$/, '');
  if (!base && import.meta.env.DEV) {
    const { loadLocalSource, loadLocalToc } = await import('./localSource.ts');
    const local = await loadLocalSource();
    if (local !== null) {
      return { blocks: parseSource(local), toc: readTocItems(await loadLocalToc()) };
    }
  }
  if (!base) throw new NoSourceError('no source');

  const [fullRes, toc] = await Promise.all([
    fetch(`${base}/full`, { credentials: 'omit' }),
    fetch(`${base}/toc`, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then(readTocItems)
      .catch((): TocItem[] => []),
  ]);
  if (!fullRes.ok) throw new Error(`HTTP ${fullRes.status}`);
  return { blocks: parseSource(await fullRes.text()), toc };
}

export function loadNovel(): Promise<Novel> {
  cache ??= fetchNovel().catch((error: unknown) => {
    cache = null;
    throw error;
  });
  return cache;
}
