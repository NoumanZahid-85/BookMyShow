"use client";

import { Clapperboard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Loading } from "@/components/ui/Feedback";
import SignInForm from "@/components/auth/SignInForm";

/**
 * Every page needs a signed-in user. Whatever link a guest opens, they see this first,
 * and after signing in they land on the page they asked for (the URL never changes).
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <Loading label="Loading" />;
  if (user) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <Clapperboard className="mx-auto h-8 w-8 text-accent" />
          <h1 className="text-2xl font-bold tracking-tight">Welcome to BookMyShow</h1>
          <p className="text-sm text-fg-muted">Sign in to see movies, showtimes and your tickets.</p>
        </div>
        <div className="rounded-xl border bg-surface p-5">
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
