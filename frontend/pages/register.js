import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import LayoutShell from "../components/LayoutShell";
import { useAuth } from "../utils/AuthContext";

const getErrorMessage = (requestError, fallback) => {
  if (requestError.response?.data?.message) {
    return requestError.response.data.message;
  }

  if (requestError.response?.data?.errors?.length) {
    return requestError.response.data.errors[0].msg;
  }

  return fallback;
};

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const passwordStrength = useMemo(() => {
    const score =
      Number(form.password.length >= 6) +
      Number(/[A-Z]/.test(form.password)) +
      Number(/[0-9]/.test(form.password)) +
      Number(/[^A-Za-z0-9]/.test(form.password));

    if (score >= 4) {
      return { label: "Strong", color: "text-emerald-600" };
    }

    if (score >= 2) {
      return { label: "Medium", color: "text-amber-600" };
    }

    return { label: "Basic", color: "text-slate-500" };
  }, [form.password]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Please complete all required fields.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      await register(form);
      await router.push("/dashboard");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Registration failed"));
    }
  };

  return (
    <LayoutShell title="Create Citizen Account">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[32px] bg-white p-8 shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Citizen Onboarding</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-ink">Start reporting civic issues in minutes.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Create your citizen account to track complaints, receive updates, use AI report writing, and join nearby
            duplicate issues instead of creating noise.
          </p>

          <div className="mt-6 grid gap-3">
            {[
              "Track your reported and joined issues in one place",
              "Use AI-assisted complaint writing and Smart Preview",
              "Receive real-time updates when status changes",
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 rounded-[32px] bg-white p-8 shadow-card">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Registration Form</p>
            <p className="mt-2 text-sm text-slate-600">Citizen registration is public. Admin and worker accounts stay protected.</p>
          </div>

          <input
            className="rounded-2xl border border-slate-200 px-4 py-3"
            placeholder="Full name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <input
            type="email"
            className="rounded-2xl border border-slate-200 px-4 py-3"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <div className="grid gap-3">
            <div className="flex gap-3">
              <input
                type={showPassword ? "text" : "password"}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Password (min 6 characters)"
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
            <p className={`text-sm font-semibold ${passwordStrength.color}`}>Password strength: {passwordStrength.label}</p>
          </div>

          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-civic px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Creating account..." : "Create Citizen Account"}
          </button>

          <p className="text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login/user" className="font-bold text-civic">
              Sign in as citizen
            </Link>
          </p>
        </form>
      </div>
    </LayoutShell>
  );
}
