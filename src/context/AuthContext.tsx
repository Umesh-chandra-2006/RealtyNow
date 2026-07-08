"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export interface UserProfile {
  id?: string;
  full_name: string;
  role: "buyer" | "owner" | "builder" | string;
  phone?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch public profile details from Postgres db
  const fetchProfile = async (userId: string) => {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await supabase

        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error fetching user profile:", err);
      return null;
    }
  };

  // Get active session user
  const getSessionUser = async () => {
    try {
      const useMockSession = typeof window !== "undefined" && localStorage.getItem("realtynow_use_mock_session") === "true";

      if (!isSupabaseConfigured() || useMockSession) {
        // LocalStorage fallback check
        const localUser = typeof window !== "undefined" ? localStorage.getItem("realtynow_mock_user") : null;
        if (localUser) {
          const parsed = JSON.parse(localUser);
          setUser(parsed);
          setProfile(parsed.profile || { role: "buyer", full_name: "Mock User" });
        } else {
          setUser(null);
          setProfile(null);
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const prof = await fetchProfile(session.user.id);
        setProfile(prof);
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.error("Error retrieving auth session:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSessionUser();

    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        const useMockSession = typeof window !== "undefined" && localStorage.getItem("realtynow_use_mock_session") === "true";
        if (useMockSession) return; // Ignore Supabase events if in local bypass mode

        if (session?.user) {
          setUser(session.user);
          const prof = await fetchProfile(session.user.id);
          setProfile(prof);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("realtynow_use_mock_session");
        localStorage.removeItem("realtynow_mock_user");
      }
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error("Error signing out user:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut: handleSignOut,
        refreshUser: getSessionUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
