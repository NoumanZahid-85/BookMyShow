"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Alert, Loading } from "@/components/ui/Feedback";
import { BackLink } from "@/components/ui/PageHeader";

/** Shows children only to admins; everyone else gets a sign-in prompt. */
export default function AdminGuard({ children, title = "Admin dashboard" }: { children: React.ReactNode; title?: string }) {
  const { isAdmin, loading, openAuthModal, loginDemo } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Loading label="Checking access" />;
  if (isAdmin) return <>{children}</>;

  return (
    <div className="page flex max-w-md flex-col items-center gap-4 pt-24 text-center">
      <ShieldAlert className="h-8 w-8 text-fg-muted" />
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-fg-muted">This page is for cinema staff. Sign in with an admin account to continue.</p>
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => loginDemo("ADMIN").catch((e: Error) => setError(e.message))}>Use demo admin</Button>
        <Button variant="secondary" onClick={() => openAuthModal("login")}>
          Sign in
        </Button>
      </div>
      <BackLink />
    </div>
  );
}
