import { Fragment, useId, type ReactNode } from 'react';
import { getPerson, getTerm, parseRich, type MarkupNode } from '../../content';
import { useAppStore } from '../../store/store';
import { usePopoverStore } from '../../store/popover';
import { NoteRow } from '../../features/hints/NoteRow';
import { resolveNoteInsertionPoint } from '../../features/hints/note-placement';

/**
 * 全站所有「含行內標記的文字」都經過這裡（憲章 I）：人名／名詞連結、伏筆回收處。
 * 人名與名詞會依別名表自動辨識；規則見 contracts/content-markup.md。
 */
export interface RichTextProps {
  text: string;
  className?: string;
  /** 流式版事件敘述：在伏筆回收處之後的標點後面插入註記列（框格放在這裡）；桌機版不用 */
  noteRows?: boolean;
}

export function RichText({ text, className, noteRows }: RichTextProps) {
  const nodes = parseRich(text);
  if (!noteRows) return <span className={className}>{renderNodes(nodes)}</span>;
  return (
    <span className={className}>
      {resolveNoteInsertionPoint(nodes).map((item, i) =>
        item.kind === 'note' ? (
          <NoteRow key={`note-${i}`} hintIds={item.hintIds} />
        ) : (
          <Fragment key={i}>{renderNodes([item.node])}</Fragment>
        ),
      )}
    </span>
  );
}

function renderNodes(nodes: MarkupNode[]): ReactNode {
  return nodes.map((node, i) => {
    if (node.type === 'text') return <Fragment key={i}>{node.text}</Fragment>;
    const label = node.explicit ? renderNodes(node.children) : null;
    switch (node.type) {
      case 'p':
        return (
          <NameLink key={i} personId={node.arg}>
            {label}
          </NameLink>
        );
      case 't':
        return (
          <TermLink key={i} termId={node.arg}>
            {label}
          </TermLink>
        );
      case 'h':
        return (
          <HintAnchor key={i} hintId={node.arg}>
            {label}
          </HintAnchor>
        );
    }
  });
}

/**
 * 行內可點文字。刻意用 <span role="button"> 而不是 <button>：瀏覽器把 button 當成「不可拆開的行內方塊」，
 * 緊接在後面的全形標點（）、。）會被擠到下一行行首，違反中文排版的避頭尾；span 則可以正常斷行。
 * 鍵盤行為與 button 相同（Tab 聚焦、Enter／空白鍵啟動）。
 */
function InlineButton({
  onActivate,
  children,
  ...rest
}: {
  onActivate: (element: HTMLElement) => void;
  children?: ReactNode;
  className: string;
  'data-open'?: true | undefined;
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      {...rest}
      onClick={(e) => onActivate(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onActivate(e.currentTarget);
      }}
    >
      {children}
    </span>
  );
}

function useIsOpen(kind: 'person' | 'term', id: string, anchorKey: string): boolean {
  return usePopoverStore(
    (s) => s.open?.kind === kind && s.open.id === id && s.open.anchorKey === anchorKey,
  );
}

/** 人名：灰色點線；點擊開人物 Popover（內容依進度，見 PopoverLayer） */
export function NameLink({ personId, children }: { personId: string; children?: ReactNode }) {
  const anchorKey = useId();
  const open = useIsOpen('person', personId, anchorKey);
  const toggle = usePopoverStore((s) => s.togglePopover);
  const person = getPerson(personId);
  if (!person) return <>{children}</>; // 內容驗證會在建置時擋下；執行期退化為純文字
  return (
    <InlineButton
      className="link-name"
      data-open={open || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      onActivate={(anchor) => toggle({ kind: 'person', id: personId, anchor, anchorKey })}
    >
      {children ?? person.name}
    </InlineButton>
  );
}

/** 名詞：金色字＋金色點線；點擊開名詞 Popover（固定內容） */
export function TermLink({ termId, children }: { termId: string; children?: ReactNode }) {
  const anchorKey = useId();
  const open = useIsOpen('term', termId, anchorKey);
  const toggle = usePopoverStore((s) => s.togglePopover);
  const term = getTerm(termId);
  if (!term) return <>{children}</>;
  return (
    <InlineButton
      className="link-term"
      data-open={open || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      onActivate={(anchor) => toggle({ kind: 'term', id: termId, anchor, anchorKey })}
    >
      {children ?? term.term}
    </InlineButton>
  );
}

/**
 * 伏筆回收處：雙底線片語。框格與弧線依這個元素的位置放置（HintSlotLayer 以 data-hint 量測，任務 T094）；
 * 已解開的伏筆底線改為灰色。
 */
export function HintAnchor({ hintId, children }: { hintId: string; children?: ReactNode }) {
  const solved = useAppStore((s) => s.hints.solved.includes(hintId));
  return (
    <span className="hint-anchor" data-hint={hintId} data-solved={solved || undefined}>
      {children}
    </span>
  );
}
