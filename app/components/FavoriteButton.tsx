"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useToast } from "@/app/context/ToastContext";
import { useRouter, usePathname } from "next/navigation";
import { toggleFavorite as apiToggleFavorite } from "@/lib/actions";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface FavoriteButtonProps {
  propertyId: string;
  className?: string;
  isFavorited?: boolean;
}

export default function FavoriteButton({ propertyId, className, isFavorited: propIsFavorited }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [isFavorited, setIsFavorited] = useState(propIsFavorited !== undefined ? propIsFavorited : false);

  useEffect(() => {
    if (propIsFavorited !== undefined) {
      setIsFavorited(propIsFavorited);
      return;
    }

    async function checkFavorite() {
      if (!user) {
        setIsFavorited(false);
        return;
      }

      if (isSupabaseConfigured() && !user.id.startsWith("mock-")) {
        try {
          const { data, error } = await supabase
            .from("favorites")
            .select("*")
            .eq("user_id", user.id)
            .eq("property_id", propertyId)
            .maybeSingle();

          if (error) throw error;
          setIsFavorited(!!data);
        } catch (e) {
          console.error("Error checking favorite status:", e);
        }
      } else {
        const localKey = `realtynow_favs_${user.id}`;
        const localStr = localStorage.getItem(localKey) || "[]";
        const list = JSON.parse(localStr);
        setIsFavorited(list.includes(propertyId));
      }
    }
    checkFavorite();
  }, [propertyId, user, propIsFavorited]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast("Please log in to save properties to your portfolio.", "info");
      router.push(`/login?redirect=${pathname}`);
      return;
    }

    try {
      const res = await apiToggleFavorite(user.id, propertyId);
      if (res.success) {
        setIsFavorited(res.isFavorited || false);
        toast(res.isFavorited ? "Added to favorites!" : "Removed from favorites.", "info");
      }
    } catch (err: any) {
      toast(err.message || "Error saving bookmark.", "error");
    }
  };

  return (
    <button
      type="button"
      className={`${className || "project-card__heart"} ${isFavorited ? "active" : ""}`}
      onClick={toggleFavorite}
      aria-label="Add to favorites"
      aria-pressed={isFavorited}
    >
      {isFavorited ? "♥" : "♡"}
    </button>
  );
}
