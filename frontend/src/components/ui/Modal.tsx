"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Centered dialog with backdrop. Escape and backdrop click close it. */
export function Modal({
  open,
  onClose,
  title,
  className = "max-w-md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full overflow-hidden rounded-xl border bg-surface shadow-2xl ${className}`}
      >
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
