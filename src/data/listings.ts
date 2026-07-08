import bandra from "@/assets/listing-bandra-loft.jpg";
import koramangala from "@/assets/listing-koramangala-duplex.jpg";
import powai from "@/assets/listing-powai-lake.jpg";
import hsr from "@/assets/listing-hsr-villa.jpg";
import pune from "@/assets/listing-pune-townhouse.jpg";
import hyd from "@/assets/listing-hyd-penthouse.jpg";

export type VerificationCheckKey = "rera" | "identity" | "photo" | "duplicate";

export type VerificationCheck = {
  key: VerificationCheckKey;
  label: string;
  detail: string;
  method: string;
  passedOn: string;
};

export type Listing = {
  id: string;
  title: string;
  city: string;
  locality: string;
  price: number;
  priceLabel: string;
  cadence: "sale" | "rent";
  propertyType: "Apartment" | "Villa" | "Penthouse" | "Townhouse";
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  furnishing: "Fully furnished" | "Semi-furnished" | "Unfurnished";
  photo: string;
  owner: { name: string; joinedYear: number };
  verifiedOn: string;
  reraNumber: string;
  reraState: string;
  description: string;
  checks: VerificationCheck[];
  highlights: string[];
};

const commonChecks = (dateISO: string, reraState: string): VerificationCheck[] => [
  {
    key: "rera",
    label: "RERA registration",
    detail: `Registration number confirmed against the ${reraState} RERA portal. Project name, promoter and validity all match.`,
    method: "Manual portal lookup",
    passedOn: dateISO,
  },
  {
    key: "identity",
    label: "Owner identity",
    detail:
      "Phone number verified via OTP. Government-issued ID reviewed by our team and matched to the account name.",
    method: "Phone OTP + manual ID review",
    passedOn: dateISO,
  },
  {
    key: "photo",
    label: "Photo authenticity",
    detail:
      "EXIF metadata inspected on every photo. Capture dates fall within the last 12 months. No screenshots detected.",
    method: "EXIF check + spot review",
    passedOn: dateISO,
  },
  {
    key: "duplicate",
    label: "Duplicate scan",
    detail:
      "Perceptual hash of every image compared against the platform. Title and address checked for near-matches. Clean.",
    method: "pHash + text similarity",
    passedOn: dateISO,
  },
];

