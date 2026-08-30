# syntax=docker/dockerfile:1

ARG NPM_VERSION=12.0.2

FROM node:24-alpine AS deps
ARG NPM_VERSION
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@"${NPM_VERSION}" --ignore-scripts && npm ci --ignore-scripts

FROM deps AS build
COPY index.html ./
COPY vite.config.ts ./
COPY postcss.config.mjs ./
COPY src ./src
COPY public ./public
RUN npm run build


FROM node:24-alpine AS runtime
ARG IMAGE_TAG=dev
ARG NPM_VERSION
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
LABEL org.opencontainers.image.title="SeedFlix"
LABEL org.opencontainers.image.description="SeedFlix full-stack app (React + Express)"
LABEL org.opencontainers.image.version="${IMAGE_TAG}"

COPY package*.json ./
# Install ffmpeg for on-the-fly media remuxing/transcoding in production/Kubernetes.
# Remove npm/npx afterward: the app runs with node only in production.
RUN apk add --no-cache ffmpeg \
	&& npm install -g npm@"${NPM_VERSION}" --ignore-scripts \
	&& npm ci --omit=dev --ignore-scripts \
	&& npm cache clean --force \
	&& rm -rf /usr/local/lib/node_modules/npm \
	&& rm -f /usr/local/bin/npm /usr/local/bin/npx

# Data directory is owned by node so the app can write runtime files.
# All code files are owned by root (read-only for the running process).
RUN mkdir -p /app/server/modules /app/server/routes /app/server/types /app/common /app/data \
	&& chown node:node /app/data
COPY --chown=root:root --chmod=444 server/* ./server/
COPY --chown=root:root --chmod=444 server/modules/* ./server/modules/
COPY --chown=root:root --chmod=444 server/routes/* ./server/routes/
COPY --chown=root:root --chmod=444 server/types/* ./server/types/
COPY --chown=root:root --chmod=444 common/* ./common/
COPY --chown=root:root --chmod=555 --from=build /app/dist ./dist

# Use the non-root user that already exists in the official Node image.
USER node

EXPOSE 4000
CMD ["./node_modules/.bin/tsx", "server/index.ts"]
