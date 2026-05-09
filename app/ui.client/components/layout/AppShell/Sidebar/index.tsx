import { useLocation } from "react-router";
import type { SidebarProps, SidebarNavKey } from "./types";

function activeKeyFor(pathname: string): SidebarNavKey | null {
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/history")) return "history";
  return null;
}

export function Sidebar({ currentChatId }: SidebarProps = {}): React.JSX.Element {
  const { pathname } = useLocation();
  const active = activeKeyFor(pathname);

  const chatHref = currentChatId ? `/chat/${currentChatId}` : "/chat";

  return (
    <nav className="hidden md:flex flex-col p-md gap-base border-r border-outline-variant bg-surface-container-low fixed left-0 top-0 h-screen w-[280px] z-50">
      <div className="mb-xl flex items-center gap-sm">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined text-title-sm">auto_stories</span>
        </div>
        <div>
          <h1 className="text-title-sm font-title-sm font-bold text-primary m-0">Scholastic AI</h1>
          <p className="text-body-sm font-body-sm text-on-surface-variant m-0">Digital Library</p>
        </div>
      </div>
      <div className="flex flex-col gap-xs flex-1">
        <SidebarLink
          href="/library"
          icon="menu_book"
          label="Library"
          isActive={active === "library"}
        />
        <SidebarLink
          href={chatHref}
          icon="forum"
          label="Chat"
          isActive={active === "chat"}
        />
        <SidebarLink
          href="#"
          icon="history"
          label="History"
          isActive={active === "history"}
          isDisabled
        />
      </div>
    </nav>
  );
}

interface SidebarLinkProps {
  href: string;
  icon: string;
  label: string;
  isActive: boolean;
  isDisabled?: boolean;
}

function SidebarLink({ href, icon, label, isActive, isDisabled }: SidebarLinkProps): React.JSX.Element {
  const className = isActive
    ? "flex items-center gap-sm p-sm bg-secondary-container text-on-secondary-container rounded-lg hover:bg-secondary-container/80 transition-all"
    : "flex items-center gap-sm p-sm text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-all";

  if (isDisabled) {
    return (
      <a
        className={className}
        href={href}
        aria-disabled="true"
        tabIndex={-1}
      >
        <span className="material-symbols-outlined">{icon}</span>
        <span className="text-label-caps font-label-caps">{label}</span>
      </a>
    );
  }

  return (
    <a
      className={className}
      href={href}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="material-symbols-outlined">{icon}</span>
      <span className="text-label-caps font-label-caps">{label}</span>
    </a>
  );
}
