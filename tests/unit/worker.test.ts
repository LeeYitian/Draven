import { describe, expect, it } from 'vitest';

// Cloudflare Worker（worker/index.js）：只對允許的 Origin 回傳 KV 裡的原文
interface WorkerModule {
  default: { fetch(request: Request, env: unknown): Promise<Response> };
}
const worker = ((await import('../../worker/index.js' as string)) as WorkerModule).default;

const env = {
  ALLOWED_ORIGINS: 'https://leeyitian.github.io, http://localhost:5173',
  NOVEL: {
    get: async (key: string) =>
      key === 'full' ? '<p>原文</p>' : key === 'toc' ? '{"items":[]}' : null,
  },
};
const get = (path: string, origin?: string, method = 'GET') =>
  worker.fetch(
    new Request(`https://w.example${path}`, { method, headers: origin ? { Origin: origin } : {} }),
    env,
  );

describe('worker', () => {
  it('允許的 Origin：回傳原文與 CORS 標頭', async () => {
    const res = await get('/full', 'https://leeyitian.github.io');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<p>原文</p>');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://leeyitian.github.io');
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('沒有 Origin 或不在名單：403，且不洩漏內容', async () => {
    for (const origin of [undefined, 'https://evil.example']) {
      const res = await get('/full', origin);
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain('原文');
    }
  });

  it('/toc 回傳 JSON', async () => {
    const res = await get('/toc', 'https://leeyitian.github.io');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('其他路徑 404、非 GET 405、預檢依 Origin 回 204／403', async () => {
    expect((await get('/other', 'https://leeyitian.github.io')).status).toBe(404);
    expect((await get('/full', 'https://leeyitian.github.io', 'POST')).status).toBe(405);
    expect((await get('/full', 'https://leeyitian.github.io', 'OPTIONS')).status).toBe(204);
    expect((await get('/full', 'https://evil.example', 'OPTIONS')).status).toBe(403);
  });

  it('KV 沒資料：404', async () => {
    const res = await worker.fetch(
      new Request('https://w.example/full', { headers: { Origin: 'http://localhost:5173' } }),
      { ...env, NOVEL: { get: async () => null } },
    );
    expect(res.status).toBe(404);
  });
});
