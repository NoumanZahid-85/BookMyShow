"use client";

import { useState, type FormEvent } from "react";
import { UserRole } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert, Spinner } from "@/components/ui/Feedback";

/** The form is idle, sending, or showing the last error. */
type Submit = { status: "idle" } | { status: "sending" } | { status: "error"; error: string };

/** Sign in or create an account. Used by the sign-in wall and the sign-in dialog. */
export default function SignInForm({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  const { login, register, loginDemo } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", phone: "" });
  const [submit, setSubmit] = useState<Submit>({ status: "idle" });

  const isLogin = mode === "login";
  const sending = submit.status === "sending";
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const run = async (action: () => Promise<void>) => {
    setSubmit({ status: "sending" });
    try {
      await action();
      setSubmit({ status: "idle" });
    } catch (e) {
      setSubmit({ status: "error", error: (e as Error).message });
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(() => (isLogin ? login(form.email, form.password) : register(form.email, form.password, form.fullName, form.phone)));
  };

  const demo = (role: UserRole) => run(() => loginDemo(role));

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed p-3">
        <p className="text-xs text-fg-muted">Just looking around? Use a demo account.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={sending} onClick={() => demo("CUSTOMER")}>
            Demo customer
          </Button>
          <Button variant="secondary" disabled={sending} onClick={() => demo("ADMIN")}>
            Demo admin
          </Button>
        </div>
      </div>

      {submit.status === "error" && <Alert>{submit.error}</Alert>}

      <form onSubmit={onSubmit} className="space-y-3">
        {!isLogin && (
          <>
            <TextField label="Full name" required autoComplete="name" value={form.fullName} onChange={set("fullName")} />
            <TextField
              label="Phone (optional)"
              type="tel"
              autoComplete="tel"
              placeholder="+92 300 1234567"
              value={form.phone}
              onChange={set("phone")}
            />
          </>
        )}
        <TextField label="Email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} />
        <TextField
          label="Password"
          type="password"
          required
          minLength={isLogin ? 1 : 8}
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={form.password}
          onChange={set("password")}
        />
        <Button type="submit" disabled={sending} className="w-full">
          {sending && <Spinner className="h-4 w-4" />}
          {isLogin ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-xs text-fg-muted">
        {isLogin ? "No account yet? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => {
            setSubmit({ status: "idle" });
            setMode(isLogin ? "register" : "login");
          }}
          className="font-medium text-fg hover:underline"
        >
          {isLogin ? "Create one" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
