# RealtyNow — Zero Brokerage Property Marketplace

RealtyNow is a premium real estate portal designed to facilitate direct owner-to-buyer property transactions in India, bypassing middleman networks and brokerage overheads.

## 🚀 Key Features

* **Zero Brokerage Search**: Direct contact details of property owners.
* **Ambient Aurora Design**: Highly visual dark-mode headers with interactive neon-aurora glow elements, sheen-glow cards, and clean typography.
* **Interactive Phone Mockup Switcher**: Live mobile view toggle on the landing page showing listing steps.
* **Chat Advisor Widget**: Smart interactive assistant available globally on all pages.
* **Auxiliary Services Index**: Legal verifications (Kaam Kaaka), custom interior designs consults, loans, and rental agreement drafts.
* **User Dashboard / Profiles**: Logged-in view tracking credentials, saved listings (favorites), and property post quotas (max 5).
* **Playwright E2E Test Suite**: Rigorous automated regression testing validating responsive views, interactive mockups, and forms routing.

---

## 📁 Directory Structure

* `/app` - Next.js App router containing page routes and components.
  * `/services` - Auxiliary services index page.
  * `/profile` - User dashboard (Saved listings, posted properties).
  * `/register` - Account creation page.
  * `/about`, `/contact`, `/careers`, `/press` - Corporate pages.
  * `/listings` - Property search page directory.
* `/lib` - Database schemas, Supabase credentials, and local fallback actions.
* `/e2e` - Playwright automation test specifications.

---

## 🛠️ Getting Started

### 1. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application locally.

### 2. Execute Playwright Tests
To verify all pages and form submittals work as expected, execute:
```bash
npx playwright test
```
To run tests sequentially (recommended in dev mode to avoid Turbopack timeouts):
```bash
npx playwright test --workers=1
```
