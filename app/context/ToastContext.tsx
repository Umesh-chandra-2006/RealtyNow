"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import Toast from "../components/Toast";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastMessage | null>(null);

  const triggerToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now().toString();
    setActiveToast({ id, message, type });
  }, []);

  const closeToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: triggerToast }}>
      {children}
      {activeToast && (
        <Toast
          key={activeToast.id}
          message={activeToast.message}
          type={activeToast.type}
          onClose={closeToast}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
