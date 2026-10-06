import { lazy, Suspense, useEffect, useState } from 'react';
import { t } from '../content';

// 開發專用元件圖鑑：只在 dev 模式載入，正式建置會把整段移除（任務 T046 會改成正式路由）
const Kit = import.meta.env.DEV ? lazy(() => import('../dev/Kit')) : null;

export function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  if (Kit && hash === '#/__kit') {
    return (
      <Suspense fallback={null}>
        <Kit />
      </Suspense>
    );
  }

  return (
    <main className="p-8">
      <h1 className="font-heading text-[40px]">{t('site.title')}</h1>
      <p>{t('site.subtitle')}</p>
    </main>
  );
}
