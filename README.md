# SeedFlix 

[![CI](https://github.com/Thefirstalpha/SeedFlix/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/Thefirstalpha/SeedFlix/actions/workflows/ci.yml)
[![Docker Release](https://github.com/Thefirstalpha/SeedFlix/actions/workflows/release-dockerhub.yml/badge.svg)](https://github.com/Thefirstalpha/SeedFlix/actions/workflows/release-dockerhub.yml)
[![SonarCloud Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=Thefirstalpha_SeedFlix&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Thefirstalpha_SeedFlix)
[![SonarCloud Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Thefirstalpha_SeedFlix&metric=security_rating)](https://sonarcloud.io/project/security_hotspots?id=Thefirstalpha_SeedFlix)
[![Trivy Enabled](https://img.shields.io/badge/security-Trivy-1904DA?logo=trivy&logoColor=white)](./trivy.yaml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

SeedFlix is a self-hosted media catalog and personal transfer management application built with React, Vite, and Express.

It combines TMDB catalog browsing, Torznab-compatible indexer integration, Transmission client connectivity for user-approved transfers, user-level data isolation, and an admin-controlled configuration model in a single full-stack application.

> **Legal notice:** SeedFlix is intended for lawful, personal use only. Users are responsible for complying with the laws applicable in their jurisdiction.

## Overview

SeedFlix is designed for users who want a lightweight web interface to:

- browse movies and series from TMDB,
- connect to authorized Torznab-compatible indexers,
- manage user-approved transfers with a local Transmission instance,
- track active and completed transfers,
- keep wishlists and notifications isolated per user,
- manage application access through an admin account.

The project targets a self-hosted setup and stores its runtime data locally under `data/` at the repository root.

## Highlights

- TMDB-powered movie and series discovery
- Advanced filtering by genre, language, rating, and release window
- Torznab-compatible indexer integration for release lookup
- Transmission RPC integration for user-approved transfer management
- Per-user wishlists, notifications, and managed transfer tracking
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
- JSON-based runtime storage under `data/`
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
docker compose -f docker-compose.yml up --build
```

Run the command from the repository root so the `./data` volume is resolved correctly.

The application is exposed on `http://localhost:4000`.

Runtime data is persisted through:

```text
./data:/app/data
```

### Manual Docker Build

```bash
docker build --build-arg IMAGE_TAG=local -t seedflix:local .
docker run --rm -p 4000:4000 -v ${PWD}/data:/app/data seedflix:local
```

## Configuration

### First Login

- Default account: `admin` / `admin`
- On first login, the default password must be changed before normal access is granted.

## Main Capabilities

### Discovery

- Browse popular movies and series
- Search TMDB content
- Filter by language, genre, rating, and release dates
- Inspect detailed movie, series, season, and episode pages

### Release Review

- Connect to authorized Torznab-compatible indexers
- Match indexer results against your personal wishlist
- Review and validate indexer suggestions manually
- Notify users when a matching suggestion is detected on configured sources

### Transfer Management

- Send user-approved transfers to a connected Transmission instance
- Track active and completed managed transfers
- Distinguish SeedFlix-managed items from other Transmission library content

### Administration

- Create users
- Delete users
- Reset user passwords
- Control global settings
- Run a factory reset


## Legal Notice

SeedFlix is a personal media management tool intended strictly for lawful use. Users remain solely responsible for:

- complying with the laws applicable in their jurisdiction,
- respecting intellectual property rights and platform terms of service,
- ensuring that connected indexers and download sources are authorized and legal,
- using SeedFlix for personal, non-commercial purposes only.

The authors of SeedFlix do not endorse, facilitate, or condone copyright infringement or unauthorized content distribution.

This repository is provided as-is, without warranty.
  