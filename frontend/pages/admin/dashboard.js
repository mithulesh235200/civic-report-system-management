import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import LayoutShell from "../../components/LayoutShell";
import MapView from "../../components/MapView";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatCard from "../../components/StatCard";
import {
  assignIssue,
  createWorker,
  deleteAdminIssue,
  downloadAdminIssuesCsv,
  fetchAiTrainingCenter,
  fetchAdminDashboard,
  fetchAdminIssues,
  fetchWorkers,
  submitAiTrainingFeedback,
  updateAdminIssueStatus,
} from "../../services/admin";
import { ROLES } from "../../utils/roles";

const MiniBarChart = ({ title, data, colorClass }) => {
  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="rounded-3xl bg-white p-6 shadow-card">
      <p className="text-lg font-black text-ink">{title}</p>
      <div className="mt-5 flex h-48 items-end gap-3">
        {data.map((item) => (
          <div key={item.label || item._id} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={`w-full rounded-t-2xl ${colorClass}`}
              style={{ height: `${Math.max((item.count / max) * 100, 10)}%` }}
            />
            <p className="text-xs font-bold text-slate-500">{item.label || item._id}</p>
            <p className="text-sm font-bold text-ink">{item.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const calculateDistanceMeters = (longitudeA, latitudeA, longitudeB, latitudeB) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLongitude / 2) ** 2;

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const getRecommendationLabel = (worker, issue) => {
  const availabilityScore = {
    available: 0,
    busy: 18,
    offline: 40,
  }[worker.workerProfile?.availability || "offline"];
  const workloadScore = (worker.activeAssignments || 0) * 12;
  const coordinates = worker.workerProfile?.lastKnownLocation?.coordinates || [];
  const issueCoordinates = issue.location?.coordinates || [];
  const distanceMeters =
    coordinates.length === 2 && issueCoordinates.length === 2
      ? calculateDistanceMeters(coordinates[0], coordinates[1], issueCoordinates[0], issueCoordinates[1])
      : null;
  const distanceScore = distanceMeters === null ? 25 : Math.min(Math.round(distanceMeters / 120), 35);
  const totalScore = availabilityScore + workloadScore + distanceScore;

  return {
    ...worker,
    distanceMeters,
    dispatchScore: totalScore,
  };
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [issues, setIssues] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState({});
  const [selectedMapIssueId, setSelectedMapIssueId] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    severity: "all",
    category: "all",
  });
  const [workerForm, setWorkerForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [workerMessage, setWorkerMessage] = useState("");
  const [workerError, setWorkerError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [assigningIssueId, setAssigningIssueId] = useState("");
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [trainingCenter, setTrainingCenter] = useState(null);
  const [trainingForms, setTrainingForms] = useState({});
  const [trainingSavingId, setTrainingSavingId] = useState("");
  const deferredSearch = useDeferredValue(filters.search);

  const getErrorMessage = (requestError, fallback) => {
    if (requestError.response?.data?.message) {
      return requestError.response.data.message;
    }

    if (requestError.response?.data?.errors?.length) {
      return requestError.response.data.errors[0].msg;
    }

    return fallback;
  };

  const loadData = useCallback(async () => {
    const [dashboardResponse, issuesResponse, workersResponse, trainingResponse] = await Promise.all([
      fetchAdminDashboard(),
      fetchAdminIssues(),
      fetchWorkers(),
      fetchAiTrainingCenter(),
    ]);
    setStats({ ...dashboardResponse.stats, workers: workersResponse.workers });
    setIssues(issuesResponse.issues);
    setTrainingCenter(trainingResponse.training);
  }, []);

  useEffect(() => {
    loadData().catch(() => {
      setStats(null);
      setIssues([]);
    });
  }, [loadData]);

  const handleAssign = async (issueId) => {
    if (!selectedWorkers[issueId]) {
      setActionMessage("");
      setActionError("Select a worker before assigning this issue.");
      return;
    }
    setActionError("");
    setActionMessage("");
    try {
      setAssigningIssueId(issueId);
      const response = await assignIssue({ issueId, workerId: selectedWorkers[issueId] });
      setActionMessage(response.message || "Worker assigned successfully");
      await loadData();
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Unable to assign worker"));
    } finally {
      setAssigningIssueId("");
    }
  };

  const handleStatus = async (issueId, status) => {
    setActionError("");
    setActionMessage("");
    try {
      const response = await updateAdminIssueStatus({ issueId, status });
      setActionMessage(response.message || "Issue status updated");
      await loadData();
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Unable to update issue status"));
    }
  };

  const selectedMapIssue = useMemo(
    () => issues.find((issue) => issue._id === selectedMapIssueId) || null,
    [issues, selectedMapIssueId]
  );
  const recommendedWorkers = useMemo(() => {
    if (!selectedMapIssue) {
      return [];
    }

    return [...(stats?.workers || [])]
      .map((worker) => getRecommendationLabel(worker, selectedMapIssue))
      .sort((left, right) => left.dispatchScore - right.dispatchScore)
      .slice(0, 3);
  }, [selectedMapIssue, stats?.workers]);
  const commandCenter = useMemo(() => {
    const criticalOpen = issues.filter(
      (issue) => issue.severity === "critical" && !["resolved", "rejected"].includes(issue.status)
    );
    const proofReview = issues.filter(
      (issue) =>
        issue.resolutionVerification &&
        issue.resolutionVerification.verificationStatus !== "verified"
    );
    const unassignedVerified = issues.filter(
      (issue) => issue.status === "verified" && !issue.assignedWorker
    );

    return {
      criticalOpen,
      proofReview,
      unassignedVerified,
    };
  }, [issues]);
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSearch = deferredSearch
        ? [issue.title, issue.description, issue.address, issue.reportedBy?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(deferredSearch.toLowerCase())
        : true;
      const matchesStatus = filters.status === "all" ? true : issue.status === filters.status;
      const matchesSeverity = filters.severity === "all" ? true : issue.severity === filters.severity;
      const matchesCategory = filters.category === "all" ? true : issue.category === filters.category;

      return matchesSearch && matchesStatus && matchesSeverity && matchesCategory;
    });
  }, [deferredSearch, issues, filters]);

  const formatLocationUpdatedAt = (value) => {
    if (!value) {
      return "No location sync";
    }

    return new Date(value).toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleCreateWorker = async (event) => {
    event.preventDefault();
    setWorkerMessage("");
    setWorkerError("");

    if (!workerForm.name.trim() || !workerForm.email.trim() || !workerForm.password) {
      setWorkerError("Name, email, and password are required");
      return;
    }

    if (workerForm.password.length < 6) {
      setWorkerError("Password must be at least 6 characters long");
      return;
    }

    try {
      const response = await createWorker(workerForm);
      setWorkerMessage(response.message);
      setWorkerForm({ name: "", email: "", password: "", phone: "" });
      await loadData();
    } catch (requestError) {
      setWorkerError(getErrorMessage(requestError, "Unable to create worker"));
    }
  };

  const handleExportCsv = async () => {
    setActionError("");
    setActionMessage("");
    setExportingCsv(true);

    try {
      const csvBlob = await downloadAdminIssuesCsv(filters);
      const blobUrl = window.URL.createObjectURL(new Blob([csvBlob], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `civictrack-issues-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      setActionMessage("CSV export downloaded successfully.");
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Unable to export CSV"));
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDeleteResolvedIssue = async (issueId, title) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete the resolved issue "${title}"? This will also remove related comments, assignments, and AI training links.`);
      if (!confirmed) {
        return;
      }
    }

    setActionError("");
    setActionMessage("");

    try {
      const response = await deleteAdminIssue(issueId);
      setActionMessage(response.message || "Resolved issue deleted successfully.");
      await loadData();
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Unable to delete the resolved issue"));
    }
  };

  const getTrainingForm = (issue) =>
    trainingForms[issue.id] || {
      correctedCategory: issue.currentCategory,
      correctedSeverity: issue.currentSeverity,
      confidenceOverride: "",
      trainingNotes: "",
    };

  const handleTrainingFeedback = async (issue) => {
    const form = getTrainingForm(issue);
    setActionError("");
    setActionMessage("");
    setTrainingSavingId(issue.id);

    try {
      const response = await submitAiTrainingFeedback({
        issueId: issue.id,
        correctedCategory: form.correctedCategory,
        correctedSeverity: form.correctedSeverity,
        confidenceOverride: form.confidenceOverride,
        trainingNotes: form.trainingNotes,
      });
      setActionMessage(response.message || "AI training feedback saved");
      await loadData();
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Unable to save AI training feedback"));
    } finally {
      setTrainingSavingId("");
    }
  };

  return (
    <ProtectedRoute roles={[ROLES.ADMIN]}>
      <LayoutShell title="Admin Dashboard">
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Issues" value={stats.totalIssues} />
            <StatCard label="Pending" value={stats.pendingIssues} accent="bg-amber-500" />
            <StatCard label="Resolved" value={stats.resolvedIssues} accent="bg-emerald-500" />
            <StatCard label="Workers" value={stats.workers.length} accent="bg-indigo-500" />
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-card">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-700">Critical Queue</p>
            <p className="mt-3 text-4xl font-black text-ink">{commandCenter.criticalOpen.length}</p>
            <p className="mt-2 text-sm text-slate-600">Open critical issues that still need immediate attention.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-card">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-700">Manual Proof Review</p>
            <p className="mt-3 text-4xl font-black text-ink">{commandCenter.proofReview.length}</p>
            <p className="mt-2 text-sm text-slate-600">Resolved issues where AI still wants a human review.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-card">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Ready To Assign</p>
            <p className="mt-3 text-4xl font-black text-ink">{commandCenter.unassignedVerified.length}</p>
            <p className="mt-2 text-sm text-slate-600">Verified complaints waiting for worker assignment.</p>
          </div>
        </div>

        {stats && (
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xl font-black text-ink">Assignment Map</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Review complaint locations on the map and pick the right issue before assigning a worker.
                  </p>
                </div>
                <p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                  {issues.filter((issue) => issue.location?.coordinates?.length === 2).length} mapped issues
                </p>
              </div>
              <div className="mt-5">
                <MapView
                  issues={issues}
                  activeIssueId={selectedMapIssueId}
                  onMapUnavailable={() => setMapUnavailable(true)}
                  onIssueSelect={(issue) => setSelectedMapIssueId(issue._id)}
                  renderIssueDetails={(issue) => (
                    <div className="max-w-64">
                      <p className="font-bold text-slate-900">{issue.title}</p>
                      <p className="mt-1 text-sm capitalize text-slate-600">
                        {issue.category} | {issue.severity} | {issue.status}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{issue.address || "No address provided"}</p>
                      <button
                        type="button"
                        onClick={() => setSelectedMapIssueId(issue._id)}
                        className="mt-3 rounded-full bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                      >
                        Use This Issue
                      </button>
                    </div>
                  )}
                />
              </div>
              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-600">
                      Assignment List Fallback
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {mapUnavailable
                        ? "Maps failed to load, but admins can still select and assign issues here."
                        : "Use this list if the map tile service is unavailable or a network issue blocks map loading."}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    {filteredIssues.length} available
                  </span>
                </div>
                <div className="mt-4 grid max-h-96 gap-3 overflow-y-auto pr-1">
                  {filteredIssues.slice(0, 12).map((issue) => (
                    <button
                      key={`fallback-${issue._id}`}
                      type="button"
                      onClick={() => setSelectedMapIssueId(issue._id)}
                      className={`rounded-2xl p-4 text-left transition ${
                        selectedMapIssueId === issue._id
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 hover:bg-civic/5"
                      }`}
                    >
                      <p className="font-bold">{issue.title}</p>
                      <p className="mt-1 text-sm capitalize opacity-80">
                        {issue.category} | {issue.severity} | {issue.status}
                      </p>
                      <p className="mt-1 text-sm opacity-80">{issue.address || "No address provided"}</p>
                    </button>
                  ))}
                  {!filteredIssues.length && <p className="text-sm text-slate-600">No issues match the current filters.</p>}
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-card">
              <p className="text-xl font-black text-ink">Selected Issue</p>
              {selectedMapIssue ? (
                <div className="mt-4">
                  <p className="text-lg font-black text-ink">{selectedMapIssue.title}</p>
                  <p className="mt-1 text-sm text-slate-500 capitalize">
                    {selectedMapIssue.category} | {selectedMapIssue.severity} | {selectedMapIssue.status}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">
                    {selectedMapIssue.address || "No address provided"}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">{selectedMapIssue.description}</p>
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">AI Priority Signal</p>
                    <p className="mt-2 text-sm font-bold text-ink">
                      {selectedMapIssue.aiAnalysis?.priorityBand || "Routine"} priority
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Likely department: {selectedMapIssue.aiAnalysis?.likelyDepartment || "General Civic Operations"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      SLA target: {selectedMapIssue.aiAnalysis?.suggestedSlaHours || 72} hours
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {selectedMapIssue.aiAnalysis?.recommendedAction || "No AI guidance available."}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {selectedMapIssue.aiAnalysis?.adminSummary || "No admin AI summary available yet."}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <select
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                      value={selectedWorkers[selectedMapIssue._id] || ""}
                      onChange={(event) =>
                        setSelectedWorkers((current) => ({
                          ...current,
                          [selectedMapIssue._id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select worker</option>
                      {stats?.workers.map((worker) => (
                        <option key={worker.id || worker._id} value={worker.id || worker._id}>
                          {worker.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleAssign(selectedMapIssue._id)}
                        disabled={assigningIssueId === selectedMapIssue._id}
                        className="rounded-full bg-slate-900 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {assigningIssueId === selectedMapIssue._id ? "Assigning..." : "Assign Worker"}
                      </button>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedMapIssue.location?.coordinates?.[1]},${selectedMapIssue.location?.coordinates?.[0]}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-civic px-4 py-2 font-bold text-white"
                      >
                        Open Location
                      </a>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Smart Dispatch Suggestions</p>
                    <div className="mt-3 grid gap-3">
                      {recommendedWorkers.map((worker, index) => (
                        <button
                          key={worker.id}
                          type="button"
                          onClick={() =>
                            setSelectedWorkers((current) => ({
                              ...current,
                              [selectedMapIssue._id]: worker.id,
                            }))
                          }
                          className="rounded-2xl bg-white p-3 text-left transition hover:border hover:border-civic"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-ink">
                                #{index + 1} {worker.name}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                                {worker.workerProfile?.availability || "offline"} | {worker.activeAssignments || 0} active tasks
                              </p>
                            </div>
                            <span className="rounded-full bg-civic/10 px-3 py-1 text-xs font-bold text-civic">
                              Score {worker.dispatchScore}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {worker.distanceMeters === null
                              ? "No live location yet"
                              : `${worker.distanceMeters}m from this issue`}
                          </p>
                        </button>
                      ))}
                      {!recommendedWorkers.length && (
                        <p className="text-sm text-slate-600">
                          No worker recommendations yet. Ask workers to set availability and sync their location.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Click any map marker to inspect the citizen location and assign the best worker faster.
                </p>
              )}
            </div>
          </div>
        )}

        {stats && (
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xl font-black text-ink">Worker Operations Board</p>
                <p className="mt-1 text-sm text-slate-600">
                  Live worker availability, active assignment load, and location freshness.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {stats.workers.map((worker) => (
                <div key={worker.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">{worker.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{worker.email}</p>
                    </div>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white">
                      {worker.workerProfile?.availability || "offline"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">
                    Active assignments: <span className="font-bold">{worker.activeAssignments || 0}</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Last location update: {formatLocationUpdatedAt(worker.workerProfile?.lastLocationUpdatedAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats && (
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <MiniBarChart title="7-Day Reporting Trend" data={stats.dailyTrend} colorClass="bg-civic" />
            <MiniBarChart
              title="Issues by Category"
              data={stats.categoryBreakdown.map((item) => ({ ...item, label: item._id }))}
              colorClass="bg-amber-500"
            />
            <MiniBarChart
              title="Issues by Severity"
              data={stats.severityBreakdown.map((item) => ({ ...item, label: item._id }))}
              colorClass="bg-rose-500"
            />
          </div>
        )}

        {stats && (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-card">
              <p className="text-xl font-black text-ink">Hotspot Areas</p>
              <div className="mt-4 grid gap-3">
                {stats.hotspots.map((hotspot) => (
                  <div key={hotspot.address} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-ink">{hotspot.address}</p>
                        <p className="mt-1 text-sm text-slate-600 capitalize">{hotspot.categories.join(", ")}</p>
                      </div>
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-700">
                        {hotspot.count} reports
                      </span>
                    </div>
                  </div>
                ))}
                {!stats.hotspots.length && <p className="text-sm text-slate-600">No hotspot data yet.</p>}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-card">
              <p className="text-xl font-black text-ink">Most Followed Issues</p>
              <div className="mt-4 grid gap-3">
                {stats.topSupportedIssues.map((issue) => (
                  <div key={issue._id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-ink">{issue.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{issue.address || "No address provided"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-civic">{issue.supportersCount} supporters</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{issue.status}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!stats.topSupportedIssues.length && <p className="text-sm text-slate-600">No support data yet.</p>}
              </div>
            </div>
          </div>
        )}

        {stats && (
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xl font-black text-ink">Predictive Hotspot Forecast</p>
                <p className="mt-1 text-sm text-slate-600">
                  AI estimates where complaint volume may rise next so teams can act before backlog grows.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {(stats.hotspotForecasts || []).map((forecast) => (
                <div key={`${forecast.address}-${forecast.primaryCategory}`} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-ink">{forecast.address}</p>
                      <p className="mt-1 text-sm capitalize text-slate-600">
                        {forecast.primaryCategory} risk over the {forecast.forecastWindow}
                      </p>
                    </div>
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase text-rose-700">
                      {forecast.riskBand}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{forecast.summary}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    Expected volume: {forecast.expectedVolume} reports
                  </p>
                  <p className="mt-3 text-sm text-slate-600">{forecast.preventiveAction}</p>
                </div>
              ))}
              {!stats.hotspotForecasts?.length && (
                <p className="text-sm text-slate-600">Not enough hotspot data yet to forecast upcoming complaint clusters.</p>
              )}
            </div>
          </div>
        )}

        {trainingCenter && (
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xl font-black text-ink">AI Training Center</p>
                <p className="mt-1 text-sm text-slate-600">
                  Review uncertain predictions, correct labels, and feed approved learning back into CivicTrack.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">
                  Total feedback: {trainingCenter.stats.totalFeedback}
                </span>
                <span className="rounded-full bg-cyan-50 px-4 py-2 text-cyan-800">
                  This week: {trainingCenter.stats.recentFeedback}
                </span>
                <span className="rounded-full bg-amber-50 px-4 py-2 text-amber-800">
                  Review queue: {trainingCenter.stats.reviewQueueCount}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-4">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Review Queue</p>
                {trainingCenter.reviewQueue.map((issue) => {
                  const form = getTrainingForm(issue);
                  return (
                    <div key={issue.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-ink">{issue.title}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {issue.address || "No address"} | {issue.status}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                          AI {Math.round((issue.confidenceScore || 0) * 100)}%
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        Predicted: {issue.predictedCategory} / {issue.predictedSeverity}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Current label: {issue.currentCategory} / {issue.currentSeverity}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {issue.historicalPatternSummary || "No historical pattern summary for this issue yet."}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <select
                          className="rounded-2xl border border-slate-200 px-4 py-3"
                          value={form.correctedCategory}
                          onChange={(event) =>
                            setTrainingForms((current) => ({
                              ...current,
                              [issue.id]: { ...form, correctedCategory: event.target.value },
                            }))
                          }
                        >
                          <option value="pothole">Pothole</option>
                          <option value="garbage">Garbage</option>
                          <option value="water-leakage">Water Leakage</option>
                          <option value="streetlight">Streetlight</option>
                          <option value="road-damage">Road Damage</option>
                          <option value="other">Other</option>
                        </select>
                        <select
                          className="rounded-2xl border border-slate-200 px-4 py-3"
                          value={form.correctedSeverity}
                          onChange={(event) =>
                            setTrainingForms((current) => ({
                              ...current,
                              [issue.id]: { ...form, correctedSeverity: event.target.value },
                            }))
                          }
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="critical">Critical</option>
                        </select>
                        <input
                          className="rounded-2xl border border-slate-200 px-4 py-3"
                          placeholder="Confidence override (0 to 1)"
                          value={form.confidenceOverride}
                          onChange={(event) =>
                            setTrainingForms((current) => ({
                              ...current,
                              [issue.id]: { ...form, confidenceOverride: event.target.value },
                            }))
                          }
                        />
                        <input
                          className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2"
                          placeholder="Training note for future AI behavior"
                          value={form.trainingNotes}
                          onChange={(event) =>
                            setTrainingForms((current) => ({
                              ...current,
                              [issue.id]: { ...form, trainingNotes: event.target.value },
                            }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTrainingFeedback(issue)}
                        disabled={trainingSavingId === issue.id}
                        className="mt-4 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {trainingSavingId === issue.id ? "Saving feedback..." : "Approve And Train"}
                      </button>
                    </div>
                  );
                })}
                {!trainingCenter.reviewQueue.length && (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    The review queue is clear right now. Current AI confidence is stable across recent issues.
                  </p>
                )}
              </div>

              <div className="grid gap-4">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Recent Approved Feedback</p>
                {trainingCenter.feedbackItems.map((item) => (
                  <div key={item._id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-bold text-ink">{item.issueId?.title || "Reviewed issue"}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      AI predicted {item.predictedCategory || "unknown"} / {item.predictedSeverity || "unknown"}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Admin corrected to {item.correctedCategory} / {item.correctedSeverity}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Reviewed by {item.correctedBy?.name || "Admin"} on{" "}
                      {new Date(item.appliedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {item.trainingNotes && <p className="mt-2 text-sm text-slate-600">{item.trainingNotes}</p>}
                  </div>
                ))}
                {!trainingCenter.feedbackItems.length && (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    No approved AI training feedback yet. Review uncertain issues to start building supervised memory.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-3xl bg-white p-6 shadow-card">
          <p className="text-xl font-black text-ink">Create Field Worker</p>
          <form onSubmit={handleCreateWorker} className="mt-4 grid gap-3 md:grid-cols-4">
            <input
              className="rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Name"
              value={workerForm.name}
              onChange={(event) => setWorkerForm({ ...workerForm, name: event.target.value })}
            />
            <input
              type="email"
              className="rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Email"
              value={workerForm.email}
              onChange={(event) => setWorkerForm({ ...workerForm, email: event.target.value })}
            />
            <input
              className="rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Password"
              type="password"
              value={workerForm.password}
              onChange={(event) => setWorkerForm({ ...workerForm, password: event.target.value })}
            />
            <input
              className="rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Phone"
              value={workerForm.phone}
              onChange={(event) => setWorkerForm({ ...workerForm, phone: event.target.value })}
            />
            <button type="submit" className="rounded-full bg-slate-900 px-5 py-3 font-bold text-white md:col-span-4">
              Create Worker
            </button>
          </form>
          {workerMessage && <p className="mt-3 text-sm font-semibold text-emerald-700">{workerMessage}</p>}
          {workerError && <p className="mt-3 text-sm font-semibold text-rose-600">{workerError}</p>}
        </div>

        {(actionMessage || actionError) && (
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-card">
            {actionMessage && <p className="text-sm font-semibold text-emerald-700">{actionMessage}</p>}
            {actionError && <p className="text-sm font-semibold text-rose-600">{actionError}</p>}
          </div>
        )}

        <div className="mt-8 rounded-3xl bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xl font-black text-ink">Issue Command Filters</p>
              <p className="mt-1 text-sm text-slate-600">
                Narrow the issue queue by status, severity, category, or citizen-facing text.
              </p>
            </div>
            <p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
              {filteredIssues.length} matching issues
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingCsv ? "Preparing CSV..." : "Download Issues CSV"}
            </button>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Export respects your current search, status, severity, and category filters.
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input
              className="rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Search title, address, reporter"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
            <select
              className="rounded-2xl border border-slate-200 px-4 py-3"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="all">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="verified">Verified</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              className="rounded-2xl border border-slate-200 px-4 py-3"
              value={filters.severity}
              onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              className="rounded-2xl border border-slate-200 px-4 py-3"
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="all">All Categories</option>
              <option value="pothole">Pothole</option>
              <option value="garbage">Garbage</option>
              <option value="water-leakage">Water Leakage</option>
              <option value="streetlight">Streetlight</option>
              <option value="road-damage">Road Damage</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          {filteredIssues.map((issue) => (
            <div key={issue._id} className="rounded-3xl bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-black text-ink">{issue.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Reported by {issue.reportedBy?.name} | {issue.category} | {issue.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatus(issue._id, "verified")}
                    className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-bold text-cyan-800"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatus(issue._id, "rejected")}
                    className="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatus(issue._id, "in-progress")}
                    className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-bold text-indigo-800"
                  >
                    In Progress
                  </button>
                  {issue.status === "resolved" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteResolvedIssue(issue._id, issue.title)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600">{issue.description}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">AI Risk View</p>
                  <p className="mt-2 text-sm text-slate-700 capitalize">
                    Predicted severity: {issue.aiAnalysis?.predictedSeverity || issue.severity}
                  </p>
                  <p className="mt-1 text-sm text-slate-700 capitalize">
                    Predicted category: {issue.aiAnalysis?.predictedCategory || issue.category}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Confidence: {Math.round((issue.aiAnalysis?.confidenceScore || 0) * 100)}%
                  </p>
                  <p className="mt-1 text-sm font-bold text-ink">
                    Priority: {issue.aiAnalysis?.priorityBand || "Routine"} | SLA: {issue.aiAnalysis?.suggestedSlaHours || 72}h
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Department: {issue.aiAnalysis?.likelyDepartment || "General Civic Operations"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {issue.aiAnalysis?.recommendedAction || "No AI action guidance available yet."}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {issue.aiAnalysis?.adminSummary || "No admin AI summary available yet."}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    ETA signal: {issue.aiAnalysis?.estimatedResolutionEta || "No ETA signal available yet."}
                  </p>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">AI Learning Strategy</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {issue.aiAnalysis?.learningMode || "Standard civic AI decision flow"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Supervised label: {issue.aiAnalysis?.supervisedLabel || "Not available"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Unsupervised pattern: {issue.aiAnalysis?.unsupervisedPattern || "Not available"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Semi-supervised confidence:{" "}
                      {issue.aiAnalysis?.semisupervisedConfidence !== undefined
                        ? `${Math.round((issue.aiAnalysis.semisupervisedConfidence || 0) * 100)}%`
                        : "Not available"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Retrieval confidence:{" "}
                      {issue.aiAnalysis?.retrievalConfidence !== undefined
                        ? `${Math.round((issue.aiAnalysis.retrievalConfidence || 0) * 100)}%`
                        : "Not available"}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {issue.aiAnalysis?.historicalPatternSummary || "No historical pattern summary available yet."}
                    </p>
                    {issue.aiAnalysis?.similarIssueTitles?.length > 0 && (
                      <p className="mt-2 text-sm text-slate-600">
                        Similar learned cases: {issue.aiAnalysis.similarIssueTitles.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Duplicate Signal</p>
                  {issue.aiAnalysis?.duplicateIssueId ? (
                    <>
                      <p className="mt-2 text-sm font-bold text-amber-800">Potential nearby duplicate detected</p>
                      <p className="mt-1 text-sm text-slate-700">
                        Duplicate confidence: {Math.round((issue.aiAnalysis?.duplicateScore || 0) * 100)}%
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">No strong duplicate signal detected.</p>
                  )}
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Citizen-Facing Summary</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {issue.aiAnalysis?.citizenSummary || "No citizen summary available yet."}
                  </p>
                </div>
              </div>
              {issue.resolutionVerification && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">AI Proof Verification</p>
                  <p className="mt-2 text-sm font-bold text-ink capitalize">
                    {issue.resolutionVerification.verificationStatus} | Confidence{" "}
                    {Math.round((issue.resolutionVerification.confidenceScore || 0) * 100)}%
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{issue.resolutionVerification.summary}</p>
                  <p className="mt-2 text-sm text-slate-600">{issue.resolutionVerification.adminRecommendation}</p>
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <select
                  className="rounded-full border border-slate-200 px-4 py-2"
                  value={selectedWorkers[issue._id] || ""}
                  onChange={(event) =>
                    setSelectedWorkers((current) => ({ ...current, [issue._id]: event.target.value }))
                  }
                >
                  <option value="">Select worker</option>
                  {stats?.workers.map((worker) => (
                    <option key={worker.id || worker._id} value={worker.id || worker._id}>
                      {worker.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAssign(issue._id)}
                  disabled={assigningIssueId === issue._id}
                  className="rounded-full bg-slate-900 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assigningIssueId === issue._id ? "Assigning..." : "Assign Worker"}
                </button>
              </div>
            </div>
          ))}
          {!filteredIssues.length && (
            <div className="rounded-3xl bg-white p-6 shadow-card">No issues match the current admin filters.</div>
          )}
        </div>
      </LayoutShell>
    </ProtectedRoute>
  );
}
