# RealtyNow — Deployment Guidelines

Two supported hosting paths; pick per environment (see `docs/LAUNCH_GATE.md` for the go-live checklist).

| Path | Use for | Where |
| --- | --- | --- |
| **Netlify** | Primary public site + CDN edge | `netlify.toml`, `public/_redirects` |
| **Docker / Kubernetes** | Containerized web tier (high availability, autoscaling) | `Dockerfile`, `docker-compose.yml`, `k8s/` |

---

## 1. Netlify (primary)

- Build: `npm run build` (runs image optimization → Vite build → copies `.htaccess` to `dist/`). Publish dir: `dist`.
- **CDN:** Netlify’s edge *is* the CDN layer. Hashed `/assets/*` and `/optimized/*` are cached `immutable` (1 year); `index.html` is `no-cache, no-store` so new asset hashes are picked up instantly; images/fonts cached day-scale.
- **SPA routing:** `/*` → `/index.html` (200) with runtime rewrites in `public/_redirects`.
- **Security headers** at the edge: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`.
- Domains: `www.realtynow.in`, `realtynow.in`, `realtynow.netlify.app` (also the CORS allow-list — keep in sync with `supabase/functions/_shared/cors.ts`).

**Deploy:** push to `main` builds a preview; production via the Netlify UI/CLI:
```bash
netlify deploy --prod --dir dist
```

---

## 2. Docker / Kubernetes (web tier)

### Dockerfile & runtime model
- Runs **nginx as uid 101 (non-root)** on **port 8080**, read-only root filesystem, all capabilities dropped, `/tmp` emptyDir for nginx pid/temp files. `HEALTHCHECK` hits `/`.
- `docker-compose.yml` is the single-container local/quickstart path.

### Manifests (`k8s/`)
| File | Purpose |
| --- | --- |
| `namespace.yaml` | `realtynow` namespace |
| `deployment.yaml` | 2 replicas, liveness/readiness probes on `/` :8080, non-root securityContext |
| `service.yaml` | ClusterIP → container port 8080 |
| `hpa.yaml` | HorizontalPodAutoscaler **2–8 replicas** on CPU/memory |
| `kustomization.yaml` | Apply the whole tier |

```bash
kubectl apply -k k8s/
kubectl rollout status deployment/realtynow -n realtynow
```

TLS/Ingress is external (your ingress controller terminates HTTPS in front of the ClusterIP Service).

### Automated release (`release.yml`)
- Trigger: push a git tag **`v*`**.
- Build → push image to **GHCR** (`ghcr.io/<repo>:<sha>` + `:latest`) → set image on the deployment in the **`production`** environment (required reviewers) → `rollout status` → **automatic `rollout undo` on failure** (rollback to prior tag).
- Requires GitHub `production` environment with secrets: `KUBE_CONFIG` (service-account kubeconfig), plus GHCR auth via `GITHUB_TOKEN`.

---

## 3. Environments & secrets

| Variable / secret | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Build env (Netlify), runtime env (container) | Public-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-side only** (edge-function env / secret manager) | Never in `VITE_*` or committed |
| `PUBLIC_SITE_URL` | Edge function env | Defaults to `https://realtynow.in` |
| `RESEND_API_KEY` | Server (email) | See `docs/ADMIN_LOGIN_PLAN.md`/ops |
| `VITE_SENTRY_DSN` | Build env | Blank in dev |
| `RAZORPAY_KEY_ID` / `KEY_SECRET` | Server (payment-gateway, txn webhook) | — |
| `KUBE_CONFIG` | GitHub `production` env | — |
| `E2E_*` secrets | GitHub env | Runs Playwright against staging backend |

> Rule: `VITE_*` vars are compiled into the client — never put secrets there. Server secrets go into the edge-function env / secret manager and are referenced via `Deno.env.get(...)`.

---

## 4. Deploy checklist (per release)

1. `npm run build` locally succeeds; `npm run typecheck`, `npm test`, `npm run lint:ci`, secret scan green.
2. Tag → CI `quality` + `release` pipelines pass.
3. Verify post-deploy: `/` 200, `/assets/*` immutable-200, `/api`/edge smoke paths, `v_properties_search` public query returns published-only + no phone columns.
4. If `kubectl rollout` fails, release.yml auto-rolls back — confirm old pod healthy.
5. CDN: hashed assets purge-free; bump any changed env vars in Netlify/env manager.

---

## 5. Scaling & capacity

- HPA 2–8 replicas; right-size against `k6/` load results before go-live.
- The SPA holds no server state — failed pods are replaced instantly.
- Database is the vertical bottleneck ahead of the web tier: `SEARCH_HARD_CAP=500`, indexes (0144), and the Redis / pg_full_text backlog items in `docs/DEVELOPMENT_GUIDELINES.md` → ops plan cover it.