export const listings: Listing[] = [
  {
    id: "bandra-loft",
    title: "Sunlit two-storey loft on Pali Hill",
    city: "Mumbai",
    locality: "Bandra West",
    price: 21000000,
    priceLabel: "₹2.10 Cr",
    cadence: "sale",
    propertyType: "Apartment",
    bedrooms: 3,
    bathrooms: 3,
    areaSqft: 1840,
    furnishing: "Semi-furnished",
    photo: bandra,
    owner: { name: "Ananya S.", joinedYear: 2024 },
    verifiedOn: "2026-06-14",
    reraNumber: "P51800032981",
    reraState: "Maharashtra",
    description:
      "A twin-height loft with restored teak floors, wraparound glazing and a west-facing balcony that catches the last light of the day. Set inside a quiet 1970s building the owner has restored top-to-bottom over the past two years.",
    checks: commonChecks("2026-06-14", "Maharashtra"),
    highlights: [
      "Twin-height living room, 5.4 m ceilings",
      "Restored Burma teak floors",
      "West-facing balcony with sea peek",
      "Covered parking for two cars",
    ],
  },
  {
    id: "koramangala-duplex",
    title: "Garden duplex in Koramangala 4th Block",
    city: "Bengaluru",
    locality: "Koramangala",
    price: 125000,
    priceLabel: "₹1,25,000 / mo",
    cadence: "rent",
    propertyType: "Apartment",
    bedrooms: 4,
    bathrooms: 4,
    areaSqft: 3200,
    furnishing: "Fully furnished",
    photo: koramangala,
    owner: { name: "Vikram K.", joinedYear: 2023 },
    verifiedOn: "2026-06-22",
    reraNumber: "PRM/KA/RERA/1251/446/AG/220612/003104",
    reraState: "Karnataka",
    description:
      "A four-bedroom duplex opening onto its own indoor garden. Split-level layout keeps sleeping quarters completely private from the entertaining floor.",
    checks: commonChecks("2026-06-22", "Karnataka"),
    highlights: [
      "Private 900 sq.ft. terrace garden",
      "Independent guest suite on entry floor",
      "3-phase power, full backup",
      "Walking distance to Sony Signal",
    ],
  },
  {
    id: "powai-lake",
    title: "Fifteenth-floor apartment overlooking Powai Lake",
    city: "Mumbai",
    locality: "Powai",
    price: 32500000,
    priceLabel: "₹3.25 Cr",
    cadence: "sale",
    propertyType: "Apartment",
    bedrooms: 3,
    bathrooms: 3,
    areaSqft: 2100,
    furnishing: "Semi-furnished",
    photo: powai,
    owner: { name: "Rohan M.", joinedYear: 2022 },
    verifiedOn: "2026-06-30",
    reraNumber: "P51800008421",
    reraState: "Maharashtra",
    description:
      "Uninterrupted lake views from every room. A rare corner unit in a low-density tower with only two apartments per floor.",
    checks: commonChecks("2026-06-30", "Maharashtra"),
    highlights: [
      "Corner unit, two apartments per floor",
      "Direct lake view from primary bedroom",
      "Modular Bosch kitchen",
      "Access to marina & clubhouse",
    ],
  },
  {
    id: "hsr-villa",
    title: "Independent villa in HSR Layout Sector 2",
    city: "Bengaluru",
    locality: "HSR Layout",
    price: 42500000,
    priceLabel: "₹4.25 Cr",
    cadence: "sale",
    propertyType: "Villa",
    bedrooms: 4,
    bathrooms: 5,
    areaSqft: 3400,
    furnishing: "Unfurnished",
    photo: hsr,
    owner: { name: "Priya N.", joinedYear: 2025 },
    verifiedOn: "2026-07-01",
    reraNumber: "PRM/KA/RERA/1251/309/PR/180205/000567",
    reraState: "Karnataka",
    description:
      "A modern independent villa on a 2,400 sq.ft. plot. Double-height entry, private landscaped garden and a rooftop that&rsquo;s been designed for evenings outside.",
    checks: commonChecks("2026-07-01", "Karnataka"),
    highlights: [
      "2,400 sq.ft. plot, corner site",
      "Rooftop terrace, plumbing for outdoor kitchen",
      "Home office with separate entry",
      "EV charger installed",
    ],
  },
  {
    id: "pune-townhouse",
    title: "Brick-and-white townhouse in Koregaon Park",
    city: "Pune",
    locality: "Koregaon Park",
    price: 85000,
    priceLabel: "₹85,000 / mo",
    cadence: "rent",
    propertyType: "Townhouse",
    bedrooms: 3,
    bathrooms: 3,
    areaSqft: 2100,
    furnishing: "Semi-furnished",
    photo: pune,
    owner: { name: "Kabir D.", joinedYear: 2024 },
    verifiedOn: "2026-06-18",
    reraNumber: "P52100019874",
    reraState: "Maharashtra",
    description:
      "A three-storey townhouse on a tree-lined lane. Exposed brick facade, black-framed windows, and a small courtyard at the back.",
    checks: commonChecks("2026-06-18", "Maharashtra"),
    highlights: [
      "Tree-lined lane, quiet neighbourhood",
      "Private rear courtyard",
      "Independent utility area",
      "Pet-friendly",
    ],
  },
  {
    id: "hyd-penthouse",
    title: "Penthouse with infinity terrace, Gachibowli",
    city: "Hyderabad",
    locality: "Gachibowli",
    price: 55000000,
    priceLabel: "₹5.50 Cr",
    cadence: "sale",
    propertyType: "Penthouse",
    bedrooms: 4,
    bathrooms: 5,
    areaSqft: 4200,
    furnishing: "Fully furnished",
    photo: hyd,
    owner: { name: "Meera R.", joinedYear: 2023 },
    verifiedOn: "2026-07-03",
    reraNumber: "P02400001673",
    reraState: "Telangana",
    description:
      "Full-floor penthouse with a 1,200 sq.ft. private terrace, plunge pool and 270-degree views of the city. Access via a dedicated lift.",
    checks: commonChecks("2026-07-03", "Telangana"),
    highlights: [
      "Full-floor unit, dedicated lift",
      "1,200 sq.ft. private terrace + plunge pool",
      "Smart home wiring throughout",
      "Two dedicated parking bays + valet",
    ],
  },
];

export const findListing = (id: string) => listings.find((l) => l.id === id);

export const cities = [
  { name: "Mumbai", count: 428, image: "city-mumbai" },
  { name: "Bengaluru", count: 316, image: "city-bengaluru" },
  { name: "Pune", count: 184, image: "city-pune" },
  { name: "Hyderabad", count: 152, image: "city-hyderabad" },
  { name: "Delhi NCR", count: 261, image: "city-delhi" },
  { name: "Chennai", count: 97, image: "city-chennai" },
] as const;
