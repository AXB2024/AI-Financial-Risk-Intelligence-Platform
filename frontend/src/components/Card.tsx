import { PropsWithChildren, ReactNode } from 'react';

interface CardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  className?: string;
  contentClassName?: string;
  headerAction?: ReactNode;
}

export function Card({
  title,
  subtitle,
  className = '',
  contentClassName = '',
  headerAction,
  children,
}: CardProps) {
  return (
    <section className={`surface-card p-6 ${className}`}>
      {title || subtitle || headerAction ? (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title ? <h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3> : null}
            {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p> : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </header>
      ) : null}

      <div className={contentClassName}>{children}</div>
    </section>
  );
}
