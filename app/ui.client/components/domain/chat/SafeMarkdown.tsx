import { Fragment, type ReactNode } from "react";

/**
 * Tiny safe markdown renderer.
 *
 * Why hand-rolled instead of pulling `react-markdown`? The canned response
 * engine emits a deliberately small subset of markdown — paragraphs, bullet
 * lists, and `**bold**` runs. This renderer covers exactly that subset and
 * HTML-escapes everything else. No `dangerouslySetInnerHTML`. When the real
 * LLM lands and outputs richer markdown, we swap in a vetted library.
 */

interface SafeMarkdownProps {
  text: string;
  className?: string;
}

interface Block {
  kind: "paragraph" | "list";
  lines: string[];
}

function tokeniseBlocks(text: string): Block[] {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      if (current) blocks.push(current);
      current = null;
      continue;
    }
    const isListItem = /^\s*[-*]\s+/.test(line);
    if (isListItem) {
      if (!current || current.kind !== "list") {
        if (current) blocks.push(current);
        current = { kind: "list", lines: [] };
      }
      current.lines.push(line.replace(/^\s*[-*]\s+/, ""));
    } else {
      if (!current || current.kind !== "paragraph") {
        if (current) blocks.push(current);
        current = { kind: "paragraph", lines: [] };
      }
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function renderInline(text: string): ReactNode {
  // Splits on `**bold**` while preserving the surrounding text.
  const parts: ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={`t-${key++}`}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    parts.push(<strong key={`b-${key++}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={`t-${key++}`}>{text.slice(lastIndex)}</Fragment>);
  }
  return parts;
}

export function SafeMarkdown({ text, className }: SafeMarkdownProps): React.JSX.Element {
  const blocks = tokeniseBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, idx) => {
        if (block.kind === "list") {
          return (
            <ul key={idx} className="list-disc pl-md text-body-md font-body-md text-on-surface space-y-xs my-xs">
              {block.lines.map((item, i) => (
                <li key={i}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} className="text-body-md font-body-md text-on-surface my-xs">
            {block.lines.map((line, i) => (
              <Fragment key={i}>
                {renderInline(line)}
                {i < block.lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
