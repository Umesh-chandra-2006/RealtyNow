"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/app/context/ToastContext";
import Footer from "@/app/components/Footer";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"buyer" | "owner">("buyer");
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!fullName.trim()) {
      newErrors.fullName = true;
      isValid = false;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      newErrors.phone = true;
      isValid = false;
    }

    setErrors(newErrors);

    if (isValid) {
      // Redirect to login page to complete verification via SMS OTP, pre-populating fields
      toast(`Registration request initiated. Redirecting to verify +91 ${phone}...`, "success");
      router.push(`/login?phone=${phone}&role=${role}&name=${encodeURIComponent(fullName)}`);
    }
  };

  return (
    <main className="detail-page-main" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Aurora Ambient Background */}
      <div className="aurora-container" style={{ position: "absolute", width: "100%", height: "450px", overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
        <div className="aurora-glow aurora-glow--crimson" style={{ top: "-5%", left: "15%", opacity: 0.12 }}></div>
        <div className="aurora-glow aurora-glow--navy" style={{ bottom: "-10%", right: "10%", opacity: 0.15 }}></div>
      </div>

      <section className="section" style={{ position: "relative", zIndex: 1, flex: 1, padding: "120px 0 80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="wrap" style={{ maxWidth: "480px", width: "100%" }}>
          <div className="project-card sheen-glow gradient-border" style={{ padding: "40px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--surface)" }}>
            
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <Link href="/" className="logo logo--centered" style={{ display: "inline-flex", justifyContent: "center", marginBottom: "20px" }}>
                <span className="logo__mark"></span>RealtyNow
              </Link>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: "700", color: "#FFFFFF", marginBottom: "8px" }}>
                Create your Account
              </h1>
              <p style={{ fontSize: "13.5px", color: "var(--muted-slate)" }}>
                Direct owner communication. Zero brokerage listings.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Role Selection */}
              <div>
                <span style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--muted-slate)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                  I want to list / search as
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    className={`intent-option ${role === "buyer" ? "active" : ""}`}
                    onClick={() => setRole("buyer")}
                    style={{
                      padding: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: role === "buyer" ? "rgba(255,255,255,0.05)" : "transparent",
                      color: role === "buyer" ? "var(--accent)" : "#FFFFFF",
                      borderColor: role === "buyer" ? "var(--accent)" : "var(--line)",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontSize: "13px",
                      textAlign: "center",
                    }}
                  >
                    Buyer / Tenant
                  </button>
                  <button
                    type="button"
                    className={`intent-option ${role === "owner" ? "active" : ""}`}
                    onClick={() => setRole("owner")}
                    style={{
                      padding: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: role === "owner" ? "rgba(255,255,255,0.05)" : "transparent",
                      color: role === "owner" ? "var(--accent)" : "#FFFFFF",
                      borderColor: role === "owner" ? "var(--accent)" : "var(--line)",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontSize: "13px",
                      textAlign: "center",
                    }}
                  >
                    Property Owner
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div className="form-group">
                <label htmlFor="fullName" style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  placeholder="Enter your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${errors.fullName ? "red" : "var(--line)"}`,
                    color: "#FFFFFF",
                    fontSize: "14px",
                  }}
                />
              </div>

              {/* Phone Input */}
              <div className="form-group">
                <label htmlFor="phone" style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>
                  Phone Number
                </label>
                <div className="input-phone-container" style={{ display: "flex", border: `1px solid ${errors.phone ? "red" : "var(--line)"}`, borderRadius: "var(--radius-md)", overflow: "hidden", backgroundColor: "rgba(255, 255, 255, 0.03)" }}>
                  <span className="phone-prefix" style={{ padding: "12px 16px", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRight: "1px solid var(--line)", color: "var(--muted-slate)", fontSize: "14px", fontWeight: "600" }}>
                    +91
                  </span>
                  <input
                    type="tel"
                    id="phone"
                    placeholder="Enter 10-digit number"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      backgroundColor: "transparent",
                      border: "none",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn--accent"
                style={{ width: "100%", padding: "14px", marginTop: "10px", fontSize: "15px", fontWeight: "700" }}
              >
                Send Verification OTP
              </button>

              <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13.5px", color: "var(--muted-slate)" }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "var(--accent)", fontWeight: "600" }}>
                  Log in
                </Link>
              </div>
            </form>

          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
