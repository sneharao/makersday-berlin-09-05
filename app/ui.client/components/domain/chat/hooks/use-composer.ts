import { useCallback, useEffect, useRef, useState } from "react";

const MAX_TEXTAREA_HEIGHT_PX = 160;

export interface UseComposerApi {
  text: string;
  setText: (next: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  reset: () => void;
}

/**
 * Owns DOM-coupled composer behaviour:
 * - autosizes the textarea up to ~5 lines (`max-h-[160px]`)
 * - Shift+Enter inserts a newline; Enter submits
 *
 * `onSubmit` is invoked when the user presses Enter (without Shift) on a
 * non-empty trimmed body. The hook does not clear the text — the parent
 * does that on a successful send via `reset()`.
 */
export function useComposer(onSubmit: (text: string) => void): UseComposerApi {
  const [text, setText] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Autosize on every text change.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    const next = Math.min(node.scrollHeight, MAX_TEXTAREA_HEIGHT_PX);
    node.style.height = `${next}px`;
  }, [text]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      onSubmit(trimmed);
    },
    [text, onSubmit],
  );

  const reset = useCallback((): void => {
    setText("");
  }, []);

  return { text, setText, textareaRef, handleKeyDown, reset };
}
