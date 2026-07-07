"use client";

import React from "react";

export default function ExploreCTA() {
  const handleCTAAction = () => {
    const cityInput = document.getElementById("cityInput");
    if (cityInput) {
      cityInput.scrollIntoView({ behavior: "smooth", block: "center" });
      cityInput.focus();
    }
  };

  return (
    <button
      onClick={handleCTAAction}
      className="hero-explore-btn"
    >
      Explore Properties &rarr;
    </button>
  );
}
