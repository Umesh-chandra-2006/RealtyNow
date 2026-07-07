"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { submitServiceBooking } from "@/lib/actions";

export default function KaamKaakaPage() {
  const { user } = useAuth();
  const [selectedService, setSelectedService] = useState("movers");
  const [bhkSize, setBhkSize] = useState("2");
  const [movingFrom, setMovingFrom] = useState("");
  const [movingTo, setMovingTo] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Estimates calculator
  const calculateEstimate = () => {
    let base = 2500;
    const factor = parseInt(bhkSize) || 1;
    if (selectedService === "movers") {
      base = 4500 + factor * 2000;
    } else if (selectedService === "cleaning") {
      base = 1800 + factor * 900;
    } else if (selectedService === "painting") {
      base = 8000 + factor * 5000;
    } else {
      base = 450 * factor;
    }
    return base.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactPhone || !bookingDate) {
      alert("Please fill in all contact and schedule details.");
      return;
    }
    
    setSubmitting(true);
    try {
      const buyerId = user ? user.id : "mock-user-uuid-123";
      await submitServiceBooking({
        buyer_id: buyerId,
        service_type: selectedService,
        bhk_size: bhkSize,
        moving_from: movingFrom || undefined,
        moving_to: movingTo || undefined,
        name: contactName,
        phone: contactPhone,
        preferred_date: bookingDate,
        estimate: calculateEstimate()
      });
      setIsSuccess(true);
    } catch (err: any) {
      alert(`Booking error: ${err.message || "Failed to submit booking"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="detail-page-main" style={{ padding: "120px 0 80px", background: "var(--bg)" }}>
      <div className="wrap" style={{ maxWidth: "900px" }}>
        
        {/* Breadcrumbs */}
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: "20px", fontSize: "13px", color: "var(--muted-slate)" }}>
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Home</Link> /{" "}
          <Link href="/listings" style={{ color: "inherit", textDecoration: "none" }}>Listings</Link> /{" "}
          <span style={{ color: "var(--ink)" }}>Kaam Kaaka Services</span>
        </nav>

        {/* Hero Banner */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Ecosystem Partner Integration
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.5rem", color: "var(--ink)", marginTop: "8px", marginBottom: "12px" }}>
            Kaam Kaaka Home Services
          </h1>
          <p style={{ fontSize: "1.05rem", color: "var(--muted-slate)", maxWidth: "600px", margin: "0 auto", lineHeight: "1.6" }}>
            Get verified packers & movers, deep cleaning, professional painters, and plumbers scheduled for your new home instantly.
          </p>
        </div>

        {/* Layout Grid */}
        <div className="services-layout-grid--kaam-kaaka">
          
          {/* Left Column: Select Service & Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Service Selection */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "20px" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "700", marginBottom: "16px", color: "var(--ink)" }}>1. Select Service</h2>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { id: "movers", label: "Packers & Movers", icon: "📦" },
                  { id: "cleaning", label: "Deep House Cleaning", icon: "✨" },
                  { id: "painting", label: "Professional Painting", icon: "🎨" },
                  { id: "handyman", label: "Plumbing & Electrical", icon: "🛠️" }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedService(s.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      border: "1px solid",
                      borderColor: selectedService === s.id ? "var(--accent)" : "var(--line)",
                      background: selectedService === s.id ? "rgba(139, 0, 0, 0.04)" : "#FFFFFF",
                      color: selectedService === s.id ? "var(--accent)" : "var(--ink)",
                      fontSize: "14px",
                      fontWeight: "600",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.16s ease"
                    }}
                  >
                    <span style={{ fontSize: "1.4rem" }}>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Options Configuration */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "20px" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "700", marginBottom: "16px", color: "var(--ink)" }}>2. Details & Scale</h2>

              {/* Home Size Selector */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "8px" }}>Home Configuration</label>
                <select
                  value={bhkSize}
                  onChange={(e) => setBhkSize(e.target.value)}
                  style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "14px", color: "var(--ink)", background: "#FFFFFF", outline: "none" }}
                >
                  <option value="1">1 BHK Layout</option>
                  <option value="2">2 BHK Layout</option>
                  <option value="3">3 BHK Layout</option>
                  <option value="4">4+ BHK Layout</option>
                </select>
              </div>

              {/* Conditional Movers fields */}
              {selectedService === "movers" && (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "8px" }}>Moving From (Locality)</label>
                    <input
                      type="text"
                      placeholder="e.g. Whitefield, Bengaluru"
                      value={movingFrom}
                      onChange={(e) => setMovingFrom(e.target.value)}
                      style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "14px", color: "var(--ink)", background: "#FFFFFF", outline: "none" }}
                    />
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "8px" }}>Moving To (Locality)</label>
                    <input
                      type="text"
                      placeholder="e.g. Indiranagar, Bengaluru"
                      value={movingTo}
                      onChange={(e) => setMovingTo(e.target.value)}
                      style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "14px", color: "var(--ink)", background: "#FFFFFF", outline: "none" }}
                    />
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Right Column: Dynamic Estimate & Contact Lead */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "24px", boxShadow: "0 8px 16px rgba(0,0,0,0.02)" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>Estimated Service Fee</h2>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "20px" }}>
              <span style={{ fontSize: "2rem", fontWeight: "800", color: "var(--accent)" }}>{calculateEstimate()}</span>
              <span style={{ fontSize: "13px", color: "var(--muted-slate)" }}>*Estimated starting price</span>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "20px 0" }} />

            <form onSubmit={handleBookingSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "6px" }}>Your Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  style={{ width: "100%", height: "42px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "14px", color: "var(--ink)", background: "#FFFFFF", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "6px" }}>Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="Enter phone number"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  style={{ width: "100%", height: "42px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "14px", color: "var(--ink)", background: "#FFFFFF", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--muted-slate)", textTransform: "uppercase", marginBottom: "6px" }}>Preferred Date</label>
                <input
                  type="date"
                  required
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  style={{ width: "100%", height: "42px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "14px", color: "var(--ink)", background: "#FFFFFF", outline: "none" }}
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
                  transition: "background-color 0.2s ease",
                  marginTop: "10px"
                }}
              >
                {submitting ? "Submitting Booking..." : "Book Service Call"}
              </button>
            </form>
          </div>

        </div>

        {/* Referral Trust indicators */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginTop: "48px", borderTop: "1px solid var(--line)", paddingTop: "32px", textAlign: "center" }}>
          <div>
            <h4 style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px" }}>🛡️ Verified Pros</h4>
            <p style={{ fontSize: "12.5px", color: "var(--muted-slate)", margin: "0" }}>Only highly rated and back-checked partners qualify.</p>
          </div>
          <div>
            <h4 style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px" }}>💸 Standardized Rates</h4>
            <p style={{ fontSize: "12.5px", color: "var(--muted-slate)", margin: "0" }}>Zero surge fees or hidden costs at delivery.</p>
          </div>
          <div>
            <h4 style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px" }}>📞 Priority Support</h4>
            <p style={{ fontSize: "12.5px", color: "var(--muted-slate)", margin: "0" }}>Dedicated partner liaison helpline for listings.</p>
          </div>
        </div>

      </div>

      {/* Success Dialog overlay */}
      {isSuccess && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10, 17, 40, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#FFFFFF", borderRadius: "12px", padding: "32px", maxWidth: "420px", width: "90%", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)" }}>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "16px" }}>🎉</span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: "700", color: "var(--ink)", marginBottom: "8px" }}>Booking Requested!</h3>
            <p style={{ fontSize: "14px", color: "var(--muted-slate)", lineHeight: "1.6", marginBottom: "24px" }}>
              Thank you, <strong>{contactName}</strong>! Your request for <strong>Kaam Kaaka</strong> home services has been submitted. A service manager will contact you on <strong>{contactPhone}</strong> shortly to finalize scheduling.
            </p>
            <button
              onClick={() => setIsSuccess(false)}
              className="btn btn--dark"
              style={{ padding: "10px 24px", background: "var(--accent)", color: "#FFFFFF", border: "none", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}
            >
              Back to Services
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
