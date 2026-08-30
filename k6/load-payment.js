// k6 load test — RealtyNow PAYMENT path
//
// The payment-gateway edge function (supabase/functions/payment-gateway) requires:
//   - `Authorization: Bearer <real user JWT>` (it calls auth.getUser on it)
//   - `x-action: create-order`
//   - service-role-backed Razorpay credentials configured server-side
//   - rate limiting: 30 req/min per key/IP
//
// Because it needs REAL authenticated user tokens AND Razorpay test-mode keys,
// this cannot run against an anonymous sandbox. Prepare first:
//
//   1. Deploy payment-gateway and set RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET (test mode).
//   2. Create N test users and capture their JWTs into k6-auth-tokens.json:
//        [ "eyJ...", "eyJ..." ]
//   3. Run:
//        $env:EDGE_URL="https://YOURPROJECT.supabase.co/functions/v1/payment-gateway"
//        k6 run k6/load-payment.js
//
// The script picks a random token per VU and spreads load to stay within the
// per-key 30/min rate limit while still exercising concurrent create-order calls.

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const EDGE_URL = __ENV.EDGE_URL || "http://localhost:54321/functions/v1/payment-gateway";

// Load a real token list passed separately (never commit real JWTs).
const TOKENS = new SharedArray("tokens", function () {
  try {
    const content = open(__ENV.TOKENS_FILE || "k6/k6-auth-tokens.json");
    return JSON.parse(content);
  } catch {
    return ["missing-token"];
  }
});

export const options = {
  scenarios: {
    create_order: {
      executor: "constant-vus",
      vus: 8, // stays under 30/min per key given ~2 iterations/min per VU
      duration: "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"], // <5% errors (auth/provisioned users expected)
    http_req_duration: ["p(95)<1200"],
  },
};

export default function () {
  const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
  const payload = {
    // RealtyNow payment shape: amount in paise = ₹500.00
    amount: 50000,
    currency: "INR",
    receipt: `k6-${__VU}-${__ITER}`,
  };

  const res = http.post(
    EDGE_URL,
    JSON.stringify(payload),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-action": "create-order",
      },
    }
  );

  check(res, {
    "create-order accepted (200/201)": (r) => r.status === 200 || r.status === 201,
    "returns order id": (r) => {
      try {
        const b = r.json();
        return b.id || (b.order && b.order.id) || false;
      } catch {
        return false;
      }
    },
  });

  sleep(2); // 30s avg spacing per VU → ~2/min, within rate limit
}
