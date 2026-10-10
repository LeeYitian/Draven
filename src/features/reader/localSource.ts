/**
 * 開發模式專用：讀取本機的 contents/full.html 與 contents/toc.json（兩者都不進 repo）。
 * 只被 loadNovel.ts 在 import.meta.env.DEV 為真時動態載入，正式建置不會把它們打包進網站。
 */
const files = import.meta.glob<string>('../../../contents/full.html', {
  query: '?raw',
  import: 'default',
});
const tocFiles = import.meta.glob<unknown>('../../../contents/toc.json', { import: 'default' });

export async function loadLocalSource(): Promise<string | null> {
  const loader = files[`../../../contents/full.html`];
  if (loader) return loader();
  return null;
}

export async function loadLocalToc(): Promise<unknown> {
  const loader = tocFiles['../../../contents/toc.json'];
  return loader ? loader() : undefined;
}
