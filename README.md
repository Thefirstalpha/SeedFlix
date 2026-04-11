
# SeedFlix

[![CI](https://github.com/Thefirstalpha/SeedFlix/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/Thefirstalpha/SeedFlix/actions/workflows/ci.yml)
[![Docker Release](https://github.com/Thefirstalpha/SeedFlix/actions/workflows/release-dockerhub.yml/badge.svg)](https://github.com/Thefirstalpha/SeedFlix/actions/workflows/release-dockerhub.yml)
[![SonarCloud Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=Thefirstalpha_SeedFlix&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Thefirstalpha_SeedFlix)
[![SonarCloud Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Thefirstalpha_SeedFlix&metric=security_rating)](https://sonarcloud.io/project/security_hotspots?id=Thefirstalpha_SeedFlix)
[![Trivy Enabled](https://img.shields.io/badge/security-Trivy-1904DA?logo=trivy&logoColor=white)](./trivy.yaml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

SeedFlix is a self-hosted media discovery and download management application built with React, Vite, and Express.

It combines TMDB catalog browsing, Torznab-based release search, Transmission integration, user-level data isolation, and an admin-controlled configuration model in a single full-stack application.

![SeedFlix interface](./SeedFlix.png)

## Overview

SeedFlix is designed for users who want a lightweight web interface to:

- browse movies and series from TMDB,
- search releases through Torznab-compatible indexers,
- send downloads to Transmission,
- track managed downloads,
- keep wishlists and notifications isolated per user,
- manage application access through an admin account.

The project targets a self-hosted setup and stores its runtime data locally under `server/data`.

## Highlights

- TMDB-powered movie and series discovery
- Advanced filtering by genre, language, rating, and release window
- Torznab release search for movies, series, seasons, and episodes
- Transmission RPC integration for download submission and monitoring
- Per-user wishlists, notifications, and managed download tracking
- Admin-only user management and global application settings
- HTTP-only session authentication
- French and English interface support
- Docker support with healthcheck and CI security scanning

## Architecture

### Frontend

- React
- Vite
- React Router
- Tailwind CSS

### Backend

- Node.js
- Express 5
- JSON-based runtime storage under `server/data`
- Session cookie authentication

### Integrations

- TMDB
- Torznab-compatible indexers
- Transmission RPC
- Discord webhook notifications

## Quality And Security

The repository already includes:

- a GitHub Actions CI pipeline for build, backend syntax checks, smoke tests, Docker build, and dependency audit,
- a dedicated SonarCloud workflow for static analysis once repository variables and secrets are configured,
- Trivy filesystem and container image scanning in CI,
- a production Dockerfile and Compose definition,
- admin-only protection for sensitive API operations.

## Quick Start

### Prerequisites

- Node.js 24+
- npm
- A TMDB API key
- Optionally: a Torznab indexer and a Transmission instance

### Installation

```bash
npm install
```

### Development

Recommended on Windows:

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev
```

Combined mode is also available:

```bash
npm run dev:all
```

Note: depending on the terminal environment on Windows, `node --watch` may report a non-zero exit code even when both services are up. Running frontend and backend in separate terminals is the most reliable setup.

### Production Build

```bash
npm run build
```

## Docker

### Docker Compose

```bash
docker compose up --build
```

The application is exposed on `http://localhost:4000`.

Runtime data is persisted through:

```text
./server/data:/app/server/data
```

### Manual Docker Build

```bash
docker build --build-arg IMAGE_TAG=local -t seedflix:local .
docker run --rm -p 4000:4000 -v ${PWD}/server/data:/app/server/data seedflix:local
```

## Configuration

### First Login

- Default account: `admin` / `admin`
- On first login, the default password must be changed before normal access is granted.

### Application Settings

Most configuration is handled from the web UI after login:

- TMDB API key
- Transmission connection settings
- Torznab endpoint and token
- Default download folders
- Notification channels
- Language and user preferences

### Supported Environment Variables

SeedFlix can also read a few runtime environment variables:

```bash
PORT=4000
DEBUG=false
TMDB_API_KEY=your_tmdb_key
APP_IMAGE_TAG=dev
```

`TMDB_API_KEY` can be used to bootstrap the application, but the project also supports admin-managed configuration through the UI.

## Main Capabilities

### Discovery

- Browse popular movies and series
- Search TMDB content
- Filter by language, genre, rating, and release dates
- Inspect detailed movie, series, season, and episode pages

### Release Search

- Query Torznab indexers from SeedFlix
- Match releases against wishlists
- Validate or reject tracker suggestions
- Notify users when a matching release is found

### Download Management

- Add torrents or magnet links to Transmission
- Track active and completed managed downloads
- Distinguish SeedFlix-managed torrents from the rest of the client library

### Administration

- Create users
- Delete users
- Reset user passwords
- Control global settings
- Run a factory reset

## Repository Structure

```text
.
├── src/                    Frontend application
│   └── app/                Routes, components, services, contexts, i18n
├── server/                 Express backend
│   ├── modules/            Feature modules
│   ├── data/               Runtime JSON data stores
│   └── defaultSettings.json
├── docker/                 Container-related assets
├── .github/workflows/      CI and release automation
├── Dockerfile
├── docker-compose.yml
└── trivy.yaml
```

## API Surface

Main API families include:

- `/api/auth/*`
- `/api/settings/*`
- `/api/users/*`
- `/api/wishlist*`
- `/api/series-wishlist*`
- `/api/notifications*`
- `/api/tracker-results*`
- `/api/indexer/*`
- `/api/torrent/*`
- `/api/movies/*`
- `/api/series/*`

## Public Repository Notes

If you expose this repository publicly, it is recommended to:

- keep real API keys and credentials out of tracked files,
- avoid committing production `server/data` content,
- configure repository secrets before enabling release publishing,
- enable branch protection on the default branch,
- optionally connect SonarCloud for additional static analysis.

## SonarCloud

Yes, there is a free Sonar offering for public repositories: SonarCloud provides a free tier for open-source and public projects.

This repository is now connected to SonarCloud.

Files added for the integration:

- `.github/workflows/sonarcloud.yml`
- `sonar-project.properties`

The repository is configured with the following SonarCloud identifiers:

- `SONAR_ORGANIZATION`: `thefirstalpha`
- `SONAR_PROJECT_KEY`: `Thefirstalpha_SeedFlix`

If you need to reconfigure the integration in GitHub:

1. Import the repository into SonarCloud.
2. Add the repository secret `SONAR_TOKEN`.
3. Add the repository variable `SONAR_ORGANIZATION`.
4. Add the repository variable `SONAR_PROJECT_KEY`.

Live badges currently available for this project include:

- Quality Gate
- Bugs
- Vulnerabilities
- Code Smells
- Security Rating

Example badge URLs for this repository:

```text
https://sonarcloud.io/api/project_badges/measure?project=Thefirstalpha_SeedFlix&metric=alert_status
https://sonarcloud.io/api/project_badges/measure?project=Thefirstalpha_SeedFlix&metric=security_rating
```

## Legal Notice

SeedFlix is a self-hosted management interface. Users remain responsible for:

- complying with the laws applicable in their jurisdiction,
- respecting content rights and platform terms of service,
- using indexers, trackers, and media sources lawfully.

This repository is provided as-is, without warranty.
  