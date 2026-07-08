"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useToast } from "@/app/context/ToastContext";
import { submitContactRequest } from "@/lib/actions";
import Footer from "../components/Footer";

function ContactFormContent() {
  const searchParams = useSearchParams();
  const initialInquiry = searchParams.get("inquiry") || "general";
  const { user } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inquiryType, setInquiryType] = useState(initialInquiry);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial type from query params
  useEffect(() => {
    if (initialInquiry) {
      setInquiryType(initialInquiry);
    }
  }, [initialInquiry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const buyerId = user ? user.id : "mock-guest-user-uuid";
    const detailedMessage = `[Contact Form - Category: ${inquiryType}] Name: ${name}, Email: ${email}, Message: ${message}`;

    try {
      const res = await submitContactRequest(buyerId, null, detailedMessage);
      if (res.success) {
        toast("Thank you! Your message has been submitted successfully.", "success");
        setName("");
        setEmail("");
        setMessage("");
      }
    } catch (err: any) {
      toast(err.message || "Error submitting inquiry.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Name Input */}
      <div className="form-group">
        <label htmlFor="contactName" style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>
          Full Name
        </label>
        <input
          type="text"
          id="contactName"
          placeholder="Enter your name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--line)",
            color: "#FFFFFF",
            fontSize: "14px",
          }}
        />
      </div>

      {/* Email Input */}
      <div className="form-group">
        <label htmlFor="contactEmail" style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>
          Email Address
        </label>
        <input
          type="email"
          id="contactEmail"
          placeholder="Enter your email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--line)",
            color: "#FFFFFF",
            fontSize: "14px",
          }}
        />
      </div>

      {/* Category Dropdown */}
      <div className="form-group">
        <label htmlFor="inquiryType" style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>
          Inquiry Type
        </label>
        <select
          id="inquiryType"
          value={inquiryType}
          onChange={(e) => setInquiryType(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--line)",
            color: "#FFFFFF",
            fontSize: "14px",
            outline: "none",
          }}
        >
          <option value="general">General Inquiry</option>
          <option value="home-loan">RealtyNow Financials (Home Loans)</option>
          <option value="lease-draft">DigiDraft Legal Leases</option>
          <option value="support">Technical Support</option>
          <option value="partnership">Partner / Developer Relations</option>
        </select>
      </div>

      {/* Message Textarea */}
      <div className="form-group">
        <label htmlFor="contactMessage" style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>
          Message
        </label>
        <textarea
          id="contactMessage"
          placeholder="How can we help you?"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--line)",
            color: "#FFFFFF",
            fontSize: "14px",
            resize: "vertical",
          }}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn btn--accent"
        style={{ width: "100%", padding: "14px", fontWeight: "700", fontSize: "15px" }}
      >
        {isSubmitting ? "Submitting Inquiries..." : "Send Message"}
      </button>

    </form>
  );
}

export default function ContactPage() {
  return (
    <main className="detail-page-main" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Background Ambience */}
      <div className="aurora-container" style={{ position: "absolute", width: "100%", height: "450px", overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
        <div className="aurora-glow aurora-glow--navy" style={{ top: "-10%", left: "15%", opacity: 0.15 }}></div>
        <div className="aurora-glow aurora-glow--crimson" style={{ bottom: "-10%", right: "10%", opacity: 0.12 }}></div>
      </div>

      <section className="section" style={{ position: "relative", zIndex: 1, flex: 1, padding: "120px 0 80px" }}>
        <div className="wrap">
          {/* Head */}
          <div className="section-head reveal-scroll" style={{ marginBottom: "50px", textAlign: "center" }}>
            <span className="section-num mono section-num--accent">06 / Support</span>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "3rem", fontWeight: "800", color: "#FFFFFF", marginTop: "12px", marginBottom: "16px" }}>
              Get in <span className="hero__title-accent">Touch</span>
            </h1>
            <p className="section-head__desc" style={{ maxWidth: "600px", margin: "0 auto" }}>
              Have questions about listings, legal verifications, or partner relations? Submit a message below.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "50px", alignItems: "start" }}>
            
            {/* Form Card */}
            <div className="project-card sheen-glow gradient-border" style={{ padding: "40px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--surface)" }}>
              <Suspense fallback={<p style={{ color: "#FFF" }}>Loading form parameters...</p>}>
                <ContactFormContent />
              </Suspense>
            </div>

            {/* General Info cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="project-card sheen-glow gradient-border" style={{ padding: "30px", borderRadius: "var(--radius-md)", backgroundColor: "var(--surface)" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#FFFFFF", marginBottom: "10px" }}>📞 Customer Advisory</h3>
                <p style={{ fontSize: "14px", color: "var(--muted-slate)", marginBottom: "12px" }}>
                  Chat directly with our verified property advisory desks for legal verifications.
                </p>
                <strong style={{ color: "var(--accent)", fontSize: "16px" }}>+91 94942 30774</strong>
              </div>

              <div className="project-card sheen-glow gradient-border" style={{ padding: "30px", borderRadius: "var(--radius-md)", backgroundColor: "var(--surface)" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#FFFFFF", marginBottom: "10px" }}>✉️ Press & Partnership</h3>
                <p style={{ fontSize: "14px", color: "var(--muted-slate)", marginBottom: "12px" }}>
                  For builder ties, APIs support, or press requests, drop a mail directly to:
                </p>
                <strong style={{ color: "var(--accent)", fontSize: "16px" }}>press@realtynow.in</strong>
              </div>

              <div className="project-card sheen-glow gradient-border" style={{ padding: "30px", borderRadius: "var(--radius-md)", backgroundColor: "var(--surface)" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#FFFFFF", marginBottom: "10px" }}>🏢 Corporate Head Office</h3>
                <p style={{ fontSize: "14px", color: "var(--muted-slate)" }}>
                  DLF Cyber City, Tower B, 10th Floor, Gurugram, Haryana - 122002
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
