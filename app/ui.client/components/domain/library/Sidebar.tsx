export function Sidebar(): React.JSX.Element {
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
        <a
          className="flex items-center gap-sm p-sm bg-secondary-container text-on-secondary-container rounded-lg hover:bg-secondary-container/80 transition-all"
          href="/library"
          aria-current="page"
        >
          <span className="material-symbols-outlined">menu_book</span>
          <span className="text-label-caps font-label-caps">Library</span>
        </a>
        <a
          className="flex items-center gap-sm p-sm text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-all"
          href="#"
          aria-disabled="true"
          tabIndex={-1}
        >
          <span className="material-symbols-outlined">forum</span>
          <span className="text-label-caps font-label-caps">Chat</span>
        </a>
        <a
          className="flex items-center gap-sm p-sm text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-all"
          href="#"
          aria-disabled="true"
          tabIndex={-1}
        >
          <span className="material-symbols-outlined">history</span>
          <span className="text-label-caps font-label-caps">History</span>
        </a>
      </div>
    </nav>
  );
}
