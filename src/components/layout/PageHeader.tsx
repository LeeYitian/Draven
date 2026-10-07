import { t } from '../../content';
import { DisplayNum, Eyebrow } from '../ui';
import { useLayout } from './LayoutProvider';

export interface PageHeaderProps {
  /** 例如 "01" */
  number: string;
  /** 例如「第一主軸 · 政治與文化主線」 */
  category: string;
  title: string;
  /** 一句話（流式版頁首副標；舞台版為了 72px 高度不顯示） */
  oneLiner: string;
  coreTheme: string;
}

/** 主軸頁頁首：大數字＋分類＋標題＋核心主題（設計稿 §3；流式版見 §7） */
export function PageHeader({ number, category, title, oneLiner, coreTheme }: PageHeaderProps) {
  const { mode } = useLayout();

  if (mode === 'flow') {
    return (
      <header className="flex flex-col gap-3 pt-9">
        <div className="flex flex-col gap-2.5 border-b border-divider pb-5">
          <div className="flex items-end gap-3.5">
            <DisplayNum className="text-[60px] leading-[0.8]">{number}</DisplayNum>
            <Eyebrow accent>{category}</Eyebrow>
          </div>
          <h1 className="mt-1.5 text-[30px] leading-[1.3]">{title}</h1>
          <p className="m-0 text-[14.5px] leading-[1.7] text-neutral-700">{oneLiner}</p>
        </div>
        <div className="border-t border-accent pt-3">
          <Eyebrow className="mb-1.5">{t('axis.coreTheme')}</Eyebrow>
          <p className="m-0 text-[18px] leading-[1.65]">{coreTheme}</p>
        </div>
      </header>
    );
  }

  return (
    <header className="grid h-[64px] grid-cols-[minmax(0,1fr)_460px] items-end gap-12">
      <div className="flex items-end gap-[22px]">
        <DisplayNum className="text-[64px] leading-[0.8]">{number}</DisplayNum>
        <div>
          <Eyebrow accent>{category}</Eyebrow>
          <h1 className="mt-1 text-[32px] leading-[1.1]">{title}</h1>
        </div>
      </div>
      <div>
        <Eyebrow>{t('axis.coreTheme')}</Eyebrow>
        <p className="m-0 mt-1 text-[17px] leading-[1.55]">{coreTheme}</p>
      </div>
    </header>
  );
}
