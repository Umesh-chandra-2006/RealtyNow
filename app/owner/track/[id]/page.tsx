"use client";

import React, { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, AlertTriangle, Clock, Eye } from "lucide-react";
import { findListing } from "../../../../src/data/listings";
import { VerifiedPill } from "../../../../src/components/VerifiedPill";
import { cn, getImgSrc } from "../../../../src/lib/utils";

type TimelineState = "done" | "active" | "todo" | "warn";

type TimelineRow = {
  label: string;
  detail: string;
  time: string;
  state: TimelineState;
};

export default function TrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listing = findListing(resolvedParams.id);

  if (!listing) {
    notFound();
  }

  const timeline: TimelineRow[] = [
    {
      label: "Submitted",
      detail: "Property details, photos and documents received.",
      time: "Day 1 · 09:14",
      state: "done",
    },
    {
      label: "RERA lookup — " + listing.reraState + " portal",
      detail: "Registration number confirmed against project name and validity.",
      time: "Day 1 · 11:02",
      state: "done",
    },
    {
      label: "Owner identity",
      detail: "Phone OTP verified. Government ID reviewed and matched.",
      time: "Day 1 · 14:38",
      state: "done",
    },
    {
      label: "Photo authenticity + duplicate scan",
      detail: "EXIF data checked on every image. Perceptual hash cleared against the platform.",
      time: "Day 2 · 08:20",
      state: "done",
    },
    {
      label: "Public listing activated",
      detail: "Your home is now visible in verified search results.",
      time: "Day 2 · 08:22",
      state: "active",
    },
  ];

  const doneCount = timeline.filter((t) => t.state === "done").length;
  const total = timeline.length;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="container-page py-10">
          <Link
            href="/owner"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Owner portal
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Verification tracker
              </p>
              <h1 className="mt-2 font-display text-4xl font-semibold text-navy md:text-5xl">
                {listing.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {listing.locality}, {listing.city} · {listing.propertyType} · {listing.priceLabel}
              </p>
            </div>
            <VerifiedPill />
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <Stat
              icon={Check}
              label="Steps complete"
              value={`${doneCount} / ${total}`}
              tint="coral"
            />
            <Stat icon={Clock} label="Elapsed" value="1d 3h" tint="primary" />
            <Stat icon={Eye} label="Visibility" value="Public search" tint="primary" />
            <Stat icon={AlertTriangle} label="Attention needed" value="None" tint="muted" />
          </div>
        </div>
      </section>

      <section className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-6 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Pipeline
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-navy">{pct}%</span> complete
            </p>
          </div>
          <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>

          <ol className="relative">
            {timeline.map((row, i, arr) => (
              <li key={row.label} className="grid grid-cols-[32px_1fr] gap-4 pb-8">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full text-xs font-bold",
                      row.state === "done" && "bg-coral text-coral-foreground",
                      row.state === "active" &&
                        "bg-primary text-primary-foreground ring-4 ring-primary/15",
                      row.state === "todo" && "bg-white ring-1 ring-border text-muted-foreground",
                      row.state === "warn" && "bg-destructive text-destructive-foreground",
                    )}
                  >
                    {row.state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  </span>
                  {i < arr.length - 1 && <span className="mt-2 flex-1 w-px bg-border" />}
                </div>
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-lg font-semibold text-navy">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.time}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside>
          <div className="sticky top-24 space-y-4">
            <div className="overflow-hidden rounded-2xl ring-1 ring-border">
              <img src={getImgSrc(listing.photo)} alt="" className="h-48 w-full object-cover" />
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Listing</p>
                <p className="mt-1 font-display text-base font-semibold text-navy">
                  {listing.title}
                </p>
                <Link
                  href={`/listing/${listing.id}`}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  View public listing
                </Link>
              </div>
            </div>
            <div className="rounded-2xl bg-card p-5 text-card-foreground ring-1 ring-border">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                If a check ever fails
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                We&rsquo;ll tell you exactly what to fix. Specific and human — e.g. &ldquo;photo
                timestamp older than 12 months, please re-upload.&rdquo; Not a generic error.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: any;
  label: string;
  value: string;
  tint: "coral" | "primary" | "muted";
}) {
  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg",
          tint === "coral" && "bg-coral/12 text-coral",
          tint === "primary" && "bg-primary/10 text-primary",
          tint === "muted" && "bg-surface text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold text-navy">{value}</p>
    </div>
  );
}
