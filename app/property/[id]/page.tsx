"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Mock database listings
const PROPERTIES_DB: { [key: string]: any } = {
  "1": {
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
  "2": {
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
  "3": {
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

  // Inquiry Form State
  const [inqName, setInqName] = useState("");
  const [inqPhone, setInqPhone] = useState("");

  const property = PROPERTIES_DB[id] || PROPERTIES_DB["1"];

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(
      `Thank you for your interest, ${inqName}!\n\nThe listing host (${property.owner}) has been notified and will call you back shortly at ${inqPhone}.`
    );
    setInqName("");
    setInqPhone("");
  };

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
            <img id="mainGalleryImg" src={property.img} alt="Main property view" className="gallery-img" />
          </div>
          <div className="detail-gallery__side">
            <img src="/bengaluru.webp" alt="Secondary view" className="gallery-img" />
            <img src="/delhi.webp" alt="Alternative view" className="gallery-img" />
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
              <div className="partner-services-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginTop: "15px" }}>
                <div className="partner-card" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "1.5rem" }}>📦</span>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "600", margin: "0" }}>Kaam Kaaka — Home Services</h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--muted-slate)", margin: "0", lineHeight: "1.5" }}>Book verified movers & packers, professional painters, and plumbers to set up your new home seamlessly.</p>
                  <a href="https://kaamkaaka.com?ref=realtynow" target="_blank" rel="noopener noreferrer" className="btn btn--ghost" style={{ marginTop: "auto", textAlign: "center", textDecoration: "none", display: "inline-block" }}>Book Services</a>
                </div>
                <div className="partner-card" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "1.5rem" }}>✨</span>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "600", margin: "0" }}>Interior Design Studio</h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--muted-slate)", margin: "0", lineHeight: "1.5" }}>Get customized, high-end interior layouts and modular fit-outs for your apartment or commercial showroom.</p>
                  <a href="https://interiorstudio.com?ref=realtynow" target="_blank" rel="noopener noreferrer" className="btn btn--ghost" style={{ marginTop: "auto", textAlign: "center", textDecoration: "none", display: "inline-block" }}>Request Quote</a>
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
                  {property.label === "Developer Representative" ? "Verified Builder" : "Verified Owner"}
                </span>
                <div className="owner-profile">
                  <div className="owner-avatar" id="sidebarAvatar">
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
                  <span className="number" id="sidebarPhone">
                    {property.phone}
                  </span>
                </div>

                {/* CTA Buttons */}
                <div className="sidebar-actions">
                  <a
                    href={`tel:${property.phone.replace(/\s+/g, "")}`}
                    className="btn btn--accent sidebar-btn"
                    id="sidebarCallBtn"
                  >
                    📞 Call {property.label} Now
                  </a>
                  <a
                    href={`https://wa.me/${property.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--ghost sidebar-btn sidebar-btn--whatsapp"
                  >
                    💬 Chat on WhatsApp
                  </a>
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
                  <button type="submit" className="btn btn--dark btn--inquiry">
                    Request Call Back
                  </button>
                </form>
              </div>
            </div>
          </aside>
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
