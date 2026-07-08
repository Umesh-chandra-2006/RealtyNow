import Link from "next/link";
import { MapPin, BedDouble, Bath, Maximize2 } from "lucide-react";
import { VerifiedPill } from "./VerifiedPill";
import type { Listing } from "../data/listings";
import { cn, getImgSrc } from "../lib/utils";

export function ListingCard({
  listing,
  index = 0,
  className,
}: {
  listing: Listing;
  index?: number;
  className?: string;
}) {
  return (
    <Link
      href={`/listing/${listing.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated animate-fade-rise",
        className,
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={getImgSrc(listing.photo)}
          alt={listing.title}
          loading="lazy"
          width={1200}
          height={900}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/50 via-navy/0 to-transparent opacity-70" />
        <div className="absolute left-3 top-3">
          <VerifiedPill variant="ghost" />
        </div>
        <div className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy shadow-crisp">
          For {listing.cadence === "rent" ? "rent" : "sale"}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-navy">
              {listing.title}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {listing.locality}, {listing.city}
              </span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-bold text-navy">{listing.priceLabel}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {listing.propertyType}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-4 border-t border-border pt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-3.5 w-3.5" /> {listing.bedrooms} BHK
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bath className="h-3.5 w-3.5" /> {listing.bathrooms}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Maximize2 className="h-3.5 w-3.5" /> {listing.areaSqft} sqft
          </span>
        </div>
      </div>
    </Link>
  );
}
