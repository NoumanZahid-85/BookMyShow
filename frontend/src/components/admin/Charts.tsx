import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export type Bar = { label: string; value: number; display: string };

/** Titled card. Every chart says in plain words what it shows. */
export function ChartCard({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-0.5 text-sm text-fg-muted">{hint}</p>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** Same numbers as a table, for screen readers. */
function DataTable({ caption, bars }: { caption: string; bars: Bar[] }) {
  return (
    // Wrapper div: a table ignores the 1px sr-only width and would widen the page on phones.
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              <td>{b.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Vertical bars, one series, one color. The highest bar is labeled; hover or focus any bar for its value.
 */
export function ColumnChart({ bars, caption }: { bars: Bar[]; caption: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const peak = bars.findIndex((b) => b.value === max);

  return (
    <>
      <div className="flex h-44 items-end gap-0.5 border-b sm:gap-1" aria-hidden>
        {bars.map((b, i) => (
          <div key={b.label} className="group relative flex h-full flex-1 flex-col justify-end px-px" tabIndex={0}>
            {/* Tooltip */}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-surface-2 px-2 py-1 text-xs shadow-lg group-hover:block group-focus:block">
              <span className="text-fg-muted">{b.label}:</span> {b.display}
            </span>
            {i === peak && <span className="mb-1 text-center text-[11px] font-medium text-fg">{b.display}</span>}
            <div
              className="min-h-[2px] rounded-t bg-chart transition-opacity group-hover:opacity-80"
              style={{ height: `${(b.value / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5 sm:gap-1" aria-hidden>
        {bars.map((b) => (
          <span key={b.label} className="flex-1 truncate text-center text-[11px] text-fg-muted">
            {b.label}
          </span>
        ))}
      </div>
      <DataTable caption={caption} bars={bars} />
    </>
  );
}

/** Ranked horizontal bars with the value written at the end. Good for names that are too long for a column chart. */
export function BarList({ bars, caption, max }: { bars: Bar[]; caption: string; max?: number }) {
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  return (
    <>
      <ul className="space-y-3" aria-hidden>
        {bars.map((b) => (
          <li key={b.label}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate">{b.label}</span>
              <span className="shrink-0 tabular-nums text-fg-muted">{b.display}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-chart" style={{ width: `${Math.max(1, (b.value / top) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <DataTable caption={caption} bars={bars} />
    </>
  );
}
