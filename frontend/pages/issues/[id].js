import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import ChatbotPanel from "../../components/ChatbotPanel";
import LayoutShell from "../../components/LayoutShell";
import ProtectedRoute from "../../components/ProtectedRoute";
import { addIssueComment, fetchIssueDetails } from "../../services/issues";
import { useAuth } from "../../utils/AuthContext";
import { ROLES, STATUS_STYLES } from "../../utils/roles";

export default function IssueDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) {
      return;
    }

    fetchIssueDetails(id)
      .then((response) => {
        setIssue(response.issue);
        setComments(response.comments);
      })
      .catch(() => setIssue(null));
  }, [id]);

  const submitComment = async (event) => {
    event.preventDefault();
    const response = await addIssueComment(id, { message });
    setComments((current) => [...current, response.comment]);
    setMessage("");
  };

  if (!issue) {
    return (
      <ProtectedRoute roles={[ROLES.USER]}>
        <LayoutShell title="Issue Details">
          <div className="rounded-3xl bg-white p-6 shadow-card">Loading issue...</div>
        </LayoutShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={[ROLES.USER]}>
      <LayoutShell title="Issue Details">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-3xl font-black text-ink">{issue.title}</p>
              <p className="mt-2 text-slate-600">{issue.address}</p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${STATUS_STYLES[issue.status]}`}>
              {issue.status}
            </span>
          </div>
          <p className="mt-6 text-slate-700">{issue.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-slate-100 px-4 py-2 font-semibold capitalize">{issue.category}</span>
            <span className="rounded-full bg-rose-50 px-4 py-2 font-semibold capitalize text-rose-700">
              {issue.severity}
            </span>
            <span className="rounded-full bg-cyan-50 px-4 py-2 font-semibold text-cyan-800">
              {issue.supporters?.length || 0} supporters
            </span>
          </div>
          {issue.aiAnalysis && (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Citizen AI Guidance</p>
                <p className="mt-3 text-lg font-black text-ink">{issue.aiAnalysis.citizenSummary}</p>
                <p className="mt-3 text-sm text-slate-700">{issue.aiAnalysis.citizenGuidance}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Priority</p>
                    <p className="mt-2 text-sm font-bold text-ink">{issue.aiAnalysis.priorityBand || "Routine"}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Timeline</p>
                    <p className="mt-2 text-sm font-bold text-ink">
                      {issue.aiAnalysis.estimatedResolutionEta || "Under review"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl bg-slate-50 p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">AI Resolution Path</p>
                <p className="mt-3 text-sm font-bold text-ink">
                  Likely department: {issue.aiAnalysis.likelyDepartment || "General Civic Operations"}
                </p>
                <p className="mt-3 text-sm text-slate-700">
                  {issue.aiAnalysis.recommendedAction || "No AI action guidance available yet."}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  Confidence {Math.round((issue.aiAnalysis.confidenceScore || 0) * 100)}%
                </p>
                {issue.aiAnalysis.adminSummary && (
                  <div className="mt-4 rounded-2xl bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Operations Note</p>
                    <p className="mt-2 text-sm text-slate-700">{issue.aiAnalysis.adminSummary}</p>
                  </div>
                )}
                <div className="mt-4 rounded-2xl bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Advanced AI Learning</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {issue.aiAnalysis.learningMode || "Standard CivicTrack AI flow"}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {issue.aiAnalysis.historicalPatternSummary || "No historical learning summary is available for this issue yet."}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Retrieval confidence:{" "}
                    {issue.aiAnalysis.retrievalConfidence !== undefined
                      ? `${Math.round((issue.aiAnalysis.retrievalConfidence || 0) * 100)}%`
                      : "Not available"}
                  </p>
                  {issue.aiAnalysis.similarIssueTitles?.length > 0 && (
                    <p className="mt-2 text-sm text-slate-600">
                      Similar learned cases: {issue.aiAnalysis.similarIssueTitles.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          {issue.image && <img src={issue.image} alt={issue.title} className="mt-6 max-h-96 rounded-3xl object-cover" />}
          {issue.proofImage && (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Worker Proof Image</p>
                <img src={issue.proofImage} alt="Resolution proof" className="mt-3 max-h-96 rounded-3xl object-cover" />
              </div>
              <div className="rounded-3xl bg-slate-50 p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">AI Resolution Check</p>
                {issue.resolutionVerification ? (
                  <>
                    <p className="mt-3 text-lg font-black capitalize text-ink">
                      {issue.resolutionVerification.verificationStatus}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      Confidence {Math.round((issue.resolutionVerification.confidenceScore || 0) * 100)}%
                    </p>
                    <p className="mt-3 text-sm text-slate-700">{issue.resolutionVerification.citizenMessage}</p>
                    {issue.resolutionNotes && (
                      <>
                        <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                          Worker Notes
                        </p>
                        <p className="mt-2 text-sm text-slate-700">{issue.resolutionNotes}</p>
                      </>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-700">Resolution proof has been uploaded and is awaiting AI review.</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 rounded-3xl bg-white p-8 shadow-card">
          {user && issue && (
            <div className="mb-8">
              <p className="text-xl font-black text-ink">Ask AI About This Issue</p>
              <p className="mt-2 text-sm text-slate-600">
                Use the shared civic assistant with this issue as active context.
              </p>
              <div className="mt-4">
                <ChatbotPanel
                  user={user}
                  compact
                  issueContext={{
                    id: issue._id,
                    title: issue.title,
                    status: issue.status,
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 rounded-3xl bg-white p-8 shadow-card">
          <p className="text-xl font-black text-ink">Comments</p>
          <div className="mt-4 grid gap-3">
            {comments.map((comment) => (
              <div key={comment._id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold">{comment.userId?.name}</p>
                <p className="mt-1 text-sm text-slate-600">{comment.message}</p>
              </div>
            ))}
          </div>
          <form onSubmit={submitComment} className="mt-4 flex gap-3">
            <input
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Add a comment"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <button type="submit" className="rounded-full bg-civic px-5 py-3 font-bold text-white">
              Send
            </button>
          </form>
        </div>
      </LayoutShell>
    </ProtectedRoute>
  );
}
