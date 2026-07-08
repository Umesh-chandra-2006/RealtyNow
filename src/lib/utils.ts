import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImgSrc(img: any): string {
  if (!img) return "";
  if (typeof img === "string") return img;
  if (img.src && typeof img.src === "string") return img.src;
  if (img.default) {
    if (typeof img.default === "string") return img.default;
    if (img.default.src && typeof img.default.src === "string") return img.default.src;
  }
  return String(img);
}
