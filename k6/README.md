# k6 load tests

Load-test scripts for RealtyNow's two highest-cost paths.

| File | Target | Prerequisites |
|---|---|---|
| `load-search.js` | Supabase REST `v_properties_search` (the real search query) | deployed project URL + anon key |
| `load-payment.js` | `payment-gateway` edge function `create-order` | real user JWTs + Razorpay test keys |

## Install k6

- Windows: `choco install k6` or download the binary from the k6 releases page.
- Verify: `k6 version`

## Search (any environment)

```powershell
$env:SUPABASE_URL = "https://YOURPROJECT.supabase.co"
$env:SUPABASE_ANON_KEY = "<anon key>"   # public client credential, not a secret
k6 run k6/load-search.js
```

Defaults to `http://localhost:54321` (local Supabase) so you can also run it
against `supabase start`.

## Payment (deployed, auth + Razorpay test mode)

```powershell
$env:EDGE_URL = "https://YOURPROJECT.supabase.co/functions/v1/payment-gateway"
k6 run k6/load-payment.js          # reads k6/k6-auth-tokens.json by default
```

The token file must contain a JSON array of real user JWTs (one per VU):
`[ "eyJ...", "eyJ..." ]`. **Never commit real JWTs** — `k6-tokens*.json` and
`k6-results*` are gitignored.

## Reading results / pass criteria

Scripts set built-in k6 thresholds and will FAIL (exit code 1) if breached:

- Search: `p(95) < 800ms`, error rate `< 1%`.
- Payment: `p(95) < 1200ms`, error rate `< 5%` (payment depends on Razorpay latency).

Watch the printed summary for `http_req_duration` and `http_req_failed`. To record
a trend for comparison, run with `--out json=k6-results-<run>.json` and keep the
named runs for post-launch regression checks.
