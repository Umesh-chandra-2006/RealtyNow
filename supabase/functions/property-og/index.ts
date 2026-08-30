// supabase/functions/property-og/index.ts
// Dynamic Open Graph & Twitter Card server-side metadata generator for WhatsApp, Facebook, Twitter, and LinkedIn crawlers.
// Fetches property data from Supabase and serves rich HTML head tags with RealtyNow branding.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getCorsHeaders } from '../_shared/cors.ts';

let corsHeaders: Record<string, string> = {};

const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') || 'https://realtynow.in';
const BRAND_LOGO = 'https://realtynow.in/pwa-512x512.png';
const FALLBACK_IMAGE = BRAND_LOGO;

function formatCompactPrice(price: number | string | null | undefined, purpose?: string | null): string {
  if (!price) return 'Price on Request';
  const num = typeof price === 'number' ? price : Number(String(price).replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) return 'Price on Request';

  const isRent = purpose?.toLowerCase() === 'rent';
  const suffix = isRent ? '/mo' : '';

  if (num >= 10000000) {
    const cr = (num / 10000000).toFixed(2).replace(/\.00$/, '');
    return `₹${cr} Cr${suffix}`;
  }
  if (num >= 100000) {
    const lk = (num / 100000).toFixed(2).replace(/\.00$/, '');
    return `₹${lk} L${suffix}`;
  }
  return `₹${num.toLocaleString('en-IN')}${suffix}`;
}

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

function extractPropertyId(url: URL): string | null {
  // Check query parameter ?id=... or ?slug=...
  const qId = url.searchParams.get('id');
  if (qId) return qId;

  // Check path like /property-og/UUID or /property-og/slug-UUID
  const pathname = url.pathname.replace(/^\/property-og\/?/, '');
  const match = pathname.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const propertyId = extractPropertyId(url);

  if (!propertyId) {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>RealtyNow — All About Realty</title>
  <meta name="description" content="Discover premium verified real estate properties, luxury apartments, and villas on RealtyNow.">
  <meta property="og:title" content="RealtyNow — All About Realty">
  <meta property="og:description" content="Discover premium verified real estate properties, luxury apartments, and villas on RealtyNow.">
  <meta property="og:image" content="${FALLBACK_IMAGE}">
  <meta property="og:url" content="${SITE_URL}">
  <meta property="og:site_name" content="RealtyNow">
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0; url=${SITE_URL}">
</head>
<body>
  <p>Redirecting to <a href="${SITE_URL}">RealtyNow</a>...</p>
</body>
</html>`,
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  const supabase = serviceClient();

  // v_properties_search joins in property_type_name/locality_name/city_name —
  // the raw properties table doesn't carry those denormalized columns.
  const { data: prop, error } = await supabase
    .from('v_properties_search')
    .select('*')
    .eq('id', propertyId)
    .maybeSingle();

  if (error || !prop) {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Property on RealtyNow</title>
  <meta property="og:title" content="Property on RealtyNow">
  <meta property="og:description" content="View property details on RealtyNow — All About Realty.">
  <meta property="og:image" content="${FALLBACK_IMAGE}">
  <meta property="og:url" content="${SITE_URL}">
  <meta http-equiv="refresh" content="0; url=${SITE_URL}">
</head>
<body>
  <p>Redirecting to <a href="${SITE_URL}">RealtyNow</a>...</p>
</body>
</html>`,
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  const title = (prop.seo_title || prop.title || 'Premium Property in Hyderabad').replace(/"/g, '&quot;');
  const bhk = prop.bedrooms ? `${prop.bedrooms} BHK ` : '';
  const propType = prop.property_type_name || prop.category || 'Property';
  const purpose = prop.purpose === 'Rent' ? 'for Rent' : 'for Sale';
  const locality = prop.locality_name || prop.locality || '';
  const city = prop.city_name || prop.city || 'Hyderabad';
  const place = [locality, city].filter(Boolean).join(', ');
  const price = formatCompactPrice(prop.price, prop.purpose);

  const description = (
    prop.seo_description ||
    prop.description ||
    `${bhk}${propType} ${purpose} in ${place}. ${price}. Explore verified listings, photos, floor plans, and amenities on RealtyNow — All About Realty.`
  )
    .replace(/"/g, '&quot;')
    .slice(0, 200);

  // Share previews always carry the RealtyNow logo, never the property's own
  // photo — intentionally not prop.og_image/prop.images[0].
  const ogImage = BRAND_LOGO;

  // Canonical Property URL
  const slug = (prop.title || 'property')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 60)
    .replace(/-$/, '');
  const canonicalUrl = `${SITE_URL}/property/${slug}-${prop.id}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${title} | RealtyNow</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Open Graph / WhatsApp / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="RealtyNow — All About Realty">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:secure_url" content="${ogImage}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${title}">
  <meta property="og:locale" content="en_IN">

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@RealtyNow">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">
  <meta name="twitter:image:alt" content="${title}">

  <!-- Schema.org Product / RealEstate JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": "${title}",
    "description": "${description}",
    "url": "${canonicalUrl}",
    "image": "${ogImage}",
    "offers": {
      "@type": "Offer",
      "price": "${prop.price || 0}",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock"
    }
  }
  </script>

  <!-- Client-side Redirect for Browser Visitors -->
  <script>
    if (!/bot|crawler|spider|crawling|facebookexternalhit|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot/i.test(navigator.userAgent)) {
      window.location.replace("${canonicalUrl}");
    }
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #fff; padding: 40px 20px; text-align: center;">
  <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    <div style="width: 100%; height: 280px; background: #b61f24; display: flex; align-items: center; justify-content: center;">
      <img src="${ogImage}" alt="RealtyNow" style="width: 140px; height: 140px; object-fit: contain;">
    </div>
    <div style="padding: 24px;">
      <span style="background: #e11d48; color: #fff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase;">
        ${prop.purpose === 'Rent' ? 'FOR RENT' : 'FOR SALE'}
      </span>
      <h1 style="font-size: 22px; font-weight: 800; margin: 16px 0 8px;">${title}</h1>
      <p style="font-size: 18px; font-weight: 900; color: #fb7185; margin: 0 0 12px;">${price}</p>
      <p style="font-size: 14px; color: #94a3b8; margin: 0 0 20px;">📍 ${place}</p>
      <a href="${canonicalUrl}" style="display: inline-block; background: #e11d48; color: #fff; padding: 12px 28px; border-radius: 12px; font-weight: 700; text-decoration: none;">
        View Property on RealtyNow →
      </a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
});
