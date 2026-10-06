import { lazy, Suspense, useEffect, useState } from 'react';
import ui from '../content/ui.yaml';

// 空殼首頁（Phase 1 的部署驗證用）。內容載入與 t() 會在任務 T028 正式建立，屆時取代這裡的暫時型別。
const { site } = ui as { site: { title: string; subtitle: string } };

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
      <h1 className="font-heading text-[40px]">{site.title}</h1>
      <p>{site.subtitle}</p>
    </main>
  );
}
