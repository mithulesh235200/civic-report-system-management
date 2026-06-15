import Link from "next/link";

import LayoutShell from "../components/LayoutShell";

export default function UnauthorizedPage() {
  return (
    <LayoutShell title="Unauthorized">
      <div className="rounded-3xl bg-white p-8 shadow-card">
        <p className="text-lg text-slate-700">You do not have permission to access this page.</p>
        <Link href="/" className="mt-4 inline-block font-bold text-civic">
          Return home
        </Link>
      </div>
    </LayoutShell>
  );
}
