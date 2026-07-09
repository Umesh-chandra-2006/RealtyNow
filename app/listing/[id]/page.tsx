"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  BedDouble,
  Bath,
  Maximize2,
  Phone,
  MessageCircle,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { SiteHeader } from "../../../src/components/SiteHeader.next";
import { SiteFooter } from "../../../src/components/SiteFooter.next";
import { VerifiedPill } from "../../../src/components/VerifiedPill";
import { VerificationChecklist } from "../../../src/components/VerificationChecklist";
import { getImgSrc } from "../../../src/lib/utils";
import { findListing } from "../../../src/data/listings";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listing = findListing(resolvedParams.id);

  if (!listing) {
    notFound();
  }

  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background pt-16">
      <SiteHeader />

      <div className="container-page py-6">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Link>
      </div>

      {/* Hero gallery */}
      <section className="container-page">
        <div className="grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-3xl md:h-[480px]">
          <div className="relative col-span-4 row-span-2 md:col-span-3">
            <img
              src={getImgSrc(listing.photo)}
              alt={listing.title}
              width={1200}
              height={900}
              className="h-full w-full object-cover"
            />
            <div className="absolute left-4 top-4">
              <VerifiedPill variant="ghost" />
            </div>
          </div>
          <div className="hidden md:block">
            <img src={getImgSrc(listing.photo)} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="hidden md:block">
            <img src={getImgSrc(listing.photo)} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Main body */}
      <section className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          {/* Title block */}
          <header>
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span className="rounded-full bg-surface px-3 py-1 font-semibold text-navy">
                {listing.propertyType}
              </span>
              <span>For {listing.cadence === "rent" ? "rent" : "sale"}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {listing.locality}, {listing.city}
              </span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold text-navy md:text-5xl">
              {listing.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
              <p className="font-display text-4xl font-bold text-navy">{listing.priceLabel}</p>
              <div className="flex items-center gap-5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4" /> {listing.bedrooms} BHK
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bath className="h-4 w-4" /> {listing.bathrooms} baths
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Maximize2 className="h-4 w-4" /> {listing.areaSqft} sqft
                </span>
              </div>
            </div>
          </header>

          {/* Description */}
          <section>
            <h2 className="font-display text-2xl font-semibold text-navy">About this home</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {listing.description}
            </p>
          </section>

          {/* Highlights */}
          <section>
            <h2 className="font-display text-2xl font-semibold text-navy">Highlights</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {listing.highlights.map((h: string) => (
                <li
                  key={h}
                  className="flex items-start gap-3 rounded-xl bg-surface p-4 ring-1 ring-border"
                >
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-navy">{h}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Verification */}
          <VerificationChecklist checks={listing.checks} reraState={listing.reraState} />

          {/* Meta */}
          <section className="rounded-2xl bg-surface p-6 ring-1 ring-border">
            <div className="grid gap-6 sm:grid-cols-3">
              <Meta label="RERA number" value={listing.reraNumber} />
              <Meta label="Furnishing" value={listing.furnishing} />
              <Meta
                label="Verified on"
                value={new Date(listing.verifiedOn).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
            </div>
          </section>
        </div>

        {/* Sticky contact rail */}
        <aside>
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl bg-card p-6 shadow-card ring-1 ring-border">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-display text-lg font-semibold text-primary">
                  {listing.owner.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Listed by owner
                  </p>
                  <p className="font-display text-lg font-semibold text-navy">
                    {listing.owner.name}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-surface p-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-semibold text-coral">
                  <ShieldCheck className="h-3.5 w-3.5" /> Identity verified
                </span>
                {" · "}
                Owner on RealtyNow since {listing.owner.joinedYear}
              </div>

              <button
                onClick={() => setContactOpen(true)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
              >
                <Phone className="h-4 w-4" /> Contact owner
              </button>
              <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-surface px-4 py-3 text-sm font-semibold text-navy ring-1 ring-border transition-colors hover:bg-accent">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Contact is only enabled after verification. No forwarded broker leads.
              </p>
            </div>

            <div className="rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-border">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Trust note
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                If anything about this listing changes — price, RERA status, ownership — we
                re-run the checks. If any fail, the listing is pulled the same day.
              </p>
            </div>
          </div>
        </aside>
      </section>

      {contactOpen && (
        <ContactSheet
          ownerName={listing.owner.name}
          onClose={() => setContactOpen(false)}
        />
      )}

      <SiteFooter />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-base font-semibold text-navy">{value}</p>
    </div>
  );
}

function ContactSheet({
  ownerName,
  onClose,
}: {
  ownerName: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-[#0B1020]/50 backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-elevated sm:rounded-3xl animate-fade-rise"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Contact
        </p>
        <h3 className="mt-2 font-display text-2xl font-semibold text-navy">
          Message {ownerName}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell the owner a bit about you and when you&rsquo;d like to visit. They&rsquo;ll get
          your message directly — no broker in between.
        </p>
        <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); onClose(); }}>
          <input
            className="w-full rounded-xl bg-surface px-4 py-3 text-sm text-navy focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Your full name"
            required
          />
          <input
            type="tel"
            className="w-full rounded-xl bg-surface px-4 py-3 text-sm text-navy focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Phone number (we&rsquo;ll verify with OTP)"
            required
          />
          <textarea
            rows={3}
            className="w-full resize-none rounded-xl bg-surface px-4 py-3 text-sm text-navy focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="I&rsquo;d like to visit this weekend..."
          />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            Send message
          </button>
        </form>
      </div>
    </div>
  );
}
