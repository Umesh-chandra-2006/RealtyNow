"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { signInWithOtp, verifyOtpCode } from "@/lib/actions";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";
import { useToast } from "@/app/context/ToastContext";
import Footer from "@/app/components/Footer";
import { User } from "@supabase/supabase-js";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const { user, profile, loading, refreshUser } = useAuth();
  const { toast } = useToast();

  // Authentication Flow States
  const [activeRole, setActiveRole] = useState<"buyer" | "owner">("buyer");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [isSimulatedLogin, setIsSimulatedLogin] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  // Onboarding States
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

  const handleSocialLogin = async (provider: string) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider.toLowerCase() as any,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectUrl}`,
        },
      });
      if (error) toast(error.message, "error");
    } else {
      // Mock Login
      toast(`Connecting with ${provider} authentication credentials...`, "info");
      const mockUser = {
        id: `mock-${provider.toLowerCase()}-${Date.now()}`,
        email: `mockuser@${provider.toLowerCase()}.com`,
        phone: "+91 99999 88888",
        profile: {
          full_name: `${provider} Demo User`,
          role: "buyer",
        },
      };
      localStorage.setItem("realtynow_mock_user", JSON.stringify(mockUser));
      localStorage.setItem("realtynow_use_mock_session", "true");
      await refreshUser();
      router.push(redirectUrl);
    }
  };

  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!otpRequested) {
      // Step 1: Validate Phone
      if (!phone.trim() || phone.trim().length < 10) {
        newErrors.phone = true;
        isValid = false;
      }
      setErrors(newErrors);

      if (isValid) {
        try {
          const res = await signInWithOtp(phone);
          if (res.simulated) {
            setIsSimulatedLogin(true);
          }
          setOtpRequested(true);
          toast(`OTP code request submitted for +91 ${phone}. Enter 123456 to verify.`, "success");
        } catch (err: any) {
          toast(err.message || "Error requesting OTP. Please check your configurations.", "error");
        }
      }
    } else {
      // Step 2: Validate OTP Code
      if (!otp.trim() || otp.trim().length < 6) {
        newErrors.otp = true;
        isValid = false;
      }
      setErrors(newErrors);

      if (isValid) {
        try {
          const res = await verifyOtpCode(phone, otp, isSimulatedLogin);
          if (res.success) {
            if (res.bypassed) {
              setIsSimulatedLogin(true);
            }
            // Check if profile exists
            if (isSupabaseConfigured() && !res.bypassed) {
              const { data: dbProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", res.user?.id)
                .maybeSingle();

              if (!dbProfile || !dbProfile.full_name) {
                // Trigger profile onboarding
                setTempUser(res.user);
                setOnboardingRequired(true);
              } else {
                localStorage.removeItem("realtynow_use_mock_session");
                await refreshUser();
                router.push(redirectUrl);
              }
            } else {
              // Simulated Onboarding requirement
              setTempUser(res.user);
              setOnboardingRequired(true);
            }
          }
        } catch (err: any) {
          setErrors({ otp: true });
          toast(err.message || "Invalid OTP code. Please enter 123456.", "error");
        }
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
      const isMock = isSimulatedLogin || !isSupabaseConfigured() || (tempUser && tempUser.id.startsWith("mock-"));

      if (isSupabaseConfigured() && !isMock && tempUser) {
        // Upsert or update profile in database
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            role: onboardRole,
          })
          .eq("id", tempUser.id);

        if (error) throw error;
        localStorage.removeItem("realtynow_use_mock_session");
      } else if (tempUser) {
        // LocalStorage mock onboarding save
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
    <main className="login-page-main">
      <div className="wrap login-centered-wrap">
        <div className="login-card">
          <div className="login-card__head">
            <div className="logo logo--centered">
              <span className="logo__mark"></span>RealtyNow
            </div>
            {onboardingRequired ? (
              <>
                <h1>Complete Your Profile</h1>
                <p>Welcome! Tell us a bit about yourself to help tailor your RealtyNow dashboard.</p>
              </>
            ) : (
              <>
                <h1>Welcome back</h1>
                <p>Login to view verified owner contact details and save properties.</p>
              </>
            )}
          </div>

          <div className="login-card__body">
            {onboardingRequired ? (
              /* Onboarding Multi-choice Profile Form */
              <form onSubmit={handleOnboardingSubmit} noValidate>
                <div className="form-group">
                  <label htmlFor="fullName">Full Name</label>
                  <input
                    type="text"
                    id="fullName"
                    className={errors.fullName ? "has-error" : ""}
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (e.target.value) setErrors({});
                    }}
                    placeholder="Enter your name"
                    required
                  />
                  {errors.fullName && (
                    <div className="invalid-feedback" style={{ display: "block" }}>
                      Please specify your full name.
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>I am registering as a...</label>
                  <div className="login-role-tabs" style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button
                      type="button"
                      className={`role-tab ${onboardRole === "buyer" ? "active" : ""}`}
                      onClick={() => setOnboardRole("buyer")}
                      style={{ flex: 1, fontSize: "0.8rem", padding: "10px" }}
                    >
                      Buyer / Tenant
                    </button>
                    <button
                      type="button"
                      className={`role-tab ${onboardRole === "owner" ? "active" : ""}`}
                      onClick={() => setOnboardRole("owner")}
                      style={{ flex: 1, fontSize: "0.8rem", padding: "10px" }}
                    >
                      Property Owner
                    </button>
                    <button
                      type="button"
                      className={`role-tab ${onboardRole === "builder" ? "active" : ""}`}
                      onClick={() => setOnboardRole("builder")}
                      style={{ flex: 1, fontSize: "0.8rem", padding: "10px" }}
                    >
                      Builder / Builder Rep
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn--accent btn--full" style={{ marginTop: "20px" }}>
                  Complete Setup
                </button>
              </form>
            ) : (
              /* Regular OTP Authentication Portal */
              <>
                <div className="login-role-tabs">
                  <button
                    type="button"
                    className={`role-tab ${activeRole === "buyer" ? "active" : ""}`}
                    onClick={() => {
                      setActiveRole("buyer");
                      setOnboardRole("buyer");
                    }}
                    id="tabBuyer"
                  >
                    I am a Buyer/Tenant
                  </button>
                  <button
                    type="button"
                    className={`role-tab ${activeRole === "owner" ? "active" : ""}`}
                    onClick={() => {
                      setActiveRole("owner");
                      setOnboardRole("owner");
                    }}
                    id="tabOwner"
                  >
                    I am an Owner/Broker
                  </button>
                </div>

                <form id="loginForm" onSubmit={handleSubmitAuth} noValidate>
                  <div className="form-group">
                    <label htmlFor="loginPhone">Enter Mobile Number</label>
                    <div className="input-phone-container">
                      <span className="phone-prefix">+91</span>
                      <input
                        type="tel"
                        id="loginPhone"
                        placeholder="Enter 10-digit number"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (e.target.value) setErrors({});
                        }}
                        disabled={otpRequested}
                        required
                      />
                    </div>
                    {errors.phone && (
                      <div className="invalid-feedback" id="phoneFeedback" style={{ display: "block" }}>
                        Please enter a valid 10-digit mobile number.
                      </div>
                    )}
                  </div>

                  {otpRequested && (
                    <div className="form-group" id="otpGroup">
                      <label htmlFor="loginOtp">Enter 6-Digit OTP</label>
                      <input
                        type="text"
                        id="loginOtp"
                        placeholder="Enter OTP code"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => {
                          setOtp(e.target.value);
                          if (e.target.value) setErrors({});
                        }}
                        required
                      />
                      {errors.otp && (
                        <div className="invalid-feedback" id="otpFeedback" style={{ display: "block" }}>
                          Please enter a valid 6-digit OTP code (e.g. 123456).
                        </div>
                      )}
                    </div>
                  )}

                  <button type="submit" className="btn btn--accent btn--full" id="loginSubmitBtn">
                    {otpRequested ? "Verify & Login" : "Request OTP"}
                  </button>
                </form>

                <div className="login-divider">
                  <span>or connect with</span>
                </div>

                <div className="social-oauth-container">
                  <button
                    type="button"
                    className="btn btn--ghost btn--social"
                    onClick={() => handleSocialLogin("Google")}
                  >
                    <svg className="social-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--social"
                    onClick={() => handleSocialLogin("Apple")}
                  >
                    <svg className="social-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.2.67-2.92 1.51-.62.73-1.16 1.87-1.01 2.98 1.11.09 2.24-.59 2.94-1.43z" />
                    </svg>
                    Apple
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", color: "var(--muted-slate)" }}><h3>Loading authentication...</h3></div>}>
      <LoginContent />
    </Suspense>
  );
}
