"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useToast } from "../context/ToastContext";

interface FooterProps {
  onCityClick?: (city: string) => void;
}

export default function Footer({ onCityClick }: FooterProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      toast(`Thank you! We have received your email subscription: ${email}`, "success");
      setEmail("");
    }
  };

  const cities = ["Mumbai", "Bengaluru", "Pune", "Delhi", "Hyderabad"];

  const handleCityClick = (city: string, e: React.MouseEvent) => {
    if (onCityClick) {
      e.preventDefault();
      onCityClick(city);
    }
  };

  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link href="/" className="logo logo--footer" id="footerLogo">
            <span className="logo__mark"></span>RealtyNow
          </Link>
          <p className="footer-grid__about">
            Premium RERA-verified property listings with transparent pricing and direct owner verification details.
          </p>
          <div className="socials" aria-label="Social media links">
            <a href="#linkedin" aria-label="LinkedIn">
              <svg className="social-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
            <a href="#twitter" aria-label="X (Twitter)">
              <svg className="social-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
              </svg>
            </a>
            <a href="#instagram" aria-label="Instagram">
              <svg className="social-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h4>Cities</h4>
          <ul>
            {cities.map((city) => (
              <li key={city}>
                {onCityClick ? (
                  <button
                    type="button"
                    onClick={(e) => handleCityClick(city, e)}
                    className="btn--link-city"
                  >
                    {city === "Delhi" ? "Delhi NCR" : city}
                  </button>
                ) : (
                  <Link href={`/listings?city=${city}`}>
                    {city === "Delhi" ? "Delhi NCR" : city}
                  </Link>
                )}
              </li>
            ))}
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
            <li><a href="#contact">Contact Us</a></li>
          </ul>
        </div>

        <div>
          <h4>Newsletter</h4>
          <p className="footer-newsletter-text">
            Subscribe to get the latest property updates and verified offers.
          </p>
          <form onSubmit={handleSubscribe} className="footer-newsletter-form">
            <input
              type="email"
              placeholder="Enter your email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address for newsletter"
              className="footer-newsletter-input"
            />
            <button
              type="submit"
              aria-label="Submit newsletter subscription"
              className="footer-newsletter-submit"
            >
              &rarr;
            </button>
          </form>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© 2026 RealtyNow. All rights reserved.</span>
        <span>Premium Marketplace — All RERA listings verified.</span>
      </div>
    </footer>
  );
}

