"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Upload, ShieldCheck } from "lucide-react";
import { cn } from "../../../src/lib/utils";

const steps = [
  { key: "details", label: "Property details" },
  { key: "photos", label: "Photos" },
  { key: "rera", label: "RERA & documents" },
  { key: "identity", label: "Identity" },
] as const;

export default function Submit() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  return (
    <section className="container-page py-16 md:py-20">
      <Link
        href="/owner"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to owner portal
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[280px_1fr]">
        {/* Stepper */}
        <aside>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Submission
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-navy">Add your property</h1>
          <ol className="mt-8 space-y-4">
            {steps.map((s, i) => {
              const state = done || i < step ? "done" : i === step ? "active" : "todo";
              return (
                <li key={s.key} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ring-1",
                      state === "done"
                        ? "bg-coral text-coral-foreground ring-coral"
                        : state === "active"
                          ? "bg-primary text-primary-foreground ring-primary"
                          : "bg-surface text-muted-foreground ring-border",
                    )}
                  >
                    {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <div className="pt-1">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        state === "todo" ? "text-muted-foreground" : "text-navy",
                      )}
                    >
                      {s.label}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-10 rounded-2xl bg-surface p-5 ring-1 ring-border">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-navy">
              What happens next
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Once you submit, checks kick off within minutes. You&rsquo;ll be able to track every
              step from the owner portal.
            </p>
          </div>
        </aside>

        {/* Form panel */}
        <div className="rounded-3xl bg-card p-8 ring-1 ring-border md:p-10">
          {done ? <Success /> : renderStep(step, setStep, setDone)}
        </div>
      </div>
    </section>
  );
}

function renderStep(step: number, setStep: (n: number) => void, setDone: (v: boolean) => void) {
  const next = () => {
    if (step === 3) setDone(true);
    else setStep(step + 1);
  };
  const prev = () => setStep(Math.max(0, step - 1));

  const StepShell = ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
      className="animate-fade-rise"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Step {step + 1} of 4
      </p>
      <h2 className="mt-2 font-display text-3xl font-semibold text-navy">{title}</h2>
      <p className="mt-2 text-muted-foreground">{subtitle}</p>
      <div className="mt-8 space-y-5">{children}</div>
      <div className="mt-10 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          disabled={step === 0}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          {step === 3 ? "Submit for verification" : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );

  if (step === 0)
    return (
      <StepShell
        title="Tell us about the property"
        subtitle="The basics. You can always edit these before verification kicks off."
      >
        <Field label="Listing title">
          <input className={fieldCls} placeholder="e.g. Sunlit two-storey loft on Pali Hill" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City">
            <select className={fieldCls}>
              <option>Mumbai</option>
              <option>Bengaluru</option>
              <option>Pune</option>
              <option>Hyderabad</option>
            </select>
          </Field>
          <Field label="Locality">
            <input className={fieldCls} placeholder="Bandra West" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Type">
            <select className={fieldCls}>
              <option>Apartment</option>
              <option>Villa</option>
              <option>Penthouse</option>
              <option>Townhouse</option>
            </select>
          </Field>
          <Field label="Bedrooms">
            <select className={fieldCls}>
              <option>1</option>
              <option>2</option>
              <option>3</option>
              <option>4+</option>
            </select>
          </Field>
          <Field label="Price (₹)">
            <input className={fieldCls} placeholder="21000000" />
          </Field>
        </div>
      </StepShell>
    );

  if (step === 1)
    return (
      <StepShell
        title="Upload photos"
        subtitle="At least six shots, taken within the last 12 months. We keep EXIF data intact for the authenticity check."
      >
        <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface px-6 py-14 text-center transition-colors hover:border-primary hover:bg-accent cursor-pointer">
          <Upload className="h-8 w-8 text-primary" />
          <p className="mt-3 font-display text-lg font-semibold text-navy">Drop photos here</p>
          <p className="mt-1 text-sm text-muted-foreground">JPEG or PNG · Up to 12 MB each</p>
          <input type="file" accept="image/*" multiple className="hidden" />
        </label>
      </StepShell>
    );

  if (step === 2)
    return (
      <StepShell
        title="RERA and documents"
        subtitle="We&rsquo;ll match your registration number against the relevant state RERA portal. Manual, honest — no automated API claims."
      >
        <Field label="RERA registration number">
          <input className={fieldCls} placeholder="P51800032981" />
        </Field>
        <Field label="RERA state">
          <select className={fieldCls}>
            <option>Maharashtra</option>
            <option>Karnataka</option>
            <option>Telangana</option>
            <option>Tamil Nadu</option>
          </select>
        </Field>
        <Field label="Screenshot of state RERA portal listing page">
          <label className="flex cursor-pointer items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm text-muted-foreground ring-1 ring-border hover:bg-accent">
            <span>Upload PDF or image</span>
            <Upload className="h-4 w-4" />
            <input type="file" className="hidden" />
          </label>
        </Field>
      </StepShell>
    );

  return (
    <StepShell
      title="Confirm your identity"
      subtitle="Phone OTP plus a government-issued ID reviewed by a human. We never share your ID with buyers or brokers."
    >
      <Field label="Phone number">
        <input className={fieldCls} placeholder="+91 98765 43210" />
      </Field>
      <Field label="ID type">
        <select className={fieldCls}>
          <option>Aadhaar</option>
          <option>PAN</option>
        </select>
      </Field>
      <Field label="Upload ID (image or PDF)">
        <label className="flex cursor-pointer items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm text-muted-foreground ring-1 ring-border hover:bg-accent">
          <span>Choose file</span>
          <Upload className="h-4 w-4" />
          <input type="file" className="hidden" />
        </label>
      </Field>
    </StepShell>
  );
}

const fieldCls =
  "w-full rounded-xl bg-surface px-4 py-3 text-sm text-navy ring-1 ring-transparent focus:outline-none focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Success() {
  return (
    <div className="animate-fade-rise text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-coral text-coral-foreground">
        <Check className="h-6 w-6" strokeWidth={3} />
      </span>
      <h2 className="mt-6 font-display text-3xl font-semibold text-navy">
        Submitted. Checks are running.
      </h2>
      <p className="mt-3 max-w-md text-muted-foreground mx-auto">
        You&rsquo;ll get an update on every step. Most listings finish verification in under 48
        hours.
      </p>
      <Link
        href="/owner/track/bandra-loft"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        Open the tracker
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
