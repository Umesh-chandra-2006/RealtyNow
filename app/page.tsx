"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  // Search widget state
  const [activeTab, setActiveTab] = useState<"buy" | "rent" | "pg" | "commercial">("buy");
  const [cityInput, setCityInput] = useState("");
  const [bhkInput, setBhkInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [hasError, setHasError] = useState(false);

  // Favorites state
  const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({
    "1": false,
    "2": false,
    "3": false,
  });

  const cityInputRef = useRef<HTMLInputElement>(null);

  // IntersectionObserver for Scroll Reveal
  useEffect(() => {
    const scrollElements = document.querySelectorAll(".reveal-scroll");
    if ("IntersectionObserver" in window && scrollElements.length > 0) {
      const scrollObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        {
          root: null,
          rootMargin: "0px 0px -60px 0px",
          threshold: 0.1,
        }
      );
      scrollElements.forEach((el) => scrollObserver.observe(el));
      return () => scrollObserver.disconnect();
    } else {
      scrollElements.forEach((el) => el.classList.add("is-visible"));
    }
  }, []);

  const handleTabChange = (tab: "buy" | "rent" | "pg" | "commercial") => {
    setActiveTab(tab);
    setHasError(false);
  };

  const handleTagClick = (city: string) => {
    setCityInput(city);
    setHasError(false);
    if (cityInputRef.current) {
      cityInputRef.current.focus();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityInput.trim()) {
      setHasError(true);
      if (cityInputRef.current) {
        cityInputRef.current.focus();
      }
      return;
    }

    // Redirect to listings page with parameters
    const params = new URLSearchParams();
    params.set("type", activeTab);
    params.set("city", cityInput);
    if (bhkInput) params.set("bhk", bhkInput);
    if (budgetInput) params.set("budget", budgetInput);

    router.push(`/listings?${params.toString()}`);
  };

  const handleCityCellClick = (city: string) => {
    router.push(`/listings?type=${activeTab}&city=${city}`);
  };

  const handleCategoryClick = (category: string) => {
    router.push(`/listings?type=${category}`);
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Dynamic placeholder text for search bar
  const getPlaceholderText = () => {
    if (activeTab === "commercial") {
      return "Search office, retail park or building — e.g. Gachibowli";
    } else if (activeTab === "pg") {
      return "Search student hostings, co-living hubs — e.g. Baner";
    } else {
      return "Search city, locality or project — e.g. Mumbai";
    }
  };

  return (
    <main>
      {/* Hero Section */}
      <section className="hero" id="heroSection">
        <div className="hero__background" aria-hidden="true">
          <img
            src="/mumbai.webp"
            alt="City Skyline Backdrop"
            className="hero__bg-image"
            width={1200}
            height={600}
          />
          <div className="hero__bg-overlay"></div>
        </div>

        <div className="wrap hero__content">
          <div className="badge-wrapper animate-reveal">
            <span className="badge">
              <span className="badge__pulse" aria-hidden="true"></span>
              12,400+ verified listings added this week
            </span>
          </div>

          <h1 className="hero__title animate-reveal">
            Find a home that feels
            <br />
            <span className="hero__title-accent">exactly like you.</span>
          </h1>

          <p className="hero__subtitle animate-reveal">
            Search verified apartments, plots, PGs and commercial spaces across India — with real photos, real prices, real owners.
          </p>

          {/* Search Widget Card */}
          <div className="search-card animate-reveal">
            <div className="search-tabs" id="searchTabs" role="tablist">
              <button
                type="button"
                className={activeTab === "buy" ? "active" : ""}
                onClick={() => handleTabChange("buy")}
                role="tab"
                aria-selected={activeTab === "buy"}
                id="tabBuy"
              >
                Buy
              </button>
              <button
                type="button"
                className={activeTab === "rent" ? "active" : ""}
                onClick={() => handleTabChange("rent")}
                role="tab"
                aria-selected={activeTab === "rent"}
                id="tabRent"
              >
                Rent
              </button>
              <button
                type="button"
                className={activeTab === "pg" ? "active" : ""}
                onClick={() => handleTabChange("pg")}
                role="tab"
                aria-selected={activeTab === "pg"}
                id="tabPg"
              >
                PG / Co-living
              </button>
              <button
                type="button"
                className={activeTab === "commercial" ? "active" : ""}
                onClick={() => handleTabChange("commercial")}
                role="tab"
                aria-selected={activeTab === "commercial"}
                id="tabCommercial"
              >
                Commercial
              </button>
            </div>

            <form className="search-fields" id="searchForm" onSubmit={handleSearchSubmit}>
              <div className={`search-field search-field--wide ${hasError ? "has-error" : ""}`}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M21 21l-4.35-4.35" />
                  <circle cx="10" cy="10" r="7" />
                </svg>
                <input
                  type="text"
                  id="cityInput"
                  ref={cityInputRef}
                  value={cityInput}
                  onChange={(e) => {
                    setCityInput(e.target.value);
                    if (e.target.value) setHasError(false);
                  }}
                  placeholder={getPlaceholderText()}
                  aria-label="City, locality or project"
                />
              </div>

              <div className="search-field">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                <select
                  id="bhkInput"
                  value={bhkInput}
                  onChange={(e) => setBhkInput(e.target.value)}
                  aria-label="Configuration"
                >
                  <option value="">Configuration</option>
                  <option value="1">1 BHK</option>
                  <option value="2">2 BHK</option>
                  <option value="3">3 BHK</option>
                  <option value="4">4+ BHK</option>
                </select>
              </div>

              <div className="search-field">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <select
                  id="budgetInput"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  aria-label="Budget"
                >
                  <option value="">Budget</option>
                  <option value="50l">Under ₹50 L</option>
                  <option value="1cr">₹50 L – 1 Cr</option>
                  <option value="2cr">₹1 Cr – 2 Cr</option>
                  <option value="above">Above ₹2 Cr</option>
                </select>
              </div>

              <button type="submit" className="search-submit" id="searchSubmitBtn">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  aria-hidden="true"
                >
                  <path d="M21 21l-4.35-4.35" />
                  <circle cx="10" cy="10" r="7" />
                </svg>
                Search
              </button>
            </form>

            <div className="popular-tags">
              <span className="popular-tags__label">Trending:</span>
              <button type="button" className="tag-btn" onClick={() => handleTagClick("Mumbai")}>
                Mumbai
              </button>
              <button type="button" className="tag-btn" onClick={() => handleTagClick("Bengaluru")}>
                Bengaluru
              </button>
              <button type="button" className="tag-btn" onClick={() => handleTagClick("Pune")}>
                Pune
              </button>
              <button type="button" className="tag-btn" onClick={() => handleTagClick("Delhi NCR")}>
                Delhi NCR
              </button>
              <button type="button" className="tag-btn" onClick={() => handleTagClick("Hyderabad")}>
                Hyderabad
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip block */}
      <section className="section--stats-bar" aria-label="RealtyNow Statistics">
        <div className="wrap">
          <div className="stat-strip animate-reveal">
            <div className="stat-card">
              <span className="stat-card__value mono">2.4M+</span>
              <span className="stat-card__label">Listings Live</span>
            </div>
            <div className="stat-divider" aria-hidden="true"></div>
            <div className="stat-card">
              <span className="stat-card__value mono">28</span>
              <span className="stat-card__label">Cities Covered</span>
            </div>
            <div className="stat-divider" aria-hidden="true"></div>
            <div className="stat-card">
              <span className="stat-card__value mono">96%</span>
              <span className="stat-card__label">Owner-Verified</span>
            </div>
            <div className="stat-divider" aria-hidden="true"></div>
            <div className="stat-card">
              <span className="stat-card__value mono">4.7★</span>
              <span className="stat-card__label">User Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Cities Section */}
      <section className="section section--cities" id="citiesSection">
        <div className="wrap">
          <div className="section-head reveal-scroll">
            <div className="section-head__title-group">
              <span className="section-num mono">01 /</span>
              <h2>Explore properties by city</h2>
            </div>
            <Link className="see-all" href="/listings" id="allCitiesLink">
              View all cities →
            </Link>
          </div>

          <div className="bento-grid reveal-scroll">
            {/* Mumbai */}
            <div
              className="bento-cell bento-cell--hero"
              onClick={() => handleCityCellClick("Mumbai")}
              style={{ cursor: "pointer" }}
            >
              <img
                src="/mumbai.webp"
                alt="Aerial view of Bandra-Worli Sea Link and Mumbai coastal towers"
                className="bento-cell__img"
                loading="lazy"
                width={768}
                height={464}
              />
              <div className="bento-cell__overlay"></div>
              <div className="bento-cell__content">
                <span className="bento-cell__count mono">3,20,000+ Listings</span>
                <h3 className="bento-cell__title">Mumbai</h3>
                <p className="bento-cell__desc">
                  Coastal luxury apartments, high-end high rises, and premium commercial hubs.
                </p>
              </div>
            </div>

            {/* Bengaluru */}
            <div
              className="bento-cell"
              onClick={() => handleCityCellClick("Bengaluru")}
              style={{ cursor: "pointer" }}
            >
              <img
                src="/bengaluru.webp"
                alt="Modern green residential building facade in Bengaluru"
                className="bento-cell__img"
                loading="lazy"
                width={368}
                height={220}
              />
              <div className="bento-cell__overlay"></div>
              <div className="bento-cell__content">
                <span className="bento-cell__count mono">2,80,000+ Listings</span>
                <h3 className="bento-cell__title">Bengaluru</h3>
              </div>
            </div>

            {/* Delhi */}
            <div
              className="bento-cell"
              onClick={() => handleCityCellClick("Delhi")}
              style={{ cursor: "pointer" }}
            >
              <img
                src="/delhi.webp"
                alt="Contemporary brick and sandstone villa architecture in Delhi"
                className="bento-cell__img"
                loading="lazy"
                width={368}
                height={220}
              />
              <div className="bento-cell__overlay"></div>
              <div className="bento-cell__content">
                <span className="bento-cell__count mono">2,95,000+ Listings</span>
                <h3 className="bento-cell__title">Delhi NCR</h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="section section--compact section--categories" id="categoriesSection">
        <div className="wrap">
          <div className="section-head reveal-scroll">
            <div className="section-head__title-group">
              <h2>What are you looking for?</h2>
            </div>
          </div>

          <div className="category-grid reveal-scroll">
            <div
              className="category-card"
              id="catApartments"
              onClick={() => handleCategoryClick("buy")}
              style={{ backgroundImage: "url('/cat_apartments.png')", cursor: "pointer" }}
            >
              <div className="category-card__overlay"></div>
              <div className="category-card__content">
                <h3 className="category-card__label">Apartments</h3>
                <p className="category-card__desc">Premium flats & builder floors</p>
              </div>
            </div>

            <div
              className="category-card"
              id="catVillas"
              onClick={() => handleCategoryClick("buy")}
              style={{ backgroundImage: "url('/cat_villas.png')", cursor: "pointer" }}
            >
              <div className="category-card__overlay"></div>
              <div className="category-card__content">
                <h3 className="category-card__label">Independent House</h3>
                <p className="category-card__desc">Luxury villas & bungalows</p>
              </div>
            </div>

            <div
              className="category-card"
              id="catPlots"
              onClick={() => handleCategoryClick("buy")}
              style={{ backgroundImage: "url('/cat_plots.png')", cursor: "pointer" }}
            >
              <div className="category-card__overlay"></div>
              <div className="category-card__content">
                <h3 className="category-card__label">Plots & Land</h3>
                <p className="category-card__desc">Premium residential plots</p>
              </div>
            </div>

            <div
              className="category-card"
              id="catColiving"
              onClick={() => handleCategoryClick("pg")}
              style={{ backgroundImage: "url('/cat_coliving.png')", cursor: "pointer" }}
            >
              <div className="category-card__overlay"></div>
              <div className="category-card__content">
                <h3 className="category-card__label">PG & Co-living</h3>
                <p className="category-card__desc">Managed student & shared stays</p>
              </div>
            </div>

            <div
              className="category-card"
              id="catOffices"
              onClick={() => handleCategoryClick("commercial")}
              style={{ backgroundImage: "url('/cat_offices.png')", cursor: "pointer" }}
            >
              <div className="category-card__overlay"></div>
              <div className="category-card__content">
                <h3 className="category-card__label">Office Spaces</h3>
                <p className="category-card__desc">Grade-A commercial offices</p>
              </div>
            </div>

            <div
              className="category-card"
              id="catRetail"
              onClick={() => handleCategoryClick("commercial")}
              style={{ backgroundImage: "url('/cat_retail.png')", cursor: "pointer" }}
            >
              <div className="category-card__overlay"></div>
              <div className="category-card__content">
                <h3 className="category-card__label">Retail & Showrooms</h3>
                <p className="category-card__desc">High-footfall commercial spaces</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Projects Section */}
      <section className="section section--projects" id="projectsSection">
        <div className="wrap">
          <div className="section-head reveal-scroll">
            <div className="section-head__title-group">
              <h2>Featured new launches</h2>
              <p className="section-head__desc">Handpicked residential projects from RERA-registered builders.</p>
            </div>
            <Link className="see-all" href="/listings" id="allProjectsLink">
              Browse all projects →
            </Link>
          </div>

          <div className="project-grid reveal-scroll">
            {/* Property Card 1 */}
            <article className="project-card">
              <div className="project-card__thumb">
                <img
                  src="/hero_house.webp"
                  alt="Luxury modern concrete villa"
                  className="project-card__img"
                  loading="lazy"
                  width={368}
                  height={200}
                />
                <span className="project-card__badge project-card__badge--rera">RERA</span>
                <button
                  type="button"
                  className={`project-card__heart ${favorites["1"] ? "active" : ""}`}
                  onClick={(e) => toggleFavorite("1", e)}
                  aria-label="Add to favorites"
                  aria-pressed={favorites["1"]}
                >
                  {favorites["1"] ? "♥" : "♡"}
                </button>
              </div>
              <div className="project-card__body">
                <div className="project-card__price">₹ 1.32 Cr <span>onwards</span></div>
                <h3 className="project-card__title">
                  <Link href="/property/1" style={{ color: "inherit", textDecoration: "none" }}>
                    Meridian Sunview
                  </Link>
                </h3>
                <p className="project-card__loc">Whitefield, Bengaluru</p>
                <div className="project-card__meta">
                  <span>Configuration: <b>2–3 BHK</b></span>
                  <span>Size: <b>980–1450 sq.ft</b></span>
                </div>
              </div>
            </article>

            {/* Property Card 2 */}
            <article className="project-card">
              <div className="project-card__thumb">
                <img
                  src="/bengaluru.webp"
                  alt="Modern residential apartment block"
                  className="project-card__img"
                  loading="lazy"
                  width={368}
                  height={200}
                />
                <span className="project-card__badge">Ready to move</span>
                <button
                  type="button"
                  className={`project-card__heart ${favorites["2"] ? "active" : ""}`}
                  onClick={(e) => toggleFavorite("2", e)}
                  aria-label="Add to favorites"
                  aria-pressed={favorites["2"]}
                >
                  {favorites["2"] ? "♥" : "♡"}
                </button>
              </div>
              <div className="project-card__body">
                <div className="project-card__price">₹ 78 L <span>onwards</span></div>
                <h3 className="project-card__title">
                  <Link href="/property/2" style={{ color: "inherit", textDecoration: "none" }}>
                    Cedar Lake Residency
                  </Link>
                </h3>
                <p className="project-card__loc">Baner, Pune</p>
                <div className="project-card__meta">
                  <span>Configuration: <b>1–2 BHK</b></span>
                  <span>Size: <b>560–980 sq.ft</b></span>
                </div>
              </div>
            </article>

            {/* Property Card 3 */}
            <article className="project-card">
              <div className="project-card__thumb">
                <img
                  src="/delhi.webp"
                  alt="Modern residential sandstone villa"
                  className="project-card__img"
                  loading="lazy"
                  width={368}
                  height={200}
                />
                <span className="project-card__badge project-card__badge--rera">RERA</span>
                <button
                  type="button"
                  className={`project-card__heart ${favorites["3"] ? "active" : ""}`}
                  onClick={(e) => toggleFavorite("3", e)}
                  aria-label="Add to favorites"
                  aria-pressed={favorites["3"]}
                >
                  {favorites["3"] ? "♥" : "♡"}
                </button>
              </div>
              <div className="project-card__body">
                <div className="project-card__price">₹ 2.40 Cr <span>onwards</span></div>
                <h3 className="project-card__title">
                  <Link href="/property/3" style={{ color: "inherit", textDecoration: "none" }}>
                    Palm Coast Villas
                  </Link>
                </h3>
                <p className="project-card__loc">ECR, Chennai</p>
                <div className="project-card__meta">
                  <span>Configuration: <b>3–4 BHK</b></span>
                  <span>Size: <b>2100–2850 sq.ft</b></span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="section section--testimonials" id="testimonialsSection">
        <div className="wrap">
          <div className="section-head reveal-scroll">
            <div className="section-head__title-group">
              <span className="section-num mono" style={{ color: "var(--accent-light)" }}>04 /</span>
              <h2 style={{ color: "#fff" }}>Real customer stories</h2>
            </div>
          </div>

          <div className="editorial-testimonials reveal-scroll">
            <blockquote className="featured-quote">
              <div className="quote-rating" aria-label="5 out of 5 stars">★★★★★</div>
              <p className="featured-quote__text">
                "Found our 3BHK in Whitefield within two weeks. Every photo matched what we saw on-site. The transparency was refreshing."
              </p>
              <footer className="quote-author">
                <div className="quote-author__avatar" style={{ backgroundColor: "var(--accent)" }}>AR</div>
                <div>
                  <cite className="quote-author__name">Ananya R.</cite>
                  <span className="quote-author__role">Verified Buyer, Bengaluru</span>
                </div>
              </footer>
            </blockquote>

            <div className="secondary-quotes">
              <blockquote className="secondary-quote">
                <div className="quote-rating" aria-label="5 out of 5 stars">★★★★★</div>
                <p className="secondary-quote__text">
                  "Renting as a first-time tenant felt completely safe. The owner verification is genuinely robust and the agreement process was fully digital."
                </p>
                <footer className="quote-author">
                  <div className="quote-author__avatar" style={{ backgroundColor: "var(--muted-slate)" }}>KS</div>
                  <div>
                    <cite className="quote-author__name">Kabir S.</cite>
                    <span className="quote-author__role">Tenant, Pune</span>
                  </div>
                </footer>
              </blockquote>

              <blockquote className="secondary-quote">
                <div className="quote-rating" aria-label="5 out of 5 stars">★★★★★</div>
                <p className="secondary-quote__text">
                  "We leased our commercial office in under a month. The verified commercial filters saved us weeks of useless site visits."
                </p>
                <footer className="quote-author">
                  <div className="quote-author__avatar" style={{ backgroundColor: "var(--ink-slate)" }}>MT</div>
                  <div>
                    <cite className="quote-author__name">Meera T.</cite>
                    <span className="quote-author__role">Office Tenant, Gurugram</span>
                  </div>
                </footer>
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Journal Insights Section */}
      <section className="section section--insights" id="insightsSection">
        <div className="wrap">
          <div className="section-head reveal-scroll">
            <div className="section-head__title-group">
              <h2>Guides before you sign</h2>
            </div>
            <a className="see-all" href="#all-insights" id="allInsightsLink">All journal entries →</a>
          </div>

          <div className="journal-list reveal-scroll">
            <article className="journal-entry">
              <div className="journal-entry__meta mono">
                <span className="journal-entry__cat">Home Loans</span>
                <span className="journal-entry__date">July 2026</span>
              </div>
              <div className="journal-entry__main">
                <h3 className="journal-entry__title">
                  <a href="#article-1">A first-timer's guide to home loan pre-approval</a>
                </h3>
                <p className="journal-entry__desc">What lenders evaluate, how to estimate your borrow limit, and common reasons for rejection.</p>
              </div>
              <a href="#article-1" className="journal-entry__arrow" aria-hidden="true" tabIndex={-1}>→</a>
            </article>

            <article className="journal-entry">
              <div className="journal-entry__meta mono">
                <span className="journal-entry__cat">Renting</span>
                <span className="journal-entry__date">June 2026</span>
              </div>
              <div className="journal-entry__main">
                <h3 className="journal-entry__title">
                  <a href="#article-2">Rent agreement clauses tenants often overlook</a>
                </h3>
                <p className="journal-entry__desc">Lock-in periods, unexpected maintenance fees, and deposit refund laws to look out for.</p>
              </div>
              <a href="#article-2" className="journal-entry__arrow" aria-hidden="true" tabIndex={-1}>→</a>
            </article>

            <article className="journal-entry">
              <div className="journal-entry__meta mono">
                <span className="journal-entry__cat">Investing</span>
                <span className="journal-entry__date">May 2026</span>
              </div>
              <div className="journal-entry__main">
                <h3 className="journal-entry__title">
                  <a href="#article-3">Is it the right time to invest in residential plots?</a>
                </h3>
                <p className="journal-entry__desc">A comprehensive look at land appreciation trends across tier-1 and tier-2 Indian cities.</p>
              </div>
              <a href="#article-3" className="journal-entry__arrow" aria-hidden="true" tabIndex={-1}>→</a>
            </article>
          </div>
        </div>
      </section>

      {/* App CTA */}
      <section className="section section--compact section--cta" id="ctaSection">
        <div className="wrap">
          <div className="app-cta">
            <div className="app-cta__content">
              <h2>Take RealtyNow wherever you go</h2>
              <p>Get instant alerts, save property shortlists, and chat directly with verified owners right from your phone.</p>
              <div className="app-cta__stores">
                <a className="store-btn" href="#google-play" id="playBtn">▶ Google Play</a>
                <a className="store-btn" href="#app-store" id="appstoreBtn">⌘ App Store</a>
              </div>
            </div>
            <div className="app-cta__glow-wrapper" aria-hidden="true">
              <div className="app-cta__glow"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Site Footer */}
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div className="footer-brand">
            <Link href="/" className="logo logo--footer" id="footerLogo">
              <span className="logo__mark"></span>RealtyNow
            </Link>
            <p className="footer-grid__about">India's most trusted, verified property marketplace for buying, renting, and leasing.</p>
            <div className="socials" aria-label="Social media links">
              <a href="#linkedin" aria-label="LinkedIn">in</a>
              <a href="#twitter" aria-label="X (Twitter)">X</a>
              <a href="#instagram" aria-label="Instagram">ig</a>
            </div>
          </div>
          <div>
            <h4>Cities</h4>
            <ul>
              <li><button type="button" onClick={() => handleCityCellClick("Mumbai")} className="btn--link">Mumbai</button></li>
              <li><button type="button" onClick={() => handleCityCellClick("Bengaluru")} className="btn--link">Bengaluru</button></li>
              <li><button type="button" onClick={() => handleCityCellClick("Pune")} className="btn--link">Pune</button></li>
              <li><button type="button" onClick={() => handleCityCellClick("Delhi")} className="btn--link">Delhi NCR</button></li>
              <li><button type="button" onClick={() => handleCityCellClick("Hyderabad")} className="btn--link">Hyderabad</button></li>
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
