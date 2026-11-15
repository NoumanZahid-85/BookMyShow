"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { VerifyResponse } from "@/types";
import { verifyTicketGateApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatTime, toDate } from "@/lib/format";
import { useShowDetails } from "@/hooks/useShowDetails";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Alert, Spinner } from "@/components/ui/Feedback";

const GATES = [
  ["GATE_A_NORTH", "Gate A, North"],
  ["GATE_B_SOUTH", "Gate B, South"],
  ["VIP_GATE", "VIP lounge"],
];

const FORGED = '{"data": {"ticket_id": "fake_123", "seat_ids": ["H15"]}, "sig": "forged_signature"}';

/** The scanner does one thing at a time. */
type Scan =
  | { status: "idle" }
  | { status: "camera" }
  | { status: "verifying" }
  | { status: "result"; result: VerifyResponse }
  | { status: "error"; error: string };

// Built into Chromium browsers. Not in the TypeScript DOM library yet.
type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const getDetector = (): Detector | null => {
  const Ctor = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
};

/** Changes the seats inside a real payload so the signature no longer matches. */
function tamper(payload: string): string {
  try {
    const parsed = JSON.parse(payload);
    parsed.data.seat_ids = ["H15_TAMPERED"];
    return JSON.stringify(parsed);
  } catch {
    return FORGED;
  }
}

export default function GateScanner() {
  const { token } = useAuth();
  const [payload, setPayload] = useState("");
  const [gateId, setGateId] = useState(GATES[0][0]);
  const [scan, setScan] = useState<Scan>({ status: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);

  const verify = async (text: string) => {
    if (!token) return; // the admin page only renders for signed-in staff
    setScan({ status: "verifying" });
    try {
      setScan({ status: "result", result: await verifyTicketGateApi(token, text.trim(), gateId) });
    } catch (e) {
      setScan({ status: "error", error: (e as Error).message });
    }
  };

  // While in "camera", read frames until a QR code shows up. Leaving the state stops the camera.
  useEffect(() => {
    if (scan.status !== "camera") return;
    const detector = getDetector();
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval>;
    let stopped = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        video.play();
        timer = setInterval(async () => {
          const codes = await detector!.detect(video).catch(() => []);
          if (codes[0] && !stopped) {
            setPayload(codes[0].rawValue);
            verify(codes[0].rawValue);
          }
        }, 300);
      })
      .catch(() => setScan({ status: "error", error: "Camera access was blocked. Paste the QR payload instead." }));

    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // `verify` reads the current gate; restarting the camera for it is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.status]);

  const startCamera = () =>
    getDetector()
      ? setScan({ status: "camera" })
      : setScan({ status: "error", error: "This browser cannot scan QR codes with the camera. Use Chrome or Edge, or paste the payload." });

  const busy = scan.status === "verifying";

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <Select label="Gate" value={gateId} onChange={(e) => setGateId(e.target.value)}>
          {GATES.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>

        {scan.status === "camera" && (
          <div className="overflow-hidden rounded-lg border bg-black">
            <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
            <p className="p-2 text-center text-xs text-fg-muted">Point the camera at the customer&apos;s QR code.</p>
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">QR payload (filled by the camera, or paste it)</span>
          <textarea
            rows={4}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder='{"data": {...}, "sig": "..."}'
            className="w-full rounded-lg border bg-surface-2 p-3 font-mono text-xs text-fg placeholder:text-fg-muted/60 focus:border-accent focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {scan.status === "camera" ? (
            <Button variant="secondary" onClick={() => setScan({ status: "idle" })}>
              <CameraOff className="h-4 w-4" />
              Stop camera
            </Button>
          ) : (
            <Button onClick={startCamera} disabled={busy}>
              <Camera className="h-4 w-4" />
              Scan with camera
            </Button>
          )}
          <Button variant="secondary" onClick={() => verify(payload)} disabled={busy || !payload.trim()}>
            {busy ? <Spinner className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
            Verify pasted ticket
          </Button>
          <Button variant="ghost" onClick={() => setPayload(tamper(payload))}>
            Try a tampered ticket
          </Button>
        </div>
      </Card>

      {scan.status === "error" && <Alert>{scan.error}</Alert>}

      {scan.status === "result" && <ScanResult result={scan.result} gate={GATES.find(([id]) => id === gateId)?.[1] ?? gateId} />}
    </div>
  );
}

/** What the gate staff need to check, in large text: allowed or not, and which show and seats. */
function ScanResult({ result, gate }: { result: VerifyResponse; gate: string }) {
  const { show, cinema } = useShowDetails(result.valid ? result.show_id : undefined);
  const Icon = result.valid ? CheckCircle2 : XCircle;
  const rows: [string, string][] = result.valid
    ? [
        ["Movie", show?.movie_title ?? "Loading"],
        ["Cinema", cinema?.name ?? "-"],
        ["When", show ? `${formatDate(show.start_time)}, ${formatTime(show.start_time)}` : "-"],
        ["Screen", show ? String(show.screen_number) : "-"],
        ["Seats", result.seat_ids.join(", ")],
        ["Ticket ID", result.ticket_id],
        ["Gate", gate],
        ["Scanned", result.scanned_at ? toDate(result.scanned_at).toLocaleTimeString() : "-"],
      ]
    : [["Ticket ID", result.ticket_id], ["Gate", gate]];

  return (
    <div
      role="status"
      className={`overflow-hidden rounded-xl border ${result.valid ? "border-success/50" : "border-danger/50"}`}
    >
      <div className={`flex items-center gap-3 p-4 ${result.valid ? "bg-success/15" : "bg-danger/15"}`}>
        <Icon className={`h-8 w-8 shrink-0 ${result.valid ? "text-success" : "text-danger"}`} />
        <div>
          <p className="text-xl font-bold">{result.valid ? "Entry allowed" : "Entry denied"}</p>
          <p className="text-sm text-fg-muted">{result.message}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 bg-surface p-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className={label === "Movie" || label === "Ticket ID" ? "col-span-2" : ""}>
            <dt className="eyebrow">{label}</dt>
            <dd className={`mt-0.5 break-all ${label === "Seats" ? "text-lg font-semibold" : ""}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
