"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Clapperboard, LogOut, MapPin, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCity } from "@/context/CityContext";
import { Button, buttonClass } from "@/components/ui/Button";

const customerLinks = [
  { href: "/#movies", label: "Movies" },
  { href: "/#shows", label: "Showtimes" },
  { href: "/tickets", label: "My tickets" },
];

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/scanner", label: "Gate scanner" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const { city, changeCity } = useCity();
  const links = isAdmin ? adminLinks : customerLinks;

  useEffect(() => setOpen(false), [pathname]);

  const linkClass = (href: string) =>
    `rounded-md px-3 py-2 text-sm transition-colors ${pathname === href ? "text-fg" : "text-fg-muted hover:text-fg"}`;

  return (
    <header className="sticky top-0 z-40 border-b bg-bg/95 backdrop-blur">
      <div className="page flex h-14 items-center justify-between gap-3">
        <Link href={isAdmin ? "/admin" : "/"} className="flex shrink-0 items-center gap-2 font-semibold">
          <Clapperboard className="h-5 w-5 text-accent" />
          <span className="hidden min-[380px]:inline">BookMyShow</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {!isAdmin && (
            <button
              type="button"
              onClick={changeCity}
              className="inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm text-fg-muted hover:text-fg"
              aria-label={`City: ${city?.name ?? "not set"}. Change city`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span className="max-w-[7rem] truncate">{city?.name ?? "City"}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="hidden text-sm text-fg-muted lg:inline" title={user?.email}>
            {isAdmin ? "Admin" : user?.full_name?.split(" ")[0]}
          </span>
          <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out" title="Sign out" className="hidden md:inline-flex">
            <LogOut className="h-4 w-4" />
          </Button>
          {!isAdmin && (
            <Link href="/#shows" className={buttonClass("primary", "sm", "hidden sm:inline-flex")}>
              Book tickets
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rounded-md p-2 text-fg-muted hover:text-fg md:hidden"
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="page flex flex-col gap-1 border-t py-3 md:hidden" aria-label="Mobile">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`${linkClass(l.href)} py-3`}>
              {l.label}
            </Link>
          ))}
          <button type="button" onClick={logout} className="flex items-center gap-2 rounded-md px-3 py-3 text-left text-sm text-fg-muted">
            <LogOut className="h-4 w-4" />
            Sign out {user?.email && <span className="truncate text-xs">({user.email})</span>}
          </button>
        </nav>
      )}
    </header>
  );
}
