/**
 * 《德雷文》好讀版：Cloudflare Worker。把 KV 裡的小說原文（/full）與目錄（/toc），只送給允許的網站。
 * 約定見 specs/002-reader-mode/contracts/worker-api.md；部署步驟見 specs/002-reader-mode/quickstart.md。
 *
 * 能擋：不經過你的網站、直接用網址或程式抓取（沒有正確的 Origin 就是 403）。
 * 擋不住：有心人偽造 Origin；讀者的瀏覽器收到後的內容（開發者工具看得到）。
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const cors =
      origin && allowed.includes(origin)
        ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
        : null;

    if (request.method === 'OPTIONS') {
      return cors
        ? new Response(null, {
            status: 204,
            headers: {
              ...cors,
              'Access-Control-Allow-Methods': 'GET',
              'Access-Control-Max-Age': '86400',
            },
          })
        : new Response(null, { status: 403 });
    }
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    const key = { '/full': 'full', '/toc': 'toc' }[url.pathname];
    if (!key) return new Response('Not Found', { status: 404 });
    if (!cors) return new Response('Forbidden', { status: 403 });

    const body = await env.STORY.get(key);
    if (body === null) return new Response('Not Found', { status: 404, headers: cors });

    return new Response(body, {
      headers: {
        ...cors,
        'Content-Type':
          key === 'toc' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};
