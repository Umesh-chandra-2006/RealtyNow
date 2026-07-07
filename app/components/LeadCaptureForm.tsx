"use client";

import React, { useState } from "react";
import { useToast } from "@/app/context/ToastContext";

export default function LeadCaptureForm() {
  const { toast } = useToast();
  const [emailInput, setEmailInput] = useState("");

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      toast(`Thank you! We have received your email subscription: ${emailInput}`, "success");
      setEmailInput("");
    }
  };

  return (
    <form className="lead-form" onSubmit={handleLeadSubmit}>
      <input
        type="email"
        className="lead-input"
        placeholder="Enter your email address"
        required
        value={emailInput}
        onChange={(e) => setEmailInput(e.target.value)}
        aria-label="Email address for newsletter"
      />
      <button type="submit" className="lead-submit" id="dreamHomeBtn">
        Find Your Dream Home
      </button>
    </form>
  );
}
