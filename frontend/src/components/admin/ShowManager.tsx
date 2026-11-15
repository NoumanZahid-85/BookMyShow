"use client";

import { useState, type FormEvent } from "react";
import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { Show, ShowInput } from "@/types";
import { createShowApi, deleteShowApi, updateShowApi } from "@/lib/api";
import { MOVIES } from "@/lib/movies";
import { formatDate, formatPrice, formatTime, toDate, toLocalInput } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, TextField } from "@/components/ui/Field";
import { Alert, Chip, EmptyState, Spinner } from "@/components/ui/Feedback";

/** One dialog at a time: closed, the add/edit form, or the cancel confirmation. */
type Dialog = { kind: "closed" } | { kind: "form"; show: Show | null } | { kind: "confirmDelete"; show: Show };

type Request = { status: "idle" } | { status: "saving" } | { status: "error"; error: string };

type FormValues = { movie_title: string; screen_number: string; start: string; end: string; base_price: string };

const emptyForm = (): FormValues => ({
  movie_title: MOVIES[0].title,
  screen_number: "1",
  start: "",
  end: "",
  base_price: "1000",
});
const formFrom = (s: Show): FormValues => ({
  movie_title: s.movie_title,
  screen_number: String(s.screen_number),
  start: toLocalInput(s.start_time),
  end: toLocalInput(s.end_time),
  base_price: String(s.base_price),
});

/** Add, edit and cancel shows for one cinema. Every write goes through the admin-only API. */
export default function ShowManager({
  token,
  cinemaId,
  shows,
  selectedShowId,
  onSelect,
  onChanged,
}: {
  token: string;
  cinemaId: string;
  shows: Show[];
  selectedShowId: string;
  onSelect: (showId: string) => void;
  onChanged: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const [request, setRequest] = useState<Request>({ status: "idle" });
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [showPast, setShowPast] = useState(false);

  const saving = request.status === "saving";
  const set = (key: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const open = (next: Dialog) => {
    setRequest({ status: "idle" });
    if (next.kind === "form") setForm(next.show ? formFrom(next.show) : emptyForm());
    setDialog(next);
  };
  const close = () => !saving && setDialog({ kind: "closed" });

  const run = async (action: () => Promise<unknown>) => {
    setRequest({ status: "saving" });
    try {
      await action();
      setRequest({ status: "idle" });
      setDialog({ kind: "closed" });
      onChanged();
    } catch (e) {
      setRequest({ status: "error", error: (e as Error).message });
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dialog.kind !== "form") return;
    if (new Date(form.end) <= new Date(form.start)) {
      return setRequest({ status: "error", error: "The end time must be after the start time." });
    }
    const input: ShowInput = {
      movie_title: form.movie_title,
      screen_number: Number(form.screen_number),
      start_time: new Date(form.start).toISOString(),
      end_time: new Date(form.end).toISOString(),
      base_price: Number(form.base_price),
    };
    const editing = dialog.show;
    run(() => (editing ? updateShowApi(token, editing.id, input) : createShowApi(token, cinemaId, input)));
  };

  const now = Date.now();
  const sorted = [...shows]
    .filter((s) => showPast || toDate(s.end_time).getTime() > now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  // Keep a custom title editable even if it is not in the local movie list.
  const titles = [...new Set([...MOVIES.map((m) => m.title), form.movie_title])];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Shows at this cinema</h2>
        <div className="flex items-center gap-2">
          <Chip active={showPast} onClick={() => setShowPast(!showPast)}>
            Include past shows
          </Chip>
          <Button size="sm" onClick={() => open({ kind: "form", show: null })} disabled={!cinemaId}>
            <CalendarPlus className="h-4 w-4" />
            Add show
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={CalendarPlus} title={showPast ? "No shows at this cinema." : "No upcoming shows at this cinema."} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-xs text-fg-muted">
              <tr>
                {["Movie", "When", "Screen", "Price", "Seats left", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((s) => (
                <tr key={s.id} className={s.id === selectedShowId ? "bg-accent/10" : ""}>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onSelect(s.id)} className="text-left font-medium hover:text-accent">
                      {s.movie_title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {formatDate(s.start_time)}, {formatTime(s.start_time)}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{s.screen_number}</td>
                  <td className="px-4 py-3 text-fg-muted">{formatPrice(s.base_price)}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {s.available_seats} / {s.total_seats}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => open({ kind: "form", show: s })}
                      aria-label={`Edit ${s.movie_title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => open({ kind: "confirmDelete", show: s })}
                      aria-label={`Cancel ${s.movie_title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs text-fg-muted">Select a movie name to watch that show live under System health.</p>

      <Modal
        open={dialog.kind === "form"}
        onClose={close}
        title={dialog.kind === "form" && dialog.show ? "Edit show" : "Add show"}
      >
        <form onSubmit={submit} className="space-y-3 p-5">
          {request.status === "error" && <Alert>{request.error}</Alert>}
          <Select label="Movie" value={form.movie_title} onChange={set("movie_title")}>
            {titles.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Starts" type="datetime-local" required value={form.start} onChange={set("start")} />
            <TextField label="Ends" type="datetime-local" required value={form.end} onChange={set("end")} />
            <TextField
              label="Screen"
              type="number"
              required
              min={1}
              max={50}
              value={form.screen_number}
              onChange={set("screen_number")}
            />
            <TextField
              label="Base price (PKR)"
              type="number"
              required
              min={1}
              max={10000}
              value={form.base_price}
              onChange={set("base_price")}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />}
              Save show
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog.kind === "confirmDelete"} onClose={close} title="Cancel this show?">
        {dialog.kind === "confirmDelete" && (
          <div className="space-y-4 p-5">
            {request.status === "error" && <Alert>{request.error}</Alert>}
            <p className="text-sm">
              {dialog.show.movie_title}, {formatDate(dialog.show.start_time)} at {formatTime(dialog.show.start_time)}.
            </p>
            <p className="text-sm text-fg-muted">
              Customers will no longer see it. Tickets already sold stay valid in the records
              {dialog.show.available_seats < dialog.show.total_seats ? ", and this show has sold seats" : ""}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={saving}>
                Keep show
              </Button>
              <Button variant="danger" disabled={saving} onClick={() => run(() => deleteShowApi(token, dialog.show.id))}>
                {saving && <Spinner className="h-4 w-4" />}
                Cancel show
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
