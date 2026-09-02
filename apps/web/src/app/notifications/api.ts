import { apiFetch } from "../lib/api";

export interface NotificationItem {
  id: string;
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  priority: "info" | "success" | "warning" | "danger";
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const BASE = "/api/v1/notifications";

export const notificationsApi = {
  list: (limit = 20, offset = 0) =>
    apiFetch<NotificationsResponse>(`${BASE}?limit=${limit}&offset=${offset}`),

  markRead: (id: string) =>
    apiFetch<void>(`${BASE}/${id}/read`, { method: "PATCH" }),

  markAllRead: () =>
    apiFetch<void>(`${BASE}/read-all`, { method: "POST" }),

  subscribe: (sub: PushSubscriptionInput) =>
    apiFetch<void>(`${BASE}/subscribe`, {
      method: "POST",
      body: JSON.stringify(sub),
    }),

  unsubscribe: (endpoint: string) =>
    apiFetch<void>(`${BASE}/unsubscribe`, {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    }),
};
