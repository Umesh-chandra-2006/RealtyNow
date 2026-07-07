"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function HeroSearchWidget() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"buy" | "rent" | "pg" | "commercial">("buy");
  const [cityInput, setCityInput] = useState("");
  const [bhkInput, setBhkInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [hasError, setHasError] = useState(false);

  const cityInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (tab: "buy" | "rent" | "pg" | "commercial") => {
    setActiveTab(tab);
    setHasError(false);
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

    const params = new URLSearchParams();
    params.set("type", activeTab);
    params.set("city", cityInput);
    if (bhkInput) params.set("bhk", bhkInput);
    if (budgetInput) params.set("budget", budgetInput);

    router.push(`/listings?${params.toString()}`);
  };

  const getPlaceholderText = () => {
    if (activeTab === "commercial") {
      return "Enter city, locality or tech park";
    } else if (activeTab === "pg") {
      return "Enter city or locality";
    } else {
      return "Enter location, city or locality";
    }
  };

  return (
    <div className="search-card animate-reveal">
      <form className="search-fields" id="searchForm" onSubmit={handleSearchSubmit}>
        {/* Location Input */}
        <div className={`search-field ${hasError ? "has-error" : ""}`}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <div className="search-field__container">
            <label htmlFor="cityInput" className="search-field__label">Location</label>
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
              aria-label="Location"
              className="search-field__input"
            />
          </div>
        </div>

        {/* Property Type Select */}
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
          <div className="search-field__container">
            <label htmlFor="propTypeSelect" className="search-field__label">Property Type</label>
            <select
              id="propTypeSelect"
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as any)}
              aria-label="Property Type"
              className="search-field__select"
            >
              <option value="buy">All Properties (For Sale)</option>
              <option value="rent">For Rent</option>
              <option value="pg">PG / Co-living</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
        </div>

        {/* Min Price Select */}
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
          <div className="search-field__container">
            <label htmlFor="minBhk" className="search-field__label">BHK Type</label>
            <select
              id="minBhk"
              value={bhkInput}
              onChange={(e) => setBhkInput(e.target.value)}
              aria-label="BHK Type"
              className="search-field__select"
            >
              <option value="">BHK Type</option>
              <option value="1">1 BHK</option>
              <option value="2">2 BHK</option>
              <option value="3">3 BHK</option>
              <option value="4">4+ BHK</option>
            </select>
          </div>
        </div>

        {/* Max Budget Select */}
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
          <div className="search-field__container">
            <label htmlFor="budgetSelect" className="search-field__label">Max Price</label>
            <select
              id="budgetSelect"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              aria-label="Max Price"
              className="search-field__select"
            >
              <option value="">Max Price</option>
              <option value="50l">Under ₹50 L</option>
              <option value="1cr">₹50 L – 1 Cr</option>
              <option value="2cr">₹1 Cr – 2 Cr</option>
              <option value="above">Above ₹2 Cr</option>
            </select>
          </div>
        </div>

        <button type="submit" className="search-submit" id="searchSubmitBtn">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            aria-hidden="true"
          >
            <path d="M21 21l-4.35-4.35" />
            <circle cx="10" cy="10" r="7" />
          </svg>
          Search Properties
        </button>
      </form>
    </div>
  );
}
