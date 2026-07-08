import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { VerificationCheck } from "@/data/listings";
import { cn } from "@/lib/utils";

export function VerificationChecklist({
  checks,
  reraState,
}: {
  checks: VerificationCheck[];
  reraState: string;
}) {
  const [open, setOpen] = useState<string | null>(checks[0]?.key ?? null);
  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-border">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">
            Verification
          </p>
          <h3 className="mt-1 font-display text-2xl font-semibold text-navy">
            {checks.length} of {checks.length} checks passed
          </h3>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            RERA portal
          </p>
          <p className="font-display text-sm font-semibold text-navy">{reraState}</p>
        </div>
      </header>
      <ul className="divide-y divide-border">
        {checks.map((check) => {
          const isOpen = open === check.key;
          return (
            <li key={check.key}>
              <button
                onClick={() => setOpen(isOpen ? null : check.key)}
                className="flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-surface"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral text-coral-foreground">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold text-navy">
                    {check.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {check.method} · Passed{" "}
                    {new Date(check.passedOn).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen && (
                <div className="px-6 pb-6 pl-[76px] text-sm leading-relaxed text-muted-foreground animate-fade-rise">
                  {check.detail}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <footer className="border-t border-border bg-surface px-6 py-4 text-[11px] text-muted-foreground">
        Every listing is re-checked when key details change. If a check ever fails, the listing
        is pulled from public search the same day.
      </footer>
    </section>
  );
}
