interface DashboardHeaderProps {
  generatedAt?: string;
  userName: string;
  userTier: string;
  tenantName?: string;
  tenantRole?: string;
  onSignOut: () => void;
}

export function DashboardHeader({
  generatedAt,
  userName,
  userTier,
  tenantName,
  tenantRole,
  onSignOut,
}: DashboardHeaderProps) {
  return (
    <header className="space-y-3">
      <p className="section-label">AI Risk Intelligence Platform</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Financial Risk & Market Intelligence Dashboard
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Evaluate portfolio exposure with VaR, volatility, anomaly detection, and sentiment insights
            in one streamlined workflow.
          </p>
        </div>

        <p className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          {generatedAt ? `Last analysis: ${new Date(generatedAt).toLocaleString()}` : 'No analysis yet'}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm font-medium text-slate-700">
          Signed in as <span className="font-semibold text-slate-950">{userName}</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-600">
            {userTier}
          </span>
          {tenantName ? (
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {tenantName} · {tenantRole}
            </span>
          ) : null}
        </p>
        <button type="button" onClick={onSignOut} className="btn-secondary">
          Log out
        </button>
      </div>
    </header>
  );
}
