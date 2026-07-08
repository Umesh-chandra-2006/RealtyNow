"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useToast } from "@/app/context/ToastContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { PropertyListing } from "@/lib/actions";
import Link from "next/link";
import Image from "next/image";
import Footer from "../components/Footer";

// Static mock listings to map bookmarks against
const STATIC_MOCK_DATABASE = [
  {
    id: "static-1",
    title: "Meridian Sunview",
    price: 13200000,
    locality: "Whitefield",
    city: "Bengaluru",
    bhk: 3,
    area_sqft: 1450,
    type: "buy",
    image: "/hero_house.webp",
  },
  {
    id: "static-2",
    title: "Cedar Lake Residency",
    price: 7800000,
    locality: "Baner",
    city: "Pune",
    bhk: 2,
    area_sqft: 980,
    type: "buy",
    image: "/bengaluru.webp",
  },
  {
    id: "static-3",
    title: "Urban Elite Apartment",
    price: 95000,
    locality: "Bandra West",
    city: "Mumbai",
    bhk: 2,
    area_sqft: 1200,
    type: "rent",
    image: "/delhi.webp",
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"profile" | "favorites" | "posts">("profile");
  const [favoriteListings, setFavoriteListings] = useState<any[]>([]);
  const [userPostings, setUserPostings] = useState<PropertyListing[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Auth Guard redirect
  useEffect(() => {
    if (!loading && !user) {
      toast("Please log in to access your profile dashboard.", "info");
      router.push("/login?redirect=/profile");
    }
  }, [user, loading, router, toast]);

  // Load User Favorites and Postings
  useEffect(() => {
    if (!user) return;

    async function loadUserData(activeUser: any) {
      setDbLoading(true);
      try {
        let bookmarkedIds: string[] = [];
        let posts: PropertyListing[] = [];

        // 1. Fetch Bookmarked IDs
        if (isSupabaseConfigured() && !activeUser.id.startsWith("mock-")) {
          const { data: favsData } = await supabase
            .from("favorites")
            .select("property_id")
            .eq("user_id", activeUser.id);
          
          bookmarkedIds = favsData?.map((f) => f.property_id) || [];

          // Fetch user postings
          const { data: postsData } = await supabase
            .from("properties")
            .select("*")
            .eq("created_by", activeUser.id);
          posts = postsData || [];
        } else {
          // LocalStorage fallback
          const localFavsKey = `realtynow_favs_${activeUser.id}`;
          bookmarkedIds = JSON.parse(localStorage.getItem(localFavsKey) || "[]");

          const localPropsKey = "realtynow_properties";
          const allProps: PropertyListing[] = JSON.parse(localStorage.getItem(localPropsKey) || "[]");
          posts = allProps.filter((p) => p.created_by === activeUser.id);
        }

        // Map bookmarks to listing details
        const mappedFavs = bookmarkedIds.map((favId) => {
          // Check static mocks
          const staticMatch = STATIC_MOCK_DATABASE.find((s) => s.id === favId);
          if (staticMatch) return staticMatch;

          // Check custom local posts
          const localPropsKey = "realtynow_properties";
          const allProps: PropertyListing[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem(localPropsKey) || "[]") : [];
          const localMatch = allProps.find((p) => p.id === favId);
          if (localMatch) {
            return {
              id: localMatch.id,
              title: localMatch.title,
              price: localMatch.price,
              locality: localMatch.locality,
              city: localMatch.city,
              bhk: localMatch.bhk,
              area_sqft: localMatch.area_sqft,
              type: localMatch.type,
              image: localMatch.image_urls?.[0] || "/hero_house.webp",
            };
          }
          return null;
        }).filter(Boolean);

        setFavoriteListings(mappedFavs);
        setUserPostings(posts);
      } catch (err) {
        console.error("Error loading user profile details:", err);
      } finally {
        setDbLoading(false);
      }
    }

    loadUserData(user);
  }, [user]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg)", color: "#FFFFFF" }}>
        <h3>Loading your account info...</h3>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    toast("Logged out successfully.", "info");
    router.push("/");
  };

  return (
    <main className="detail-page-main" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Background Ambience */}
      <div className="aurora-container" style={{ position: "absolute", width: "100%", height: "400px", overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
        <div className="aurora-glow aurora-glow--navy" style={{ top: "-10%", left: "10%", opacity: 0.15 }}></div>
        <div className="aurora-glow aurora-glow--crimson" style={{ bottom: "-10%", right: "10%", opacity: 0.1 }}></div>
      </div>

      <section className="section" style={{ position: "relative", zIndex: 1, flex: 1, padding: "120px 0 80px" }}>
        <div className="wrap">
          {/* Header Summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", flexWrap: "wrap", gap: "20px" }}>
            <div>
              <span className="section-num mono section-num--accent">Dashboard</span>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.5rem", fontWeight: "800", color: "#FFFFFF", marginTop: "10px" }}>
                Welcome, <span className="hero__title-accent">{profile?.full_name || "RealtyNow Member"}</span>
              </h1>
              <p style={{ color: "var(--muted-slate)", fontSize: "14px", marginTop: "4px" }}>
                Manage your credentials, bookmarks, and posted properties.
              </p>
            </div>
            <button onClick={handleLogout} className="btn btn--ghost" style={{ border: "1px solid var(--line)" }}>
              Logout Account
            </button>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--line)", gap: "10px", marginBottom: "30px" }}>
            <button
              onClick={() => setActiveTab("profile")}
              className={`showcase-tab ${activeTab === "profile" ? "active" : ""}`}
              style={{ padding: "12px 24px", background: "none", border: "none", color: "#FFFFFF", cursor: "pointer", fontWeight: "600", fontSize: "14.5px" }}
            >
              👤 My Credentials
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={`showcase-tab ${activeTab === "favorites" ? "active" : ""}`}
              style={{ padding: "12px 24px", background: "none", border: "none", color: "#FFFFFF", cursor: "pointer", fontWeight: "600", fontSize: "14.5px" }}
            >
              ♥ Bookmarked Properties ({favoriteListings.length})
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`showcase-tab ${activeTab === "posts" ? "active" : ""}`}
              style={{ padding: "12px 24px", background: "none", border: "none", color: "#FFFFFF", cursor: "pointer", fontWeight: "600", fontSize: "14.5px" }}
            >
              🏢 Posted Listings ({userPostings.length}/5)
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-contents">
            {/* 1. PROFILE DETAILS TAB */}
            {activeTab === "profile" && (
              <div className="project-card sheen-glow gradient-border" style={{ padding: "32px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--surface)", maxWidth: "600px" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: "700", color: "#FFFFFF", marginBottom: "20px" }}>
                  Account Specifications
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--muted-slate)", fontSize: "14px" }}>Full Name</span>
                    <strong style={{ color: "#FFFFFF", fontSize: "14px" }}>{profile?.full_name || "Sandbox User"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--muted-slate)", fontSize: "14px" }}>Contact Phone</span>
                    <strong style={{ color: "#FFFFFF", fontSize: "14px" }}>{user.phone || "Mock Account"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--muted-slate)", fontSize: "14px" }}>Registered Role</span>
                    <span className="project-card__badge" style={{ position: "static", transform: "none", textTransform: "uppercase", fontSize: "9px" }}>
                      {profile?.role || "Buyer"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "12px" }}>
                    <span style={{ color: "var(--muted-slate)", fontSize: "14px" }}>Listing Quota Usage</span>
                    <strong style={{ color: userPostings.length >= 5 ? "red" : "#4ADE80", fontSize: "14px" }}>
                      {userPostings.length} of 5 property slots filled
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* 2. FAVORITES TAB */}
            {activeTab === "favorites" && (
              <div>
                {dbLoading ? (
                  <p style={{ color: "var(--muted-slate)" }}>Querying saved listings...</p>
                ) : favoriteListings.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", border: "1px dashed var(--line)", borderRadius: "var(--radius-lg)" }}>
                    <p style={{ color: "var(--muted-slate)", marginBottom: "16px" }}>You have not bookmarked any properties yet.</p>
                    <Link href="/listings" className="btn btn--accent" style={{ display: "inline-flex" }}>
                      Explore Properties
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px" }}>
                    {favoriteListings.map((fav) => (
                      <article key={fav.id} className="project-card sheen-glow gradient-border" style={{ backgroundColor: "var(--surface)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                        <div style={{ height: "180px", position: "relative" }}>
                          <Image src={fav.image} alt={fav.title} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 100vw, 368px" />
                        </div>
                        <div style={{ padding: "20px" }}>
                          <h4 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: "700", color: "#FFFFFF", marginBottom: "4px" }}>
                            {fav.title}
                          </h4>
                          <p style={{ fontSize: "12px", color: "var(--muted-slate)", marginBottom: "12px" }}>
                            {fav.locality}, {fav.city}
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ color: "var(--accent)", fontSize: "16px" }}>
                              {fav.type === "rent" ? `₹ ${fav.price.toLocaleString()} /mo` : `₹ ${(fav.price / 10000000).toFixed(2)} Cr`}
                            </strong>
                            <Link href={`/property/${fav.id}`} className="see-all see-all--accent" style={{ fontSize: "12px", fontWeight: "600" }}>
                              View details &rarr;
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. POSTED PROPERTIES TAB */}
            {activeTab === "posts" && (
              <div>
                {dbLoading ? (
                  <p style={{ color: "var(--muted-slate)" }}>Querying property postings...</p>
                ) : userPostings.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", border: "1px dashed var(--line)", borderRadius: "var(--radius-lg)" }}>
                    <p style={{ color: "var(--muted-slate)", marginBottom: "16px" }}>You have not listed any properties yet.</p>
                    <Link href="/post-property" className="btn btn--accent" style={{ display: "inline-flex" }}>
                      Post Property Free
                    </Link>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                      <span style={{ fontSize: "14px", color: "var(--muted-slate)" }}>
                        You have used {userPostings.length} out of your 5 free listing slots.
                      </span>
                      {userPostings.length < 5 && (
                        <Link href="/post-property" className="btn btn--accent" style={{ padding: "8px 16px", fontSize: "12.5px" }}>
                          + Post Another
                        </Link>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px" }}>
                      {userPostings.map((post) => (
                        <article key={post.id} className="project-card sheen-glow gradient-border" style={{ backgroundColor: "var(--surface)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                          <div style={{ height: "180px", position: "relative" }}>
                            <Image src={post.image_urls?.[0] || "/hero_house.webp"} alt={post.title} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 100vw, 368px" />
                          </div>
                          <div style={{ padding: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                              <h4 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>
                                {post.title}
                              </h4>
                              {post.is_verified && (
                                <span className="project-card__badge" style={{ position: "static", transform: "none", fontSize: "8px", padding: "2px 4px" }}>
                                  VERIFIED
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: "12px", color: "var(--muted-slate)", marginBottom: "12px" }}>
                              {post.locality}, {post.city}
                            </p>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <strong style={{ color: "var(--accent)", fontSize: "16px" }}>
                                {post.type === "rent" ? `₹ ${post.price.toLocaleString()} /mo` : `₹ ${(post.price / 10000000).toFixed(2)} Cr`}
                              </strong>
                              <Link href={`/property/${post.id}`} className="see-all see-all--accent" style={{ fontSize: "12px", fontWeight: "600" }}>
                                View details &rarr;
                              </Link>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
