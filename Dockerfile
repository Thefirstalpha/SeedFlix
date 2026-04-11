# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY index.html ./
COPY vite.config.ts ./
COPY postcss.config.mjs ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24-alpine AS runtime
ARG IMAGE_TAG=dev
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV APP_IMAGE_TAG=${IMAGE_TAG}
LABEL org.opencontainers.image.title="SeedFlix"
LABEL org.opencontainers.image.description="SeedFlix full-stack app (React + Express)"
LABEL org.opencontainers.image.version="${IMAGE_TAG}"

# Pull in latest Alpine security fixes available at build time.
RUN apk upgrade --no-cache

# Update bundled npm to latest patched release so image scans do not fail on npm's own transitive deps.
RUN npm install -g npm@latest

COPY package*.json ./
RUN npm ci --omit=dev

RUN mkdir -p /app/server/modules /app/data && chown node:node /app/data
COPY --chown=node:node --chmod=0444 server/config.js server/defaultSettings.json server/i18n.js server/index.js server/logger.js ./server/
COPY --chown=node:node --chmod=0555 server/modules ./server/modules
COPY --chown=node:node --chmod=0555 --from=build /app/dist ./dist

# Use the non-root user that already exists in the official Node image.
USER node

EXPOSE 4000
CMD ["node", "server/index.js"]
