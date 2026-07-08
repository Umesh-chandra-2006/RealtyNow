import React, { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { signUpWithEmail } from "@/lib/actions";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();

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
          toast.success("Account registered successfully! Please log in to your dashboard.");
          navigate({ to: "/login", search: { redirect: "/profile" } });
        }
      } catch (err: any) {
        toast.error(err.message || "Registration failed. Try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="relative flex flex-1 items-center justify-center px-4 py-24">
        {/* Background Aurora blurs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[5%] left-[15%] h-[450px] w-[450px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[10%] h-[450px] w-[450px] rounded-full bg-primary/8 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-[480px] rounded-3xl bg-card p-8 shadow-elevated ring-1 ring-border md:p-10">
          {/* Logo header */}
          <div className="mb-8 text-center">
            <Link to="/" className="inline-flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">R</span>
              Realty<span className="text-primary">Now</span>
            </Link>
            <h1 className="mt-6 font-display text-2xl font-bold text-foreground">
              Create your Account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign up with your credentials to get started.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {/* Role Selection */}
            <div>
              <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Register as a
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("buyer")}
                  className={`rounded-xl border py-3 text-xs font-semibold transition-colors ${
                    role === "buyer"
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border text-foreground hover:bg-surface"
                  }`}
                >
                  Buyer / Tenant
                </button>
                <button
                  type="button"
                  onClick={() => setRole("owner")}
                  className={`rounded-xl border py-3 text-xs font-semibold transition-colors ${
                    role === "owner"
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border text-foreground hover:bg-surface"
                  }`}
                >
                  Property Owner
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-semibold text-foreground mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                placeholder="Enter full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full rounded-xl bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${
                  errors.fullName ? "border-red-500" : "border-border"
                }`}
                required
              />
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-xl bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${
                  errors.email ? "border-red-500" : "border-border"
                }`}
                required
              />
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-foreground mb-1.5">
                Phone Number (without prefix)
              </label>
              <div className="flex gap-2">
                <span className="grid place-items-center rounded-xl bg-surface px-3 text-sm text-muted-foreground border border-border">
                  +91
                </span>
                <input
                  type="tel"
                  id="phone"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full rounded-xl bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${
                    errors.phone ? "border-red-500" : "border-border"
                  }`}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-1.5">
                Password
              </label>
              <input
                type="password"
                id="password"
                placeholder="Choose at least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-xl bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${
                  errors.password ? "border-red-500" : "border-border"
                }`}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-75"
            >
              <span>{isSubmitting ? "Creating Account..." : "Create Account"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Log In
              </Link>
            </div>
          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
