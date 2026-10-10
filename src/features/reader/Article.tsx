import { memo, useState, type ReactNode } from 'react';
import type { Block, Inline } from './source';

/** 表情圖：由 scripts/fetch-emoticons.ts 下載到 public/images/emoticons/；缺圖時退回顯示 alt 文字 */
function Emoticon({ file, alt }: { file: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="rd-emo-alt">{alt}</span>;
  return (
    <img
      className="rd-emo"
      src={`${import.meta.env.BASE_URL}images/emoticons/${file}`}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function renderInline(nodes: readonly Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return n.v;
      case 'br':
        return <br key={i} />;
      case 'em':
        return <em key={i}>{renderInline(n.c)}</em>;
      case 'strong':
        return <strong key={i}>{renderInline(n.c)}</strong>;
      case 'emo':
        return <Emoticon key={i} file={n.file} alt={n.alt} />;
    }
  });
}

const Paragraph = memo(function Paragraph({
  block,
  index,
  marked,
}: {
  block: Block;
  index: number;
  marked: boolean;
}) {
  const Tag = block.kind === 'p' ? 'p' : block.kind;
  return (
    <Tag data-b={index} data-seg={block.seg || undefined} data-bookmark={marked || undefined}>
      {renderInline(block.c)}
    </Tag>
  );
});

/** 小說全文。以資料模型渲染（不使用 innerHTML）；bookmarkIndex 的段落左側有標記 */
export const Article = memo(function Article({
  blocks,
  bookmarkIndex,
}: {
  blocks: readonly Block[];
  bookmarkIndex: number | null;
}) {
  return (
    <>
      {blocks.map((block, i) => (
        <Paragraph key={i} block={block} index={i} marked={i === bookmarkIndex} />
      ))}
    </>
  );
});
