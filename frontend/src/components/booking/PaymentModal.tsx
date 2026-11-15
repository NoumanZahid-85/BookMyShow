import { SeatItem } from "@/types";
import { formatPrice } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Feedback";

/** Mock payment provider: the user picks the outcome to test both paths. */
export default function PaymentModal({
  open,
  seats,
  total,
  busy,
  onPay,
  onClose,
}: {
  open: boolean;
  seats: SeatItem[];
  total: number;
  busy: boolean;
  onPay: (success: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Checkout">
      <div className="space-y-5 p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-fg-muted">Seats</dt>
            <dd>{seats.map((s) => s.seat_id).join(", ")}</dd>
          </div>
          <div className="flex justify-between border-t pt-2">
            <dt className="text-fg-muted">Total</dt>
            <dd className="font-semibold">{formatPrice(total)}</dd>
          </div>
        </dl>

        <p className="text-xs text-fg-muted">
          This is a test payment. Choose how it ends. A declined payment releases your seats right away.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="danger" onClick={() => onPay(false)} disabled={busy}>
            Decline card
          </Button>
          <Button onClick={() => onPay(true)} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            Pay successfully
          </Button>
        </div>
      </div>
    </Modal>
  );
}
