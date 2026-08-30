# RealtyNow Kubernetes manifests (web tier)

Containerized deployment for the static SPA (nginx serving `dist/`). The tier is
stateless, so it scales horizontally via the HorizontalPodAutoscaler.

## Layout

| File | Purpose |
|---|---|
| `namespace.yaml` | `realtynow` namespace |
| `deployment.yaml` | nginx SPA Deployment (2 replicas, probes, hardened non-root securityContext, `/tmp` emptyDir) |
| `service.yaml` | ClusterIP Service → port 80 → container port 8080 |
| `hpa.yaml` | HorizontalPodAutoscaler (2–8 replicas, CPU/memory) |
| `kustomization.yaml` | Kustomize base (apply the whole tier with one command) |

## Deploy

```bash
kubectl apply -k k8s/
kubectl rollout status deployment/realtynow -n realtynow
```

TLS/Ingress is intentionally external (ingress-controller/LB of your choice) and
terminates HTTPS in front of the `realtynow` ClusterIP Service.

## Image / CI

- The deployment image reference (`ghcr.io/...:latest`) is a placeholder.
- `.github/workflows/release.yml` builds the image from the `Dockerfile`,
  pushes to GHCR, and runs:
  `kubectl set image deployment/realtynow realtynow=<tag>` + `rollout status`,
  with automatic `kubectl rollout undo` on failure (rollback to the prior tag).
- Requires the `production` GitHub environment and a `KUBE_CONFIG` secret.

## Scaling

- `hpa.yaml` scales 2 → 8 replicas on CPU/memory. Right-size based on the k6
  load-test results before go-live (see `docs/LAUNCH_GATE.md`).
- The SPA holds no local state — a failed pod is replaced instantly with no
  data-loss risk.

## Runtime model (non-root, locked down)

- The image runs nginx as **uid 101 (non-root)** on **port 8080** with a read-only
  root filesystem and all capabilities dropped — the `securityContext` in
  `deployment.yaml` matches the hardened `Dockerfile` exactly.
- A writable `emptyDir` is mounted at `/tmp`, where the nginx config writes its
  pid + temp/buffer files (it can no longer write `/var/cache`).
- Probes hit `/` on port 8080, mirroring the Dockerfile `HEALTHCHECK`.
