"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { signInWithEmail } from "@/lib/actions";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";
import { useToast } from "@/app/context/ToastContext";
import Footer from "@/app/components/Footer";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const { user, profile, loading, refreshUser } = useAuth();
  const { toast } = useToast();

  // Authentication Flow States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  // Onboarding States (if public profile is not found yet)
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [onboardRole, setOnboardRole] = useState<"buyer" | "owner" | "builder">("buyer");

  // Redirect if user is already fully authenticated
  useEffect(() => {
    if (!loading && user && profile) {
      router.push(redirectUrl);
    }
  }, [user, profile, loading, router, redirectUrl]);

  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!email.trim() || !email.includes("@")) {
      newErrors.email = true;
      isValid = false;
    }
    if (!password.trim() || password.length < 6) {
      newErrors.password = true;
      isValid = false;
    }

    setErrors(newErrors);

    if (isValid) {
      setIsSubmitting(true);
      try {
        const res = await signInWithEmail(email, password);
        if (res.success) {
          if (isSupabaseConfigured() && !res.simulated) {
            // Check if profile exists in database
            const { data: dbProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", res.user?.id)
              .maybeSingle();

            if (!dbProfile || !dbProfile.full_name) {
              setTempUser(res.user);
              setOnboardingRequired(true);
            } else {
              localStorage.removeItem("realtynow_use_mock_session");
              localStorage.removeItem("realtynow_mock_user");
              await refreshUser();
              toast("Logged in successfully!", "success");
              router.push(redirectUrl);
            }
          } else {
            // Simulated login context setup
            const mockUser = {
              id: res.user?.id || "mock-user-123",
              email: res.user?.email || email,
              phone: res.user?.phone || "+91 98765 43210",
              profile: res.user?.profile || {
                full_name: "Sandbox User",
                role: "buyer",
              }
            };
            localStorage.setItem("realtynow_mock_user", JSON.stringify(mockUser));
            localStorage.setItem("realtynow_use_mock_session", "true");
            await refreshUser();
            toast("Logged in successfully (Sandbox)!", "success");
            router.push(redirectUrl);
          }
        }
      } catch (err: any) {
        toast(err.message || "Invalid credentials. Use test@example.com / password123 for sandbox testing.", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrors({ fullName: true });
      return;
    }

    try {
      const isMock = !isSupabaseConfigured() || tempUser?.id.startsWith("mock-");

      if (isSupabaseConfigured() && !isMock && tempUser) {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            role: onboardRole,
          })
          .eq("id", tempUser.id);

        if (error) throw error;
        localStorage.removeItem("realtynow_use_mock_session");
        localStorage.removeItem("realtynow_mock_user");
      } else if (tempUser) {
        const mockUser = {
          ...tempUser,
          profile: {
            id: tempUser.id,
            phone: tempUser.phone,
            full_name: fullName,
            role: onboardRole,
          },
        };
        localStorage.setItem("realtynow_mock_user", JSON.stringify(mockUser));
        localStorage.setItem("realtynow_use_mock_session", "true");
      }

      toast("Profile configured successfully! Welcome to RealtyNow.", "success");
      await refreshUser();
      router.push(redirectUrl);
    } catch (err: any) {
      toast(err.message || "Error completing profile configurations.", "error");
    }
  };

  return (
    <main className="login-page-main" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Background Ambience */}
      <div className="aurora-container" style={{ position: "absolute", width: "100%", height: "450px", overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
        <div className="aurora-glow aurora-glow--navy" style={{ top: "-10%", left: "10%", opacity: 0.15 }}></div>
        <div className="aurora-glow aurora-glow--crimson" style={{ bottom: "-10%", right: "10%", opacity: 0.12 }}></div>
      </div>

      <section className="section" style={{ position: "relative", zIndex: 1, flex: 1, padding: "120px 0 80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="wrap" style={{ maxWidth: "450px", width: "100%" }}>
          <div className="project-card sheen-glow gradient-border" style={{ padding: "40px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--surface)" }}>
            
            {/* Logo & Header */}
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <Link href="/" className="logo logo--centered" style={{ display: "inline-flex", marginBottom: "16px" }}>
                <span className="logo__mark"></span>RealtyNow
              </Link>
              {onboardingRequired ? (
                <>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: "700", color: "#FFFFFF", marginBottom: "6px" }}>Complete Your Profile</h1>
                  <p style={{ fontSize: "13px", color: "var(--muted-slate)" }}>Finish setting up your account details.</p>
                </>
              ) : (
                <>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: "700", color: "#FFFFFF", marginBottom: "6px" }}>Welcome Back</h1>
                  <p style={{ fontSize: "13px", color: "var(--muted-slate)" }}>Log in using your email credentials.</p>
                </>
              )}
            </div>

            {onboardingRequired ? (
              /* Onboarding Form */
              <form onSubmit={handleOnboardingSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="form-group">
                  <label htmlFor="fullName" style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>Full Name</label>
                  <input
                    type="text"
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${errors.fullName ? "red" : "var(--line)"}`,
                      color: "#FFFFFF",
                      fontSize: "14px",
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>Register as a...</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setOnboardRole("buyer")}
                      style={{
                        padding: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: onboardRole === "buyer" ? "rgba(255,255,255,0.05)" : "transparent",
                        color: onboardRole === "buyer" ? "var(--accent)" : "#FFFFFF",
                        borderColor: onboardRole === "buyer" ? "var(--accent)" : "var(--line)",
                        fontWeight: "600",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      Buyer / Tenant
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnboardRole("owner")}
                      style={{
                        padding: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: onboardRole === "owner" ? "rgba(255,255,255,0.05)" : "transparent",
                        color: onboardRole === "owner" ? "var(--accent)" : "#FFFFFF",
                        borderColor: onboardRole === "owner" ? "var(--accent)" : "var(--line)",
                        fontWeight: "600",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      Property Owner
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn--accent" style={{ width: "100%", padding: "14px", fontWeight: "700" }}>
                  Complete Setup
                </button>
              </form>
            ) : (
              /* Regular Login Form */
              <form onSubmit={handleSubmitAuth} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Email input */}
                <div className="form-group">
                  <label htmlFor="loginEmail" style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>Email Address</label>
                  <input
                    type="email"
                    id="loginEmail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter Gmail or email"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${errors.email ? "red" : "var(--line)"}`,
                      color: "#FFFFFF",
                      fontSize: "14px",
                    }}
                    required
                  />
                </div>

                {/* Password input */}
                <div className="form-group">
                  <label htmlFor="loginPassword" style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#FFFFFF", marginBottom: "8px" }}>Password</label>
                  <input
                    type="password"
                    id="loginPassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${errors.password ? "red" : "var(--line)"}`,
                      color: "#FFFFFF",
                      fontSize: "14px",
                    }}
                    required
                  />
                </div>

                <button type="submit" disabled={isSubmitting} className="btn btn--accent" style={{ width: "100%", padding: "14px", fontWeight: "700" }}>
                  {isSubmitting ? "Logging In..." : "Log In"}
                </button>

                <div style={{ textAlign: "center", marginTop: "10px", fontSize: "13.5px", color: "var(--muted-slate)" }}>
                  Don't have an account?{" "}
                  <Link href="/register" style={{ color: "var(--accent)", fontWeight: "600" }}>
                    Sign Up
                  </Link>
                </div>
              </form>
            )}

          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", color: "var(--muted-slate)" }}><h3>Loading...</h3></div>}>
      <LoginContent />
    </Suspense>
  );
}
