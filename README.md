# RealtyNow

RealtyNow is a premium, high-integrity real estate marketplace focused on a strict 4-step verification pipeline (RERA Check, Ownership/Deed verification, EXIF photo validation, and Aadhaar/PAN Identity match).

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & Vanilla CSS for customized UI transitions.
- **Component Library**: [shadcn/ui](https://ui.shadcn.com/) (fully localized in the source tree)
- **Database & Auth**: [Supabase](https://supabase.com/) (SQL schemas, indexes, and custom PL/pgSQL atomic transaction functions)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 📂 Project Directory Structure

```text
├── app/                       # Next.js App Router routes
│   ├── api/                   # Server API endpoints
│   │   └── health/            # Healthcheck uptime route
│   ├── browse/                # Search & Filter Catalog
│   ├── listing/[id]/          # Property detail view
│   ├── login/                 # User login page
│   ├── register/              # User registration page
│   ├── profile/               # Buyer/Owner profile dashboard
│   ├── owner/                 # Owner portal & submission wizard
│   ├── layout.tsx             # Root layout configuration
│   └── page.tsx               # Homepage / Landing page
│
├── src/                       # Frontend application sources
│   ├── assets/                # Static images and brand assets
│   ├── components/            # Shared UI components
│   │   ├── ui/                # shadcn/ui primitives
│   │   └── *.tsx              # SiteHeader, SiteFooter, ListingCard, etc.
│   ├── context/               # React Context Providers (AuthContext)
│   ├── data/                  # Local Mock Data & SQL Migrations
│   │   ├── listings.ts        # Seed Listings
│   │   └── schema.sql         # SQL Table schemas & Atomic RPCs
│   ├── hooks/                 # Custom React hooks (useMobile)
│   ├── lib/                   # Utility helpers & server actions
│   │   ├── actions.ts         # User auth & database mutations
│   │   ├── logger.ts          # Centralized PII-scrubbed JSON logger
│   │   ├── supabase.ts        # Request-scoped Supabase client cache proxy
│   │   └── utils.ts           # Class merger helpers
│   ├── types/                 # Custom global TypeScript typings
│   └── styles.css             # Main styling entrypoint
│
├── middleware.ts              # Route-guard middleware (profile/owner tracking)
├── next.config.ts             # Next.js compiler settings
└── tsconfig.json              # TypeScript compiler rules
```

---

## 🔒 Security & Verification Pipeline

RealtyNow enforces trust via rigorous, human-assisted verification processes.

1. **RERA Audit**: Submissions are matched against state land registry databases using the registration number.
2. **Title Deed Match**: Checks property ownership records against government registries.
3. **EXIF/Photo Authenticity**: Uploaded photos are verified for metadata matching actual location/time coordinates.
4. **Identity Match**: Strict phone number OTP match and ID document verification.

### Mock Authentication

For local prototyping, a mock bypass authentication model can be enabled using environment variables.
When enabled, use the credentials below:

- **Email**: `test@example.com`
- **Password**: `password123`
- **OTP Bypass**: `123456`

---

## 🚀 Environment & Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Dev Mock Bypass Controls (Disable/omit in production)
ENABLE_MOCK_AUTH=true
```

### Install Dependencies

```bash
npm install
```

### Run Local Development Server

```bash
npm run dev
```

### Build Production Bundle

```bash
npm run build
```
