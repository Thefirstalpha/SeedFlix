# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@latest && npm ci

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

COPY package*.json ./
RUN npm ci --omit=dev

# Data directory is owned by node so the app can write runtime files.
# All code files are owned by root (read-only for the running process).
RUN mkdir -p /app/server/modules /app/data && chown node:node /app/data
COPY --chown=root:root --chmod=444 server/* ./server/
COPY --chown=root:root --chmod=444 server/modules/* ./server/modules/
COPY --chown=root:root --chmod=555 --from=build /app/dist ./dist

# Use the non-root user that already exists in the official Node image.
USER node

EXPOSE 4000
CMD ["node", "server/index.js"]
