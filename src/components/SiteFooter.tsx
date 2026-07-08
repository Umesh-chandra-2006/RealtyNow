import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/5 bg-[#090B11] text-white/70">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold">
              R
            </span>
            <span className="font-display text-lg font-bold text-white">
              Realty<span className="text-primary">Now</span>
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            India&rsquo;s verification-first property platform. Every listing you see here has
            passed a four-step check before going live.
          </p>
          <p className="mt-6 text-xs text-white/40">
            Example inventory shown pre-launch. Nothing here is booked or for sale yet.
          </p>
        </div>

        <FooterCol
          title="Browse"
          links={[
            { to: "/browse", label: "All verified homes" },
            { to: "/browse?city=Mumbai", label: "Mumbai" },
            { to: "/browse?city=Bengaluru", label: "Bengaluru" },
            { to: "/browse?city=Pune", label: "Pune" },
          ]}
        />
        <FooterCol
          title="Owners"
          links={[
            { to: "/owner", label: "Owner portal" },
            { to: "/owner/submit", label: "Submit a listing" },
            { to: "/owner/track/bandra-loft", label: "Track a listing" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { to: "/", label: "Verification standard" },
            { to: "/", label: "Trust & safety" },
            { to: "/", label: "Contact" },
          ]}
        />
      </div>
      <div className="border-t border-white/5">
        <div className="container-page flex flex-col items-start justify-between gap-3 py-6 text-xs text-white/40 md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} RealtyNow. All rights reserved.</span>
          <span>
            Built for renters and buyers in Tier-1 and Tier-2 Indian cities. Broker tools coming
            later.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
