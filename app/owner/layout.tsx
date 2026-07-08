import { SiteHeader } from "../../src/components/SiteHeader.next";
import { SiteFooter } from "../../src/components/SiteFooter.next";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
