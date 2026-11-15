import AdminGuard from "@/components/AdminGuard";
import GateScanner from "@/components/admin/GateScanner";
import { PageHeader } from "@/components/ui/PageHeader";

/** Standalone scanner for gate staff on a phone. The same scanner is a tab on the dashboard. */
export default function GateScannerPage() {
  return (
    <AdminGuard title="Gate scanner">
      <div className="page max-w-2xl space-y-6 pt-8">
        <PageHeader
          back={{ href: "/admin", label: "Back to dashboard" }}
          title="Gate scanner"
          subtitle="Scan the customer's QR code. Reused and forged tickets are rejected."
        />
        <GateScanner />
      </div>
    </AdminGuard>
  );
}
