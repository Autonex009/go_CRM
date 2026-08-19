import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { create } from "zustand";

import { orgApi } from "./api";

interface WorkspaceState {
  name: string;
  /** ISO 4217 code. "USD" until the real value loads. */
  currency: string;
  set: (workspace: { name: string; currency: string }) => void;
}

/**
 * Workspace settings in a zustand store rather than read from the query cache at
 * each use site.
 *
 * Why: every lead and deal card needs the currency to format its amount. Sixty
 * cards each subscribing to a TanStack query is sixty subscriptions for a value
 * that changes about once a year; a zustand selector is a far cheaper read, and
 * `useCurrency()` returns a primitive so a card only re-renders if the code
 * itself actually changes.
 */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  name: "",
  currency: "USD",
  set: ({ name, currency }) => set({ name, currency }),
}));

/** Cheap primitive selector for the ~every component that formats money. */
export function useCurrency(): string {
  return useWorkspaceStore((s) => s.currency);
}

/**
 * Fetches the workspace once and hydrates the store. Mounted by AppLayout, so
 * it runs for every authenticated page and nowhere else.
 */
export function useWorkspaceSync(): void {
  const set = useWorkspaceStore((s) => s.set);

  const { data } = useQuery({
    queryKey: ["workspace"],
    queryFn: orgApi.workspace,
    // Settings change rarely; don't refetch on every remount.
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    if (data) set({ name: data.name, currency: data.currency });
  }, [data, set]);
}
