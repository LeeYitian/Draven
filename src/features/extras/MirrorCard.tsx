import { useState, type MouseEvent } from 'react';
import { RotateCw } from 'lucide-react';
import { NameLink, RichText } from '../../components/text/RichText';
import { Eyebrow } from '../../components/ui';
import { getPerson, t } from '../../content';
import type { AxisExtrasMirror } from '../../content/schema';

type Side = AxisExtrasMirror['sideA'];

function Face({
  mirror,
  side,
  which,
  hidden,
  flipped,
  onFlip,
}: {
  mirror: AxisExtrasMirror;
  side: Side;
  which: 'a' | 'b';
  hidden: boolean;
  flipped: boolean;
  onFlip: () => void;
}) {
  const name = getPerson(side.personId)?.name ?? side.personId;
  return (
    <div
      className="mirror-face"
      data-side={which}
      data-mirror-face={side.personId}
      role="group"
      aria-label={t('mirror.sideLabel', { name, subtitle: side.subtitle })}
      aria-hidden={hidden || undefined}
      inert={hidden}
    >
      <div className="mirror-face__head">
        <span className="mirror-face__name">
          <NameLink personId={side.personId} />
        </span>
        <Eyebrow className="mirror-face__sub">{side.subtitle}</Eyebrow>
        <button
          type="button"
          className="mirror-face__hint"
          data-mirror-flip
          aria-pressed={flipped}
          aria-label={t('mirror.flip')}
          onClick={onFlip}
        >
          <RotateCw size={12} strokeWidth={1.75} aria-hidden="true" />
          {t('mirror.flipHint')}
        </button>
      </div>
      {mirror.rows.map((row) => (
        <div key={row.key} className="mirror-row" data-row={row.key}>
          <span className="mirror-row__label">{row.label}</span>
          <span className="mirror-row__text">
            <RichText text={side.cells[row.key] ?? ''} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 04 鏡像對照卡（設計稿 D6）：一面艾莉絲、一面主教，兩面「身分背景／選擇／動機」同網格同位置。
 * 三層元素：外層閒置時 rotateY ±8° 緩慢來回（像鏡子）→ 中層點擊翻面 rotateY 180°（600ms）→ 兩面卡片有厚度陰影。
 * 「減少動態」時停止自動旋轉，翻面改為淡入淡出（CSS）。看不到的那一面 inert，不會被 Tab 或讀出。
 */
export function MirrorCard({ mirror }: { mirror: AxisExtrasMirror }) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((v) => !v);

  // 點卡片任何地方都翻面，但點到人名（Popover）或翻面鈕時由它們自己處理
  const onCardClick = (e: MouseEvent) => {
    if ((e.target as Element).closest('[role="button"], button')) return;
    toggle();
  };

  return (
    <div className="mirror-stage" data-mirror>
      <div className="mirror-idle">
        <div
          className="mirror-card"
          data-flipped={flipped || undefined}
          role="group"
          aria-label={t('mirror.label')}
          onClick={onCardClick}
        >
          <Face
            mirror={mirror}
            side={mirror.sideA}
            which="a"
            hidden={flipped}
            flipped={flipped}
            onFlip={toggle}
          />
          <Face
            mirror={mirror}
            side={mirror.sideB}
            which="b"
            hidden={!flipped}
            flipped={flipped}
            onFlip={toggle}
          />
        </div>
      </div>
    </div>
  );
}
