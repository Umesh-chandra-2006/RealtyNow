"use client";

import React, { useEffect } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "info":
      default:
        return "ℹ";
    }
  };

  return (
    <div className={`toast-notification toast-notification--${type}`} role="alert">
      <span className="toast-notification__icon">{getIcon()}</span>
      <span className="toast-notification__message">{message}</span>
      <button className="toast-notification__close" onClick={onClose} aria-label="Close notification">
        ✕
      </button>
    </div>
  );
}
