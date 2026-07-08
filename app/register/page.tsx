"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/app/context/ToastContext";
import { signUpWithEmail } from "@/lib/actions";
import Footer from "../components/Footer";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"buyer" | "owner">("buyer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!fullName.trim()) {
      newErrors.fullName = true;
      isValid = false;
    }
    if (!email.trim() || !email.includes("@")) {
      newErrors.email = true;
      isValid = false;
    }
    if (!password.trim() || password.length < 6) {
      newErrors.password = true;
      isValid = false;
    }
    if (!phone.trim() || phone.length < 10) {
      newErrors.phone = true;
      isValid = false;
    }

    setErrors(newErrors);

    if (isValid) {
      setIsSubmitting(true);
      try {
        const res = await signUpWithEmail(email, password, fullName, phone, role);
        if (res.success) {
          toast("Account registered successfully! Please log in to your dashboard.", "success");
          router.push(`/login?redirect=/profile`);
        }
      } catch (err: any) {
        toast(err.message || "Registration failed. Try again.", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <main className="detail-page-main" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Background Ambience */}
      <div className="aurora-container" style={{ position: "absolute", width: "100%", height: "450px", overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
        <div className="aurora-glow aurora-glow--crimson" style={{ top: "-5%", left: "15%", opacity: 0.12 }}></div>
        <div className="aurora-glow aurora-glow--navy" style={{ bottom: "-10%", right: "10%", opacity: 0.15 }}></div>
      </div>

      <section className="section" style={{ position: "relative", zIndex: 1, flex: 1, padding: "120px 0 80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="wrap" style={{ maxWidth: "480px", width: "100%" }}>
          <div className="project-card sheen-glow gradient-border" style={{ padding: "40px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--surface)" }}>
            
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <Link href="/" className="logo logo--centered" style={{ display: "inline-flex", justifyContent: "center", marginBottom: "16px" }}>
                <span className="logo__mark"></span>RealtyNow
              </Link>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: "700", color: "#FFFFFF", marginBottom: "6px" }}>
                Create your Account
              </h1>
              <p style={{ fontSize: "13px", color: "var(--muted-slate)" }}>
                Sign up with your email credentials to get started.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Role Selection */}
              <div>
                <span style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--muted-slate)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                  Register as a
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setRole("buyer")}
                    style={{
                      padding: "10px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: role === "buyer" ? "rgba(255,255,255,0.05)" : "transparent",
                      color: role === "buyer" ? "var(--accent)" : "#FFFFFF",
                      borderColor: role === "buyer" ? "var(--accent)" : "var(--line)",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    Buyer / Tenant
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("owner")}
                    style={{
                      padding: "10px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: role === "owner" ? "rgba(255,255,255,0.05)" : "transparent",
                      color: role === "owner" ? "var(--accent)" : "#FFFFFF",
                      borderColor: role === "owner" ? "var(--accent)" : "var(--line)",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    Property Owner
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div className="form-group">
                <label htmlFor="fullName" style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", marginBottom: "6px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${errors.fullName ? "red" : "var(--line)"}`,
                    color: "#FFFFFF",
                    fontSize: "13.5px",
                  }}
                  required
                />
              </div>

              {/* Gmail / Email */}
              <div className="form-group">
                <label htmlFor="email" style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", marginBottom: "6px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  placeholder="Enter Gmail or email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${errors.email ? "red" : "var(--line)"}`,
                    color: "#FFFFFF",
                    fontSize: "13.5px",
                  }}
                  required
                />
              </div>

              {/* Password */}
              <div className="form-group">
                <label htmlFor="password" style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", marginBottom: "6px" }}>
                  Password (min. 6 chars)
                </label>
                <input
                  type="password"
                  id="password"
                  placeholder="Create password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${errors.password ? "red" : "var(--line)"}`,
                    color: "#FFFFFF",
                    fontSize: "13.5px",
                  }}
                  required
                />
              </div>

              {/* Phone */}
              <div className="form-group">
                <label htmlFor="phone" style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", marginBottom: "6px" }}>
                  Contact Phone Number
                </label>
                <div style={{ display: "flex", border: `1px solid ${errors.phone ? "red" : "var(--line)"}`, borderRadius: "var(--radius-md)", overflow: "hidden", backgroundColor: "rgba(255, 255, 255, 0.03)" }}>
                  <span style={{ padding: "10px 14px", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRight: "1px solid var(--line)", color: "var(--muted-slate)", fontSize: "13.5px", fontWeight: "600" }}>
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
                      padding: "10px 14px",
                      backgroundColor: "transparent",
                      border: "none",
                      color: "#FFFFFF",
                      fontSize: "13.5px",
                      outline: "none",
                    }}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn--accent"
                style={{ width: "100%", padding: "12px", marginTop: "8px", fontWeight: "700" }}
              >
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </button>

              <div style={{ textAlign: "center", marginTop: "10px", fontSize: "13.5px", color: "var(--muted-slate)" }}>
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
