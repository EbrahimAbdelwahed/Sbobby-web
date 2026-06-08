import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="sb-page-header">
      <div>
        {kicker ? <p className="sb-kicker">{kicker}</p> : null}
        <h1 className="sb-title">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sb-text-dim)]">{description}</p> : null}
      </div>
      {actions ? <div className="sb-page-header-actions">{actions}</div> : null}
    </header>
  );
}
