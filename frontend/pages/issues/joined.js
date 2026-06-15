import Link from "next/link";

import LayoutShell from "../../components/LayoutShell";
import ProtectedRoute from "../../components/ProtectedRoute";
import { ROLES } from "../../utils/roles";

export default function JoinedIssueInfoPage() {
  return (
    <ProtectedRoute roles={[ROLES.USER]}>
      <LayoutShell title="Issue Joined">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <p className="text-lg text-slate-700">
            You are now following an existing complaint, and you will receive updates when its status changes.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block font-bold text-civic">
            Return to dashboard
          </Link>
        </div>
      </LayoutShell>
    </ProtectedRoute>
  );
}
