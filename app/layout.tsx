import type { Metadata } from "next";
import "./styles.css";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "RealtyNow — Verified Property Marketplace",
  description: "Search verified apartments, plots, PGs, and commercial spaces across India with real photos, real prices, real owners.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
