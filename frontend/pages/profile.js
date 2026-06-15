import { useEffect, useMemo, useState } from "react";

import LayoutShell from "../components/LayoutShell";
import ProtectedRoute from "../components/ProtectedRoute";
import { fetchMyIssues } from "../services/issues";
import { useAuth } from "../utils/AuthContext";
import { ROLES } from "../utils/roles";

const emptyPreferences = {
  statusUpdates: true,
  nearbyAlerts: true,
  assistantTips: true,
};

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [issues, setIssues] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    avatar: "",
    address: "",
    bio: "",
    preferredLanguage: "english",
    notificationPreferences: emptyPreferences,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMyIssues()
      .then((response) => setIssues(response.issues || []))
      .catch(() => setIssues([]));
  }, []);

  useEffect(() => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
      avatar: user?.avatar || "",
      address: user?.address || "",
      bio: user?.bio || "",
      preferredLanguage: user?.preferredLanguage || "english",
      notificationPreferences: {
        ...emptyPreferences,
        ...(user?.notificationPreferences || {}),
      },
    });
  }, [user]);

  const stats = useMemo(() => {
    const resolved = issues.filter((issue) => issue.status === "resolved").length;
    const active = issues.filter((issue) => ["reported", "verified", "assigned", "in-progress"].includes(issue.status)).length;
    const critical = issues.filter((issue) => issue.severity === "critical").length;

    return {
      total: issues.length,
      resolved,
      active,
      critical,
    };
  }, [issues]);

  const aiProfileSummary = useMemo(() => {
    const languageLabel = form.preferredLanguage === "hinglish" ? "Hinglish" : "English";
    const locationText = form.address?.trim() || "your saved area";
    return `CivicTrack AI will tailor complaint drafts in ${languageLabel}, use ${locationText} as fallback location context, and prioritize ${stats.critical ? "urgent risk wording when needed" : "clear public-impact wording"} for your reports.`;
  }, [form.preferredLanguage, form.address, stats.critical]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await updateProfile(form);
      setMessage("Profile and AI preferences updated successfully.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Profile update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute roles={[ROLES.USER]}>
      <LayoutShell title="Citizen Profile">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={handleSubmit} className="grid gap-5 rounded-[32px] bg-white p-8 shadow-card">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Identity And Preferences</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-ink">Make your reporting profile work for you.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Save your area, language, and notification choices so the AI writer and issue guidance stay relevant every
                time you report.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Full name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                className="rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Phone number"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>

            <input
              className="rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Avatar URL"
              value={form.avatar}
              onChange={(event) => setForm((current) => ({ ...current, avatar: event.target.value }))}
            />

            <input
              className="rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Home area, address, or landmark"
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            />

            <textarea
              className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Short bio or local context you care about"
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value.slice(0, 280) }))}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="rounded-2xl border border-slate-200 px-4 py-3"
                value={form.preferredLanguage}
                onChange={(event) => setForm((current) => ({ ...current, preferredLanguage: event.target.value }))}
              >
                <option value="english">English</option>
                <option value="hinglish">Hinglish</option>
              </select>
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                AI writer style: <span className="font-bold text-ink">{form.preferredLanguage === "hinglish" ? "Conversational civic tone" : "Formal civic tone"}</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-600">Notification Preferences</p>
              <div className="mt-4 grid gap-3">
                {[
                  ["statusUpdates", "Issue status changes"],
                  ["nearbyAlerts", "Nearby civic alerts"],
                  ["assistantTips", "AI guidance and report tips"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(form.notificationPreferences[key])}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notificationPreferences: {
                            ...current.notificationPreferences,
                            [key]: event.target.checked,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
            {message && <p className="text-sm font-semibold text-emerald-600">{message}</p>}

            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-civic px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving profile..." : "Save Profile"}
            </button>
          </form>

          <div className="grid gap-5">
            <div className="rounded-[32px] bg-white p-7 shadow-card">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Citizen Snapshot</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Reports</p>
                  <p className="mt-2 text-3xl font-black text-ink">{stats.total}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Active</p>
                  <p className="mt-2 text-3xl font-black text-ink">{stats.active}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Resolved</p>
                  <p className="mt-2 text-3xl font-black text-emerald-600">{stats.resolved}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Critical Reports</p>
                  <p className="mt-2 text-3xl font-black text-rose-600">{stats.critical}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] bg-slate-900 p-7 text-white shadow-card">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">AI Personalization</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight">Your reporting assistant now adapts to you.</h3>
              <p className="mt-4 text-sm leading-7 text-slate-200">{aiProfileSummary}</p>
              <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm text-slate-100">
                Saved area: <span className="font-bold">{form.address || "Not added yet"}</span>
              </div>
              <div className="mt-3 rounded-2xl bg-white/10 p-4 text-sm text-slate-100">
                Preferred language: <span className="font-bold capitalize">{form.preferredLanguage}</span>
              </div>
            </div>

            <div className="rounded-[32px] bg-white p-7 shadow-card">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Profile Tips</p>
              <div className="mt-4 grid gap-3 text-sm leading-7 text-slate-600">
                <p>Adding your home area helps the AI fill location context faster when you start a report from the dashboard.</p>
                <p>Choosing Hinglish makes draft writing more conversational while keeping the complaint clear enough for admins.</p>
                <p>Keeping notification tips enabled helps the assistant suggest stronger issue wording and duplicate-safe actions.</p>
              </div>
            </div>
          </div>
        </div>
      </LayoutShell>
    </ProtectedRoute>
  );
}
