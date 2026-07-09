import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImgSrc(img: unknown): string {
  if (!img) return "";
  if (typeof img === "string") return img;
  if (img && typeof img === "object") {
    const obj = img as Record<string, unknown>;
    if (typeof obj.src === "string") return obj.src;
    if (obj.default) {
      if (typeof obj.default === "string") return obj.default;
      const def = obj.default as Record<string, unknown>;
      if (typeof def.src === "string") return def.src;
    }
  }
  return String(img);
}
