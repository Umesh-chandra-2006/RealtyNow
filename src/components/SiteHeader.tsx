import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/browse", label: "Browse verified" },
  { to: "/owner", label: "List a property" },
  { to: "/owner/track/bandra-loft", label: "Track a listing" },
] as const;

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
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
              "font-display text-lg font-bold tracking-tight",
              transparent ? "text-white" : "text-navy",
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
                transparent
                  ? "text-white/85 hover:bg-white/10 hover:text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-navy",
              )}
              activeProps={{
                className: transparent
                  ? "bg-white/15 text-white"
                  : "bg-accent text-navy",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/browse"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              transparent
                ? "text-white/85 hover:text-white"
                : "text-navy hover:text-primary",
            )}
          >
            Sign in
          </Link>
          <Link
            to="/owner/submit"
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
