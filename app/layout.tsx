import type { Metadata } from "next";
import { Fraunces, Poppins, JetBrains_Mono } from "next/font/google";
import "@/styles.css";
import { AuthProvider } from "@/context/AuthContext";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--next-font-display",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--next-font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--next-font-mono",
  weight: ["500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RealtyNow — Only verified homes across India",
  description:
    "India's verification-first property platform. Every listing clears a 4-step check — RERA, identity, photo authenticity, duplicate scan — before going public.",
  authors: [{ name: "RealtyNow" }],
  openGraph: {
    title: "RealtyNow — Only verified homes across India",
    description:
      "India's verification-first property platform. Every listing clears a 4-step check — RERA, identity, photo authenticity, duplicate scan — before going public.",
    type: "website",
    images: [
      "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/58577042-df69-4f8e-9839-a075d6aeccc0/id-preview-84e51c01--2cae08e4-3cb9-495a-ab7c-2e08050cbb06.lovable.app-1783514595383.png",
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RealtyNow — Only verified homes across India",
    description:
      "India's verification-first property platform. Every listing clears a 4-step check — RERA, identity, photo authenticity, duplicate scan — before going public.",
    images: [
      "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/58577042-df69-4f8e-9839-a075d6aeccc0/id-preview-84e51c01--2cae08e4-3cb9-495a-ab7c-2e08050cbb06.lovable.app-1783514595383.png",
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${poppins.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('realtynow-theme');
                  // Default to dark mode to match existing project aesthetic if no override is saved
                  if (theme === 'dark' || !theme) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
