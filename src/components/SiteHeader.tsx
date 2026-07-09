import { Link } from "@tanstack/react-router";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const nav = [
  { to: "/browse", label: "Browse verified" },
  { to: "/owner", label: "List a property" },
  { to: "/owner/track/bandra-loft", label: "Track a listing" },
] as const;

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const { user, profile, loading, signOut } = useAuth();

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("realtynow-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("realtynow-theme", "light");
    }
  };

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

  const isHeaderTransparent = transparent && !scrolled;

  return (
    <header
      className={cn(
        "fixed top-0 left-0 z-50 w-full transition-all duration-300",
        isHeaderTransparent
          ? "border-b border-white/10 bg-transparent text-white"
          : "border-b border-border bg-background/85 backdrop-blur-xl shadow-crisp"
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold",
            )}
          >
            R
          </span>
          <span
            className={cn(
              "font-display text-lg font-bold tracking-tight transition-colors",
              isHeaderTransparent ? "text-white" : "text-navy"
            )}
          >
            Realty<span className="text-primary">Now</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isHeaderTransparent
                  ? "text-white/85 hover:bg-white/10 hover:text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-navy",
              )}
              activeProps={{
                className: isHeaderTransparent
                  ? "bg-white/15 text-white"
                  : "bg-accent text-navy",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {/* Theme Toggle */}
          {mounted ? (
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full transition-colors",
                isHeaderTransparent
                  ? "text-white/80 hover:bg-white/10 hover:text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-navy"
              )}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          ) : (
            <span className="h-9 w-9 shrink-0" />
          )}

          {!loading && user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors",
                  isHeaderTransparent ? "text-white hover:text-primary" : "text-navy hover:text-primary"
                )}
              >
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white font-display font-semibold text-xs">
                  {getInitials()}
                </div>
                <span>{profile?.full_name || "Profile"}</span>
              </Link>
              <button
                onClick={signOut}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border",
                  isHeaderTransparent
                    ? "text-white/70 hover:text-white border-white/10 hover:bg-white/5"
                    : "text-muted-foreground hover:text-navy border-border hover:bg-surface"
                )}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isHeaderTransparent
                  ? "text-white/85 hover:text-white"
                  : "text-navy hover:text-primary",
              )}
            >
              Sign in
            </Link>
          )}
          <Link
            to="/owner/submit"
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-crisp transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            List for free
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {/* Mobile Theme Toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full transition-colors",
                isHeaderTransparent ? "text-white" : "text-navy"
              )}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full",
              isHeaderTransparent ? "text-white" : "text-navy",
            )}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-navy hover:bg-accent"
              >
                {item.label}
              </Link>
            ))}
            {!loading && user ? (
              <>
                <Link
                  to="/profile"
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
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-navy hover:bg-accent"
              >
                Sign in
              </Link>
            )}
            <Link
              to="/owner/submit"
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
