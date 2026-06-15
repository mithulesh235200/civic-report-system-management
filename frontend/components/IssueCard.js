import Link from "next/link";

import { STATUS_STYLES } from "../utils/roles";

const IssueCard = ({ issue, hrefPrefix = "/issues" }) => {
  const updatedAtLabel = issue.updatedAt
    ? new Date(issue.updatedAt).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-ink">{issue.title}</p>
          <p className="mt-1 text-sm text-slate-500">{issue.address || "Location pending"}</p>
          {updatedAtLabel && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Updated {updatedAtLabel}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLES[issue.status]}`}>
          {issue.status}
        </span>
      </div>
      <p className="mt-4 line-clamp-3 text-sm text-slate-600">{issue.description}</p>
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold capitalize">{issue.category}</span>
          <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold capitalize text-rose-700">
            {issue.severity}
          </span>
          {issue.aiAnalysis?.priorityBand && (
            <span className="rounded-full bg-cyan-50 px-3 py-1 font-semibold text-cyan-800">
              {issue.aiAnalysis.priorityBand}
            </span>
          )}
        </div>
        <Link href={`${hrefPrefix}/${issue._id || issue.id}`} className="font-bold text-civic">
          View
        </Link>
      </div>
    </div>
  );
};

export default IssueCard;
