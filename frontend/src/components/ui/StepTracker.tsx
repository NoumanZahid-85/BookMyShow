import { Check } from "lucide-react";

const STEPS = ["Movie", "Seats", "Payment", "Done"];

/** Booking progress. `current` is 1-based; pass 5 to mark every step done. */
export function StepTracker({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex shrink-0 items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                done ? "border-success/40 bg-success/15 text-success" : active ? "border-accent bg-accent text-white" : "text-fg-muted"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            {/* Phones show only the current label; the others stay readable for screen readers. */}
            <span className={active ? "font-medium text-fg" : "sr-only text-fg-muted sm:not-sr-only"}>{label}</span>
            {n < STEPS.length && <span className="mx-1 h-px w-4 bg-border sm:w-10" />}
          </li>
        );
      })}
    </ol>
  );
}
