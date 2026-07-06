"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

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

  return (
    <>
      {/* Top bar (Marketing Announcement) */}
      <div className="topbar">
        <div className="wrap topbar__row">
          <span>India's fastest-growing property marketplace</span>
          <div className="topbar__links">
            <a href="#builders">For builders</a>
            <a href="#help">Help center</a>
            <a href="#app">Download app</a>
          </div>
        </div>
      </div>

      {/* Main Site Header */}
      <header className="site-header">
        <div className="wrap nav">
          <Link href="/" className="logo" id="logoLink">
            <span className="logo__mark"></span>RealtyNow
          </Link>

          <nav className="nav__links" id="mainNav">
            <Link href="/listings?type=buy" className={pathname === "/listings" ? "active" : ""}>
              Buy
            </Link>
            <Link href="/listings?type=rent" className={pathname === "/listings" ? "active" : ""}>
              Rent
            </Link>
            <Link href="/listings?type=pg" className={pathname === "/listings" ? "active" : ""}>
              PG / Co-living
            </Link>
            <Link href="/listings?type=commercial" className={pathname === "/listings" ? "active" : ""}>
              Commercial
            </Link>
            <Link href="/listings?type=projects" className={pathname === "/listings" ? "active" : ""}>
              New Projects
            </Link>
          </nav>

          <div className="nav__actions">
            <Link className={`btn btn--ghost ${pathname === "/login" ? "active" : ""}`} href="/login" id="loginBtn">
              Log in
            </Link>
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
          style={{ display: mobileMenuOpen ? "flex" : "none" }}
        >
          <Link href="/listings?type=buy">Buy</Link>
          <Link href="/listings?type=rent">Rent</Link>
          <Link href="/listings?type=pg">PG / Co-living</Link>
          <Link href="/listings?type=commercial">Commercial</Link>
          <Link href="/listings?type=projects">New Projects</Link>
          <Link href="/post-property" className="btn btn--accent" id="mobilePostBtn">
            Post property FREE
          </Link>
        </nav>
      </header>
    </>
  );
}
