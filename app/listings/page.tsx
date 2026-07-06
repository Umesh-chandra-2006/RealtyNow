"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Mock database listings
const MOCK_LISTINGS = [
  {
    id: 1,
    title: "Meridian Sunview",
    price: 13200000, // ₹ 1.32 Cr
    priceLabel: "₹ 1.32 Cr",
    locality: "Whitefield",
    city: "Bengaluru",
    bhk: [2, 3],
    bhkLabel: "2-3 BHK",
    area: "980-1450",
    status: "Ready to Move",
    type: "buy", // buy / sale
    subType: "apartment",
    excerpt: "Premium east-facing flat with high-end modular kitchen, visual wardrobes, and private balcony overlooking the pool.",
    ownerName: "Suresh Kumar",
    ownerLabel: "Owner",
    phone: "+91 98765 43210",
    image: "/hero_house.webp",
    isRera: true,
    isVerified: true,
    pinCoords: { top: "25%", left: "35%" },
  },
  {
    id: 2,
    title: "Cedar Lake Residency",
    price: 7800000, // ₹ 78 L
    priceLabel: "₹ 78 L",
    locality: "Baner",
    city: "Pune",
    bhk: [1, 2],
    bhkLabel: "1-2 BHK",
    area: "560-980",
    status: "Resale",
    type: "buy",
    subType: "apartment",
    excerpt: "Beautiful, well-ventilated apartment located in the prime sector of Baner, walking distance to shopping hubs and tech parks.",
    ownerName: "Anil Deshmukh",
    ownerLabel: "Owner",
    phone: "+91 87654 32109",
    image: "/bengaluru.webp",
    isRera: false,
    isVerified: true,
    statusBadge: "READY TO MOVE",
    pinCoords: { top: "45%", left: "55%" },
  },
  {
    id: 3,
    title: "Palm Coast Villas",
    price: 24000000, // ₹ 2.40 Cr
    priceLabel: "₹ 2.40 Cr",
    locality: "ECR",
    city: "Chennai",
    bhk: [3, 4],
    bhkLabel: "3-4 BHK",
    area: "2100-2850",
    status: "Under Construction",
    type: "buy", // buy
    subType: "villa",
    excerpt: "Premium luxury villa with smart home automation, private plunge pool, and beautiful sea-facing garden terraces.",
    ownerName: "Palm Construct",
    ownerLabel: "Developer",
    phone: "+91 76543 21098",
    image: "/delhi.webp",
    isRera: true,
    isVerified: true,
    pinCoords: { top: "60%", left: "30%" },
  },
];

