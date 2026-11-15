import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href = "/", label = "Back to movies" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg">
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}

/** Title row used at the top of every inner page. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href?: string; label?: string };
  actions?: ReactNode;
}) {
  return (
    <header className="space-y-4">
      {back && <BackLink {...back} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-fg-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
