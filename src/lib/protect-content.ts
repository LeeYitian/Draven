/**
 * 文字保護事件層（N-01／FR-091）。CSS 的 user-select:none 是主力（src/styles/index.css），
 * 這裡是保險：就算有東西選到了文字，也不讓它被複製、剪下或拖出去。
 *
 * 限制（必須誠實）：這只能擋一般讀者的操作，擋不住檢視原始碼、截圖、閱讀模式。見 research R25。
 */
export interface ProtectOptions {
  /** 攔截右鍵選單。預設關閉：擋了也擋不住快捷鍵，只會讓一般讀者不便。 */
  contextMenu?: boolean;
  /** 要掛事件的目標，預設 document（測試時可注入）。 */
  target?: Document;
}

export function installContentProtection(options: ProtectOptions = {}): () => void {
  const doc = options.target ?? document;

  const stop = (event: Event) => event.preventDefault();
  // 好讀版的文章區允許反白（為了「記錄閱讀進度」）；反白的文字仍不能複製、剪下或拖出去
  const inReaderArticle = (event: Event) => {
    const node = event.target as Node | null;
    const el = node instanceof Element ? node : (node?.parentElement ?? null);
    return !!el?.closest('[data-reader-article]');
  };
  const onSelectStart = (event: Event) => {
    if (!inReaderArticle(event)) event.preventDefault();
  };
  const onContextMenu = (event: Event) => {
    if (inReaderArticle(event)) event.preventDefault();
  };
  const onCopy = (event: ClipboardEvent) => {
    event.preventDefault();
    // 就算有東西被選到，剪貼簿也只會得到空字串
    event.clipboardData?.setData('text/plain', '');
  };

  doc.addEventListener('selectstart', onSelectStart);
  doc.addEventListener('contextmenu', onContextMenu);
  doc.addEventListener('dragstart', stop);
  doc.addEventListener('cut', stop);
  doc.addEventListener('copy', onCopy);
  if (options.contextMenu) doc.addEventListener('contextmenu', stop);

  return () => {
    doc.removeEventListener('selectstart', onSelectStart);
    doc.removeEventListener('dragstart', stop);
    doc.removeEventListener('cut', stop);
    doc.removeEventListener('copy', onCopy);
    doc.removeEventListener('contextmenu', onContextMenu);
    doc.removeEventListener('contextmenu', stop);
  };
}

/**
 * 啟動入口。開發模式下網址加 ?allowSelect=1（寫在 # 之前）可暫時關閉保護，方便作者校對文字；
 * 正式建置（import.meta.env.DEV 為 false）時這段會被整個移除，上線網站無法用旗標關閉。
 */
export function startContentProtection(): () => void {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('allowSelect')) {
    document.documentElement.setAttribute('data-allow-select', '');
    return () => {};
  }
  return installContentProtection();
}
