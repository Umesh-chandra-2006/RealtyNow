import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  MapPin,
  ShieldCheck,
  FileCheck2,
  Camera,
  Copy,
  ArrowRight,
  Clock,
  Building2,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ListingCard } from "@/components/ListingCard";
import { VerifiedPill } from "@/components/VerifiedPill";
import { listings, cities } from "@/data/listings";
import AppShowcase from "@/components/AppShowcase";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import hero from "@/assets/hero-skyline.jpg";
import cMumbai from "@/assets/city-mumbai.jpg";
import cBengaluru from "@/assets/city-bengaluru.jpg";
import cPune from "@/assets/city-pune.jpg";
import cHyderabad from "@/assets/city-hyderabad.jpg";
import cDelhi from "@/assets/city-delhi.jpg";
import cChennai from "@/assets/city-chennai.jpg";

const cityImages: Record<string, string> = {
  "city-mumbai": cMumbai,
  "city-bengaluru": cBengaluru,
  "city-pune": cPune,
  "city-hyderabad": cHyderabad,
  "city-delhi": cDelhi,
  "city-chennai": cChennai,
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RealtyNow — Only verified homes across India" },
      {
        name: "description",
        content:
          "India's verification-first property platform. Every listing clears a 4-step check — RERA, identity, photo authenticity, duplicate scan — before going public.",
      },
      { property: "og:title", content: "RealtyNow — Only verified homes across India" },
      {
        property: "og:description",
        content:
          "India's verification-first property platform. Every listing clears a 4-step check — RERA, identity, photo authenticity, duplicate scan — before going public.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="relative">
        <SiteHeader transparent />
        <Hero />
      </div>
      <TrustStrip />
      <HowItWorks />
      <FeaturedListings />
      <CitiesStrip />
      <AppShowcase />
      <OwnerBand />
      <section className="section--lead-cta" id="ctaSection">
        <div className="container-page">
          <div className="lead-cta lead-cta--home">
            <div className="lead-cta__content">
              <h2 className="font-display">Ready to Find Your Dream Home?</h2>
              <p>
                Let us help you find the perfect space for you and your family. Enter your email below to connect with verified listings.
              </p>
              <LeadCaptureForm />
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  const [tab, setTab] = useState<"buy" | "rent">("buy");
  return (
    <section className="relative -mt-16 min-h-[720px] overflow-hidden">
      <img
        src={hero}
        alt="Mumbai residential skyline at golden hour"
        width={1920}
        height={1280}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/85 via-navy/60 to-navy/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-transparent to-navy/30" />

      <div className="container-page relative pt-32 pb-24 md:pt-44 md:pb-32">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur-md animate-fade-rise">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-coral" />
            </span>
            FIND YOUR PERFECT SPACE
          </div>

          <h1
            className="mt-6 font-display text-5xl font-bold leading-[1.02] text-white md:text-7xl animate-fade-rise"
            style={{ animationDelay: "80ms" }}
          >
            Find Your
            <br />
            <span className="text-white/70">Dream Home</span>
          </h1>

          <p
            className="mt-6 max-w-xl text-lg text-white/85 animate-fade-rise"
            style={{ animationDelay: "160ms" }}
          >
            Premium properties. Prime locations. Unmatched lifestyle.
          </p>
        </div>

        {/* Search card */}
        <div
          className="mt-10 max-w-4xl rounded-2xl bg-white p-2 shadow-elevated ring-1 ring-white/40 animate-fade-rise"
          style={{ animationDelay: "240ms" }}
        >
          <div className="flex items-center gap-1 border-b border-border px-3 pt-2">
            {(["buy", "rent"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative rounded-t-lg px-5 py-2.5 text-sm font-semibold capitalize transition-colors ${
                  tab === t ? "text-navy" : "text-muted-foreground hover:text-navy"
                }`}
              >
                {t}
                {tab === t && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-[1.4fr_1fr_1fr_auto]">
            <label className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 ring-1 ring-transparent focus-within:ring-primary">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <input
                type="text"
                placeholder="Search a city or locality"
                defaultValue="Bandra West, Mumbai"
                className="w-full bg-transparent text-sm text-navy placeholder:text-muted-foreground focus:outline-none"
              />
            </label>
            <select
              defaultValue="Apartment"
              className="rounded-xl bg-surface px-4 py-3 text-sm text-navy focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option>Apartment</option>
              <option>Villa</option>
              <option>Penthouse</option>
              <option>Townhouse</option>
            </select>
            <select
              defaultValue="3 BHK"
              className="rounded-xl bg-surface px-4 py-3 text-sm text-navy focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option>1 BHK</option>
              <option>2 BHK</option>
              <option>3 BHK</option>
              <option>4+ BHK</option>
            </select>
            <Link
              to="/browse"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Search className="h-4 w-4" />
              <span>Search verified</span>
            </Link>
          </div>
        </div>

        {/* Ticker strip */}
        <div
          className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/75 animate-fade-rise"
          style={{ animationDelay: "320ms" }}
        >
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-coral" /> 4-step verification
          </span>
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-coral" /> 1,438 verified homes live
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4 text-coral" /> Verified in under 48 hours
          </span>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="container-page flex items-center gap-8 overflow-hidden py-6">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Checked against
        </span>
        <div className="flex flex-1 items-center gap-10 overflow-hidden">
          <div className="flex shrink-0 animate-marquee items-center gap-10 text-sm font-medium text-navy/70">
            {[
              "MahaRERA · Maharashtra portal",
              "K-RERA · Karnataka portal",
              "TG-RERA · Telangana portal",
              "TN-RERA · Tamil Nadu portal",
              "H-RERA · Haryana portal",
              "UP-RERA · Uttar Pradesh portal",
              "MahaRERA · Maharashtra portal",
              "K-RERA · Karnataka portal",
              "TG-RERA · Telangana portal",
              "TN-RERA · Tamil Nadu portal",
              "H-RERA · Haryana portal",
              "UP-RERA · Uttar Pradesh portal",
            ].map((label, i) => (
              <span key={i} className="whitespace-nowrap">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    icon: FileCheck2,
    label: "Submitted",
    body: "Owner enters property details and uploads documents.",
  },
  {
    icon: ShieldCheck,
    label: "RERA & identity",
    body: "Registration confirmed against the state portal. Owner ID reviewed.",
  },
  {
    icon: Camera,
    label: "Photo & duplicate check",
    body: "EXIF checked. Every image scanned against existing listings.",
  },
  {
    icon: Copy,
    label: "Live",
    body: "Only now does the listing appear in public search results.",
  },
];

function HowItWorks() {
  return (
    <section className="container-page py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          How verification works
        </p>
        <h2 className="mt-3 font-display text-4xl font-semibold text-navy md:text-5xl">
          A listing exists on RealtyNow only after it&rsquo;s been checked.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          There is no &ldquo;pending&rdquo; inventory quietly visible in search. If we haven&rsquo;t
          finished checking it, you don&rsquo;t see it.
        </p>
      </div>

      <ol className="mt-12 grid gap-4 md:grid-cols-4">
        {steps.map((step, i) => (
          <li
            key={step.label}
            className="relative flex flex-col gap-4 rounded-2xl bg-surface p-6 ring-1 ring-border transition-transform hover:-translate-y-1 hover:shadow-card animate-fade-rise"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <step.icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Step {i + 1}
              </span>
            </div>
            <h3 className="font-display text-xl font-semibold text-navy">{step.label}</h3>
            <p className="text-sm text-muted-foreground">{step.body}</p>
            {i === steps.length - 1 && (
              <span className="absolute right-4 top-4">
                <VerifiedPill variant="ghost" />
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function FeaturedListings() {
  return (
    <section className="container-page py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Verified this week
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-navy md:text-5xl">
            Homes fresh from the pipeline.
          </h2>
        </div>
        <Link
          to="/browse"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          Browse all verified
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l, i) => (
          <ListingCard key={l.id} listing={l} index={i} />
        ))}
      </div>
    </section>
  );
}

function CitiesStrip() {
  return (
    <section className="container-page py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Where we&rsquo;re active
        </p>
        <h2 className="mt-3 font-display text-4xl font-semibold text-navy md:text-5xl">
          Six cities. All verified inventory.
        </h2>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cities.map((city, i) => (
          <Link
            key={city.name}
            to="/browse"
            className="group relative aspect-[3/4] overflow-hidden rounded-2xl animate-fade-rise"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <img
              src={cityImages[city.image]}
              alt={`${city.name} skyline`}
              loading="lazy"
              width={800}
              height={1000}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="font-display text-lg font-semibold">{city.name}</p>
              <p className="text-xs text-white/75">{city.count} verified homes</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function OwnerBand() {
  return (
    <section className="container-page py-16">
      <div className="relative overflow-hidden rounded-3xl bg-navy px-8 py-16 text-white md:px-16 md:py-20">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.6) 1px, transparent 1px), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "24px 24px, 40px 40px",
          }}
        />
        <div className="relative grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
              For owners
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
              List your property. Get verified in 48 hours. No broker.
            </h2>
            <p className="mt-5 max-w-xl text-white/75">
              Submit your listing through a four-step flow that mirrors the verification pipeline
              itself. You watch every check happen. No hidden state.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/owner/submit"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-navy transition-transform hover:scale-[1.02]"
              >
                Start a listing
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/owner"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/15"
              >
                How the portal works
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/15 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/70">
              <span>Live pipeline sample</span>
              <VerifiedPill variant="onDark" />
            </div>
            <ul className="mt-6 space-y-4 text-sm">
              {[
                { label: "Documents received", status: "Done" },
                { label: "RERA lookup — Maharashtra portal", status: "Done" },
                { label: "Owner identity check", status: "Running" },
                { label: "Photo authenticity + duplicate scan", status: "Queued" },
              ].map((row, i) => (
                <li key={row.label} className="flex items-center gap-3">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      row.status === "Done"
                        ? "bg-coral text-coral-foreground"
                        : row.status === "Running"
                          ? "bg-white/20 text-white"
                          : "bg-white/10 text-white/60"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1">{row.label}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      row.status === "Done"
                        ? "text-coral"
                        : row.status === "Running"
                          ? "text-white"
                          : "text-white/50"
                    }`}
                  >
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
