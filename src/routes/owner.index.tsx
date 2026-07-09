import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Clock, Eye, FileText } from "lucide-react";
import { VerifiedPill } from "@/components/VerifiedPill";

export const Route = createFileRoute("/owner/")({
  head: () => ({
    meta: [
      { title: "Owner portal · RealtyNow" },
      {
        name: "description",
        content:
          "List your property directly on RealtyNow. Track your listing through every verification step, from documents received to live in search.",
      },
      { property: "og:title", content: "Owner portal · RealtyNow" },
      {
        property: "og:description",
        content:
          "Submit a listing and watch every verification check happen in the open. No broker in between.",
      },
    ],
  }),
  component: OwnerHome,
});

function OwnerHome() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_1fr] md:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Owner portal
            </p>
            <h1 className="mt-3 font-display text-5xl font-semibold leading-tight text-navy md:text-6xl">
              List your property.
              <br />
              <span className="text-primary">Watch every check happen.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Submit through a four-step flow that mirrors the verification pipeline itself.
              No hidden queue, no black-box status. If a check needs your attention,
              we&rsquo;ll tell you exactly what and why.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/owner/submit"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Start a listing
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/owner/track/$id"
                params={{ id: "bandra-loft" }}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20"
              >
                See a sample tracker
              </Link>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Clock, label: "Verified in", value: "<48 hours" },
                { icon: Eye, label: "Pipeline visibility", value: "Live" },
                { icon: ShieldCheck, label: "Listing fee", value: "Free" },
              ].map((s) => (
                <li
                  key={s.label}
                  className="rounded-2xl bg-card p-5 ring-1 ring-border"
                >
                  <s.icon className="h-5 w-5 text-primary" />
                  <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold text-navy">
                    {s.value}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Sample tracker card */}
          <div className="rounded-3xl bg-card p-8 text-card-foreground ring-1 ring-border shadow-elevated">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Sample pipeline
              </span>
              <VerifiedPill />
            </div>
            <h3 className="mt-4 font-display text-2xl font-semibold text-foreground">
              Sunlit two-storey loft, Bandra
            </h3>
            <p className="text-sm text-muted-foreground">Submitted 3 days ago</p>
            <div className="mt-8 space-y-5">
              {[
                { label: "Documents received", status: "Done", time: "Jun 11" },
                { label: "RERA lookup — MahaRERA", status: "Done", time: "Jun 12" },
                { label: "Owner identity", status: "Done", time: "Jun 13" },
                { label: "Photo authenticity + duplicate scan", status: "Done", time: "Jun 14" },
                { label: "Public listing activated", status: "Done", time: "Jun 14" },
              ].map((row, i, arr) => (
                <div key={row.label} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-coral text-coral-foreground text-[10px] font-bold">
                      ✓
                    </span>
                    {i < arr.length - 1 && (
                      <span className="mt-1 h-8 w-px bg-border" />
                    )}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            What you upload
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-navy md:text-5xl">
            Four short steps. Nothing you don&rsquo;t need.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {[
            { t: "Property details", d: "Address, size, price, bedrooms." },
            { t: "Photos", d: "At least six recent shots. EXIF preserved." },
            { t: "RERA & documents", d: "Registration number and portal screenshot." },
            { t: "Identity", d: "Phone OTP and a government ID." },
          ].map((s, i) => (
            <div
              key={s.t}
              className="rounded-2xl bg-surface p-6 ring-1 ring-border"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Step {i + 1}
              </span>
              <div className="mt-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-semibold text-navy">{s.t}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
