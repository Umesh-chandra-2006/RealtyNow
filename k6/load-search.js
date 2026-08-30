// k6 load test — RealtyNow SEARCH path
//
// The production search query is a Supabase REST (PostgREST) request against the
// `v_properties_search` view using the anon key — this is exactly what
// src/lib/search-service.ts does via supabase-js. This script replays that
// request shape so we can measure the real DB/network cost of search at load.
//
// Run (point at your deployed project):
//
//   $env:SUPABASE_URL="https://YOURPROJECT.supabase.co"
//   $env:SUPABASE_ANON_KEY="<anon key>"
//   k6 run k6/load-search.js
//
// NOTE: The anon key is a public client credential (safe to use in a test), NOT
// a secret. The service_role key must never go into a k6 script.

import http from "k6/http";
import { check } from "k6";

const SUPABASE_URL = __ENV.SUPABASE_URL || "http://localhost:54321";
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";

const SEARCH_QUERIES = [
  "3 BHK villa in Gachibowli",
  "2 BHK apartment Kokapet",
  "office space Jubilee Hills",
  "plot in Manikonda",
  "flats for rent near HITEC City",
];

function restUrl(query) {
  // Mimic the real client query: published/live filter + ilike on search_text,
  // plus the view columns the search UI uses. URL-encode the ilike literal.
  const params = new URLSearchParams();
  params.set("select", "id,title,price,rent_amount,purpose,locality_name,city_name,bedrooms,property_type_name,builder_name,project_name,cover_image_url,images,is_featured,is_verified,search_text");
  params.set("or", "(status.eq.published,status.eq.live,is_live.eq.true)");
  params.set("search_text", `ilike.*${query}*`);
  params.set("limit", "50");
  return `${SUPABASE_URL}/rest/v1/v_properties_search?${params.toString()}`;
}

export const options = {
  scenarios: {
    search: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 25 }, // ramp up to 25 concurrent users
        { duration: "2m", target: 25 }, // hold
        { duration: "30s", target: 0 }, // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% errors
    http_req_duration: ["p(95)<800"], // 95th percentile under 800ms
  },
};

export default function () {
  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  const res = http.get(restUrl(query), {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Accept: "application/json",
    },
  });

  check(res, {
    "search status 200": (r) => r.status === 200,
    "search returns JSON array": (r) => {
      try {
        return Array.isArray(r.json());
      } catch {
        return false;
      }
    },
  });
}
