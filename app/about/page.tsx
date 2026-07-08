"use client";

import React from "react";
import Footer from "../components/Footer";

const STATS_LIST = [
  { value: "0%", label: "Brokerage Ever Paid", desc: "No middleman cuts or listing premiums." },
  { value: "50,000+", label: "Verified Listings", desc: "Direct owner listings across 5 metro markets." },
  { value: "100%", label: "RERA Validated", desc: "Every apartment/villa cross-matched to registers." },
  { value: "12 Days", label: "Avg. Closure Time", desc: "Fast matching with direct legal support." },
];

const ADVISORS = [
  { name: "Justice R. Subramaniam", role: "Chief Legal Advisor (RERA Expert)", bio: "Former High Court counsel, specializing in land title trace audits and RERA regulations." },
  { name: "Devika Sen", role: "Principal Design Architect", bio: "Award-winning designer with 15+ years of experience structuring luxury interior space simulations." },
  { name: "Aarav Mehra", role: "Head of Verification Operations", bio: "Leads our on-site inspection teams and Kaam Kaaka structural checklist verifications." },
];

export default function AboutPage() {
  return (
    <main className="detail-page-main" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Background Ambience */}
      <div className="aurora-container" style={{ position: "absolute", width: "100%", height: "550px", overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
        <div className="aurora-glow aurora-glow--navy" style={{ top: "-10%", right: "15%", opacity: 0.18 }}></div>
        <div className="aurora-glow aurora-glow--crimson" style={{ bottom: "-10%", left: "5%", opacity: 0.15 }}></div>
      </div>

      <section className="section" style={{ position: "relative", zIndex: 1, flex: 1, padding: "120px 0 80px" }}>
        <div className="wrap" style={{ maxWidth: "900px" }}>
          
          {/* Header */}
          <div style={{ marginBottom: "60px", textAlign: "center" }}>
            <span className="section-num mono section-num--accent">05 / Company</span>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "3.5rem", fontWeight: "800", color: "#FFFFFF", marginTop: "16px", marginBottom: "20px" }}>
              Our Mission for <span className="hero__title-accent">Transparency</span>
            </h1>
            <p style={{ fontSize: "19px", lineHeight: "1.7", color: "var(--muted-slate)", maxWidth: "720px", margin: "0 auto" }}>
              We started RealtyNow with a simple belief: finding a home should be direct, transparent, and absolutely brokerage-free.
            </p>
          </div>

          {/* Metrics Section */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "60px" }}>
            {STATS_LIST.map((stat, idx) => (
              <div 
                key={idx} 
                className="project-card sheen-glow gradient-border" 
                style={{ 
                  padding: "24px", 
                  borderRadius: "var(--radius-md)", 
                  backgroundColor: "var(--surface)", 
                  textAlign: "center" 
                }}
              >
                <div style={{ fontSize: "2.2rem", fontWeight: "800", color: "var(--accent)", marginBottom: "6px" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#FFFFFF", marginBottom: "4px" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted-slate)" }}>
                  {stat.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Details Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: "50px", color: "var(--muted-slate)", fontSize: "16px", lineHeight: "1.8", marginBottom: "60px" }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: "700", color: "#FFFFFF", marginBottom: "16px" }}>
                What Makes Us Different
              </h2>
              <p>
                Traditional real estate platforms are plagued by middleman loops, phantom listings, and spam calls. RealtyNow replaces this layout entirely by facilitating a **100% direct owner-to-buyer workspace** backed by detailed legal verifications.
              </p>
            </div>

            {/* Core Values Bento Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
              <div className="project-card sheen-glow gradient-border" style={{ padding: "30px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--surface)" }}>
                <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "16px" }}>🚫</span>
                <h3 style={{ fontSize: "19px", fontWeight: "700", color: "#FFFFFF", marginBottom: "10px" }}>Zero Brokerage Policy</h3>
                <p style={{ fontSize: "13.5px" }}>No commission splits, hidden costs, or listing premiums. Pay exactly what the owner demands, nothing more.</p>
              </div>
              <div className="project-card sheen-glow gradient-border" style={{ padding: "30px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--surface)" }}>
                <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "16px" }}>🛡️</span>
                <h3 style={{ fontSize: "19px", fontWeight: "700", color: "#FFFFFF", marginBottom: "10px" }}>RERA Verification</h3>
                <p style={{ fontSize: "13.5px" }}>Every single apartment listing is cross-checked against state RERA registration databases before going live.</p>
              </div>
              <div className="project-card sheen-glow gradient-border" style={{ padding: "30px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--surface)" }}>
                <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "16px" }}>🤝</span>
                <h3 style={{ fontSize: "19px", fontWeight: "700", color: "#FFFFFF", marginBottom: "10px" }}>Direct Chat Channels</h3>
                <p style={{ fontSize: "13.5px" }}>Communicate instantly with real property owners via secure channels and coordinates checks.</p>
              </div>
            </div>

            {/* Advisors Spotlight */}
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: "700", color: "#FFFFFF", marginBottom: "16px", marginTop: "10px" }}>
                Advisory Council & Leadership
              </h2>
              <p style={{ marginBottom: "30px" }}>
                Our operations are guided by senior legal counsels, architects, and technical safety experts to safeguard every step of your real estate transaction.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {ADVISORS.map((advisor, idx) => (
                  <div 
                    key={idx} 
                    className="project-card sheen-glow gradient-border" 
                    style={{ 
                      padding: "24px", 
                      borderRadius: "var(--radius-md)", 
                      backgroundColor: "var(--surface)" 
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "6px" }}>
                      <strong style={{ color: "#FFFFFF", fontSize: "16.5px" }}>{advisor.name}</strong>
                      <span style={{ color: "var(--accent)", fontSize: "13px", fontWeight: "600" }}>{advisor.role}</span>
                    </div>
                    <p style={{ fontSize: "13.5px", margin: 0 }}>{advisor.bio}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: "700", color: "#FFFFFF", marginBottom: "16px" }}>
                Our Vision
              </h2>
              <p>
                By building trust-first search directories, verified micro-market price appreciations tracking, and robust legal verifications support (such as our Kaam Kaaka team), we are structuring a premium digital transaction ecosystem that respects the homebuyer's capital and time.
              </p>
            </div>
          </div>

        </div>
      </section>

      <Footer />
    </main>
  );
}
