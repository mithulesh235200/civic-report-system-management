import Link from "next/link";
import { useRouter } from "next/router";

import { useAuth } from "../utils/AuthContext";

const roleLinks = {
  user: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/report", label: "Report Issue" },
    { href: "/map", label: "Issue Map" },
    { href: "/assistant", label: "AI Assistant" },
    { href: "/notifications", label: "Notifications" },
    { href: "/profile", label: "Profile" },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Admin Dashboard" },
    { href: "/assistant", label: "AI Assistant" },
  ],
  worker: [
    { href: "/worker/tasks", label: "Worker Tasks" },
    { href: "/assistant", label: "AI Assistant" },
  ],
};

const LayoutShell = ({ title, children }) => {
  const router = useRouter();
  const { user, logout, unreadNotifications, liveMessage, clearLiveMessage } = useAuth();

  const navLinks = user ? roleLinks[user.role] || [] : [];
  const isActiveLink = (href) => router.pathname === href || router.pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/" className="text-xl font-black tracking-tight text-civic">
              CivicTrack
            </Link>
            {user && (
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                {user.role} portal
              </p>
            )}
          </div>
          <nav className="flex flex-wrap items-center justify-end gap-3 text-sm font-medium text-slate-600">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 ${
                  isActiveLink(link.href) ? "bg-civic text-white" : "hover:bg-slate-100"
                }`}
              >
                {link.label}
                {link.href === "/notifications" && unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
              </Link>
            ))}
            {user && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="rounded-full bg-slate-900 px-4 py-2 text-white"
              >
                Logout
              </button>
            )}
            {!user && (
              <>
                <Link href="/login/user" className="rounded-full border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">
                  Login
                </Link>
                <Link href="/register" className="rounded-full bg-civic px-4 py-2 font-bold text-white">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {liveMessage && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
            <span>{liveMessage}</span>
            <button type="button" onClick={clearLiveMessage} className="rounded-full bg-white px-3 py-1 text-cyan-800">
              Dismiss
            </button>
          </div>
        )}
        {title && <h1 className="mb-6 text-3xl font-black tracking-tight text-ink">{title}</h1>}
        {children}
      </main>
    </div>
  );
};

export default LayoutShell;
