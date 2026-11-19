# ==============================================================================
# Stage 1: Build React + TypeScript Frontend (Vite) with Node 20
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

# Default VITE_API_URL to empty string so Nginx reverse proxy handles /api/ and /ws/ on the same origin
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ==============================================================================
# Stage 2: Production Nginx Server with SPA Fallback & API/WebSocket Proxy
# ==============================================================================
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
