import { Fragment, useId, type ReactNode } from 'react';
import { getPerson, getTerm, parseRich, type MarkupNode } from '../../content';
import { useAppStore } from '../../store/store';
import { usePopoverStore } from '../../store/popover';

/**
 * 全站所有「含行內標記的文字」都經過這裡（憲章 I）：人名／名詞連結、交叉連結、伏筆回收處。
 * 人名與名詞會依別名表自動辨識；規則見 contracts/content-markup.md。
 */
export interface RichTextProps {
  text: string;
  className?: string;
  /** 點擊 {x:target|…} 交叉連結（例如 spectrum）時呼叫 */
  onCrossLink?: (target: string) => void;
}

export function RichText({ text, className, onCrossLink }: RichTextProps) {
  const nodes = parseRich(text);
  return <span className={className}>{renderNodes(nodes, onCrossLink)}</span>;
}

function renderNodes(nodes: MarkupNode[], onCrossLink?: (target: string) => void): ReactNode {
  return nodes.map((node, i) => {
    if (node.type === 'text') return <Fragment key={i}>{node.text}</Fragment>;
    const label = node.explicit ? renderNodes(node.children, onCrossLink) : null;
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
      case 'x':
        return (
          <CrossLink key={i} target={node.arg} onActivate={onCrossLink}>
            {label}
          </CrossLink>
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
    <button
      type="button"
      className="link-name"
      data-open={open || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(e) => toggle({ kind: 'person', id: personId, anchor: e.currentTarget, anchorKey })}
    >
      {children ?? person.name}
    </button>
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
    <button
      type="button"
      className="link-term"
      data-open={open || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(e) => toggle({ kind: 'term', id: termId, anchor: e.currentTarget, anchorKey })}
    >
      {children ?? term.term}
    </button>
  );
}

/** 交叉連結（「見下方 ↓」）：金色實線底線 */
export function CrossLink({
  target,
  onActivate,
  children,
}: {
  target: string;
  onActivate?: ((target: string) => void) | undefined;
  children?: ReactNode;
}) {
  return (
    <button type="button" className="link-cross" onClick={() => onActivate?.(target)}>
      {children}
    </button>
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
