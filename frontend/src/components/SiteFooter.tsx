"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function SiteFooter() {
  const { isAdmin } = useAuth();
  const links = isAdmin
    ? [
        { href: "/admin", label: "Dashboard" },
        { href: "/scanner", label: "Gate scanner" },
      ]
    : [
        { href: "/#movies", label: "Movies" },
        { href: "/#shows", label: "Showtimes" },
        { href: "/tickets", label: "My tickets" },
      ];

  return (
    <footer className="mt-24 border-t">
      <div className="page flex flex-col gap-4 py-8 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
        <p>BookMyShow clone. A portfolio project built with FastAPI, Redis, MongoDB and Next.js.</p>
        <nav className="flex gap-4" aria-label="Footer">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
