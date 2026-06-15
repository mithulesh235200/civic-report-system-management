import { useEffect, useState } from "react";

import LayoutShell from "../components/LayoutShell";
import ProtectedRoute from "../components/ProtectedRoute";
import { fetchNotifications, markNotificationRead } from "../services/notifications";
import { useAuth } from "../utils/AuthContext";
import { ROLES } from "../utils/roles";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { refreshNotifications } = useAuth();

  useEffect(() => {
    fetchNotifications()
      .then((response) => setItems(response.notifications))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRead = async (id) => {
    await markNotificationRead(id);
    setItems((current) => current.map((item) => (item._id === id ? { ...item, status: "read" } : item)));
    await refreshNotifications();
  };

  return (
    <ProtectedRoute roles={[ROLES.USER]}>
      <LayoutShell title="Notifications">
        <div className="grid gap-4">
          {loading && <div className="rounded-3xl bg-white p-6 shadow-card">Loading notifications...</div>}
          {items.map((item) => (
            <div key={item._id} className="rounded-3xl bg-white p-6 shadow-card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-ink">{item.message}</p>
                  <p className="mt-1 text-sm text-slate-500 capitalize">{item.status}</p>
                  {item.createdAt && (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {new Date(item.createdAt).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
                {item.status === "unread" && (
                  <button
                    type="button"
                    onClick={() => handleRead(item._id)}
                    className="rounded-full bg-civic px-4 py-2 font-bold text-white"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            </div>
          ))}
          {!loading && !items.length && (
            <div className="rounded-3xl bg-white p-6 shadow-card">
              No notifications yet. Issue updates, assignments, and AI review alerts will appear here.
            </div>
          )}
        </div>
      </LayoutShell>
    </ProtectedRoute>
  );
}
