import { useEffect, useMemo, useState } from "react";

import LayoutShell from "../components/LayoutShell";
import MapView from "../components/MapView";
import ProtectedRoute from "../components/ProtectedRoute";
import { fetchMapIssues } from "../services/issues";
import { ROLES } from "../utils/roles";

const initialFilters = {
  category: "all",
  severity: "all",
  status: "all",
};

export default function MapPage() {
  const [issues, setIssues] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value && value !== "all")
    );

    setLoading(true);
    fetchMapIssues(params)
      .then((response) => setIssues(response.issues))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, [filters]);

  const summary = useMemo(() => {
    const severityCounts = issues.reduce(
      (accumulator, issue) => ({
        ...accumulator,
        [issue.severity]: (accumulator[issue.severity] || 0) + 1,
      }),
      {}
    );

    return {
      total: issues.length,
      critical: severityCounts.critical || 0,
      medium: severityCounts.medium || 0,
      low: severityCounts.low || 0,
    };
  }, [issues]);

  return (
    <ProtectedRoute roles={[ROLES.USER]}>
      <LayoutShell title="Issue Heatmap">
        <div className="mb-4 rounded-3xl bg-white p-5 shadow-card">
          Heatmap intensity reflects complaint density. Use the filters to explore categories, severity, and live status.
        </div>
        <div className="mb-4 grid gap-4 rounded-3xl bg-white p-5 shadow-card md:grid-cols-3">
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
          <select
            className="rounded-2xl border border-slate-200 px-4 py-3"
            value={filters.severity}
            onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
          >
            <option value="all">All Severity Levels</option>
            <option value="critical">Critical</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
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
          </select>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-card">
          <p className="text-sm text-slate-600">
            {loading ? "Refreshing map issues..." : `Showing ${summary.total} issues for the current map filters.`}
          </p>
          <button
            type="button"
            onClick={() => setFilters(initialFilters)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
          >
            Reset Filters
          </button>
        </div>
        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Visible Issues</p>
            <p className="mt-2 text-3xl font-black text-ink">{summary.total}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Critical</p>
            <p className="mt-2 text-3xl font-black text-rose-700">{summary.critical}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Medium</p>
            <p className="mt-2 text-3xl font-black text-amber-700">{summary.medium}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Low</p>
            <p className="mt-2 text-3xl font-black text-emerald-700">{summary.low}</p>
          </div>
        </div>
        <MapView issues={issues} />
        {!loading && !issues.length && (
          <div className="mt-4 rounded-3xl bg-white p-6 shadow-card">
            No issues match the current map filters. Try broadening the severity, status, or category selection.
          </div>
        )}
      </LayoutShell>
    </ProtectedRoute>
  );
}
