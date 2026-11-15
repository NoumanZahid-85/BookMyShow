"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Maximize2, Printer, ShieldCheck } from "lucide-react";
import { fetchTicketApi } from "@/lib/api";
import { getMovieMeta } from "@/lib/movies";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { saveTicket } from "@/lib/savedTickets";
import { downloadTicketImage } from "@/lib/ticketImage";
import { useAsync } from "@/hooks/useAsync";
import { useShowDetails } from "@/hooks/useShowDetails";
import { BackLink } from "@/components/ui/PageHeader";
import { StepTracker } from "@/components/ui/StepTracker";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert, ErrorState, Loading, StatusPill } from "@/components/ui/Feedback";
import { PosterImage } from "@/components/ui/Movie";

export default function TicketDisplayPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = use(params);
  const req = useAsync(ticketId, () => fetchTicketApi(ticketId));
  const ticket = req.status === "ready" ? req.data : null;
  const { show, cinema } = useShowDetails(ticket?.show_id);
  const [gateMode, setGateMode] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Keep a copy in this browser's wallet. Runs again once show details arrive.
  useEffect(() => {
    if (!ticket) return;
    saveTicket({
      ticket_id: ticket.ticket_id,
      movie_title: show?.movie_title ?? "Movie ticket",
      cinema_name: cinema?.name ?? "",
      start_time: show?.start_time ?? null,
      seat_ids: ticket.seat_ids,
    });
  }, [ticket, show, cinema]);

  if (req.status === "loading") return <Loading label="Loading your ticket" />;
  if (req.status === "error") {
    return (
      <div className="page max-w-xl space-y-4 pt-16">
        <ErrorState title="Could not load this ticket" error={req.error} onRetry={req.reload} />
        <BackLink href="/tickets" label="My tickets" />
      </div>
    );
  }

  const t = req.data;
  const meta = show ? getMovieMeta(show.movie_title) : null;
  const facts: [string, string][] = [
    ["Date", show ? formatDate(show.start_time) : "-"],
    ["Time", show ? formatTime(show.start_time) : "-"],
    ["Screen", show ? String(show.screen_number) : "-"],
    ["Seats", t.seat_ids.join(", ")],
    ["Paid", formatPrice(t.total_amount)],
    ["Booking", t.booking_id],
  ];
  // The QR SVG comes from our own ticket service, so it is safe to inline.
  const qr = <div className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: t.qr_svg }} />;

  const download = () =>
    downloadTicketImage({
      fileName: `ticket-${t.ticket_id.slice(0, 8)}.png`,
      title: show?.movie_title ?? "Movie ticket",
      lines: [
        ["Cinema", cinema?.name ?? "-"],
        ["When", show ? `${formatDate(show.start_time)}, ${formatTime(show.start_time)}` : "-"],
        ["Seats", t.seat_ids.join(", ")],
        ["Ticket", t.ticket_id],
      ],
      qrSvg: t.qr_svg,
    })
      .then(() => setDownloadError(null))
      .catch(() => setDownloadError("Could not create the image. Use Print instead."));

  return (
    <div className="page max-w-3xl space-y-6 pt-8">
      <StepTracker current={5} />

      <div className="flex items-center justify-between">
        <BackLink href="/tickets" label="My tickets" />
        <StatusPill tone="success">{t.status}</StatusPill>
      </div>

      <Card className="grid overflow-hidden md:grid-cols-[1fr_auto]">
        <div className="space-y-6 p-6">
          <div className="flex gap-4">
            {meta && <PosterImage meta={meta} className="h-28 w-20 shrink-0 rounded-md object-cover" />}
            <div className="min-w-0">
              <p className="eyebrow">Ticket #{t.ticket_id.slice(0, 8).toUpperCase()}</p>
              <h1 className="mt-1 text-xl font-semibold">{show?.movie_title ?? "Movie ticket"}</h1>
              {cinema && (
                <p className="mt-1 text-sm text-fg-muted">
                  {cinema.name}, {cinema.address}
                </p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="eyebrow">{label}</dt>
                <dd className="mt-1 truncate" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 border-t border-dashed p-6 md:border-l md:border-t-0">
          <button
            type="button"
            onClick={() => setGateMode(true)}
            aria-label="Show the QR code full screen"
            className="w-44 rounded-lg bg-white p-3 transition hover:ring-2 hover:ring-accent"
          >
            {qr}
          </button>
          <p className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Signed QR. Tap to enlarge.
          </p>
        </div>
      </Card>

      {downloadError && <Alert>{downloadError}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setGateMode(true)}>
          <Maximize2 className="h-4 w-4" />
          Show at gate
        </Button>
        <Button variant="secondary" onClick={download}>
          <Download className="h-4 w-4" />
          Save as image
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>
      <p className="text-xs text-fg-muted">
        This ticket is saved on this device under <Link href="/tickets" className="text-fg underline">My tickets</Link>.
      </p>

      {/* Gate mode: one large, bright code that a scanner can read from arm's length. */}
      <Modal open={gateMode} onClose={() => setGateMode(false)} title="Hold this up to the scanner">
        <div className="space-y-4 p-5 text-center">
          <div className="mx-auto w-full max-w-xs rounded-xl bg-white p-4">{qr}</div>
          <p className="text-sm">
            {show?.movie_title} · Seats {t.seat_ids.join(", ")}
          </p>
          <p className="text-xs text-fg-muted">Turn your screen brightness up if the scanner struggles.</p>
        </div>
      </Modal>
    </div>
  );
}
