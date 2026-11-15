"use client";

import { useMemo, useState } from "react";
import { Show } from "@/types";
import { fetchRankings, fetchSales } from "@/lib/api";
import { formatPrice, formatTime, plural, shortTitle, toDate } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { Card } from "@/components/ui/Card";
import { Chip, ErrorState, Loading } from "@/components/ui/Feedback";
import { BarList, ChartCard, ColumnChart } from "@/components/admin/Charts";

const dayName = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
const hourName = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const compact = (n: number) => (n >= 100_000 ? `${(n / 1000).toFixed(0)}k` : n.toLocaleString());

/**
 * Business view for a non-technical manager: what sold, when people come, and how full tonight is.
 */
export default function SalesPanel({ token, cinemaId, cinemaName, shows }: { token: string; cinemaId: string; cinemaName?: string; shows: Show[] }) {
  const [scope, setScope] = useState<"all" | "cinema">("all");
  const forCinema = scope === "cinema" ? cinemaId : undefined;
  const sales = useAsync(`sales:${forCinema ?? "all"}`, () => fetchSales(token, 7, forCinema));
  const rankings = useAsync("rankings:all", () => fetchRankings(7));

  // Today's remaining shows at the selected cinema, most full first.
  const tonight = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    return shows
      .filter((s) => toDate(s.start_time).getTime() > now.getTime() && toDate(s.start_time).getTime() < end)
      .map((s) => ({ show: s, full: (s.total_seats - s.available_seats) / Math.max(1, s.total_seats) }))
      .sort((a, b) => b.full - a.full);
  }, [shows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Which cinemas">
        <Chip active={scope === "all"} onClick={() => setScope("all")}>
          All cinemas
        </Chip>
        <Chip active={scope === "cinema"} onClick={() => setScope("cinema")}>
          {cinemaName ?? "This cinema"}
        </Chip>
        <span className="text-sm text-fg-muted">Last 7 days</span>
      </div>

      {sales.status === "loading" ? (
        <Loading label="Loading sales" />
      ) : sales.status === "error" ? (
        <ErrorState title="Could not load sales" error={sales.error} onRetry={sales.reload} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ["Tickets sold", sales.data.totals.tickets.toLocaleString(), "seats paid for"],
                ["Revenue", formatPrice(sales.data.totals.revenue), "from those tickets"],
                [
                  "Average order",
                  formatPrice(Math.round(sales.data.totals.revenue / Math.max(1, sales.data.totals.bookings))),
                  `${(sales.data.totals.tickets / Math.max(1, sales.data.totals.bookings)).toFixed(1)} seats per booking`,
                ],
                [
                  "Busiest show time",
                  sales.data.by_hour.length ? hourName([...sales.data.by_hour].sort((a, b) => b.tickets - a.tickets)[0].hour) : "-",
                  "most tickets sold",
                ],
              ] as const
            ).map(([label, value, hint]) => (
              <Card key={label} className="p-4">
                <dt className="text-sm text-fg-muted">{label}</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</dd>
                <dd className="text-xs text-fg-muted">{hint}</dd>
              </Card>
            ))}
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Tickets sold per day" hint="How many seats people paid for each day.">
              <ColumnChart
                caption="Tickets sold per day"
                bars={sales.data.daily.map((d) => ({ label: dayName(d.date), value: d.tickets, display: d.tickets.toLocaleString() }))}
              />
            </ChartCard>
            <ChartCard title="Money taken per day" hint="Revenue from those tickets, in PKR.">
              <ColumnChart
                caption="Revenue per day"
                bars={sales.data.daily.map((d) => ({ label: dayName(d.date), value: d.revenue, display: `PKR ${compact(d.revenue)}` }))}
              />
            </ChartCard>
            <ChartCard title="When people come" hint="Tickets sold for each show start time. Add shows where the bars are tall.">
              <BarList
                caption="Tickets by show start time"
                bars={sales.data.by_hour.map((h) => ({ label: hourName(h.hour), value: h.tickets, display: plural(h.tickets, "ticket") }))}
              />
            </ChartCard>
            <ChartCard title="Top movies, all cinemas" hint="Which films sell the most seats right now.">
              {rankings.status === "ready" ? (
                <BarList
                  caption="Top movies by tickets sold"
                  bars={rankings.data.movies.map((m) => ({
                    label: shortTitle(m.movie_title),
                    value: m.tickets,
                    display: plural(m.tickets, "ticket"),
                  }))}
                />
              ) : rankings.status === "error" ? (
                <ErrorState title="Could not load top movies" error={rankings.error} onRetry={rankings.reload} />
              ) : (
                <Loading label="Loading" />
              )}
            </ChartCard>
          </div>
        </>
      )}

      <ChartCard
        title={`How full today's shows are${cinemaName ? ` at ${cinemaName}` : ""}`}
        hint="Seats sold or held out of all seats. Nearly full shows may need another screening."
      >
        {tonight.length === 0 ? (
          <p className="text-sm text-fg-muted">No more shows today at this cinema.</p>
        ) : (
          <BarList
            caption="Occupancy of today's remaining shows"
            max={1}
            bars={tonight.map(({ show, full }) => ({
              label: `${formatTime(show.start_time)} · ${shortTitle(show.movie_title)}`,
              value: full,
              display: `${Math.round(full * 100)}% full`,
            }))}
          />
        )}
      </ChartCard>
    </div>
  );
}
