"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { toggleFavorite as apiToggleFavorite } from "@/lib/actions";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useToast } from "@/app/context/ToastContext";
import Footer from "@/app/components/Footer";
import FavoriteButton from "@/app/components/FavoriteButton";

export interface ListingItem {
  id: string;
  title: string;
  price: number;
  priceLabel: string;
  locality: string;
  city: string;
  bhk: number[];
  bhkLabel: string;
  area: string;
  status: string;
  type: string;
  subType: string;
  excerpt: string;
  ownerName: string;
  ownerLabel: string;
  phone: string;
  image: string;
  isRera: boolean;
  isVerified: boolean;
  pinCoords: { top: string; left: string };
}

// Static mock listings
const MOCK_LISTINGS = [
  {
    id: "static-1",
    title: "Meridian Sunview",
    price: 13200000,
    priceLabel: "₹ 1.32 Cr",
    locality: "Whitefield",
    city: "Bengaluru",
    bhk: [2, 3],
    bhkLabel: "2-3 BHK",
    area: "980-1450",
    status: "Ready to Move",
    type: "buy",
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
    id: "static-2",
    title: "Cedar Lake Residency",
    price: 7800000,
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
    id: "static-3",
    title: "Palm Coast Villas",
    price: 24000000,
    priceLabel: "₹ 2.40 Cr",
    locality: "ECR",
    city: "Chennai",
    bhk: [3, 4],
    bhkLabel: "3-4 BHK",
    area: "2100-2850",
    status: "Under Construction",
    type: "buy",
    subType: "villa",
    excerpt: "Premium luxury villa with smart home automation, private plunge pool, and beautiful sea-facing garden terraces.",
    ownerName: "Palm Construct",
    ownerLabel: "Developer Representative",
    phone: "+91 76543 21098",
    image: "/delhi.webp",
    isRera: true,
    isVerified: true,
    pinCoords: { top: "60%", left: "30%" },
  },
];

function ListingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  // Search parameters
  const paramType = searchParams.get("type") || "buy";
  const paramCity = searchParams.get("city") || "";
  const paramBhk = searchParams.get("bhk") || "";
  const paramBudget = searchParams.get("budget") || "";

  // Filter States
  const [filterType, setFilterType] = useState(paramType);
  const [filterSearch, setFilterSearch] = useState(paramCity);
  const [filterBhk, setFilterBhk] = useState(paramBhk);
  const [filterBudget, setFilterBudget] = useState(paramBudget);
  const [sortBy, setSortBy] = useState("verified");

  // Dynamic Listings and Favorites state
  const [listings, setListings] = useState<ListingItem[]>(MOCK_LISTINGS);
  const [userFavorites, setUserFavorites] = useState<string[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  // Interaction States
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [isMapViewMobile, setIsMapViewMobile] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState({
    name: "",
    label: "",
    phone: "",
  });

  // 1. Fetch Listings (Merged Supabase + LocalStorage + Mock)
  useEffect(() => {
    async function loadListings() {
      setLoadingListings(true);
      const isDev = process.env.NODE_ENV !== "production";
      let merged: ListingItem[] = isDev ? [...MOCK_LISTINGS] : [];

      // A. Load from LocalStorage (dev-only sandbox simulation testing)
      if (isDev) {
        try {
          const localKey = "realtynow_properties";
          const localStr = localStorage.getItem(localKey);
          if (localStr) {
            const localProps = JSON.parse(localStr);
            const localMapped = localProps.map((item: any, idx: number) => ({
              id: item.id,
              title: item.title,
              price: item.price,
              priceLabel: `₹ ${item.price >= 10000000 ? (item.price / 10000000).toFixed(2) + " Cr" : (item.price / 100000).toFixed(0) + " L"}`,
              locality: item.locality,
              city: item.city,
              bhk: [item.bhk],
              bhkLabel: `${item.bhk} BHK`,
              area: `${item.area_sqft}`,
              status: item.is_rera_approved ? "Under Construction" : "Ready to Move",
              type: item.type,
              subType: item.sub_type,
              excerpt: item.description,
              ownerName: "Verified User",
              ownerLabel: "Owner",
              phone: "+91 99999 88888",
              image: item.image_urls?.[0] || "/hero_house.webp",
              isRera: item.is_rera_approved,
              isVerified: true,
              pinCoords: { top: `${30 + (idx * 10) % 50}%`, left: `${40 + (idx * 15) % 45}%` },
            }));
            merged = [...merged, ...localMapped];
          }
        } catch (e) {
          console.error("Error reading local properties:", e);
        }
      }

      // B. Load from Supabase Database
      if (isSupabaseConfigured()) {
        try {
          let query = supabase
            .from("properties")
            .select("*, public_profiles(full_name, role)")
            .limit(100); // Set a safety ceiling limit to avoid downloading the entire collection

          // Server-side filtering by property intent type
          const mappedType = filterType === "pg" || filterType === "commercial" ? "buy" : filterType;
          query = query.eq("type", mappedType);

          // Server-side search filter
          if (filterSearch.trim()) {
            const queryTerm = filterSearch.toLowerCase().trim();
            query = query.or("city.ilike.%" + queryTerm + "%,locality.ilike.%" + queryTerm + "%,title.ilike.%" + queryTerm + "%");
          }

          // Server-side BHK filter
          if (filterBhk) {
            const bhkVal = parseInt(filterBhk);
            if (bhkVal === 4) {
              query = query.gte("bhk", 4);
            } else {
              query = query.eq("bhk", bhkVal);
            }
          }

          // Server-side Budget filter
          if (filterBudget) {
            if (filterBudget === "50l") {
              query = query.lte("price", 5000000);
            } else if (filterBudget === "1cr") {
              query = query.gte("price", 5000000).lte("price", 10000000);
            } else if (filterBudget === "2cr") {
              query = query.gte("price", 10000000).lte("price", 20000000);
            } else if (filterBudget === "above") {
              query = query.gte("price", 20000000);
            }
          }

          // Server-side sorting
          if (sortBy === "low") {
            query = query.order("price", { ascending: true });
          } else if (sortBy === "high") {
            query = query.order("price", { ascending: false });
          } else {
            query = query.order("is_verified", { ascending: false });
          }

          const { data, error } = await query;
          
          if (error) throw error;
          if (data) {
            const dbMapped = data.map((item: any, idx: number) => ({
              id: item.id,
              title: item.title,
              price: item.price,
              priceLabel: `₹ ${item.price >= 10000000 ? (item.price / 10000000).toFixed(2) + " Cr" : (item.price / 100000).toFixed(0) + " L"}`,
              locality: item.locality,
              city: item.city,
              bhk: [item.bhk],
              bhkLabel: `${item.bhk} BHK`,
              area: `${item.area_sqft}`,
              status: item.is_rera_approved ? "Under Construction" : "Ready to Move",
              type: item.type,
              subType: item.sub_type,
              excerpt: item.description,
              ownerName: item.public_profiles?.full_name || "Verified Member",
              ownerLabel: item.public_profiles?.role || "Owner",
              phone: "+91 XXXXX XXXXX", // Masked in feed for privacy; revealed on detail page after callback request
              image: item.image_urls?.[0] || "/hero_house.webp",
              isRera: item.is_rera_approved,
              isVerified: item.is_verified,
              pinCoords: { top: `${20 + (idx * 12) % 60}%`, left: `${25 + (idx * 18) % 55}%` },
            }));
            merged = [...merged, ...dbMapped];
          }
        } catch (e) {
          console.error("Error fetching database listings:", e);
        }
      }

      setListings(merged);
      setLoadingListings(false);
    }

    loadListings();
  }, [filterType, sortBy, filterSearch, filterBhk, filterBudget]);

  // 2. Fetch User Favorites
  useEffect(() => {
    async function loadFavorites() {
      if (!user) {
        setUserFavorites([]);
        return;
      }

      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase
            .from("favorites")
            .select("property_id")
            .eq("user_id", user.id);
          
          if (error) throw error;
          if (data) {
            setUserFavorites(data.map((f: any) => f.property_id));
          }
        } catch (e) {
          console.error("Error fetching database favorites:", e);
        }
      } else {
        const localKey = `realtynow_favs_${user.id}`;
        const localStr = localStorage.getItem(localKey) || "[]";
        setUserFavorites(JSON.parse(localStr));
      }
    }
    loadFavorites();
  }, [user]);

  // Handle Favorites Toggling
  const handleToggleFavorite = async (propertyId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast("Please log in to save properties to your portfolio.", "info");
      router.push(`/login?redirect=/listings`);
      return;
    }

    try {
      const res = await apiToggleFavorite(user.id, propertyId);
      if (res.success) {
        setUserFavorites((prev) => {
          if (prev.includes(propertyId)) {
            return prev.filter((id) => id !== propertyId);
          } else {
            return [...prev, propertyId];
          }
        });
      }
    } catch (err: any) {
      toast(err.message || "Error saving bookmark.", "error");
    }
  };

  // Sync state filters if URL parameters change
  useEffect(() => {
    setFilterType(paramType);
    setFilterSearch(paramCity);
    setFilterBhk(paramBhk);
    setFilterBudget(paramBudget);
  }, [paramType, paramCity, paramBhk, paramBudget]);

  // Filter listings logic
  const filteredListings = listings.filter((item) => {
    // Intent type filter
    const mappedType = filterType === "pg" || filterType === "commercial" ? "buy" : filterType;
    if (item.type !== mappedType) return false;

    // Search locality filter
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
        if (!item.bhk.some((val: number) => val >= 4)) return false;
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
    return (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0);
  });

  const handleHighlight = (id: string) => {
    setHighlightedId(id);
    const cardElement = document.getElementById(`listing-${id}`);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const openContactModal = (name: string, label: string, phone: string) => {
    if (!user) {
      toast("Authentication required. Please log in to view verified owner contact details.", "info");
      router.push(`/login?redirect=/listings`);
      return;
    }
    setSelectedOwner({ name, label, phone });
    setModalOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeContactModal = () => {
    setModalOpen(false);
    document.body.style.overflow = "";
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
                {loadingListings ? "Syncing Listings..." : `${filteredListings.length} Verified Properties`}
                {!loadingListings && filterSearch ? ` in ${filterSearch}` : ""}
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
              {loadingListings ? (
                <div style={{ padding: "80px 20px", textAlign: "center", color: "var(--muted-slate)" }}>
                  <h3>Loading listings database...</h3>
                </div>
              ) : filteredListings.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted-slate)" }}>
                  <h3>No properties match your active search filters.</h3>
                  <p style={{ marginTop: "10px" }}>Try clearing search queries or expanding budgets.</p>
                </div>
              ) : (
                filteredListings.map((item) => {
                  const isFavorited = userFavorites.includes(String(item.id));
                  return (
                    <article
                      className={`listing-item ${highlightedId === item.id ? "is-highlighted" : ""}`}
                      id={`listing-${item.id}`}
                      key={item.id}
                      onClick={() => setHighlightedId(item.id)}
                    >
                      <div className="listing-item__img-wrapper">
                        <Image src={item.image} alt={item.title} className="listing-item__img" width={240} height={240} style={{ objectFit: "cover" }} />
                        <FavoriteButton
                          propertyId={String(item.id)}
                          className="project-card__heart listing-item__heart"
                          isFavorited={isFavorited}
                        />
                        {item.isRera ? (
                          <span className="listing-item__badge listing-item__badge--rera">RERA APPROVED</span>
                        ) : (
                          <span className="listing-item__badge listing-item__badge--ready">READY TO MOVE</span>
                        )}
                      </div>
                      <div className="listing-item__content">
                        <div className="listing-item__header">
                          <span className="listing-item__tag">
                            <span className="badge__pulse"></span>
                            {item.ownerLabel === "builder" || item.ownerLabel === "Developer"
                              ? "Verified Builder"
                              : "Owner Verified"}
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
                                .map((n: string) => n[0])
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
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Map visualization (Sticky) */}
          <div
            className={`listings-map-col ${isMapViewMobile ? "is-visible-mobile" : ""}`}
            id="listingsMapCol"
          >
            <div className="map-container">
              <Image src="/map_placeholder.png" alt="Interactive Map View" className="map-bg" width={400} height={600} style={{ objectFit: "cover" }} />
              {filteredListings.map((item) => (
                <div
                  key={item.id}
                  className={`map-pin ${highlightedId === item.id ? "is-active" : ""}`}
                  style={{
                    top: item.pinCoords.top,
                    left: item.pinCoords.left,
                    position: "absolute",
                  }}
                  onClick={() => handleHighlight(String(item.id))}
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
        {isMapViewMobile ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            View List
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
              <line x1="9" y1="3" x2="9" y2="18"></line>
              <line x1="15" y1="6" x2="15" y2="21"></line>
            </svg>
            View Map
          </>
        )}
      </button>

      <Footer onCityClick={setFilterSearch} />

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
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", color: "var(--muted-slate)" }}>
          <h3>Syncing listings database...</h3>
        </div>
      }
    >
      <ListingsContent />
    </Suspense>
  );
}
