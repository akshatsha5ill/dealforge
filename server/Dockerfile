FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci

COPY server/tsconfig.json ./server/
COPY server/src ./server/src
RUN npm run build --workspace=server

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --omit=dev

COPY --from=builder /app/server/dist/ ./server/dist/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server/dist/index.js"]
