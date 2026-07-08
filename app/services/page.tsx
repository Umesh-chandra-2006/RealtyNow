"use client";

import React from "react";
import Link from "next/link";
import Footer from "../components/Footer";

const SERVICES_LIST = [
  {
    id: "kaam-kaaka",
    title: "Kaam Kaaka Legal Audits",
    description: "Multi-point deed searches, ownership chains check, RERA certificate matchings, and property inspection audits.",
    icon: "🛡️",
    link: "/services/kaam-kaaka",
    actionText: "Verify Property &rarr;",
    badge: "Most Popular",
  },
  {
    id: "interior-design",
    title: "Premium Interior Styling",
    description: "Consult with award-winning design experts. Fully simulated 3D blueprints, custom modular styling, and premium handovers.",
    icon: "🎨",
    link: "/services/interior-design",
    actionText: "Get Free Consult &rarr;",
    badge: "Expert Curation",
  },
  {
    id: "financials",
    title: "RealtyNow Financials",
    description: "Direct bank pre-approvals, low-interest home loans, tax optimization guides, and real-time EMI interest calculators.",
    icon: "💳",
    link: "/contact?inquiry=home-loan",
    actionText: "Check Eligibility &rarr;",
    badge: "Direct Partners",
  },
  {
    id: "digidraft",
    title: "DigiDraft Lease Builder",
    description: "Instant digital rental agreements, lease deeds drafts, online notary verifications, and digital signature signs.",
    icon: "📝",
    link: "/contact?inquiry=lease-draft",
    actionText: "Build Draft Now &rarr;",
    badge: "10-Min Setup",
  },
];

export default function ServicesIndex() {
  return (
    <main className="detail-page-main" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Aurora Ambient Lighting Backdrop */}
      <div className="aurora-container" style={{ position: "absolute", width: "100%", height: "450px", overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
        <div className="aurora-glow aurora-glow--navy" style={{ top: "-10%", right: "10%", opacity: 0.15 }}></div>
        <div className="aurora-glow aurora-glow--crimson" style={{ bottom: "-10%", left: "5%", opacity: 0.1 }}></div>
      </div>

      <section className="section" style={{ position: "relative", zIndex: 1, flex: 1, padding: "120px 0 80px" }}>
        <div className="wrap">
          {/* Page Head */}
          <div className="section-head reveal-scroll" style={{ marginBottom: "50px", textAlign: "center" }}>
            <span className="section-num mono section-num--accent">04 / Services</span>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "3rem", fontWeight: "800", color: "#FFFFFF", marginTop: "12px", marginBottom: "16px" }}>
              Tailored Real Estate <span className="hero__title-accent">Services</span>
            </h1>
            <p className="section-head__desc" style={{ maxWidth: "600px", margin: "0 auto" }}>
              From legal validation checkpoints and design consults to loans, we facilitate a safe, end-to-end transaction journey.
            </p>
          </div>

          {/* Services Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px" }}>
            {SERVICES_LIST.map((service) => (
              <article 
                key={service.id}
                className="project-card sheen-glow gradient-border"
                style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  justifyContent: "space-between", 
                  backgroundColor: "var(--surface)", 
                  padding: "32px",
                  borderRadius: "var(--radius-lg)",
                  minHeight: "340px",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <span style={{ fontSize: "2.5rem" }} role="img" aria-label={service.title}>{service.icon}</span>
                    {service.badge && (
                      <span className="project-card__badge" style={{ position: "static", transform: "none", fontSize: "10px", fontWeight: "700" }}>
                        {service.badge}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: "700", color: "#FFFFFF", marginBottom: "12px" }}>
                    {service.title}
                  </h3>
                  <p style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--muted-slate)", marginBottom: "24px" }}>
                    {service.description}
                  </p>
                </div>
                <div>
                  <Link 
                    href={service.link}
                    className="see-all see-all--accent"
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "14.5px" }}
                  >
                    <span dangerouslySetInnerHTML={{ __html: service.actionText }} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
