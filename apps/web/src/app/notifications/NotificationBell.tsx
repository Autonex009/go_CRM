import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/store";
import { API_URL } from "../lib/config";
import { Badge, Button, Icon } from "../ui";
import { notificationsApi, type NotificationItem } from "./api";

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch notification list & count
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(20, 0),
    enabled: !!token,
    refetchInterval: 30000, // Fallback refetch every 30s
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Connect real-time SSE stream
  useEffect(() => {
    if (!token) return;

    // Use EventSource or standard SSE stream fetch with Bearer token
    const controller = new AbortController();
    const streamUrl = `${API_URL}/api/v1/notifications/stream`;

    async function startSSE() {
      try {
        const response = await fetch(streamUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const chunk of lines) {
            if (chunk.includes("event: notification")) {
              const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
              if (dataLine) {
                const rawJson = dataLine.replace("data: ", "").trim();
                const item: NotificationItem = JSON.parse(rawJson);

                // Show toast & refresh list query
                setToast(item);
                void queryClient.invalidateQueries({ queryKey: ["notifications"] });
                setTimeout(() => setToast(null), 5000);
              }
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          console.debug("SSE disconnected, will reconnect automatically");
        }
      }
    }

    void startSSE();

    return () => {
      controller.abort();
    };
  }, [token, queryClient]);

  // Click outside to close drawer
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const items = query.data?.items || [];
  const unreadCount = query.data?.unreadCount || 0;

  const getTone = (priority: string) => {
    switch (priority) {
      case "danger":
        return "danger";
      case "warning":
        return "warning";
      case "success":
        return "success";
      default:
        return "neutral";
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-fg-muted hover:bg-surface-hover hover:text-fg focus:outline-none"
        title="Notifications"
      >
        <Icon name="mail" size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 rounded-xl border border-line bg-surface p-sm shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-line px-sm py-xs pb-sm">
            <div className="flex items-center gap-xs">
              <h3 className="text-sm font-semibold text-fg">Notifications</h3>
              {unreadCount > 0 && <Badge tone="brand">{unreadCount} new</Badge>}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-xs text-brand hover:underline"
                onClick={() => markAllReadMutation.mutate()}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-line my-xs">
            {items.length > 0 ? (
              items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!item.isRead) markReadMutation.mutate(item.id);
                    if (item.actionUrl) {
                      setIsOpen(false);
                      navigate(item.actionUrl);
                    }
                  }}
                  className={`flex flex-col gap-xs p-sm cursor-pointer transition-colors hover:bg-surface-hover ${
                    !item.isRead ? "bg-accent-soft/30 font-medium" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-xs">
                    <span className="text-xs font-semibold text-fg truncate">{item.title}</span>
                    <Badge tone={getTone(item.priority)}>{item.priority}</Badge>
                  </div>
                  <p className="text-xs text-fg-muted line-clamp-2">{item.body}</p>
                  <span className="text-[10px] text-fg-subtle">
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-lg text-center text-xs text-fg-subtle">No notifications yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Real-time Toast Banner */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-md rounded-xl border border-line bg-surface p-md shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-xs">
              <Badge tone={getTone(toast.priority)}>{toast.priority.toUpperCase()}</Badge>
              <h4 className="text-xs font-bold text-fg truncate">{toast.title}</h4>
            </div>
            <p className="mt-xs text-xs text-fg-muted">{toast.body}</p>
          </div>
          <button
            type="button"
            className="text-fg-subtle hover:text-fg text-xs font-bold"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
