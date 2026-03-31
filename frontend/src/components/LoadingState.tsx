export function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="surface-card animate-pulse p-6">
          <div className="h-3 w-28 rounded bg-slate-200" />
          <div className="mt-4 h-9 w-24 rounded bg-slate-200" />
          <div className="mt-4 h-6 w-20 rounded-full bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
