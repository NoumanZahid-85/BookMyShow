"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, UserRole } from "@/types";
import { loginApi, registerApi } from "@/lib/api";

/** The session is exactly one of these. */
type Session = { status: "loading" } | { status: "guest" } | { status: "signedIn"; user: User; token: string };

/** The auth dialog is closed or showing one form. */
export type AuthModalState = "closed" | "login" | "register";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  modal: AuthModalState;
  openAuthModal: (mode?: "login" | "register") => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  loginDemo: (role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "bms_session";
// Seeded by the backend in development only (AuthService.ensure_demo_admin).
const DEMO_ADMIN = { email: "admin@cinema.com", password: "demo-admin-123" };
// The demo customer is local only: booking endpoints accept a plain user id.
const DEMO_CUSTOMER: User = { user_id: "usr_demo_customer", email: "customer@cinema.com", full_name: "Demo Customer", role: "CUSTOMER" };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [modal, setModal] = useState<AuthModalState>("closed");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      setSession(saved?.user && saved?.token ? { status: "signedIn", ...saved } : { status: "guest" });
    } catch {
      setSession({ status: "guest" });
    }
  }, []);

  const signIn = (user: User, token: string) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token }));
    setSession({ status: "signedIn", user, token });
    setModal("closed");
  };

  const login = async (email: string, password: string) => {
    const res = await loginApi(email, password);
    signIn(res.user, res.access_token);
  };

  const value: AuthContextType = {
    user: session.status === "signedIn" ? session.user : null,
    token: session.status === "signedIn" ? session.token : null,
    loading: session.status === "loading",
    isAdmin: session.status === "signedIn" && session.user.role === "ADMIN",
    modal,
    openAuthModal: (mode = "login") => setModal(mode),
    closeAuthModal: () => setModal("closed"),
    login,
    register: async (email, password, fullName, phone) => {
      const res = await registerApi(email, password, fullName, phone);
      signIn(res.user, res.access_token);
    },
    loginDemo: async (role) => {
      if (role === "ADMIN") await login(DEMO_ADMIN.email, DEMO_ADMIN.password);
      else signIn(DEMO_CUSTOMER, "demo_customer");
    },
    logout: () => {
      localStorage.removeItem(SESSION_KEY);
      setSession({ status: "guest" });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
