# ======================================================================
# CRIM-SYS 2026 — frontend-ui (accessible citizen interface)
# Stage 1: build the SPA. Stage 2: nginx serving it + /api proxy that
# injects X-Internal-Key SERVER-SIDE (never exposed to the browser).
# ======================================================================

# --- Stage 1: build ----------------------------------------------------
FROM oven/bun:1 AS build

WORKDIR /app
COPY package.json ./
RUN bun install --no-progress
COPY . .
# Docker Compose passes build args; Vite reads nothing secret here.
RUN bun run build

# --- Stage 2: runtime ---------------------------------------------------
FROM nginx:1.27-alpine

# Template so the internal key is read from the environment at runtime,
# never baked into the image layers. The filter restricts envsubst to the
# key variable only — nginx variables like $host/$uri pass through intact.
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV INTERNAL_API_KEY="" \
    NGINX_ENVSUBST_FILTER="^INTERNAL_API_KEY$"

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1
