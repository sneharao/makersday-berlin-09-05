export interface SidebarProps {
  /** When set, the Chat link routes to /chat/:currentChatId instead of /chat (avoids spawning new chats on repeat clicks). */
  currentChatId?: string;
}

export type SidebarNavKey = "library" | "chat" | "history";
