"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { markNotificationRead, type AdminNotification } from "@/app/admin/notificationActions";

const EVENT_TONE: Record<string, string> = {
  business_status_changed: "bg-gold-tint text-gold",
  admin_role_changed: "bg-verified-tint text-verified-dark",
  entitlement_changed: "bg-voice-tint text-voice-dark",
  entitlement_expiring: "bg-danger-tint text-danger",
  owner_password_reset: "bg-danger-tint text-danger",
};

function targetHref(n: AdminNotification): string | null {
  if (!n.targetType || !n.targetId) return null;
  if (n.targetType === "business") return `/admin/businesses/${n.targetId}`;
  if (n.targetType === "owner") return `/admin/owners/${n.targetId}`;
  if (n.targetType === "admin") return `/admin/admins/${n.targetId}`;
  return null;
}

export function NotificationCenter({ initialNotifications }: { initialNotifications: AdminNotification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleMarkRead(id: string) {
    startTransition(async () => {
      const result = await markNotificationRead(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    });
  }

  if (notifications.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-6 text-center text-sm text-slate">
        No notifications yet. Platform events — business status changes, admin role changes, entitlement
        updates — will appear here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-danger">{error}</p>}
      {notifications.map((n) => {
        const href = targetHref(n);
        const content = (
          <div
            className={`flex items-start justify-between gap-3 rounded-[var(--radius-md)] border p-4 shadow-xs transition-colors ${
              n.isRead ? "border-border bg-paper" : "border-border-strong bg-paper-raised"
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                    EVENT_TONE[n.eventType] ?? "bg-ink/5 text-slate"
                  }`}
                >
                  {n.eventType.replace(/_/g, " ")}
                </span>
                {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="Unread" />}
              </div>
              <p className="mt-1.5 text-sm text-ink">{n.title}</p>
              <p className="mt-1 text-[11px] text-slate">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
            {n.canMarkRead && !n.isRead && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleMarkRead(n.id);
                }}
                disabled={isPending}
                className="shrink-0 rounded-[var(--radius-sm)] border border-border-strong bg-paper-raised px-2.5 py-1 text-[11px] font-medium text-ink-soft disabled:opacity-50"
              >
                Mark read
              </button>
            )}
          </div>
        );

        return href ? (
          <Link key={n.id} href={href}>
            {content}
          </Link>
        ) : (
          <div key={n.id}>{content}</div>
        );
      })}
    </div>
  );
}
