"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PostProperty() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState(1);

  // Form Fields State
  const [intent, setIntent] = useState("sell");
  const [propCategory, setPropCategory] = useState("");
  const [postCity, setPostCity] = useState("");
  const [postLocality, setPostLocality] = useState("");
  const [postAddress, setPostAddress] = useState("");
  const [postBhk, setPostBhk] = useState("");
  const [postArea, setPostArea] = useState("");
  const [postPrice, setPostPrice] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [reraCertify, setReraCertify] = useState(false);

  // Validation Error States
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const validateStep = (currentStep: number) => {
    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (currentStep === 1) {
      if (!propCategory) {
        newErrors.propCategory = true;
        isValid = false;
      }
    } else if (currentStep === 2) {
      if (!postCity.trim()) {
        newErrors.postCity = true;
        isValid = false;
      }
      if (!postLocality.trim()) {
        newErrors.postLocality = true;
        isValid = false;
      }
    } else if (currentStep === 3) {
      if (!postBhk) {
        newErrors.postBhk = true;
        isValid = false;
      }
      if (!postArea || parseFloat(postArea) <= 0) {
        newErrors.postArea = true;
        isValid = false;
      }
      if (!postPrice || parseFloat(postPrice) <= 0) {
        newErrors.postPrice = true;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = (nextStep: number) => {
    if (validateStep(step)) {
      setStep(nextStep);
    }
  };

  const handleBack = (prevStep: number) => {
    setStep(prevStep);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { [key: string]: boolean } = {};
    let isValid = true;

    if (!ownerName.trim()) {
      newErrors.ownerName = true;
      isValid = false;
    }
    if (!ownerPhone.trim() || ownerPhone.trim().length < 10) {
      newErrors.ownerPhone = true;
      isValid = false;
    }

    setErrors(newErrors);

    if (isValid) {
      alert(
        `Congratulations! Your property has been successfully listed.\n\nWe have sent an OTP verification SMS to +91 ${ownerPhone} to verify owner credentials.`
      );
      router.push("/");
    }
  };

  return (
    <main className="post-property-main">
      <div className="wrap post-grid-layout">
        {/* Left Column: Trust Info */}
        <div className="post-info-col">
          <div className="badge-wrapper">
            <span className="badge">
              <span className="badge__pulse"></span>100% Verified Only
            </span>
          </div>
          <h1>List your property and connect with verified buyers</h1>
          <p className="post-desc-text">
            Join thousands of homeowners and builders who successfully sold or rented their properties on RealtyNow.
          </p>

          <div className="post-trust-cards">
            <div className="trust-bullet">
              <span className="trust-icon">✓</span>
              <div>
                <h3>Direct Connections</h3>
                <p>Direct matching between owners/builders and buyers. Safe, fast, and transparent.</p>
              </div>
            </div>
            <div className="trust-bullet">
              <span className="trust-icon">✓</span>
              <div>
                <h3>Owner Verification Badge</h3>
                <p>Get listed with our 'Owner Verified' checkmark, boosting buyer inquiries by 4.1x.</p>
              </div>
            </div>
            <div className="trust-bullet">
              <span className="trust-icon">✓</span>
              <div>
                <h3>RERA Registration Support</h3>
                <p>Immediate digital tools to check and link RERA IDs for fast buyer trust.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-step Form */}
        <div className="post-form-col">
          <div className="post-form-card">
            {/* Step indicator bar */}
            <div className="step-indicator">
              <div className={`step-dot ${step >= 1 ? "active" : ""}`} data-step="1"></div>
              <div className={`step-dot ${step >= 2 ? "active" : ""}`} data-step="2"></div>
              <div className={`step-dot ${step >= 3 ? "active" : ""}`} data-step="3"></div>
              <div className={`step-dot ${step >= 4 ? "active" : ""}`} data-step="4"></div>
            </div>

            <form id="postPropertyForm" onSubmit={handleSubmit} noValidate>
              {/* Step 1: Listing & Category */}
              {step === 1 && (
                <div className="form-step active" id="step-1">
                  <h2>Select Listing Category</h2>
                  <div className="form-group">
                    <label>Listing Intent</label>
                    <div className="intent-selectors">
                      <label className={`intent-option ${intent === "sell" ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="intent"
                          value="sell"
                          checked={intent === "sell"}
                          onChange={() => setIntent("sell")}
                        />
                        <span>Sell</span>
                      </label>
                      <label className={`intent-option ${intent === "rent" ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="intent"
                          value="rent"
                          checked={intent === "rent"}
                          onChange={() => setIntent("rent")}
                        />
                        <span>Rent</span>
                      </label>
                      <label className={`intent-option ${intent === "pg" ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="intent"
                          value="pg"
                          checked={intent === "pg"}
                          onChange={() => setIntent("pg")}
                        />
                        <span>PG / Co-live</span>
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="propCategory">Property Type</label>
                    <select
                      id="propCategory"
                      className={`filter-select select-full ${errors.propCategory ? "has-error" : ""}`}
                      value={propCategory}
                      onChange={(e) => {
                        setPropCategory(e.target.value);
                        if (e.target.value) setErrors({});
                      }}
                      required
                    >
                      <option value="">Choose category...</option>
                      <option value="apartment">Apartment / Flat</option>
                      <option value="villa">Independent Villa / House</option>
                      <option value="plot">Plot / Land</option>
                      <option value="office">Commercial Office Space</option>
                      <option value="retail">Retail / Showroom</option>
                    </select>
                    {errors.propCategory && (
                      <div className="invalid-feedback" style={{ display: "block" }}>
                        Please select a property category.
                      </div>
                    )}
                  </div>
                  <div className="step-actions">
                    <button type="button" className="btn btn--accent btn--next" onClick={() => handleNext(2)}>
                      Next Step
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Location Details */}
              {step === 2 && (
                <div className="form-step active" id="step-2">
                  <h2>Property Location</h2>
                  <div className="form-group">
                    <label htmlFor="postCity">City</label>
                    <input
                      type="text"
                      id="postCity"
                      className={errors.postCity ? "has-error" : ""}
                      value={postCity}
                      onChange={(e) => {
                        setPostCity(e.target.value);
                        if (e.target.value) setErrors({});
                      }}
                      placeholder="Enter city (e.g. Bengaluru)"
                      required
                    />
                    {errors.postCity && (
                      <div className="invalid-feedback" style={{ display: "block" }}>
                        Please enter a valid city name.
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="postLocality">Locality</label>
                    <input
                      type="text"
                      id="postLocality"
                      className={errors.postLocality ? "has-error" : ""}
                      value={postLocality}
                      onChange={(e) => {
                        setPostLocality(e.target.value);
                        if (e.target.value) setErrors({});
                      }}
                      placeholder="Enter locality (e.g. Whitefield)"
                      required
                    />
                    {errors.postLocality && (
                      <div className="invalid-feedback" style={{ display: "block" }}>
                        Please specify the locality.
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="postAddress">Street Address (Optional)</label>
                    <input
                      type="text"
                      id="postAddress"
                      value={postAddress}
                      onChange={(e) => setPostAddress(e.target.value)}
                      placeholder="e.g. Flat 402, Meridian Heights"
                    />
                  </div>
                  <div className="step-actions">
                    <button type="button" className="btn btn--ghost" onClick={() => handleBack(1)}>
                      Back
                    </button>
                    <button type="button" className="btn btn--accent btn--next" onClick={() => handleNext(3)}>
                      Next Step
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Area & Pricing */}
              {step === 3 && (
                <div className="form-step active" id="step-3">
                  <h2>Area & Pricing Details</h2>
                  <div className="form-group">
                    <label htmlFor="postBhk">Configuration (BHK)</label>
                    <select
                      id="postBhk"
                      className={`filter-select select-full ${errors.postBhk ? "has-error" : ""}`}
                      value={postBhk}
                      onChange={(e) => {
                        setPostBhk(e.target.value);
                        if (e.target.value) setErrors({});
                      }}
                      required
                    >
                      <option value="">BHK Configuration...</option>
                      <option value="1">1 BHK</option>
                      <option value="2">2 BHK</option>
                      <option value="3">3 BHK</option>
                      <option value="4">4+ BHK / Villa</option>
                    </select>
                    {errors.postBhk && (
                      <div className="invalid-feedback" style={{ display: "block" }}>
                        Please specify BHK type.
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="postArea">Area size (sq. ft.)</label>
                    <input
                      type="number"
                      id="postArea"
                      className={errors.postArea ? "has-error" : ""}
                      value={postArea}
                      onChange={(e) => {
                        setPostArea(e.target.value);
                        if (e.target.value) setErrors({});
                      }}
                      placeholder="e.g. 1450"
                      required
                    />
                    {errors.postArea && (
                      <div className="invalid-feedback" style={{ display: "block" }}>
                        Please enter the area size.
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="postPrice">Expected Price (INR)</label>
                    <input
                      type="number"
                      id="postPrice"
                      className={errors.postPrice ? "has-error" : ""}
                      value={postPrice}
                      onChange={(e) => {
                        setPostPrice(e.target.value);
                        if (e.target.value) setErrors({});
                      }}
                      placeholder="e.g. 8500000"
                      required
                    />
                    {errors.postPrice && (
                      <div className="invalid-feedback" style={{ display: "block" }}>
                        Please specify the price in INR.
                      </div>
                    )}
                  </div>
                  <div className="step-actions">
                    <button type="button" className="btn btn--ghost" onClick={() => handleBack(2)}>
                      Back
                    </button>
                    <button type="button" className="btn btn--accent btn--next" onClick={() => handleNext(4)}>
                      Next Step
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Contact & Consent */}
              {step === 4 && (
                <div className="form-step active" id="step-4">
                  <h2>Owner Verification</h2>
                  <div className="form-group">
                    <label htmlFor="ownerName">Full Name</label>
                    <input
                      type="text"
                      id="ownerName"
                      className={errors.ownerName ? "has-error" : ""}
                      value={ownerName}
                      onChange={(e) => {
                        setOwnerName(e.target.value);
                        if (e.target.value) setErrors({});
                      }}
                      placeholder="Enter your full name"
                      required
                    />
                    {errors.ownerName && (
                      <div className="invalid-feedback" style={{ display: "block" }}>
                        Please enter your name.
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="ownerPhone">Mobile Number (OTP Verification)</label>
                    <input
                      type="tel"
                      id="ownerPhone"
                      className={errors.ownerPhone ? "has-error" : ""}
                      value={ownerPhone}
                      onChange={(e) => {
                        setOwnerPhone(e.target.value);
                        if (e.target.value) setErrors({});
                      }}
                      placeholder="Enter mobile number"
                      required
                    />
                    {errors.ownerPhone && (
                      <div className="invalid-feedback" style={{ display: "block" }}>
                        Please enter a valid 10-digit mobile number.
                      </div>
                    )}
                  </div>
                  <div className="form-group checkbox-group">
                    <input
                      type="checkbox"
                      id="reraCertify"
                      checked={reraCertify}
                      onChange={(e) => setReraCertify(e.target.checked)}
                    />
                    <label htmlFor="reraCertify" className="check-label">
                      I certify that this property complies with local RERA guidelines.
                    </label>
                  </div>
                  <div className="step-actions">
                    <button type="button" className="btn btn--ghost" onClick={() => handleBack(3)}>
                      Back
                    </button>
                    <button type="submit" className="btn btn--accent">
                      Submit Property
                    </button>
                  </div>
                </div>
              )}
            </form>
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
