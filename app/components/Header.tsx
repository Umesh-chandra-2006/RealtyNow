"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

function HeaderContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeType = searchParams.get("type");
  const { user, profile, loading, signOut } = useAuth();

  // Close mobile menu when pathname changes
  useEffect(() => {
    setMobileMenuOpen(false);
    document.body.classList.remove("no-scroll");
  }, [pathname]);

  const toggleMobileMenu = () => {
    const newState = !mobileMenuOpen;
    setMobileMenuOpen(newState);
    if (newState) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase();
    }
    return "U";
  };

  const isLinkActive = (href: string) => {
    // Check if the current pathname is listings
    if (pathname !== "/listings") return false;
    
    // Parse target link parameters
    const targetUrl = new URL(href, "http://localhost:3000");
    const targetType = targetUrl.searchParams.get("type");
    
    return activeType === targetType;
  };

  return (
    <header className={`site-header ${pathname === "/" ? "" : "site-header--opaque"}`}>
      <div className="wrap nav">
        <Link href="/" className="logo" id="logoLink">
          <span className="logo__mark"></span>RealtyNow
        </Link>

        <nav className="nav__links" id="mainNav">
          <Link href="/listings?type=buy" className={isLinkActive("/listings?type=buy") ? "active" : ""}>
            Buy
          </Link>
          <Link href="/listings?type=rent" className={isLinkActive("/listings?type=rent") ? "active" : ""}>
            Rent
          </Link>
          <Link href="/listings?type=pg" className={isLinkActive("/listings?type=pg") ? "active" : ""}>
            PG / Co-living
          </Link>
          <Link href="/listings?type=commercial" className={isLinkActive("/listings?type=commercial") ? "active" : ""}>
            Commercial
          </Link>
          <Link href="/listings?type=projects" className={isLinkActive("/listings?type=projects") ? "active" : ""}>
            New Projects
          </Link>
          <Link href="/services" className={pathname === "/services" ? "active" : ""}>
            Services
          </Link>
        </nav>

        <div className="nav__actions">
          {!loading && user ? (
            <div className="user-profile-badge">
              <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: "10px", color: "inherit", textDecoration: "none" }}>
                <div className="owner-avatar owner-avatar--header">
                  {getInitials()}
                </div>
                <div className="user-profile-badge__info">
                  <span className="user-profile-badge__name">
                    {profile?.full_name || user.phone || "User"}
                  </span>
                  <span className="user-profile-badge__role">
                    {profile?.role || "Buyer"}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                className="btn btn--ghost btn--logout"
                onClick={signOut}
              >
                Logout
              </button>
            </div>
          ) : (
            <Link className={`btn btn--ghost ${pathname === "/login" ? "active" : ""}`} href="/login" id="loginBtn">
              Log in
            </Link>
          )}

          <Link className={`btn btn--accent ${pathname === "/post-property" ? "active" : ""}`} href="/post-property" id="postBtn">
            Post property FREE
          </Link>
        </div>

        <button
          className="nav__toggle"
          id="navToggle"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          onClick={toggleMobileMenu}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      <nav
        className={`nav__links nav__links--mobile ${mobileMenuOpen ? "is-open" : ""}`}
        id="mobileNav"
        aria-hidden={!mobileMenuOpen}
      >
        <Link href="/listings?type=buy" className={isLinkActive("/listings?type=buy") ? "active" : ""}>Buy</Link>
        <Link href="/listings?type=rent" className={isLinkActive("/listings?type=rent") ? "active" : ""}>Rent</Link>
        <Link href="/listings?type=pg" className={isLinkActive("/listings?type=pg") ? "active" : ""}>PG / Co-living</Link>
        <Link href="/listings?type=commercial" className={isLinkActive("/listings?type=commercial") ? "active" : ""}>Commercial</Link>
        <Link href="/listings?type=projects" className={isLinkActive("/listings?type=projects") ? "active" : ""}>New Projects</Link>
        <Link href="/services" className={pathname === "/services" ? "active" : ""}>Services</Link>
        {!loading && user ? (
          <button
            type="button"
            className="btn btn--ghost btn--mobile-logout"
            onClick={signOut}
          >
            Logout ({profile?.full_name || user.phone || "User"})
          </button>
        ) : (
          <Link href="/login" className="btn btn--ghost btn--mobile-login">
            Log in
          </Link>
        )}
        <Link href="/post-property" className="btn btn--accent" id="mobilePostBtn">
          Post property FREE
        </Link>
      </nav>
    </header>
  );
}

export default function Header() {
  return (
    <Suspense fallback={
      <header className="site-header site-header--opaque">
        <div className="wrap nav">
          <Link href="/" className="logo">
            <span className="logo__mark"></span>RealtyNow
          </Link>
        </div>
      </header>
    }>
      <HeaderContent />
    </Suspense>
  );
}

