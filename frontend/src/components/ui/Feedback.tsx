import type { ComponentType, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

export type Tone = "neutral" | "success" | "warning" | "danger";

const toneText: Record<Tone, string> = {
  neutral: "text-fg-muted",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const toneBox: Record<Tone, string> = {
  neutral: "border-border bg-surface-2",
  success: "border-success/30 bg-success/10",
  warning: "border-warning/30 bg-warning/10",
  danger: "border-danger/30 bg-danger/10",
};

const toneIcon: Record<Tone, ComponentType<{ className?: string }>> = {
  neutral: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
};

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

/** Full-area loading state with a short label. */
export function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-fg-muted">
      <Spinner className="h-6 w-6 text-accent" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Alert({ tone = "danger", children }: { tone?: Tone; children: ReactNode }) {
  const Icon = toneIcon[tone];
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${toneBox[tone]}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneText[tone]}`} />
      <div className="text-fg">{children}</div>
    </div>
  );
}

export function StatusPill({ tone, pulse = false, children }: { tone: Tone; pulse?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${toneBox[tone]} ${toneText[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
      <Icon className="h-6 w-6 text-fg-muted" />
      <p className="text-sm text-fg-muted">{title}</p>
      {children}
    </div>
  );
}

/** Failed request with a way out. Every data view uses this for its error state. */
export function ErrorState({ title, error, onRetry }: { title: string; error: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center">
      <AlertCircle className="h-6 w-6 text-danger" />
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-fg-muted">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex h-9 items-center rounded-lg border bg-surface-2 px-4 text-sm font-medium hover:bg-border"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Small filter pill. `active` is exposed to assistive tech as a pressed toggle. */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full border px-4 text-sm transition-colors ${
        active ? "border-accent bg-accent font-medium text-white" : "bg-surface text-fg-muted hover:border-fg-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-muted">{children}</span>;
}
