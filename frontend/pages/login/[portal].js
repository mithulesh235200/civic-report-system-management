import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import LayoutShell from "../../components/LayoutShell";
import { useAuth } from "../../utils/AuthContext";

const getErrorMessage = (requestError, fallback) => {
  if (requestError.response?.data?.message) {
    return requestError.response.data.message;
  }

  if (requestError.response?.data?.errors?.length) {
    return requestError.response.data.errors[0].msg;
  }

  return fallback;
};

const destinationMap = {
  user: "/dashboard",
  admin: "/admin/dashboard",
  worker: "/worker/tasks",
};

const portalConfig = {
  user: {
    title: "Citizen Login",
    heading: "Sign in to track and report civic issues.",
    accent: "text-civic",
    buttonClass: "bg-civic",
    bullets: [
      "Continue active complaints and joined issue tracking",
      "Use AI report writing and Smart Preview",
      "Receive status updates and notifications",
    ],
    footer: <Link href="/register" className="font-bold text-civic">Create a citizen account</Link>,
  },
  admin: {
    title: "Admin Login",
    heading: "Access the civic operations command center.",
    accent: "text-slate-900",
    buttonClass: "bg-slate-900",
    bullets: [
      "Review issue queues, AI triage, and heatmap insights",
      "Assign workers using the smart dispatch board",
      "Verify proof and manage hotspot escalation",
    ],
    demo: "Demo admin: admin@civictrack.local / Admin@123",
    footer: <span className="text-slate-500">Admin access is provisioned securely by the system.</span>,
  },
  worker: {
    title: "Worker Login",
    heading: "Open your field task workspace.",
    accent: "text-indigo-700",
    buttonClass: "bg-indigo-700",
    bullets: [
      "Review assigned civic tasks and nearest-route ordering",
      "See AI task briefs and department cues",
      "Upload proof and close field work properly",
    ],
    demo: "Demo worker: worker@civictrack.local / Worker@123",
    footer: <span className="text-slate-500">Worker accounts are created by admins only.</span>,
  },
};

export default function PortalLoginPage() {
  const router = useRouter();
  const { portal } = router.query;
  const { login, loading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const config = useMemo(() => portalConfig[portal] || portalConfig.user, [portal]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!portal || !["user", "admin", "worker"].includes(portal)) {
      setError("Please open a valid login portal.");
      return;
    }

    if (!form.email.trim() || !form.password) {
      setError("Email and password are required.");
      return;
    }

    try {
      await login({ ...form, portal });
      await router.push(destinationMap[portal] || "/");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Login failed"));
    }
  };

  return (
    <LayoutShell title={config.title}>
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[32px] bg-white p-8 shadow-card">
          <p className={`text-sm font-black uppercase tracking-[0.25em] ${config.accent}`}>{config.title}</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-ink">{config.heading}</h2>
          <div className="mt-6 grid gap-3">
            {config.bullets.map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
          {config.demo && <p className="mt-5 text-sm font-semibold text-slate-600">{config.demo}</p>}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 rounded-[32px] bg-white p-8 shadow-card">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Portal Access</p>
            <p className="mt-2 text-sm text-slate-600">
              Use the correct portal for your role. Citizen, admin, and worker permissions stay separated.
            </p>
          </div>

          <input
            type="email"
            className="rounded-2xl border border-slate-200 px-4 py-3"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <div className="flex gap-3">
            <input
              type={showPassword ? "text" : "password"}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3"
              placeholder="Password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`rounded-full px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-70 ${config.buttonClass}`}
          >
            {loading ? "Signing in..." : `Enter ${config.title}`}
          </button>

          <div className="text-sm text-slate-600">{config.footer}</div>
          <p className="text-sm text-slate-600">
            Need a different portal?{" "}
            <Link href="/" className="font-bold text-civic">
              Go back to role selection
            </Link>
          </p>
        </form>
      </div>
    </LayoutShell>
  );
}
