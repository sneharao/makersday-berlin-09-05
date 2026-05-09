import type { TopAppBarProps } from "./types";

export function TopAppBar({ user, onSignOut }: TopAppBarProps): React.JSX.Element {
  const initials = user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return (
    <header className="flex justify-between items-center h-16 px-gutter w-full sticky top-0 z-40 bg-surface-container-lowest border-b border-outline-variant">
      <div className="flex items-center gap-sm md:hidden">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined text-[16px]">auto_stories</span>
        </div>
        <h1 className="text-title-sm font-title-sm font-bold text-primary m-0">Scholastic AI</h1>
      </div>
      <div className="hidden md:flex flex-1 max-w-xl mx-auto">
        <div className="relative w-full group">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            className="w-full pl-xl pr-sm py-sm rounded-lg border border-outline-variant bg-surface-container-lowest text-body-md font-body-md focus:outline-none focus:border-primary transition-all disabled:opacity-50"
            placeholder="Search documents…"
            type="text"
            disabled
            aria-label="Search documents (coming soon)"
          />
        </div>
      </div>
      <div className="flex items-center gap-sm ml-auto">
        <button
          type="button"
          className="p-xs text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full disabled:opacity-50"
          aria-label="Notifications (coming soon)"
          disabled
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button
          type="button"
          className="p-xs text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full disabled:opacity-50"
          aria-label="Settings (coming soon)"
          disabled
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="bg-surface-container-high text-on-surface text-body-sm font-body-sm rounded-lg py-xs px-sm hover:bg-surface-container-highest transition-colors"
        >
          Sign out
        </button>
        <div
          className="w-8 h-8 rounded-full bg-surface-variant overflow-hidden ml-sm border border-outline-variant flex items-center justify-center text-body-sm font-body-md text-on-surface-variant"
          aria-label={user.displayName}
          title={user.displayName}
        >
          {initials || user.email.slice(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
