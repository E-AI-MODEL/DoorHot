# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY datasets ./datasets
COPY migrations ./migrations
COPY scripts ./scripts
COPY tsconfig.json tsconfig.base.json ./

RUN npm ci --ignore-scripts
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV APP_STORAGE_MODE=postgres
ENV API_HOST=0.0.0.0
ENV API_PORT=4000
ENV DATASETS_DIRECTORY=/app/datasets
ENV FILE_STORAGE_DIRECTORY=/app/var/storage

COPY --from=builder --chown=node:node /app /app

RUN mkdir -p /app/var/storage   && chown -R node:node /app/var

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3   CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health/ready').then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "scripts/start-production.mjs"]
