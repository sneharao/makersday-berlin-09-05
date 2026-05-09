import { useCallback } from "react";
import { useComposer } from "./hooks/use-composer";

export interface ChatComposerProps {
  isSending: boolean;
  onSubmit: (text: string) => void;
}

export function ChatComposer({ isSending, onSubmit }: ChatComposerProps): React.JSX.Element {
  const composer = useComposer((trimmed) => {
    onSubmit(trimmed);
    composer.reset();
  });

  const handleSendClick = useCallback((): void => {
    const trimmed = composer.text.trim();
    if (trimmed.length === 0 || isSending) return;
    onSubmit(trimmed);
    composer.reset();
  }, [composer, isSending, onSubmit]);

  const isDisabled = isSending || composer.text.trim().length === 0;

  return (
    <div className="p-gutter border-t border-outline-variant bg-surface-container-lowest shrink-0 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="relative flex items-end gap-sm bg-surface-container-lowest border border-outline-variant rounded-2xl focus-within:border-primary focus-within:shadow-md transition-all p-xs pl-md shadow-sm">
          <button
            type="button"
            className="p-xs text-on-surface-variant hover:text-primary transition-colors mb-xs disabled:opacity-50"
            title="Attach file (coming soon)"
            aria-label="Attach file (coming soon)"
            disabled
          >
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <textarea
            ref={composer.textareaRef}
            value={composer.text}
            onChange={(event) => composer.setText(event.target.value)}
            onKeyDown={composer.handleKeyDown}
            className="w-full bg-transparent border-none focus:outline-none resize-none max-h-[160px] text-body-md font-body-md py-sm text-on-background placeholder:text-outline min-h-[44px]"
            placeholder="Message Scholastic AI…"
            rows={1}
            aria-label="Message Scholastic AI"
            disabled={isSending}
          />
          <button
            type="button"
            onClick={handleSendClick}
            disabled={isDisabled}
            className="bg-primary text-on-primary p-sm rounded-xl hover:opacity-90 transition-opacity mb-xs ml-auto flex items-center justify-center shrink-0 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="Send message"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              send
            </span>
          </button>
        </div>
        <div className="text-center mt-sm">
          <span className="text-label-caps font-label-caps text-on-surface-variant uppercase tracking-widest">
            Scholastic AI can make mistakes. Verify important information.
          </span>
        </div>
      </div>
    </div>
  );
}
