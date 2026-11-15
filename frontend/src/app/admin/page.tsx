"use client";

import { useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { useAuth } from "@/context/AuthContext";
import { useShowFinder } from "@/hooks/useShowFinder";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Chip, ErrorState, Loading } from "@/components/ui/Feedback";
import SalesPanel from "@/components/admin/SalesPanel";
import LivePanel from "@/components/admin/LivePanel";
import ShowManager from "@/components/admin/ShowManager";
import GateScanner from "@/components/admin/GateScanner";

const TABS = ["Sales", "Shows", "Gate scanner", "System health"] as const;
type Tab = (typeof TABS)[number];

function Dashboard() {
  const { user, token } = useAuth();
  const finder = useShowFinder();
  const [tab, setTab] = useState<Tab>("Sales");
  const [pickedShow, setPickedShow] = useState("");

  // The monitored show is the picked one, or the first show of the cinema.
  const show = finder.shows.find((s) => s.id === pickedShow) ?? finder.shows[0];
  const needsCinema = tab === "Sales" || tab === "Shows" || tab === "System health";

  return (
    <div className="page space-y-6 pt-6">
      <PageHeader title="Admin dashboard" subtitle={`Signed in as ${user?.full_name} (${user?.email})`} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar" role="group" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
            {t}
          </Chip>
        ))}
      </div>

      {needsCinema && (
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          <Select label="City" value={finder.cityId} onChange={(e) => finder.setCityId(e.target.value)}>
            {finder.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Cinema" value={finder.cinemaId} onChange={(e) => finder.setCinemaId(e.target.value)}>
            {finder.cinemas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {tab === "Gate scanner" ? (
        <div className="max-w-2xl">
          <GateScanner />
        </div>
      ) : finder.state.status === "loading" ? (
        <Loading label="Loading shows" />
      ) : finder.state.status === "error" ? (
        <ErrorState title="Could not load shows" error={finder.state.error} onRetry={finder.reload} />
      ) : tab === "Sales" ? (
        <SalesPanel token={token ?? ""} cinemaId={finder.cinemaId} cinemaName={finder.cinema?.name} shows={finder.shows} />
      ) : tab === "Shows" ? (
        <ShowManager
          token={token ?? ""}
          cinemaId={finder.cinemaId}
          shows={finder.shows}
          selectedShowId={show?.id ?? ""}
          onSelect={(id) => {
            setPickedShow(id);
            setTab("System health");
          }}
          onChanged={finder.reload}
        />
      ) : show ? (
        <>
          <p className="text-sm text-fg-muted">
            For the tech team: live seat traffic and server speed for one show. Pick a show in the Shows tab to watch it here.
          </p>
          <LivePanel show={show} />
        </>
      ) : (
        <p className="text-sm text-fg-muted">This cinema has no shows to monitor.</p>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminGuard>
      <Dashboard />
    </AdminGuard>
  );
}
