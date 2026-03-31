interface AlertBannerProps {
  message: string;
}

export function AlertBanner({ message }: AlertBannerProps) {
  return (
    <div
      className="surface-card border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
