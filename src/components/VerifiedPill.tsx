import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedPill({
  variant = "solid",
  className,
}: {
  variant?: "solid" | "ghost" | "onDark";
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]";
  const styles = {
    solid: "bg-coral text-coral-foreground shadow-crisp",
    ghost: "bg-white/95 text-coral ring-1 ring-coral/25 backdrop-blur-md animate-coral-pulse",
    onDark: "bg-coral/15 text-coral ring-1 ring-coral/40",
  };
  return (
    <span className={cn(base, styles[variant], className)}>
      <Check className="h-3 w-3" strokeWidth={3} />
      Verified
    </span>
  );
}
