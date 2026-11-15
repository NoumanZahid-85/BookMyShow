"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket, Trash2 } from "lucide-react";
import { loadSavedTickets, removeSavedTicket, type SavedTicket } from "@/lib/savedTickets";
import { formatDate, formatTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, buttonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, Loading } from "@/components/ui/Feedback";

export default function MyTicketsPage() {
  // null until the browser storage has been read (it does not exist during server render).
  const [tickets, setTickets] = useState<SavedTicket[] | null>(null);
  // The ticket waiting for "are you sure?", if any.
  const [confirming, setConfirming] = useState<SavedTicket | null>(null);

  useEffect(() => setTickets(loadSavedTickets()), []);

  const remove = (id: string) => {
    removeSavedTicket(id);
    setTickets(loadSavedTickets());
    setConfirming(null);
  };

  return (
    <div className="page max-w-3xl space-y-6 pt-8">
      <PageHeader title="My tickets" subtitle="Tickets saved on this device. They stay here even when you are signed out." />

      {tickets === null ? (
        <Loading label="Loading your tickets" />
      ) : tickets.length === 0 ? (
        <EmptyState icon={Ticket} title="No tickets saved on this device yet.">
          <Link href="/#shows" className={buttonClass("primary", "sm")}>
            Find a show
          </Link>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.ticket_id}>
              <Card className="flex items-center gap-4 p-4">
                <Link href={`/tickets/${t.ticket_id}`} className="min-w-0 flex-1 hover:text-accent">
                  <span className="block truncate font-medium">{t.movie_title}</span>
                  <span className="block truncate text-sm text-fg-muted">
                    {t.cinema_name && `${t.cinema_name} · `}
                    {t.start_time ? `${formatDate(t.start_time)}, ${formatTime(t.start_time)} · ` : ""}
                    Seats {t.seat_ids.join(", ")}
                  </span>
                </Link>
                <Link href={`/tickets/${t.ticket_id}`} className={buttonClass("secondary", "sm")}>
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirming(t)}
                  aria-label={`Remove ${t.movie_title} ticket from this device`}
                  title="Remove from this device"
                  className="rounded-md p-2 text-fg-muted hover:bg-surface-2 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={confirming !== null} onClose={() => setConfirming(null)} title="Remove this ticket?">
        {confirming && (
          <div className="space-y-4 p-5">
            <p className="text-sm">
              {confirming.movie_title}, seats {confirming.seat_ids.join(", ")}.
            </p>
            <p className="text-sm text-fg-muted">
              Your booking stays valid, but this device will no longer have the QR code to show at the gate.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(null)}>
                Keep it
              </Button>
              <Button variant="danger" onClick={() => remove(confirming.ticket_id)}>
                Yes, remove
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
