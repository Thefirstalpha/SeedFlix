# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
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

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 4000
CMD ["node", "server/index.js"]
