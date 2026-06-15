import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import IssueForm from "../components/IssueForm";
import LayoutShell from "../components/LayoutShell";
import ProtectedRoute from "../components/ProtectedRoute";
import { analyzeIssueDraft, composeIssueDraft, createIssue, joinExistingIssue } from "../services/issues";
import { ROLES } from "../utils/roles";

export default function ReportPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [infoMessage, setInfoMessage] = useState("");
  const [initialDraft, setInitialDraft] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedDraft = window.sessionStorage.getItem("civictrack_report_draft");
    if (!savedDraft) {
      return;
    }

    try {
      setInitialDraft(JSON.parse(savedDraft));
      setInfoMessage("AI draft loaded from your dashboard. Review it and submit when ready.");
    } catch (parseError) {
      setInitialDraft(null);
    } finally {
      window.sessionStorage.removeItem("civictrack_report_draft");
    }
  }, []);

  const handleSubmit = async (payload) => {
    setLoading(true);
    setError("");
    setInfoMessage("");
    try {
      const response = await createIssue(payload);
      router.push(`/issues/${response.issue._id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Issue submission failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (payload) => {
    setAnalyzing(true);
    setError("");
    setInfoMessage("");
    try {
      const response = await analyzeIssueDraft(payload);
      setAnalysis(response.analysis);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Draft analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCompose = async (payload, applyDraft) => {
    setComposing(true);
    setError("");
    setInfoMessage("");
    try {
      const response = await composeIssueDraft({
        category: payload.category,
        address: payload.address,
        image: payload.image,
        notes: payload.description || payload.title,
      });
      applyDraft?.(response.draft);
      setInfoMessage("AI draft added to the report form.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Auto writing failed");
    } finally {
      setComposing(false);
    }
  };

  const handleJoinDuplicate = async () => {
    if (!analysis?.duplicate?.issueId) {
      return;
    }

    setLoading(true);
    setError("");
    setInfoMessage("");
    try {
      const response = await joinExistingIssue(analysis.duplicate.issueId);
      setInfoMessage(response.message);
      router.push(`/issues/${analysis.duplicate.issueId}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to join the existing issue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute roles={[ROLES.USER]}>
      <LayoutShell title="Report a Civic Issue">
        {error && <p className="mb-4 text-sm font-semibold text-rose-600">{error}</p>}
        {infoMessage && <p className="mb-4 text-sm font-semibold text-emerald-700">{infoMessage}</p>}
        <div className="mb-6 rounded-[32px] bg-white p-6 shadow-card">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Guided Reporting</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-ink">
                Help the civic team verify and resolve the issue faster.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Add the basic details first, then let the AI improve the wording, detect duplicates, and estimate urgency
                before you submit.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Step 1</p>
                <p className="mt-2 text-sm font-bold text-ink">Describe the issue clearly</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Step 2</p>
                <p className="mt-2 text-sm font-bold text-ink">Use Auto Write or Smart Preview</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Step 3</p>
                <p className="mt-2 text-sm font-bold text-ink">Submit or join a duplicate</p>
              </div>
            </div>
          </div>
        </div>
        <IssueForm
          onSubmit={handleSubmit}
          onAnalyze={handleAnalyze}
          onCompose={handleCompose}
          loading={loading}
          analyzing={analyzing}
          composing={composing}
          analysis={analysis}
          onJoinDuplicate={handleJoinDuplicate}
          initialData={initialDraft}
        />
      </LayoutShell>
    </ProtectedRoute>
  );
}
