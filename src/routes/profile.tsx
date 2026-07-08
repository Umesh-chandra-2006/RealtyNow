import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { PropertyListing } from "@/lib/actions";
import { listings } from "@/data/listings";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { User, ShieldCheck, Heart, Building, LogOut } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<"profile" | "favorites" | "posts">("profile");
  const [favoriteListings, setFavoriteListings] = useState<any[]>([]);
  const [userPostings, setUserPostings] = useState<PropertyListing[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Auth Guard redirect
  useEffect(() => {
    if (!loading && !user) {
      toast.info("Please log in to access your profile dashboard.");
      navigate({ to: "/login", search: { redirect: "/profile" } });
    }
  }, [user, loading]);

  // Load User Favorites and Postings
  useEffect(() => {
    if (!user) return;

    async function loadUserData(activeUser: any) {
      setDbLoading(true);
      try {
        let bookmarkedIds: string[] = [];
        let posts: PropertyListing[] = [];

        // Fetch bookmarks and listings
        if (isSupabaseConfigured() && !activeUser.id.startsWith("mock-")) {
          const { data: favsData } = await supabase
            .from("favorites")
            .select("property_id")
            .eq("user_id", activeUser.id);

          bookmarkedIds = favsData?.map((f) => f.property_id) || [];

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
        const mappedFavs = bookmarkedIds
          .map((favId) => {
            // Check static listings
            const listingMatch = listings.find((s) => s.id === favId);
            if (listingMatch) return listingMatch;

            // Check custom local posts
            const localPropsKey = "realtynow_properties";
            const allProps: PropertyListing[] =
              typeof window !== "undefined"
                ? JSON.parse(localStorage.getItem(localPropsKey) || "[]")
                : [];
            const localMatch = allProps.find((p) => p.id === favId);
            if (localMatch) {
              return {
                id: localMatch.id,
                title: localMatch.title,
                price: localMatch.price,
                priceLabel: `₹${localMatch.price.toLocaleString("en-IN")}`,
                locality: localMatch.locality,
                city: localMatch.city,
                bedrooms: localMatch.bhk,
                bathrooms: localMatch.bhk,
                areaSqft: localMatch.area_sqft,
                cadence: localMatch.type === "buy" ? "sale" : "rent",
                photo: localMatch.image_urls?.[0] || "",
              };
            }
            return null;
          })
          .filter(Boolean);

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
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <h3 className="text-lg font-semibold animate-pulse">Loading your account info...</h3>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    toast.success("Logged out successfully.");
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="relative flex-1 px-4 py-24">
        {/* Background Aurora blurs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[10%] left-[10%] h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[10%] h-[400px] w-[400px] rounded-full bg-primary/8 blur-[120px]" />
        </div>

        <div className="container-page relative z-10">
          {/* Header Summary */}
          <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                Dashboard
              </span>
              <h1 className="mt-2 font-display text-4xl font-extrabold text-foreground md:text-5xl">
                Welcome, <span className="text-primary">{profile?.full_name || "Member"}</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage your credentials, bookmarks, and posted properties.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout Account</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-border gap-2 mb-8 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === "profile"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-4 w-4" />
              <span>My Credentials</span>
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={`flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === "favorites"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className="h-4 w-4" />
              <span>Bookmarked ({favoriteListings.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === "posts"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building className="h-4 w-4" />
              <span>Posted ({userPostings.length}/5)</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-contents">
            {/* 1. PROFILE DETAILS TAB */}
            {activeTab === "profile" && (
              <div className="w-full max-w-[600px] rounded-3xl bg-card p-6 md:p-8 shadow-card ring-1 ring-border">
                <h3 className="font-display text-xl font-bold text-foreground mb-6">
                  Account Specifications
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Full Name</span>
                    <strong className="text-sm text-foreground">{profile?.full_name || "Sandbox User"}</strong>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Contact Phone</span>
                    <strong className="text-sm text-foreground">{user.phone || "Mock Account"}</strong>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Registered Role</span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {profile?.role || "Buyer"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground">Listing Quota Usage</span>
                    <strong
                      className={`text-sm ${
                        userPostings.length >= 5 ? "text-red-500" : "text-emerald-500"
                      }`}
                    >
                      {userPostings.length} of 5 slots filled
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* 2. FAVORITES TAB */}
            {activeTab === "favorites" && (
              <div>
                {dbLoading ? (
                  <p className="text-sm text-muted-foreground">Querying saved listings...</p>
                ) : favoriteListings.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground mb-6">You have not bookmarked any properties yet.</p>
                    <Link
                      to="/browse"
                      className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
                    >
                      Explore Properties
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {favoriteListings.map((fav) => (
                      <article
                        key={fav.id}
                        className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border transition-all hover:scale-[1.01] flex flex-col"
                      >
                        <div className="relative h-48 w-full bg-surface">
                          {fav.photo && (
                            <img
                              src={fav.photo}
                              alt={fav.title}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-display text-lg font-bold text-foreground line-clamp-1">
                              {fav.title}
                            </h4>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {fav.locality}, {fav.city}
                            </p>
                          </div>
                          <div className="mt-6 flex items-center justify-between">
                            <strong className="text-base text-primary">
                              {fav.priceLabel}
                            </strong>
                            <Link
                              to="/listing/$id"
                              params={{ id: fav.id }}
                              className="text-xs font-semibold text-foreground hover:text-primary transition-colors"
                            >
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
                  <p className="text-sm text-muted-foreground">Querying property postings...</p>
                ) : userPostings.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground mb-6">You have not listed any properties yet.</p>
                    <Link
                      to="/owner/submit"
                      className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
                    >
                      Post Property Free
                    </Link>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <span className="text-sm text-muted-foreground">
                        You have used {userPostings.length} out of your 5 free listing slots.
                      </span>
                      {userPostings.length < 5 && (
                        <Link
                          to="/owner/submit"
                          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
                        >
                          + Post Another
                        </Link>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {userPostings.map((post) => (
                        <article
                          key={post.id}
                          className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border transition-all hover:scale-[1.01] flex flex-col"
                        >
                          <div className="relative h-48 w-full bg-surface">
                            {post.image_urls?.[0] && (
                              <img
                                src={post.image_urls[0]}
                                alt={post.title}
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div className="p-5 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-display text-lg font-bold text-foreground line-clamp-1">
                                  {post.title}
                                </h4>
                                {post.is_verified && (
                                  <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-emerald-500">
                                    VERIFIED
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {post.locality}, {post.city}
                              </p>
                            </div>
                            <div className="mt-6 flex items-center justify-between">
                              <strong className="text-base text-primary">
                                {post.type === "rent"
                                  ? `₹ ${post.price.toLocaleString("en-IN")} /mo`
                                  : `₹ ${(post.price / 10000000).toFixed(2)} Cr`}
                              </strong>
                              <Link
                                to="/listing/$id"
                                params={{ id: post.id }}
                                className="text-xs font-semibold text-foreground hover:text-primary transition-colors"
                              >
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
      </main>

      <SiteFooter />
    </div>
  );
}
