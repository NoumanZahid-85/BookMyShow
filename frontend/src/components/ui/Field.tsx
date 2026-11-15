import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

export const controlClass =
  "h-10 w-full rounded-lg border bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-muted/60 focus:border-accent focus:outline-none";

/** Labeled native select. Native keeps keyboard and screen reader support for free. */
export function Select({
  label,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="eyebrow">{label}</span>
      <select className={`${controlClass} cursor-pointer truncate`} {...props} />
    </label>
  );
}

export function TextField({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      <input className={controlClass} {...props} />
    </label>
  );
}
