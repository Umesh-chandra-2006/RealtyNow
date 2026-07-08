"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { createPropertyListing } from "@/lib/actions";
import { useToast } from "@/app/context/ToastContext";
import Footer from "@/app/components/Footer";

export default function PostProperty() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const { toast } = useToast();

  // Step state
  const [step, setStep] = useState(1);

  // Form Fields State
  const [intent, setIntent] = useState<"sell" | "rent" | "pg">("sell");
  const [propCategory, setPropCategory] = useState<string>("");
  const [postCity, setPostCity] = useState("");
  const [postLocality, setPostLocality] = useState("");
  const [postAddress, setPostAddress] = useState("");
  const [postBhk, setPostBhk] = useState("");
  const [postArea, setPostArea] = useState("");
  const [postPrice, setPostPrice] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [reraCertify, setReraCertify] = useState(false);
  const [reraId, setReraId] = useState("");

  // Validation Error States
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill owner details from active session
  useEffect(() => {
    if (user && profile) {
      setOwnerName(profile.full_name || "");
      setOwnerPhone(user.phone?.replace("+91", "") || "");
    }
  }, [user, profile]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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

    // Require RERA ID for builder roles or commercial listings
    const isCommercial = propCategory === "office" || propCategory === "retail";
    const isBuilder = profile?.role === "builder";
    if ((isCommercial || isBuilder) && !reraId.trim()) {
      newErrors.reraId = true;
      isValid = false;
    }

    setErrors(newErrors);

    if (isValid) {
      setSubmitting(true);
      try {
        const mappedIntent = intent === "sell" ? "buy" : intent; // sell maps to buy in properties schema

        await createPropertyListing({
          title: `${postBhk ? postBhk + " BHK " : ""}${propCategory.charAt(0).toUpperCase() + propCategory.slice(1)} in ${postLocality}`,
          description: `Excellent condition ${propCategory} located in the prime region of ${postLocality}, ${postCity}.`,
          price: parseFloat(postPrice),
          bhk: postBhk ? parseInt(postBhk) : 1,
          area_sqft: parseInt(postArea),
          type: mappedIntent as any,
          sub_type: (propCategory === "office" || propCategory === "retail" ? propCategory : "apartment") as any,
          city: postCity,
          locality: postLocality,
          address: postAddress,
          is_rera_approved: false, // Default to false; must be verified by admin.
          rera_id: reraId || undefined,
          created_by: user.id,
          image_urls: ["/hero_house.webp"],
        });

        toast("Congratulations! Your property has been successfully listed in the database.", "success");
        router.push("/listings");
      } catch (err: any) {
        toast(err.message || "Error submitting listing. Have you reached your 5-property free limit?", "error");
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Enforce page lock if loading or not authenticated
  if (loading) {
    return (
      <main className="post-property-main" style={{ minHeight: "8vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <h3>Verifying posting quota details...</h3>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="post-property-main relative" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Ambient background glows */}
        <div className="aurora-container" style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden" }}>
          <div className="aurora-glow aurora-glow--crimson" style={{ top: "15%", left: "-10%", opacity: 0.08 }}></div>
          <div className="aurora-glow aurora-glow--navy" style={{ bottom: "25%", right: "-10%", opacity: 0.1 }}></div>
        </div>

        <div className="post-form-card sheen-glow gradient-border" style={{ maxWidth: "480px", textAlign: "center", padding: "40px", border: "1px solid var(--line)", background: "var(--surface)", borderRadius: "12px" }}>
          <h2>Login Required</h2>
          <p style={{ color: "var(--muted-slate)", margin: "15px 0", lineHeight: "1.5" }}>
            You must log in to list property postings on RealtyNow. The first 5 listings are 100% verified and free.
          </p>
          <Link href="/login?redirect=/post-property" className="btn btn--accent btn--full" style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
            Login to Post Property
          </Link>
        </div>
      </main>
    );
  }

  const isCommercial = propCategory === "office" || propCategory === "retail";
  const isBuilder = profile?.role === "builder";

  return (
    <main className="post-property-main relative">
      {/* Ambient background glows */}
      <div className="aurora-container" style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden" }}>
        <div className="aurora-glow aurora-glow--crimson" style={{ top: "15%", left: "-10%", opacity: 0.08 }}></div>
        <div className="aurora-glow aurora-glow--navy" style={{ bottom: "25%", right: "-10%", opacity: 0.1 }}></div>
      </div>
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
            Join thousands of homeowners and builders who successfully listed their properties on RealtyNow.
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
          <div className="post-form-card sheen-glow gradient-border">
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
                    <label htmlFor="ownerPhone">Mobile Number (Verified)</label>
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
                      disabled
                      required
                    />
                    {errors.ownerPhone && (
                      <div className="invalid-feedback" style={{ display: "block" }}>
                        Please enter a valid 10-digit mobile number.
                      </div>
                    )}
                  </div>

                  {/* RERA ID Field (shown contextually) */}
                  {(isCommercial || isBuilder) && (
                    <div className="form-group">
                      <label htmlFor="reraId">RERA Registration ID</label>
                      <input
                        type="text"
                        id="reraId"
                        className={errors.reraId ? "has-error" : ""}
                        value={reraId}
                        onChange={(e) => {
                          setReraId(e.target.value);
                          if (e.target.value) setErrors({});
                        }}
                        placeholder="e.g. PRM/KA/RERA/1251/..."
                        required
                      />
                      <span className="form-help-text" style={{ fontSize: "12px", color: "var(--muted-slate)", marginTop: "4px", display: "block" }}>
                        Submitted for verification. The RERA Approved badge will be visible once reviewed by moderators.
                      </span>
                      {errors.reraId && (
                        <div className="invalid-feedback" style={{ display: "block" }}>
                          RERA Registration ID is required for builders and commercial listings.
                        </div>
                      )}
                    </div>
                  )}

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
                    <button type="submit" className="btn btn--accent" disabled={submitting}>
                      {submitting ? "Listing Property..." : "Submit Property"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