function ListingsContent() {
  const searchParams = useSearchParams();

  // Filter States
  const [filterType, setFilterType] = useState(searchParams.get("type") || "buy");
  const [filterSearch, setFilterSearch] = useState(searchParams.get("city") || "");
  const [filterBhk, setFilterBhk] = useState(searchParams.get("bhk") || "");
  const [filterBudget, setFilterBudget] = useState(searchParams.get("budget") || "");
  const [sortBy, setSortBy] = useState("verified");

  // Interaction States
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [isMapViewMobile, setIsMapViewMobile] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState({
    name: "",
    label: "",
    phone: "",
  });

  // Apply filters from search params on load
  useEffect(() => {
    const type = searchParams.get("type");
    const city = searchParams.get("city");
    const bhk = searchParams.get("bhk");
    const budget = searchParams.get("budget");

    if (type) setFilterType(type);
    if (city) setFilterSearch(city);
    if (bhk) setFilterBhk(bhk);
    if (budget) setFilterBudget(budget);
  }, [searchParams]);

  // Filter and Sort Listings Logic
  const filteredListings = MOCK_LISTINGS.filter((item) => {
    // Filter Type
    // Note: PG / Commercial in tabs will fallback to buy/rent for this mock logic
    const mappedType = filterType === "pg" || filterType === "commercial" ? "buy" : filterType;
    if (item.type !== mappedType) return false;

    // Search query (matches City, Locality, or Title)
    if (filterSearch.trim()) {
      const query = filterSearch.toLowerCase().trim();
      const matchCity = item.city.toLowerCase().includes(query);
      const matchLoc = item.locality.toLowerCase().includes(query);
      const matchTitle = item.title.toLowerCase().includes(query);
      if (!matchCity && !matchLoc && !matchTitle) return false;
    }

    // BHK Filter
    if (filterBhk) {
      const bhkVal = parseInt(filterBhk);
      if (bhkVal === 4) {
        // 4+ BHK
        if (!item.bhk.some((val) => val >= 4)) return false;
      } else {
        if (!item.bhk.includes(bhkVal)) return false;
      }
    }

    // Budget Filter
    if (filterBudget) {
      if (filterBudget === "50l" && item.price > 5000000) return false;
      if (filterBudget === "1cr" && (item.price < 5000000 || item.price > 10000000)) return false;
      if (filterBudget === "2cr" && (item.price < 10000000 || item.price > 20000000)) return false;
      if (filterBudget === "above" && item.price < 20000000) return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === "low") return a.price - b.price;
    if (sortBy === "high") return b.price - a.price;
    // Default/verified first (verified are verified)
    return (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0);
  });

  // Highlight listing triggers
  const handleHighlight = (id: number) => {
    setHighlightedId(id);
    const cardElement = document.getElementById(`listing-${id}`);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const openContactModal = (name: string, label: string, phone: string) => {
    setSelectedOwner({ name, label, phone });
    setModalOpen(true);
    document.body.style.overflow = "hidden"; // Lock scroll
  };

  const closeContactModal = () => {
    setModalOpen(false);
    document.body.style.overflow = ""; // Unlock scroll
  };

  return (
    <>
      {/* Filter Sub-Nav Bar */}
      <section className="filter-bar">
        <div className="wrap filter-bar__container">
          <div className="filter-group">
            <select
              aria-label="Property Type"
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="buy">For Sale</option>
              <option value="rent">For Rent</option>
              <option value="pg">PG / Co-living</option>
              <option value="commercial">Commercial</option>
            </select>
            <input
              type="text"
              className="filter-search"
              placeholder="Search Locality or City..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
            <select
              aria-label="BHK"
              className="filter-select"
              value={filterBhk}
              onChange={(e) => setFilterBhk(e.target.value)}
            >
              <option value="">BHK Type</option>
              <option value="1">1 BHK</option>
              <option value="2">2 BHK</option>
              <option value="3">3 BHK</option>
              <option value="4">4+ BHK</option>
            </select>
            <select
              aria-label="Budget"
              className="filter-select"
              value={filterBudget}
              onChange={(e) => setFilterBudget(e.target.value)}
            >
              <option value="">Budget</option>
              <option value="50l">Under ₹50 L</option>
              <option value="1cr">₹50 L - 1 Cr</option>
              <option value="2cr">₹1 Cr - 2 Cr</option>
              <option value="above">Above ₹2 Cr</option>
            </select>
          </div>
        </div>
      </section>

      {/* Listings Main Section */}
      <main className="section--listings">
        <div className="wrap listings-grid">
          {/* Left Column: Properties list */}
          <div
            className="listings-list-col"
            id="listingsListCol"
            style={{ display: isMapViewMobile ? "none" : "block" }}
          >
            <div className="listings-meta">
              <h1 className="listings-title">
                {filteredListings.length} Verified Properties{" "}
                {filterSearch ? `in ${filterSearch}` : "available"}
              </h1>
              <div className="listings-sort">
                <label htmlFor="sortSelect">Sort by:</label>
                <select
                  id="sortSelect"
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="verified">Verified First</option>
                  <option value="low">Price: Low to High</option>
                  <option value="high">Price: High to Low</option>
                </select>
              </div>
            </div>

            <div className="listings-container">
              {filteredListings.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted-slate)" }}>
                  <h3>No properties match your active search filters.</h3>
                  <p style={{ marginTop: "10px" }}>Try clearing search queries or expanding budgets.</p>
                </div>
              ) : (
                filteredListings.map((item) => (
                  <article
                    className={`listing-item ${highlightedId === item.id ? "is-highlighted" : ""}`}
                    id={`listing-${item.id}`}
                    key={item.id}
                    onClick={() => setHighlightedId(item.id)}
                  >
                    <div className="listing-item__img-wrapper">
                      <img src={item.image} alt={item.title} className="listing-item__img" />
                      {item.isRera ? (
                        <span className="listing-item__badge listing-item__badge--rera">RERA APPROVED</span>
                      ) : (
                        <span className="listing-item__badge listing-item__badge--ready">
                          {item.statusBadge || "READY TO MOVE"}
                        </span>
                      )}
                    </div>
                    <div className="listing-item__content">
                      <div className="listing-item__header">
                        <span className="listing-item__tag">
                          <span className="badge__pulse"></span>
                          {item.ownerLabel === "Developer" ? "Verified Builder" : "Owner Verified"}
                        </span>
                        <span className="listing-item__price">{item.priceLabel}</span>
                      </div>
                      <h2 className="listing-item__title">
                        <Link href={`/property/${item.id}`}>{item.title}</Link>
                      </h2>
                      <p className="listing-item__loc">
                        {item.locality}, {item.city}
                      </p>
                      <div className="listing-item__specs">
                        <span>
                          <b>{item.bhkLabel}</b> Apartment
                        </span>
                        <span>
                          <b>{item.area}</b> sq.ft
                        </span>
                        <span>{item.status}</span>
                      </div>
                      <p className="listing-item__excerpt">{item.excerpt}</p>
                      <div className="listing-item__footer">
                        <div className="listing-item__owner">
                          <div className="owner-avatar">
                            {item.ownerName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <span className="owner-name">{item.ownerName}</span>
                            <span className="owner-label">{item.ownerLabel}</span>
                          </div>
                        </div>
                        <button
                          className="btn btn--accent btn--contact"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openContactModal(item.ownerName, item.ownerLabel, item.phone);
                          }}
                        >
                          Contact {item.ownerLabel}
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Map visualization (Sticky) */}
          <div
            className={`listings-map-col ${isMapViewMobile ? "is-visible-mobile" : ""}`}
            id="listingsMapCol"
            style={{ display: !isMapViewMobile && typeof window !== "undefined" && window.innerWidth < 768 ? "none" : "block" }}
          >
            <div className="map-container">
              <img src="/map_placeholder.png" alt="Interactive Map View" className="map-bg" />
              {/* Pins overlapping the map image */}
              {filteredListings.map((item) => (
                <div
                  key={item.id}
                  className={`map-pin ${highlightedId === item.id ? "is-active" : ""}`}
                  style={{
                    top: item.pinCoords.top,
                    left: item.pinCoords.left,
                    position: "absolute",
                  }}
                  onClick={() => handleHighlight(item.id)}
                >
                  <span className="map-pin__price">{item.priceLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Floating Action Button (FAB) for Map Toggle */}
      <button
        className="mobile-map-toggle"
        id="mobileMapToggle"
        onClick={() => setIsMapViewMobile(!isMapViewMobile)}
        aria-label="Toggle Map View"
      >
        {isMapViewMobile ? "📋 View List" : "🗺️ View Map"}
      </button>

      {/* Footer */}
      <footer className="footer">
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
              <li><button type="button" onClick={() => setFilterSearch("Mumbai")} className="btn--link">Mumbai</button></li>
              <li><button type="button" onClick={() => setFilterSearch("Bengaluru")} className="btn--link">Bengaluru</button></li>
              <li><button type="button" onClick={() => setFilterSearch("Pune")} className="btn--link">Pune</button></li>
              <li><button type="button" onClick={() => setFilterSearch("Delhi")} className="btn--link">Delhi NCR</button></li>
              <li><button type="button" onClick={() => setFilterSearch("Hyderabad")} className="btn--link">Hyderabad</button></li>
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

      {/* Owner Contact Details Dialog Modal */}
      <div
        className={`modal-overlay ${modalOpen ? "is-open" : ""}`}
        id="contactModal"
        aria-hidden={!modalOpen}
        role="dialog"
      >
        <div className="modal-card">
          <button className="modal-close" onClick={closeContactModal}>
            ✕
          </button>
          <div className="modal-header">
            <span className="badge badge--modal">
              <span className="badge__pulse"></span>Owner Verified
            </span>
            <h3 className="modal-title">Get Owner Details</h3>
          </div>
          <div className="modal-body">
            <p>Connecting with developer representative or owner details:</p>
            <div className="modal-owner-card">
              <div className="owner-avatar">
                {selectedOwner.name
                  ? selectedOwner.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                  : "SK"}
              </div>
              <div>
                <h4 id="modalOwnerName">{selectedOwner.name || "Suresh Kumar"}</h4>
                <p id="modalOwnerLabel">{selectedOwner.label || "Owner"}</p>
              </div>
            </div>
            <div className="modal-field">
              <span className="modal-label">Verified Number:</span>
              <span className="modal-number" id="modalOwnerNumber">
                {selectedOwner.phone || "+91 98765 43210"}
              </span>
            </div>
            <div className="modal-actions">
              <a
                href={`tel:${selectedOwner.phone.replace(/\s+/g, "")}`}
                className="btn btn--accent modal-btn"
                id="modalCallBtn"
              >
                📞 Call Now
              </a>
              <a
                href={`https://wa.me/${selectedOwner.phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--ghost modal-btn modal-btn--whatsapp"
              >
                💬 WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Listings() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", color: "var(--muted-slate)" }}>
        <h3>Loading verified listings...</h3>
      </div>
    }>
      <ListingsContent />
    </Suspense>
  );
}
