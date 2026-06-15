import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import IssueCard from "../components/IssueCard";
import LayoutShell from "../components/LayoutShell";
import ProtectedRoute from "../components/ProtectedRoute";
import StatCard from "../components/StatCard";
import { composeIssueDraft, fetchMyIssues } from "../services/issues";
import { useAuth } from "../utils/AuthContext";
import { ROLES } from "../utils/roles";

export default function CitizenDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [writerForm, setWriterForm] = useState({
    category: "pothole",
    address: "",
    notes: "",
    language: "english",
  });
  const [writerLoading, setWriterLoading] = useState(false);
  const [writerError, setWriterError] = useState("");
  const [writerMessage, setWriterMessage] = useState("");

  useEffect(() => {
    fetchMyIssues().then((response) => setIssues(response.issues)).catch(() => setIssues([]));
  }, []);

  useEffect(() => {
    setWriterForm((current) => ({
      ...current,
      address: current.address || user?.address || "",
      language: user?.preferredLanguage || current.language,
    }));
  }, [user]);

  const resolved = useMemo(
    () => issues.filter((issue) => issue.status === "resolved").length,
    [issues]
  );

  const handleAutoWriter = async (event) => {
    event.preventDefault();
    setWriterError("");
    setWriterMessage("");

    if (!writerForm.address.trim() && !writerForm.notes.trim()) {
      setWriterError("Add a location or a few notes so the AI can build a useful report.");
      return;
    }

    setWriterLoading(true);
    try {
      const response = await composeIssueDraft(writerForm);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "civictrack_report_draft",
          JSON.stringify({
            category: writerForm.category,
            address: writerForm.address,
            title: response.draft.title,
            description: response.draft.description,
            language: writerForm.language,
            aiSummary: response.draft.citizenSummary,
          })
        );
      }
      setWriterMessage("AI draft created. Opening the full report form now.");
      await router.push("/report");
    } catch (requestError) {
      setWriterError(requestError.response?.data?.message || "Auto report writing failed");
    } finally {
      setWriterLoading(false);
    }
  };

  return (
    <ProtectedRoute roles={[ROLES.USER]}>
      <LayoutShell title="Citizen Dashboard">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Total Reports" value={issues.length} />
          <StatCard label="Resolved" value={resolved} accent="bg-emerald-500" />
          <StatCard label="Active" value={issues.length - resolved} accent="bg-amber-500" />
        </div>
        <div className="mt-8 rounded-[32px] bg-white p-6 shadow-card">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">AI Report Writer</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-ink">Start a complaint from the dashboard.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Add a category, landmark, and a little context. The AI will draft a clean complaint and move you to the
                full report form with the content already filled in.
              </p>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                AI profile context: <span className="font-bold text-ink">{user?.preferredLanguage || "english"}</span>
                {user?.address ? `, ${user.address}` : ", no saved home area yet"}
              </div>
            </div>
            <form onSubmit={handleAutoWriter} className="grid gap-3">
              <select
                className="rounded-2xl border border-slate-200 px-4 py-3"
                value={writerForm.category}
                onChange={(event) => setWriterForm((current) => ({ ...current, category: event.target.value }))}
              >
                <option value="pothole">Pothole</option>
                <option value="garbage">Garbage Dump</option>
                <option value="water-leakage">Water Leakage</option>
                <option value="streetlight">Broken Streetlight</option>
                <option value="road-damage">Road Damage</option>
                <option value="other">Other</option>
              </select>
              <select
                className="rounded-2xl border border-slate-200 px-4 py-3"
                value={writerForm.language}
                onChange={(event) => setWriterForm((current) => ({ ...current, language: event.target.value }))}
              >
                <option value="english">English</option>
                <option value="hinglish">Hinglish</option>
              </select>
              <input
                className="rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Address or landmark"
                value={writerForm.address}
                onChange={(event) => setWriterForm((current) => ({ ...current, address: event.target.value }))}
              />
              <textarea
                className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Describe what you noticed, how serious it looks, or what citizens are facing"
                value={writerForm.notes}
                onChange={(event) => setWriterForm((current) => ({ ...current, notes: event.target.value }))}
              />
              {writerError && <p className="text-sm font-semibold text-rose-600">{writerError}</p>}
              {writerMessage && <p className="text-sm font-semibold text-emerald-700">{writerMessage}</p>}
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                The AI writer now adapts to your saved profile and uses stronger civic-domain guidance for urgency,
                location context, and department routing.
              </div>
              <button
                type="submit"
                disabled={writerLoading}
                className="rounded-full bg-civic px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {writerLoading ? "Writing report..." : "Auto Write Report"}
              </button>
            </form>
          </div>
        </div>
        <div className="mt-8 grid gap-4">
          {issues.map((issue) => (
            <IssueCard key={issue._id} issue={issue} />
          ))}
          {!issues.length && <div className="rounded-3xl bg-white p-6 shadow-card">No issues reported yet.</div>}
        </div>
      </LayoutShell>
    </ProtectedRoute>
  );
}
