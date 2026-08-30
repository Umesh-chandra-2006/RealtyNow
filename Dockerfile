# ── RealtyNow SPA build & serve container ───────────────────────────────────
# Multi-stage: build the static bundle with Node, then serve it from a minimal
# nginx image. Health-checked and ready to sit behind a load balancer.

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Install deps first (leverages Docker layer caching when package-lock changes).
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the source and build.
COPY . .
# Image optimization needs sharp (devDependency) and the public/ assets.
RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
