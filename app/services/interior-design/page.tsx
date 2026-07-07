"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/app/context/AuthContext";
import { submitInteriorConsultation } from "@/lib/actions";

export default function InteriorDesignPage() {
  const { user } = useAuth();
  const [bhkSize, setBhkSize] = useState("2");
  const [designStyle, setDesignStyle] = useState("modern");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Interior Cost Calculator Estimator
  const getInteriorEstimate = () => {
    let basePrice = 280000; // 1 BHK base Modern
    const factor = parseInt(bhkSize) || 1;

    if (designStyle === "luxury") {
      basePrice = 450000 * factor;
    } else if (designStyle === "scandinavian") {
      basePrice = 320000 * factor;
    } else if (designStyle === "industrial") {
      basePrice = 380000 * factor;
    } else {
      basePrice = 250000 * factor;
    }

    return basePrice.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  };

  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactPhone || !contactEmail) {
      alert("Please fill in your name, email, and phone number.");
      return;
    }
    
    setSubmitting(true);
    try {
      const buyerId = user ? user.id : "mock-user-uuid-123";
      await submitInteriorConsultation({
        buyer_id: buyerId,
        bhk_size: bhkSize,
        design_style: designStyle,
        name: contactName,
        phone: contactPhone,
        email: contactEmail,
        message: message || undefined,
        estimate: getInteriorEstimate()
      });
      setIsSuccess(true);
    } catch (err: any) {
      alert(`Consultation error: ${err.message || "Failed to submit consultation request"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="detail-page-main" style={{ padding: "120px 0 80px", background: "var(--bg)" }}>
      <div className="wrap" style={{ maxWidth: "1000px" }}>
        
        {/* Breadcrumbs */}
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: "20px", fontSize: "13px", color: "var(--muted-slate)" }}>
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Home</Link> /{" "}
          <Link href="/listings" style={{ color: "inherit", textDecoration: "none" }}>Listings</Link> /{" "}
          <span style={{ color: "var(--ink)" }}>Interior Design Studio</span>
        </nav>

        {/* Hero Banner */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Referral Fit-out Partner
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", color: "var(--ink)", marginTop: "8px", marginBottom: "12px" }}>
            RealtyNow Interior Design Studio
          </h1>
          <p style={{ fontSize: "1.05rem", color: "var(--muted-slate)", maxWidth: "600px", margin: "0 auto", lineHeight: "1.6" }}>
            Get customized high-end 3D room layouts, bespoke modular kitchen options, and materials estimates for your property.
          </p>
        </div>

        {/* Portfolio Showcase Grid */}
        <div style={{ marginBottom: "56px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: "700", marginBottom: "24px", color: "var(--ink)" }}>
            Bespoke Living Showcases
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            {[
              { title: "Biophilic Minimalist Living", desc: "Warm teak wood, living plant fixtures, concrete accents.", img: "/hero_house.webp" },
              { title: "Scandinavian Modular Kitchen", desc: "Flat-panel white oak cabinets, quartz countertops.", img: "/bengaluru.webp" },
              { title: "Industrial Loft Bedroom", desc: "Exposed brick wall backdrop, raw iron frame fixtures.", img: "/delhi.webp" }
            ].map((p, idx) => (
              <div key={idx} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.01)" }}>
                <div style={{ height: "160px", overflow: "hidden", position: "relative" }}>
                  <Image src={p.img} alt={p.title} fill style={{ objectFit: "cover" }} />
                </div>
                <div style={{ padding: "16px" }}>
                  <h3 style={{ fontSize: "14.5px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px" }}>{p.title}</h3>
                  <p style={{ fontSize: "12.5px", color: "var(--muted-slate)", margin: "0", lineHeight: "1.5" }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calculator and Quote Form Grid */}
        <div className="services-layout-grid">
          
          {/* Left Column: Interactive Estimator Tool */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "28px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>Fit-Out Cost Estimator</h2>
            <p style={{ fontSize: "13.5px", color: "var(--muted-slate)", marginBottom: "24px" }}>Select property configurations and layouts to compute standard material & labor estimate fees.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* BHK configuration selector */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "8px" }}>Property Layout</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["1", "2", "3", "4"].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBhkSize(b)}
                      style={{
                        flex: 1,
                        height: "42px",
                        borderRadius: "6px",
                        border: "1px solid",
                        borderColor: bhkSize === b ? "var(--accent)" : "var(--line)",
                        background: bhkSize === b ? "rgba(139, 0, 0, 0.04)" : "#FFFFFF",
                        color: bhkSize === b ? "var(--accent)" : "var(--ink)",
                        fontWeight: "700",
                        fontSize: "14px",
                        cursor: "pointer",
                        transition: "all 0.16s ease"
                      }}
                    >
                      {b} BHK
                    </button>
                  ))}
                </div>
              </div>

              {/* Design Style selector */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "8px" }}>Design Style Theme</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { id: "modern", label: "Modern Minimalist" },
                    { id: "luxury", label: "Luxury Royal Heritage" },
                    { id: "scandinavian", label: "Scandinavian Clean" },
                    { id: "industrial", label: "Industrial Loft" }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDesignStyle(s.id)}
                      style={{
                        height: "44px",
                        borderRadius: "6px",
                        border: "1px solid",
                        borderColor: designStyle === s.id ? "var(--accent)" : "var(--line)",
                        background: designStyle === s.id ? "rgba(139, 0, 0, 0.04)" : "#FFFFFF",
                        color: designStyle === s.id ? "var(--accent)" : "var(--ink)",
                        fontWeight: "600",
                        fontSize: "13.5px",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.16s ease"
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "16px 20px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase" }}>Estimated Quote Range</span>
                  <div style={{ fontSize: "1.7rem", fontWeight: "800", color: "var(--accent)", marginTop: "4px" }}>{getInteriorEstimate()}</div>
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted-slate)", textAlign: "right" }}>*Includes standard <br />modular fitting kits</span>
              </div>
            </div>
          </div>

          {/* Right Column: Lead Request Consultation Form */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "28px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "20px", color: "var(--ink)" }}>Request Consultation</h2>
            
            <form onSubmit={handleConsultSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "6px" }}>Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "13.5px", background: "#FFFFFF", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "6px" }}>Phone</label>
                <input
                  type="tel"
                  required
                  placeholder="Enter phone number"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "13.5px", background: "#FFFFFF", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "6px" }}>Email</label>
                <input
                  type="email"
                  required
                  placeholder="Enter email address"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "13.5px", background: "#FFFFFF", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "6px" }}>Property Location & Details (Optional)</label>
                <textarea
                  placeholder="e.g. 3 BHK in Whitefield, looking for clean Scandinavian styling..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{ width: "100%", height: "80px", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "13.5px", background: "#FFFFFF", outline: "none", resize: "none", fontFamily: "var(--font-body)" }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn--dark"
                style={{
                  width: "100%",
                  height: "46px",
                  background: submitting ? "var(--muted-slate)" : "var(--accent)",
                  border: "none",
                  borderRadius: "6px",
                  color: "#FFFFFF",
                  fontSize: "14.5px",
                  fontWeight: "700",
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background-color 0.2s ease"
                }}
              >
                {submitting ? "Submitting Request..." : "Schedule Free Consultation"}
              </button>
            </form>
          </div>

        </div>

      </div>

      {/* Success Dialog overlay */}
      {isSuccess && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10, 17, 40, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#FFFFFF", borderRadius: "12px", padding: "32px", maxWidth: "420px", width: "90%", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)" }}>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "16px" }}>📐</span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: "700", color: "var(--ink)", marginBottom: "8px" }}>Consultation Booked!</h3>
            <p style={{ fontSize: "14px", color: "var(--muted-slate)", lineHeight: "1.6", marginBottom: "24px" }}>
              Thank you, <strong>{contactName}</strong>! Your request for modular fit-out design consulting has been registered. An interior architect will email you at <strong>{contactEmail}</strong> and contact you to schedule a site measurement slot shortly.
            </p>
            <button
              onClick={() => setIsSuccess(false)}
              className="btn btn--dark"
              style={{ padding: "10px 24px", background: "var(--accent)", color: "#FFFFFF", border: "none", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}
            >
              Back to Showroom
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
