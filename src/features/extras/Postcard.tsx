import { useState } from 'react';
import { Eyebrow } from '../../components/ui';
import { RichText } from '../../components/text/RichText';
import { t } from '../../content';
import type { AxisExtrasPostcard } from '../../content/schema';

/**
 * 04 魔法明信片（設計稿 D7，400×250）：正面是插圖（plate 樣式：襯底＋內嵌圖；素材放 public/images/，換檔不必改程式），
 * 背面是留言；點擊翻面（rotateY 600ms，翻面時微微上浮）；卡片下方一行說明。
 * 「減少動態」時翻面改為淡入淡出、不上浮（CSS）。
 */
export function Postcard({ postcard }: { postcard: AxisExtrasPostcard }) {
  const [flips, setFlips] = useState(0);
  const flipped = flips % 2 === 1;
  const src = import.meta.env.BASE_URL + postcard.frontImage;

  return (
    <figure className="postcard-wrap" data-postcard>
      {/* 上浮動畫：兩組同樣的 keyframes 輪流用，每次翻面換一組就會從頭播放 */}
      <div className="postcard-lift" data-lift={flips === 0 ? undefined : flips % 2}>
        {/* 閒置傾斜：和鏡像卡一樣 rotateY ±8° 緩慢來回，滑鼠移上去或聚焦時暫停 */}
        <div className="postcard-idle">
          <button
            type="button"
            className="postcard"
            data-flipped={flipped || undefined}
            aria-pressed={flipped}
            aria-label={t('postcard.flip')}
            onClick={() => setFlips((n) => n + 1)}
          >
            <span className="postcard__face" data-side="front" aria-hidden={flipped || undefined}>
              <img
                className="postcard__img"
                src={src}
                alt={flipped ? '' : postcard.frontAlt}
                draggable={false}
              />
              <span className="postcard__hint">{t('postcard.flipHint')}</span>
            </span>
            <span className="postcard__face" data-side="back" aria-hidden={!flipped || undefined}>
              <Eyebrow>{postcard.backTitle}</Eyebrow>
              <span className="postcard__text">
                <RichText text={postcard.backText} />
              </span>
            </span>
          </button>
        </div>
      </div>
      <figcaption className="postcard__caption">
        <RichText text={postcard.caption} />
      </figcaption>
    </figure>
  );
}
