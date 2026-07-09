"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../src/context/AuthContext";
import { signInWithEmail } from "../../src/lib/actions";
import { supabase, isSupabaseConfigured } from "../../src/lib/supabase";
import { toast } from "sonner";
import { SiteHeader } from "../../src/components/SiteHeader";
import { SiteFooter } from "../../src/components/SiteFooter";
import { ArrowRight } from "lucide-react";

function isValidRedirect(url: string): boolean {
  if (!url) return false;
  // Ensure it starts with / and does not start with // (protocol-relative) or \\ (Windows path-like bypasses)
  return url.startsWith("/") && !url.startsWith("//") && !url.startsWith("\\");
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectUrl = isValidRedirect(rawRedirect) ? rawRedirect : "/";

  const { user, profile, loading, refreshUser } = useAuth();

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
  }, [user, profile, loading, redirectUrl, router]);

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
              toast.success("Logged in successfully!");
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
              },
            };
            localStorage.setItem("realtynow_mock_user", JSON.stringify(mockUser));
            localStorage.setItem("realtynow_use_mock_session", "true");
            await refreshUser();
            toast.success("Logged in successfully (Sandbox)!");
            router.push(redirectUrl);
          }
        }
      } catch (err: any) {
        toast.error(
          err.message ||
            "Invalid credentials. Use test@example.com / password123 for sandbox testing.",
        );
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
        const { error } = await supabase.from("profiles").upsert({
          id: tempUser.id,
          full_name: fullName,
          role: onboardRole,
        });

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

      toast.success("Profile configured successfully! Welcome to RealtyNow.");
      await refreshUser();
      router.push(redirectUrl);
    } catch (err: any) {
      toast.error(err.message || "Error completing profile configurations.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="relative flex flex-1 items-center justify-center px-4 py-24">
        {/* Background Aurora blurs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[10%] left-[10%] h-[450px] w-[450px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[10%] h-[450px] w-[450px] rounded-full bg-primary/8 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-[450px] rounded-3xl bg-card p-8 shadow-elevated ring-1 ring-border md:p-10">
          {/* Logo header */}
          <div className="mb-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                R
              </span>
              Realty<span className="text-primary">Now</span>
            </Link>
            <h1 className="mt-6 font-display text-2xl font-bold text-foreground">
              {onboardingRequired ? "Complete Your Profile" : "Welcome Back"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {onboardingRequired
                ? "Finish setting up your account details."
                : "Log in using your credentials."}
            </p>
          </div>

          {onboardingRequired ? (
            /* Onboarding Form */
            <form onSubmit={handleOnboardingSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  className={`w-full rounded-xl bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${
                    errors.fullName ? "border-red-500" : "border-border"
                  }`}
                  required
                />
              </div>

              <div>
                <span className="block text-sm font-semibold text-foreground mb-2">
                  Register as a...
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOnboardRole("buyer")}
                    className={`rounded-xl border py-3 text-xs font-semibold transition-colors ${
                      onboardRole === "buyer"
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border text-foreground hover:bg-surface"
                    }`}
                  >
                    Buyer / Tenant
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnboardRole("owner")}
                    className={`rounded-xl border py-3 text-xs font-semibold transition-colors ${
                      onboardRole === "owner"
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border text-foreground hover:bg-surface"
                    }`}
                  >
                    Property Owner
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
              >
                <span>Complete Setup</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            /* Regular Login Form */
            <form onSubmit={handleSubmitAuth} className="space-y-5">
              <div>
                <label
                  htmlFor="loginEmail"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="loginEmail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={`w-full rounded-xl bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${
                    errors.email ? "border-red-500" : "border-border"
                  }`}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="loginPassword"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="loginPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className={`w-full rounded-xl bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${
                    errors.password ? "border-red-500" : "border-border"
                  }`}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-75"
              >
                {isSubmitting ? "Logging In..." : "Log In"}
              </button>

              <div className="mt-4 text-center text-xs text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Sign Up
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <h3 className="text-lg font-semibold animate-pulse">Loading login credentials...</h3>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
