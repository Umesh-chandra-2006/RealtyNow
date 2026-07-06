"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  // State
  const [activeRole, setActiveRole] = useState<"buyer" | "owner">("buyer");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const handleSocialLogin = (provider: string) => {
    alert(`Connecting with ${provider} authentication credentials...`);
    alert(`Authentication successful! Welcome to RealtyNow.`);
    router.push("/");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!otpRequested) {
      // Validate phone
      if (!phone.trim() || phone.trim().length < 10) {
        newErrors.phone = true;
        isValid = false;
      }
      setErrors(newErrors);

      if (isValid) {
        setOtpRequested(true);
        alert(`OTP code sent successfully to +91 ${phone}. Enter 123456 to verify.`);
      }
    } else {
      // Validate OTP
      if (otp.trim() !== "123456") {
        newErrors.otp = true;
        isValid = false;
      }
      setErrors(newErrors);

      if (isValid) {
        alert("Login successful! Welcome back to RealtyNow.");
        router.push("/");
      }
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
            <h1>Welcome back</h1>
            <p>Login to view verified owner contact details and save properties.</p>
          </div>

          <div className="login-card__body">
            {/* Role selector tabs */}
            <div className="login-role-tabs">
              <button
                type="button"
                className={`role-tab ${activeRole === "buyer" ? "active" : ""}`}
                onClick={() => setActiveRole("buyer")}
                id="tabBuyer"
              >
                I am a Buyer/Tenant
              </button>
              <button
                type="button"
                className={`role-tab ${activeRole === "owner" ? "active" : ""}`}
                onClick={() => setActiveRole("owner")}
                id="tabOwner"
              >
                I am an Owner/Broker
              </button>
            </div>

            {/* Credentials Form */}
            <form id="loginForm" onSubmit={handleSubmit} noValidate>
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

              {/* Verification Field (Hidden initially) */}
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

              {/* Submit CTA */}
              <button type="submit" className="btn btn--accent btn--full" id="loginSubmitBtn">
                {otpRequested ? "Verify & Login" : "Request OTP"}
              </button>
            </form>

            <div className="login-divider">
              <span>or connect with</span>
            </div>

            {/* Social Oauth CTAs */}
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
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer" style={{ marginTop: "60px" }}>
        <div className="wrap footer-grid">
          <div className="footer-brand">
            <div className="logo">
              <span className="logo__mark"></span>RealtyNow
            </div>
            <p>
              Premium RERA-verified property listings with transparent pricing and direct owner verification details.
            </p>
            <div className="footer-social">
              <a href="#linkedin" aria-label="LinkedIn">in</a>
              <a href="#twitter" aria-label="X (Twitter)">X</a>
              <a href="#instagram" aria-label="Instagram">ig</a>
            </div>
          </div>
          <div>
            <h4>Cities</h4>
            <ul>
              <li><Link href="/listings?city=Mumbai">Mumbai</Link></li>
              <li><Link href="/listings?city=Bengaluru">Bengaluru</Link></li>
              <li><Link href="/listings?city=Pune">Pune</Link></li>
              <li><Link href="/listings?city=Delhi">Delhi NCR</Link></li>
              <li><Link href="/listings?city=Hyderabad">Hyderabad</Link></li>
            </ul>
          </div>
          <div>
            <h4>Marketplace</h4>
            <ul>
              <li><Link href="/listings?type=buy">Buy Property</Link></li>
              <li><Link href="/listings?type=rent">Rent Property</Link></li>
              <li><Link href="/listings?type=pg">PG & Co-living</Link></li>
              <li><Link href="/listings?type=commercial">Commercial</Link></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href="#about-us">About Us</a></li>
              <li><a href="#careers">Careers</a></li>
              <li><a href="#press">Press</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li><a href="#rera-disclosures">RERA Disclosures</a></li>
              <li><a href="#terms-of-use">Terms of Use</a></li>
              <li><a href="#privacy-policy">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© 2026 RealtyNow. All rights reserved.</span>
          <span>Production Build — Verified Realty Platform</span>
        </div>
      </footer>
    </main>
  );
}
