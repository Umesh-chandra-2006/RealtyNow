"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

const nav = [
  { href: "/browse", label: "Browse verified" },
  { href: "/owner", label: "List a property" },
  { href: "/owner/track/bandra-loft", label: "Track a listing" },
] as const;

function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("realtynow-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("realtynow-theme", "light");
    }
  };

  if (!mounted) {
    return <span className="h-9 w-9 shrink-0" />;
  }

  return (
    <button
      onClick={toggle}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-navy hover:bg-accent transition-colors"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4.5 w-4.5 text-primary" /> : <Moon className="h-4.5 w-4.5 text-navy" />}
    </button>
  );
}

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname();

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase();
    }
    return "U";
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors",
        transparent
          ? "border-white/10 bg-white/5 backdrop-blur-md"
          : "border-border bg-background/85 backdrop-blur-xl",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold",
            )}
          >
            R
          </span>
          <span
            className={cn(
              "font-display text-lg font-bold tracking-tight",
              transparent ? "text-white" : "text-navy",
            )}
          >
            Realty<span className="text-primary">Now</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  transparent
                    ? active
                      ? "bg-white/15 text-white"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                    : active
                      ? "bg-accent text-navy"
                      : "text-muted-foreground hover:bg-accent hover:text-navy",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <ThemeToggle />
          {!loading && user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm font-medium text-navy hover:text-primary transition-colors"
              >
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white font-display font-semibold text-xs">
                  {getInitials()}
                </div>
                <span>{profile?.full_name || "Profile"}</span>
              </Link>
              <button
                onClick={signOut}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-navy transition-colors border border-border hover:bg-surface"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                transparent
                  ? "text-white/85 hover:text-white"
                  : "text-navy hover:text-primary",
              )}
            >
              Sign in
            </Link>
          )}
          <Link
            href="/owner/submit"
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-crisp transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            List for free
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full md:hidden",
            transparent ? "text-white" : "text-navy",
          )}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-5 py-4 md:hidden animate-fade-rise">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-navy hover:bg-accent"
              >
                {item.label}
              </Link>
            ))}
            {!loading && user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-navy hover:bg-accent flex items-center gap-2"
                >
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white font-display font-semibold text-xs">
                    {getInitials()}
                  </div>
                  <span>{profile?.full_name || "Profile"}</span>
                </Link>
                <button
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-left text-navy hover:bg-accent"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-navy hover:bg-accent"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/owner/submit"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              List for free
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
