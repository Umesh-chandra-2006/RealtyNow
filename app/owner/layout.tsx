import { SiteHeader } from "../../src/components/SiteHeader";
import { SiteFooter } from "../../src/components/SiteFooter";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pt-16">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
