import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "../auth/store";
import { REVIEWER_ROLES, implementationApi, type ReviewStatus } from "./api";

export const requestsKey = (status: ReviewStatus) => ["askRequests", status] as const;

/** Manager requests in one review state; only fetched for GTM reviewers. */
export function useRequests(status: ReviewStatus) {
  const role = useAuthStore((s) => s.user?.role) ?? "";
  return useQuery({
    queryKey: requestsKey(status),
    queryFn: () => implementationApi.requests(status),
    enabled: REVIEWER_ROLES.includes(role),
    refetchInterval: 60_000,
  });
}

/** Pending count for badges; 0 for everyone else. */
export function usePendingRequestCount(): number {
  return useRequests("pending").data?.length ?? 0;
}
