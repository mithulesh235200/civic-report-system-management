const StatCard = ({ label, value, accent }) => {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-card">
      <div className={`mb-3 h-2 w-16 rounded-full ${accent || "bg-civic"}`} />
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-black text-ink">{value}</p>
    </div>
  );
};

export default StatCard;
