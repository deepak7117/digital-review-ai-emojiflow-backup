import { listNotifications } from "@/app/admin/notificationActions";
import { NotificationCenter } from "@/components/admin/NotificationCenter";

export default async function AdminNotificationsPage() {
  const result = await listNotifications();

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink sm:text-3xl">Notifications</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Platform events and entitlements approaching expiry — a shared inbox visible to every admin.
      </p>

      <div className="mt-6">
        {"error" in result ? (
          <p className="rounded-[var(--radius-md)] border border-danger/20 bg-danger-tint p-4 text-sm text-danger">
            {result.error}
          </p>
        ) : (
          <NotificationCenter initialNotifications={result.data} />
        )}
      </div>
    </div>
  );
}
