import { create } from "zustand";

/** Client-only UI state (auth session, sidebar, filters). Server state lives in TanStack Query. */
interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
