# Product Architecture & Specifications

## 1. Product Purpose
To provide India's most trusted, verified property marketplace for buying, renting, and leasing with real photos, real prices, and direct owner listings, removing the traditional brokerage fee system completely.

---

## 2. Target Audience
* **Buyers & Renters**: Individuals seeking premium housing, flats, or commercial spaces in Indian metros (Bengaluru, Pune, Mumbai, Delhi NCR, Hyderabad) without paying broker fees.
* **Property Owners**: Landlords wanting to list apartments or villas directly and coordinate with verified buyers without broker interference.

---

## 3. Core Features & User Journeys

### A. Authentication & Onboarding
* **OTP Sign In**: Passwordless verification using phone numbers (simulated sandbox code `123456` in development).
* **Onboarding Form**: Gathers user role (Buyer vs. Owner) and name.
* **Registration Page (`/register`)**: Dedicated portal routing users through the signup details check.

### B. Directory Search & Listings
* **Verified Listings Directory**: Filter listings by budget, BHK, city, locality, and property type (Buy/Rent/PG/Commercial).
* **RERA Matching Safeguards**: Integration checks indicating whether the listing is registered in state RERA databases.
* **Listing Quota Limits**: Restricts property owners to a maximum of 5 free posted listings to prevent broker spam.

### C. Auxiliary Premium Services
* **Kaam Kaaka Legal Audits (`/services/kaam-kaaka`)**: Deed trace checks and physical verifications.
* **Interior Design consultations (`/services/interior-design`)**: Expert 3D blueprints and customized home handovers.
* **RealtyNow Financials**: Pre-screen home loan eligibilities and interest rates.
* **DigiDraft Agreement Builder**: Fast digital lease and rental contracts setups.

### D. User Dashboard / Profiles (`/profile`)
* Displays active session credentials (name, phone, role).
* **My Bookmarked Properties**: Lists saved property cards.
* **My Posted Properties**: Shows properties posted by the user, warning when close to the 5-property quota limit.

---

## 4. Brand Personality
* **Voice**: Sophisticated, premium, trustworthy, and modern.
* **Aesthetic**: "Exaggerated Minimalism" balancing generous typography with subtle aurora shadows.
