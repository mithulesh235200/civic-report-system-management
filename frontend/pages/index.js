import Link from "next/link";

import LayoutShell from "../components/LayoutShell";

const roleCards = [
  {
    title: "Citizen",
    description: "Report issues, use AI drafting, track progress, and join nearby duplicate complaints.",
    primaryHref: "/register",
    primaryLabel: "Create Citizen Account",
    secondaryHref: "/login/user",
    secondaryLabel: "Citizen Login",
    accent: "bg-civic",
  },
  {
    title: "Admin",
    description: "Review incoming reports, use AI triage, assign workers, and manage civic hotspots.",
    primaryHref: "/login/admin",
    primaryLabel: "Admin Login",
    secondaryHref: "/",
    secondaryLabel: "Protected Role",
    accent: "bg-slate-900",
  },
  {
    title: "Field Worker",
    description: "View assigned tasks, navigate smarter, upload proof, and complete field closures.",
    primaryHref: "/login/worker",
    primaryLabel: "Worker Login",
    secondaryHref: "/",
    secondaryLabel: "Created By Admin",
    accent: "bg-indigo-700",
  },
];

export default function HomePage() {
  return (
    <LayoutShell>
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[36px] bg-white p-10 shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-civic">Smart Civic Response</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-tight text-ink">
            Report faster, route smarter, and close the loop with visible civic accountability.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            CivicTrack connects citizens, administrators, and field workers in one full-stack civic workflow with AI,
            maps, real-time updates, and resolution proof.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-full bg-civic px-6 py-3 font-bold text-white">
              Get Started As Citizen
            </Link>
            <Link href="/login/user" className="rounded-full border border-slate-300 px-6 py-3 font-bold text-slate-800">
              I Already Have An Account
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          {[
            "Role-separated access and protected APIs",
            "AI issue writing, severity scoring, and duplicate detection",
            "Fast Leaflet maps with OpenStreetMap issue locations and hotspot support",
            "Realtime civic notifications, assignments, and proof tracking",
          ].map((feature) => (
            <div key={feature} className="rounded-3xl bg-white p-6 shadow-card">
              <p className="text-lg font-bold text-ink">{feature}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        {roleCards.map((card) => (
          <div key={card.title} className="rounded-[32px] bg-white p-7 shadow-card">
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-white ${card.accent}`}>
              {card.title}
            </div>
            <p className="mt-4 text-lg font-bold text-ink">{card.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={card.primaryHref} className={`rounded-full px-5 py-3 text-sm font-bold text-white ${card.accent}`}>
                {card.primaryLabel}
              </Link>
              {card.secondaryHref === "/" ? (
                <span className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500">
                  {card.secondaryLabel}
                </span>
              ) : (
                <Link href={card.secondaryHref} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">
                  {card.secondaryLabel}
                </Link>
              )}
            </div>
          </div>
        ))}
      </section>
    </LayoutShell>
  );
}
