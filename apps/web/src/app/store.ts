import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Client-only UI state. Server state lives in TanStack Query. */
interface AppState {
  /** Desktop sidebar expanded vs icon-only. */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  /** Mobile drawer, deliberately not persisted — it should never survive a reload. */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      drawerOpen: false,
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
    }),
    {
      name: "gocrm.ui",
      // Only the durable preference is written to localStorage.
      partialize: (s) => ({ sidebarOpen: s.sidebarOpen }),
    },
  ),
);
