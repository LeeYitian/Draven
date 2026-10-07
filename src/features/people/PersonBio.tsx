import { Spoiler } from '../../components/ui';
import { t } from '../../content';
import type { Person } from '../../content/schema';
import { useAppStore } from '../../store/store';
import { spoilerVisible } from '../../store/selectors';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 完整介紹（任務 T085）：一般段落直接顯示；劇透段落預設只畫灰條（真實文字不進 DOM），
 * 只有讀者點擊才顯示、可再隱藏——永遠不依進度自動打開（FR-053）。
 * 進度還沒到該主軸時，標頭提示「讀完第 n 主軸後解鎖（點擊仍可查看）」。
 */
export function PersonBio({ person, progress }: { person: Person; progress: number }) {
  const revealed = useAppStore((s) => s.people.spoilerRevealed);
  const toggle = useAppStore((s) => s.toggleSpoiler);

  return (
    <>
      {person.bio.map((block, i) => {
        if (block.type === 'text')
          return (
            <p key={i} className="m-0 text-justify text-[16px] leading-[1.85] flow:text-[15px]">
              {block.text}
            </p>
          );
        const tag = t('people.spoilerTag', { axis: pad(block.axis) });
        const locked = progress < block.axis;
        return (
          <Spoiler
            key={i}
            revealed={spoilerVisible(revealed, person.id, block.axis)}
            onToggle={() => toggle(person.id, block.axis)}
            lockedLabel={`${tag} ${locked ? t('people.spoilerLocked', { n: pad(block.axis) }) : t('people.spoilerShow')}`}
            shownLabel={t('people.spoilerShown', { axis: pad(block.axis) })}
            hideLabel={t('people.spoilerHide')}
            lines={Math.min(4, Math.max(2, Math.ceil(block.text.length / 30)))}
          >
            <p className="m-0 text-justify text-[16px] leading-[1.85] flow:text-[15px]">{block.text}</p>
          </Spoiler>
        );
      })}
    </>
  );
}
