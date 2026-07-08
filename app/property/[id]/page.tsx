"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { submitContactRequest } from "@/lib/actions";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useToast } from "@/app/context/ToastContext";
import Footer from "@/app/components/Footer";

// Mock static database listings
const PROPERTIES_DB: { [key: string]: any } = {
  "static-1": {
    title: "Meridian Sunview",
    loc: "Whitefield, Bengaluru",
    price: "₹ 1.32 Cr",
    bhk: "3 BHK Apartment",
    area: "1,450 sq.ft",
    img: "/hero_house.webp",
    owner: "Suresh Kumar",
    label: "Owner",
    phone: "+91 98765 43210",
    age: "2 Years",
    floor: "4th of 12 Floors",
    facing: "East-Facing",
    desc: "This beautiful 3 BHK apartment is located in the premium gated community of Meridian Sunview in Whitefield. Structured with optimal cross-ventilation, it features 3 spacious balconies, high-end modular fittings in the kitchen, built-in teak wood wardrobes in all bedrooms, and 24/7 power backup. The residential complex offers access to premium club amenities, a grand swimming pool, gym, children's park, and is situated within 10 minutes of major IT parks and shopping hubs.",
    subType: "apartment",
    isRera: true,
  },
  "static-2": {
    title: "Cedar Lake Residency",
    loc: "Baner, Pune",
    price: "₹ 78 L",
    bhk: "2 BHK Apartment",
    area: "980 sq.ft",
    img: "/bengaluru.webp",
    owner: "Anil Deshmukh",
    label: "Owner",
    phone: "+91 87654 32109",
    age: "5 Years",
    floor: "2nd of 6 Floors",
    facing: "West-Facing",
    desc: "Beautiful, well-ventilated apartment located in the prime sector of Baner, walking distance to shopping hubs, cafes, and tech parks. The property features spacious rooms, a modular kitchen, complete woodwork, and balconies with clear pool views. Ideal for nuclear families and professionals working in Hinjewadi.",
    subType: "apartment",
    isRera: false,
  },
  "static-3": {
    title: "Palm Coast Villas",
    loc: "ECR, Chennai",
    price: "₹ 2.40 Cr",
    bhk: "4 BHK Villa",
    area: "2,850 sq.ft",
    img: "/delhi.webp",
    owner: "Palm Construct",
    label: "Developer Representative",
    phone: "+91 76543 21098",
    age: "Under Construction",
    floor: "Ground & 1st Floor",
    facing: "Sea-Facing (East)",
    desc: "Premium luxury villa with smart home automation, private plunge pool, and beautiful sea-facing garden terraces. Located in the exclusive stretch of ECR, it offers peaceful coastal living combined with quick access to the city. Built with premium materials, double-height ceilings, and custom landscape gardens.",
    subType: "villa",
    isRera: true,
  },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PropertyDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [property, setProperty] = useState<any>(null);
  const [loadingProp, setLoadingProp] = useState(true);

  // Inquiry Form State
  const [inqName, setInqName] = useState("");
  const [inqPhone, setInqPhone] = useState("");
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch listing details dynamically on mount
  useEffect(() => {
    async function loadProperty() {
      setLoadingProp(true);

      const isDev = process.env.NODE_ENV !== "production";

      // A. Check static listings first (dev-only sandbox simulation testing)
      if (isDev && PROPERTIES_DB[id]) {
        const staticProp = { ...PROPERTIES_DB[id] };
        if (!user) {
          staticProp.phone = null; // Do not leak contact number to guests
        }
        setProperty(staticProp);
        setLoadingProp(false);
        return;
      }

      // B. Check LocalStorage (dev-only sandbox simulation testing)
      if (isDev) {
        try {
          const localKey = "realtynow_properties";
          const localStr = localStorage.getItem(localKey);
          if (localStr) {
            const localProps = JSON.parse(localStr);
            const match = localProps.find((item: any) => String(item.id) === String(id));
            if (match) {
              setProperty({
                title: match.title,
                loc: `${match.locality}, ${match.city}`,
                price: `₹ ${match.price >= 10000000 ? (match.price / 10000000).toFixed(2) + " Cr" : (match.price / 100000).toFixed(0) + " L"}`,
                bhk: `${match.bhk} BHK Apartment`,
                area: `${match.area_sqft} sq.ft`,
                img: match.image_urls?.[0] || "/hero_house.webp",
                owner: "Verified User",
                label: "Owner",
                phone: user ? "+91 99999 88888" : null, // Mask number for unauthenticated users
                age: "Ready to Move",
                floor: "4th Floor",
                facing: "East-Facing",
                desc: match.description,
                subType: match.sub_type,
                isRera: match.is_rera_approved,
              });
              setLoadingProp(false);
              return;
            }
          }
        } catch (e) {
          console.error("Error reading local storage property:", e);
        }
      }

      // C. Check Supabase Database
      if (isSupabaseConfigured()) {
        try {
          // Gated Select: Only select phone column if user is logged in
          const selectFields = user
            ? "*, profiles(full_name, role, phone)"
            : "*, profiles(full_name, role)";

          const { data, error } = await supabase
            .from("properties")
            .select(selectFields)
            .eq("id", id)
            .maybeSingle();

          if (error) throw error;
          if (data) {
            setProperty({
              title: data.title,
              loc: `${data.locality}, ${data.city}`,
              price: `₹ ${data.price >= 10000000 ? (data.price / 10000000).toFixed(2) + " Cr" : (data.price / 100000).toFixed(0) + " L"}`,
              bhk: `${data.bhk} BHK ${data.sub_type}`,
              area: `${data.area_sqft} sq.ft`,
              img: data.image_urls?.[0] || "/hero_house.webp",
              owner: data.profiles?.full_name || "Verified Member",
              label: data.profiles?.role || "Owner",
              phone: user ? (data.profiles?.phone || "+91 99999 99999") : null, // Mask number for unauthenticated users
              age: data.is_rera_approved ? "Under Construction" : "Ready to Move",
              floor: "Middle Floor",
              facing: "East-Facing",
              desc: data.description,
              subType: data.sub_type,
              isRera: data.is_rera_approved,
            });
          }
        } catch (err) {
          console.error("Error fetching property details:", err);
        }
      }

      setLoadingProp(false);
    }

    loadProperty();
  }, [id, user, refreshTrigger]);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast("Authentication required. Please log in to request call backs from listing hosts.", "info");
      router.push(`/login?redirect=/property/${id}`);
      return;
    }

    setSubmittingInquiry(true);
    try {
      await submitContactRequest(user.id, String(id), `Request call back for: ${property.title}. Buyer phone: ${inqPhone}`);
      toast(
        `Thank you for your interest, ${inqName}! The listing host (${property.owner}) has been notified and will call you back shortly.`,
        "success"
      );
      setInqName("");
      setInqPhone("");
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      toast(err.message || "Error submitting inquiry request.", "error");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const handleCallOwnerClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      toast("Authentication required. Please log in to view verified contact details.", "info");
      router.push(`/login?redirect=/property/${id}`);
    }
  };

  if (loadingProp) {
    return (
      <main className="detail-page-main" style={{ minHeight: "80vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <h3>Loading property details database...</h3>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="detail-page-main" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <h2>Property Not Found</h2>
        <p style={{ color: "var(--muted-slate)", margin: "10px 0" }}>The selected property may have been removed or is no longer active.</p>
        <Link href="/listings" className="btn btn--accent">Back to Search Listings</Link>
      </main>
    );
  }

  return (
    <main className="detail-page-main">
      <div className="wrap">
        {/* Breadcrumbs */}
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> / <Link href="/listings">Listings</Link> /{" "}
          <span id="breadcrumbProperty">{property.title}</span>
        </nav>

        {/* Property Title Head */}
        <div className="detail-header">
          <div className="detail-header__title-group">
            {property.isRera && (
              <span className="detail-badge">
                <span className="badge__pulse"></span>RERA APPROVED
              </span>
            )}
            <h1 id="propTitle" className="detail-title">
              {property.title}
            </h1>
            <p id="propLoc" className="detail-loc">
              {property.loc}
            </p>
          </div>
          <div className="detail-header__price-group">
            <span className="detail-price-label">Price:</span>
            <span id="propPrice" className="detail-price">
              {property.price}
            </span>
            <span className="detail-price-sub">₹ 9,103 / sq.ft</span>
          </div>
        </div>

        {/* Detail Image Gallery Grid */}
        <section className="detail-gallery">
          <div className="detail-gallery__main">
            <Image id="mainGalleryImg" src={property.img} alt="Main property view" className="gallery-img" width={800} height={500} style={{ objectFit: "cover" }} />
          </div>
          <div className="detail-gallery__side">
            <Image src="/bengaluru.webp" alt="Secondary view" className="gallery-img" width={400} height={240} style={{ objectFit: "cover" }} />
            <Image src="/delhi.webp" alt="Alternative view" className="gallery-img" width={400} height={240} style={{ objectFit: "cover" }} />
          </div>
        </section>

        {/* Content Split Grid */}
        <div className="detail-layout">
          {/* Left Column: Specs, descriptions, amenities */}
          <div className="detail-content-col">
            {/* Key Details Grid */}
            <div className="specs-grid">
              <div className="spec-card">
                <span className="spec-card__label">Configuration</span>
                <span id="specBhk" className="spec-card__value">
                  {property.bhk}
                </span>
              </div>
              <div className="spec-card">
                <span className="spec-card__label">Super Area</span>
                <span id="specArea" className="spec-card__value">
                  {property.area}
                </span>
              </div>
              <div className="spec-card">
                <span className="spec-card__label">Status</span>
                <span className="spec-card__value">{property.age === "Under Construction" ? "New Launch" : "Ready to Move"}</span>
              </div>
              <div className="spec-card">
                <span className="spec-card__label">Age of Property</span>
                <span className="spec-card__value">{property.age}</span>
              </div>
              <div className="spec-card">
                <span className="spec-card__label">Floor Number</span>
                <span className="spec-card__value">{property.floor}</span>
              </div>
              <div className="spec-card">
                <span className="spec-card__label">Facing Direction</span>
                <span className="spec-card__value">{property.facing}</span>
              </div>
            </div>

            {/* Description Section */}
            <section className="detail-section">
              <h2>Property Description</h2>
              <p className="detail-description">{property.desc}</p>
            </section>

            {/* Amenities Section */}
            <section className="detail-section">
              <h2>Society Amenities</h2>
              <div className="amenities-grid">
                <div className="amenity-item">
                  <span className="amenity-icon">⚡</span>
                  <span className="amenity-label">Power Backup</span>
                </div>
                <div className="amenity-item">
                  <span className="amenity-icon">🛗</span>
                  <span className="amenity-label">Elevators</span>
                </div>
                <div className="amenity-item">
                  <span className="amenity-icon">🏊</span>
                  <span className="amenity-label">Swimming Pool</span>
                </div>
                <div className="amenity-item">
                  <span className="amenity-icon">🏋️</span>
                  <span className="amenity-label">Modern Gym</span>
                </div>
                <div className="amenity-item">
                  <span className="amenity-icon">🛡️</span>
                  <span className="amenity-label">24/7 Security</span>
                </div>
                <div className="amenity-item">
                  <span className="amenity-icon">🚗</span>
                  <span className="amenity-label">Reserved Parking</span>
                </div>
              </div>
            </section>

            {/* Ecosystem Referral Partner Services */}
            <section className="detail-section">
              <h2>RealtyNow Partner Services</h2>
              <div className="partner-services-grid">
                <div className="partner-card">
                  <span className="partner-card__icon">📦</span>
                  <h3 className="partner-card__title">Kaam Kaaka — Home Services</h3>
                  <p className="partner-card__desc">Book verified movers & packers, professional painters, and plumbers to set up your new home seamlessly.</p>
                  <Link href="/services/kaam-kaaka" className="btn btn--ghost partner-card__link">Book Services</Link>
                </div>
                <div className="partner-card">
                  <span className="partner-card__icon">✨</span>
                  <h3 className="partner-card__title">Interior Design Studio</h3>
                  <p className="partner-card__desc">Get customized, high-end interior layouts and modular fit-outs for your apartment or commercial showroom.</p>
                  <Link href="/services/interior-design" className="btn btn--ghost partner-card__link">Request Quote</Link>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Owner/Broker Details (Sticky Sidebar) */}
          <aside className="detail-sidebar-col">
            <div className="sidebar-contact-card">
              <div className="sidebar-contact-card__head">
                <span className="owner-tag">
                  <span className="badge__pulse"></span>
                  {property.label === "Developer Representative" || property.label === "builder" ? "Verified Builder" : "Verified Owner"}
                </span>
                <div className="owner-profile">
                  <div className="owner-avatar owner-avatar--header" id="sidebarAvatar">
                    {property.owner
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <h3 id="sidebarOwnerName">{property.owner}</h3>
                    <span className="owner-label">{property.label}</span>
                  </div>
                </div>
              </div>

              <div className="sidebar-contact-card__body">
                <p>Get in touch directly with the owner to arrange a viewing or make an inquiry.</p>

                {/* Direct details */}
                <div className="verified-phone">
                  <span className="label">Verified Contact:</span>
                  {user && property.phone ? (
                    <span className="number" id="sidebarPhone">
                      {property.phone}
                    </span>
                  ) : (
                    <span className="number verified-phone__number--blurred" id="sidebarPhone" onClick={() => router.push(`/login?redirect=/property/${id}`)}>
                      +91 XXXXX XXXXX
                    </span>
                  )}
                </div>

                {/* CTA Buttons */}
                <div className="sidebar-actions">
                  {user && property.phone ? (
                    <>
                      <a
                        href={`tel:${property.phone.replace(/\s+/g, "")}`}
                        className="btn btn--accent sidebar-btn"
                        id="sidebarCallBtn"
                        onClick={handleCallOwnerClick}
                      >
                        📞 Call Host Now
                      </a>
                      <a
                        href={`https://wa.me/${property.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--ghost sidebar-btn sidebar-btn--whatsapp"
                        onClick={handleCallOwnerClick}
                      >
                        💬 Chat on WhatsApp
                      </a>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn--accent sidebar-btn"
                        id="sidebarCallBtn"
                        onClick={handleCallOwnerClick}
                      >
                        📞 Call Host Now
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost sidebar-btn sidebar-btn--whatsapp"
                        onClick={handleCallOwnerClick}
                      >
                        💬 Chat on WhatsApp
                      </button>
                    </>
                  )}
                </div>

                <hr className="sidebar-divider" />

                {/* Inquiry Form */}
                <form className="sidebar-inquiry-form" id="sidebarInquiryForm" onSubmit={handleInquirySubmit}>
                  <h4>Or send a message</h4>
                  <div className="form-group">
                    <label htmlFor="inqName">Your Name</label>
                    <input
                      type="text"
                      id="inqName"
                      value={inqName}
                      onChange={(e) => setInqName(e.target.value)}
                      placeholder="Enter your name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="inqPhone">Your Mobile Number</label>
                    <input
                      type="tel"
                      id="inqPhone"
                      value={inqPhone}
                      onChange={(e) => setInqPhone(e.target.value)}
                      placeholder="Enter mobile number"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn--dark btn--inquiry" disabled={submittingInquiry}>
                    {submittingInquiry ? "Submitting Inquiry..." : "Request Call Back"}
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </main>
  );
}
