"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Message {
  id: string;
  text: string;
  sender: "bot" | "user";
  link?: {
    text: string;
    href: string;
  };
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hi 👋 I'm the RealtyNow assistant. Ask me anything about our pre-launch early access, RERA verification checks, or verified property listings!",
      sender: "bot",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const addBotMessage = (text: string, delay = 1000, link?: { text: string; href: string }) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          text,
          sender: "bot",
          link,
        },
      ]);
    }, delay);
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        text,
        sender: "user",
      },
    ]);
    setInputValue("");

    const query = text.toLowerCase().trim();

    if (query.includes("rera") || query.includes("verify") || query.includes("verification")) {
      addBotMessage(
        "Every property listing on RealtyNow goes through a rigorous multi-point verification checklist, matching it against RERA registrations and property deed databases. Unverified listings are blocked from the feed.",
        1200
      );
    } else if (query.includes("gurgaon") || query.includes("delhi") || query.includes("mumbai") || query.includes("listings") || query.includes("flat") || query.includes("house") || query.includes("buy")) {
      addBotMessage(
        "We have verified properties listed across key metros in India (Gurgaon, Mumbai, Hyderabad, Pune). You can explore our live property listing feed directly to see details, specs, and price guides.",
        1000,
        { text: "Browse Properties Now", href: "/listings?type=buy" }
      );
    } else if (query.includes("early") || query.includes("access") || query.includes("join") || query.includes("subscribe") || query.includes("@")) {
      addBotMessage(
        "Thank you for your interest! Joining our priority early-access list guarantees you free listings, zero platform brokerage fees for 6 months, and priority access to off-market deals when we launch.",
        1200
      );
    } else if (query.includes("agent") || query.includes("talk") || query.includes("contact") || query.includes("whatsapp")) {
      addBotMessage(
        "You can connect directly with our advisory support desk or chat with a verified property advisor on WhatsApp.",
        900,
        { text: "Chat on WhatsApp", href: "https://wa.me/919494230774" }
      );
    } else {
      addBotMessage(
        "I'm here to guide you through RealtyNow. You can ask about properties, RERA verification checks, early access perks, or chat directly with our advisory agents.",
        1000
      );
    }
  };

  const handleChipClick = (label: string) => {
    handleSend(label);
  };

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header__profile">
              <div className="chat-avatar">RN</div>
              <div className="chat-header__title">
                <h3>RealtyNow Assistant</h3>
                <span>AI Advisory • Active</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="chat-close-btn"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-msg chat-msg--${msg.sender}`}
              >
                {msg.text}
                {msg.link && (
                  <div>
                    <a
                      href={msg.link.href}
                      target={msg.link.href.startsWith("http") ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      className="chat-msg-link"
                    >
                      {msg.link.text} &rarr;
                    </a>
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="chat-typing">
                <div className="chat-typing__dot"></div>
                <div className="chat-typing__dot"></div>
                <div className="chat-typing__dot"></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-chips">
            <button
              onClick={() => handleChipClick("What is RERA verification?")}
              className="chat-chip"
            >
              🛡️ RERA Checks
            </button>
            <button
              onClick={() => handleChipClick("Find properties in Gurgaon")}
              className="chat-chip"
            >
              📍 Search Gurgaon
            </button>
            <button
              onClick={() => handleChipClick("Join early access")}
              className="chat-chip"
            >
              ✨ Early Access Perks
            </button>
            <button
              onClick={() => handleChipClick("Talk to an advisor")}
              className="chat-chip"
            >
              💬 Talk to Advisor
            </button>
          </div>

          <div className="chat-input-area">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputValue);
              }}
              className="chat-input-form"
            >
              <input
                type="text"
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="chat-input"
              />
              <button
                type="submit"
                className="chat-send-btn"
                aria-label="Send message"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="chat-launcher"
        aria-label="Open chat assistant"
        aria-expanded={isOpen}
      >
        <span className="chat-launcher__ping"></span>
        {isOpen ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </button>

      {/* Floating WhatsApp Action Helper */}
      {!isOpen && (
        <div className="floating-actions">
          <a
            href="https://wa.me/919494230774"
            target="_blank"
            rel="noopener noreferrer"
            className="floating-action-btn floating-action-btn--whatsapp"
            title="Chat on WhatsApp"
            aria-label="Chat on WhatsApp"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path>
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
