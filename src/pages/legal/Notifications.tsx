import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bell, BellRing, Check } from "lucide-react";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState } from "@/components/legal/ui";

/**
 * الإشعارات — system + review notifications. Read state is per user.
 */

interface NotificationRow {
  _id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  createdAt: number;
}

export default function Notifications() {
  const notifications = useQuery(
    api.workspace.myNotifications,
    CONVEX_URL ? {} : "skip",
  ) as NotificationRow[] | undefined;
  const markRead = useMutation(api.workspace.markNotificationRead);

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<Bell className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
        />
      </div>
    );
  }

  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-clay-text">الإشعارات</h1>
          <p className="text-sm text-clay-text-secondary">
            {unread > 0 ? `لديك ${unread} إشعار غير مقروء` : "كل الإشعارات مقروءة"}
          </p>
        </div>
        <BellRing className="h-6 w-6 text-primary" />
      </div>

      {notifications === undefined ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="clay-card h-16 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8 text-muted-foreground" />}
          title="لا توجد إشعارات"
          description="ستصلك هنا تحديثات مراجعة المصادر وردود النظام."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <article
              key={n._id}
              className={`clay-card p-4 ${n.read ? "opacity-70" : "border-e-4 border-e-primary/50"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-clay-text">{n.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-clay-text-secondary">{n.body}</p>
                  <p className="mt-1.5 text-[10px] text-clay-text-secondary">
                    {new Date(n.createdAt).toLocaleString("ar-EG")}
                  </p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => void markRead({ notificationId: n._id as never })}
                    className="clay-button flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-primary"
                    aria-label="تحديد كمقروء"
                  >
                    <Check className="h-3 w-3" />
                    مقروء
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
