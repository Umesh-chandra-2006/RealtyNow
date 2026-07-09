"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Filter, Info, SlidersHorizontal, MapPin, BedDouble, Maximize2 } from "lucide-react";
import { SiteHeader } from "../../src/components/SiteHeader.next";
import { SiteFooter } from "../../src/components/SiteFooter.next";
import { VerifiedPill } from "../../src/components/VerifiedPill";
import { listings } from "../../src/data/listings";
import { cn, getImgSrc } from "../../src/lib/utils";

const cityOptions = ["All cities", "Mumbai", "Bengaluru", "Pune", "Hyderabad"] as const;
const typeOptions = ["All types", "Apartment", "Villa", "Penthouse", "Townhouse"] as const;
const bedroomOptions = ["Any", "2+", "3+", "4+"] as const;
const cadenceOptions = ["All", "Sale", "Rent"] as const;

export default function Browse() {
  const [city, setCity] = useState<(typeof cityOptions)[number]>("All cities");
  const [type, setType] = useState<(typeof typeOptions)[number]>("All types");
  const [beds, setBeds] = useState<(typeof bedroomOptions)[number]>("Any");
  const [cadence, setCadence] = useState<(typeof cadenceOptions)[number]>("All");
  const [sort, setSort] = useState<"newest" | "price-asc" | "price-desc">("newest");

  const filtered = useMemo(() => {
    let out = listings.filter((l) => {
      if (city !== "All cities" && l.city !== city) return false;
      if (type !== "All types" && l.propertyType !== type) return false;
      if (beds !== "Any") {
        const min = parseInt(beds, 10);
        if (l.bedrooms < min) return false;
      }
      if (cadence !== "All" && l.cadence !== cadence.toLowerCase()) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      return new Date(b.verifiedOn).getTime() - new Date(a.verifiedOn).getTime();
    });
    return out;
  }, [city, type, beds, cadence, sort]);

  return (
    <div className="min-h-screen bg-background pt-16">
      <SiteHeader />

      {/* Page header */}
      <section className="border-b border-border bg-surface">
        <div className="container-page py-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Properties
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-navy md:text-5xl">
            Explore verified listings
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Discover premium homes in prime localities. Every listing is thoroughly checked for authenticity.
          </p>
        </div>
      </section>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container-page flex flex-wrap items-center gap-3 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-navy">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Filters
          </div>
          <FilterSelect label="City" value={city} onChange={(v) => setCity(v as any)} options={cityOptions} />
          <FilterSelect label="Type" value={type} onChange={(v) => setType(v as any)} options={typeOptions} />
          <FilterSelect label="Bedrooms" value={beds} onChange={(v) => setBeds(v as any)} options={bedroomOptions} />
          <FilterSelect label="For" value={cadence} onChange={(v) => setCadence(v as any)} options={cadenceOptions} />

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-coral/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-coral md:inline-flex">
              <Info className="h-3.5 w-3.5" />
              Verified only · locked
            </span>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-navy focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="newest">Newest verified</option>
                <option value="price-asc">Price · low to high</option>
                <option value="price-desc">Price · high to low</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      <section className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
        <div>
          {filtered.length === 0 ? (
            <EmptyState onReset={() => {
              setCity("All cities");
              setType("All types");
              setBeds("Any");
              setCadence("All");
            }} />
          ) : (
            <ul className="space-y-5">
              {filtered.map((l, i) => (
                <li key={l.id} className="animate-fade-rise" style={{ animationDelay: `${i * 60}ms` }}>
                  <Link
                    href={`/listing/${l.id}`}
                    className="group grid grid-cols-1 gap-0 overflow-hidden rounded-2xl bg-card ring-1 ring-border transition-all hover:shadow-elevated md:grid-cols-[320px_1fr]"
                  >
                    <div className="relative aspect-[4/3] md:aspect-auto">
                      <img
                        src={getImgSrc(l.photo)}
                        alt={l.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                      <div className="absolute left-3 top-3">
                        <VerifiedPill variant="ghost" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 p-6">
                      <div className="space-y-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-xl font-semibold text-navy">
                            {l.title}
                          </h3>
                          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" /> {l.locality}, {l.city}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-2 pt-1">
                          <p className="font-display text-xl font-bold text-navy">
                            {l.priceLabel}
                          </p>
                          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            &middot; {l.propertyType} &middot; For {l.cadence}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {l.highlights.slice(0, 3).map((h: string) => (
                          <span
                            key={h}
                            className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground"
                          >
                            {h}
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto flex items-center gap-6 border-t border-border pt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <BedDouble className="h-3.5 w-3.5" /> {l.bedrooms} BHK
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Maximize2 className="h-3.5 w-3.5" /> {l.areaSqft} sqft
                        </span>
                        <span className="hidden sm:inline">{l.furnishing}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sticky sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-40 space-y-4">
            <div className="rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-border">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Verification standard
              </p>
              <h3 className="mt-3 font-display text-xl font-semibold">
                Why you don&rsquo;t see &ldquo;pending&rdquo; listings here
              </h3>
              <p className="mt-3 text-sm text-muted-foreground">
                A listing has to pass every check before we allow it into public search. No
                fainter badges, no half-visible inventory.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-foreground">
                {[
                  "RERA registration",
                  "Owner identity",
                  "Photo authenticity",
                  "Duplicate scan",
                ].map((c) => (
                  <li key={c} className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-coral text-coral-foreground text-[10px] font-bold">
                      ✓
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-surface p-6 ring-1 ring-border">
              <h4 className="font-display text-lg font-semibold text-navy">
                Save this search
              </h4>
              <p className="mt-2 text-sm text-muted-foreground">
                Get notified when a new verified home matching your filters goes live.
              </p>
              <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]">
                <Filter className="h-4 w-4" /> Save search
              </button>
            </div>
          </div>
        </aside>
      </section>

      <SiteFooter />
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-transparent font-medium text-navy focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl bg-card px-6 py-20 text-center ring-1 ring-border")}>
      <div className="grid h-14 w-14 place-items-center rounded-full bg-surface ring-1 ring-border">
        <MapPin className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-6 font-display text-2xl font-semibold text-navy">
        No verified homes match yet
      </h3>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        We only show homes that have finished verification. Try widening your city, budget, or
        bedroom filters — new listings clear the pipeline every day.
      </p>
      <button
        onClick={onReset}
        className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Reset filters
      </button>
    </div>
  );
}
