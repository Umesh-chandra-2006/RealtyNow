import React from "react";
import Link from "next/link";
import Image from "next/image";
import Footer from "@/app/components/Footer";
import ExploreCTA from "@/app/components/ExploreCTA";
import HeroSearchWidget from "@/app/components/HeroSearchWidget";
import FavoriteButton from "@/app/components/FavoriteButton";
import LeadCaptureForm from "@/app/components/LeadCaptureForm";
import ScrollRevealInit from "@/app/components/ScrollRevealInit";
import AppShowcase from "@/app/components/AppShowcase";


export default function Home() {
  return (
    <main>
      {/* Scroll Reveal Intersection Observer Initializer (Client Side) */}
      <ScrollRevealInit />

      {/* Hero Section with Luxury Backdrop */}
      <section className="hero" id="heroSection">
        <div className="hero__background aurora-container" aria-hidden="true">
          <div className="aurora-glow aurora-glow--crimson" style={{ top: "-10%", left: "10%", opacity: 0.15 }}></div>
          <div className="aurora-glow aurora-glow--navy" style={{ bottom: "-20%", right: "-10%", opacity: 0.2 }}></div>
          <Image
            src="/zoomed_out_villa.jpg"
            alt="Luxury modern property with pool at night"
            className="hero__bg-image"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className="hero__bg-overlay"></div>
        </div>

        <div className="wrap hero__content">
          <div className="hero__text-content">
            <div className="badge-wrapper animate-reveal">
              <span className="hero-tagline">
                FIND YOUR PERFECT SPACE
              </span>
            </div>

            <h1 className="hero__title animate-reveal">
              Find Your
              <br />
              <span className="hero__title-accent">Dream Home</span>
            </h1>

            <p className="hero__subtitle animate-reveal">
              Premium properties. Prime locations.<br />Unmatched lifestyle.
            </p>

            <div className="animate-reveal">
              <ExploreCTA />
            </div>
          </div>

          {/* Horizontal Search Widget Bar (Client Side Island) */}
          <HeroSearchWidget />
        </div>
      </section>

      {/* Featured Properties Section */}
      <section className="section section--projects" id="projectsSection">
        <div className="wrap">
          <div className="section-head reveal-scroll">
            <div className="section-head__title-group">
              <span className="section-num mono section-num--accent">01 /</span>
              <h2>Featured Properties</h2>
              <p className="section-head__desc">Handpicked residential listings from verified owners in prime locations.</p>
            </div>
            <Link className="see-all see-all--accent" href="/listings" id="allProjectsLink">
              View All Properties &rarr;
            </Link>
          </div>

          <div className="project-grid reveal-scroll">
            {/* Property Card 1 */}
            <article className="project-card sheen-glow gradient-border">
              <div className="project-card__thumb">
                <Image
                  src="/hero_house.webp"
                  alt="Modern Luxury Villa"
                  className="project-card__img"
                  width={368}
                  height={200}
                  sizes="(max-width: 768px) 100vw, 368px"
                  style={{ objectFit: "cover" }}
                />
                <span className="project-card__badge">For Sale</span>
                <FavoriteButton propertyId="1" />
              </div>
              <div className="project-card__body">
                <h3 className="project-card__title">
                  <Link href="/property/static-1" className="see-all--accent" style={{ fontFamily: "var(--font-display)", fontSize: "19px", fontWeight: "700" }}>
                    Modern Luxury Villa
                  </Link>
                </h3>
                <p className="project-card__loc">Golf Course Road, Gurgaon</p>
                <div className="project-card__meta project-card__specs">
                  <span className="project-card__spec-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 4v16M2 8h20M2 14h20M22 4v16"/>
                    </svg> 4 Beds
                  </span>
                  <span className="project-card__spec-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 18a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V6H4v12zM14 2h2a2 2 0 0 1 2 2v2H6V4a2 2 0 0 1 2-2h2"/>
                    </svg> 4 Baths
                  </span>
                  <span className="project-card__spec-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg> 3500 Sq.Ft
                  </span>
                </div>
                <div className="project-card__price-row">
                  <div className="project-card__price">₹ 5.25 Cr</div>
                  <Link href="/property/static-1" className="project-card__details-link">
                    View Details &rarr;
                  </Link>
                </div>
              </div>
            </article>

            {/* Property Card 2 */}
            <article className="project-card sheen-glow gradient-border">
              <div className="project-card__thumb">
                <Image
                  src="/bengaluru.webp"
                  alt="Skyline Heights"
                  className="project-card__img"
                  width={368}
                  height={200}
                  sizes="(max-width: 768px) 100vw, 368px"
                  style={{ objectFit: "cover" }}
                />
                <span className="project-card__badge">For Sale</span>
                <FavoriteButton propertyId="2" />
              </div>
              <div className="project-card__body">
                <h3 className="project-card__title">
                  <Link href="/property/static-2" className="see-all--accent" style={{ fontFamily: "var(--font-display)", fontSize: "19px", fontWeight: "700" }}>
                    Skyline Heights
                  </Link>
                </h3>
                <p className="project-card__loc">Kokapet, Hyderabad</p>
                <div className="project-card__meta project-card__specs">
                  <span className="project-card__spec-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 4v16M2 8h20M2 14h20M22 4v16"/>
                    </svg> 3 Beds
                  </span>
                  <span className="project-card__spec-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 18a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V6H4v12zM14 2h2a2 2 0 0 1 2 2v2H6V4a2 2 0 0 1 2-2h2"/>
                    </svg> 3 Baths
                  </span>
                  <span className="project-card__spec-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg> 2100 Sq.Ft
                  </span>
                </div>
                <div className="project-card__price-row">
                  <div className="project-card__price">₹ 1.85 Cr</div>
                  <Link href="/property/static-2" className="project-card__details-link">
                    View Details &rarr;
                  </Link>
                </div>
              </div>
            </article>

            {/* Property Card 3 */}
            <article className="project-card sheen-glow gradient-border">
              <div className="project-card__thumb">
                <Image
                  src="/delhi.webp"
                  alt="Urban Elite Apartment"
                  className="project-card__img"
                  width={368}
                  height={200}
                  sizes="(max-width: 768px) 100vw, 368px"
                  style={{ objectFit: "cover" }}
                />
                <span className="project-card__badge">For Rent</span>
                <FavoriteButton propertyId="3" />
              </div>
              <div className="project-card__body">
                <h3 className="project-card__title">
                  <Link href="/property/static-3" className="see-all--accent" style={{ fontFamily: "var(--font-display)", fontSize: "19px", fontWeight: "700" }}>
                    Urban Elite Apartment
                  </Link>
                </h3>
                <p className="project-card__loc">Bandra West, Mumbai</p>
                <div className="project-card__meta project-card__specs">
                  <span className="project-card__spec-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 4v16M2 8h20M2 14h20M22 4v16"/>
                    </svg> 2 Beds
                  </span>
                  <span className="project-card__spec-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 18a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V6H4v12zM14 2h2a2 2 0 0 1 2 2v2H6V4a2 2 0 0 1 2-2h2"/>
                    </svg> 2 Baths
                  </span>
                  <span className="project-card__spec-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg> 1200 Sq.Ft
                  </span>
                </div>
                <div className="project-card__price-row">
                  <div className="project-card__price">₹ 95,000 <span>/mo</span></div>
                  <Link href="/property/static-3" className="project-card__details-link">
                    View Details &rarr;
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section with Dark Background */}
      <section className="section--why-choose-us section--why-choose-us--dark aurora-container" id="whyChooseUsSection">
        <div className="aurora-glow aurora-glow--crimson" style={{ top: "-10%", right: "-10%", opacity: 0.12 }}></div>
        <div className="aurora-glow aurora-glow--navy" style={{ bottom: "-15%", left: "-10%", opacity: 0.15 }}></div>
        <div className="wrap">
          <div className="section-head section-head--center reveal-scroll">
            <div className="section-head__title-group section-head__title-group--center">
              <span className="section-num mono section-num--accent">02 /</span>
              <h2 className="text-white">Why Choose Us</h2>
            </div>
          </div>

          <div className="why-grid why-grid--home reveal-scroll">
            {/* Column 1 */}
            <div className="why-card why-card--dark sheen-glow gradient-border">
              <div className="why-card__icon why-card__icon--dark" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <h3 className="why-card__title text-white">Prime Locations</h3>
              <p className="why-card__desc why-card__desc--dark">
                Properties listed in the most sought-after, premium locales offering luxury and appreciation potential.
              </p>
            </div>

            {/* Column 2 */}
            <div className="why-card why-card--dark sheen-glow gradient-border">
              <div className="why-card__icon why-card__icon--dark" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3 className="why-card__title text-white">Verified Properties</h3>
              <p className="why-card__desc why-card__desc--dark">
                100% verified property listings matching actual photos and specifications for a safe and secure deal.
              </p>
            </div>

            {/* Column 3 */}
            <div className="why-card why-card--dark sheen-glow gradient-border">
              <div className="why-card__icon why-card__icon--dark" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3 className="why-card__title text-white">Expert Guidance</h3>
              <p className="why-card__desc why-card__desc--dark">
                Our professional advisors assist you with legal verification, site visits, and selecting the perfect home.
              </p>
            </div>

            {/* Column 4 */}
            <div className="why-card why-card--dark sheen-glow gradient-border">
              <div className="why-card__icon why-card__icon--dark" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3 className="why-card__title text-white">End to End Support</h3>
              <p className="why-card__desc why-card__desc--dark">
                From initial search filters up to the final handover, we facilitate agreements and digital transfers smoothly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="section section--testimonials" id="testimonialsSection">
        <div className="wrap">
          <div className="section-head reveal-scroll">
            <div className="section-head__title-group">
              <span className="section-num mono section-num--accent">03 /</span>
              <h2 className="text-white">What Our Clients Say</h2>
            </div>
          </div>

          <div className="editorial-testimonials reveal-scroll">
            <blockquote className="featured-quote">
              <div className="quote-rating" aria-label="5 out of 5 stars">★★★★★</div>
              <p className="featured-quote__text">
                "RealtyNow made our home buying journey smooth and stress-free. Their team is professional, transparent, and truly cares about clients."
              </p>
              <footer className="quote-author">
                <div className="quote-author__avatar quote-author__avatar--accent">AR</div>
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
                  <div className="quote-author__avatar quote-author__avatar--accent-warm">KS</div>
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
                  <div className="quote-author__avatar quote-author__avatar--muted-slate">MT</div>
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


      {/* Mobile App Showcase Section */}
      <AppShowcase />

      {/* Pre-Footer Lead Capture Banner with Luxury Backdrop */}
      <section className="section--lead-cta" id="ctaSection">
        <div className="wrap">
          <div className="lead-cta lead-cta--home">
            <div className="lead-cta__content">
              <h2>Ready to Find Your Dream Home?</h2>
              <p className="text-white">
                Let us help you find the perfect space for you and your family. Enter your email below to connect with verified listings.
              </p>
              {/* Lead Capture form Client Island */}
              <LeadCaptureForm />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

