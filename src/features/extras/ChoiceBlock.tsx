import { RichText } from '../../components/text/RichText';
import { Eyebrow } from '../../components/ui';
import { t } from '../../content';
import type { AxisExtrasChoice } from '../../content/schema';

/** 04「艾莉絲的抉擇」與明信片留言（沒有鏡像卡或明信片的事件顯示這一塊） */
export function ChoiceBlock({ choice }: { choice: AxisExtrasChoice }) {
  return (
    <div className="choice" data-choice>
      <Eyebrow>{t('choice.title')}</Eyebrow>
      <div className="choice__lines">
        {choice.lines.map((line) => (
          <p key={line} className="choice__line">
            <RichText text={line} />
          </p>
        ))}
      </div>
      <Eyebrow className="choice__messages-title">{t('choice.messagesTitle')}</Eyebrow>
      <div className="choice__messages">
        {choice.messages.map((message) => (
          <p key={message} className="choice__message">
            <RichText text={message} />
          </p>
        ))}
      </div>
    </div>
  );
}
