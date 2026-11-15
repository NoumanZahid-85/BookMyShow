# Next.js standalone build: only the server bundle and static files reach the final image.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
# Rewrites are fixed at build time, so the API address inside Docker is a build argument.
ARG API_PROXY_URL=http://nginx:8080
# next/font downloads Inter at build time; Docker's network times out Node's IPv6-first attempt, so prefer IPv4.
ENV API_PROXY_URL=$API_PROXY_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=2000"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER node
EXPOSE 3001
CMD ["node", "server.js"]
