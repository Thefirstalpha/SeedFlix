
  # SeedFlix

A modern media management and discovery application built with React, Vite, and Express. Browse movies and TV series from TMDB, search movie releases across indexers, and manage downloads with your media client.

## Features

- **Catalog Management**: Browse and search movies and TV series from TMDB database
- **Media Discovery**: Filter content by genre, language, release year, and ratings
- **Torrent Search**: Search movie/series releases across Torznab indexers with advanced filtering
- **Client Integration**: Download support via Transmission RPC protocol
- **User Management**: Secure authentication with password management
- **Wishlist**: Save favorite movies and series for later discovery
- **Download Tracking**: Monitor active and completed downloads
- **Multi-language Support**: French and English UI with content language filtering

## Technology Stack

### Frontend
- React 18+ with TypeScript
- React Router 7 for navigation
- Tailwind CSS for styling
- Vite as build tool
- Lucide React for icons

### Backend
- Node.js with Express 5
- TMDB API integration
- Torznab protocol support (XML parsing)
- Transmission RPC client
- Session-based authentication

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- TMDB API key (get it at [themoviedb.org](https://www.themoviedb.org/settings/api))
- (Optional) Transmission client for download management
- (Optional) Torznab indexer access for release search

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd CatalogFinder
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
```

4. Add your TMDB API key to `.env`:
```env
TMDB_API_KEY=your_key_here
```

### Running the Application

**Full-stack mode** (frontend + backend together):
```bash
npm run dev:all
```

This starts:
- Vite development server with hot reload
- Express backend on `http://localhost:4000`
- Frontend proxies API requests to backend

**Frontend only**:
```bash
npm run dev
```

**Production build**:
```bash
npm run build
npm run preview
```

## Configuration

### Initial Login
- Default credentials: `admin` / `admin`
- On first login with default credentials, you must change your password in Settings
- After password change, access is unrestricted

### Settings
Navigate to **Settings** to configure:
- **Account**: Update username and password
- **Transmission Client**: URL, port, RPC credentials (optional)
- **Torznab Indexer**: API URL and token for release search
- **Indexer Defaults**: Default quality preference for searches
- **Download Folders**: Configure movie and series download destinations

## Architecture

```
SeedFlix/
├── src/                          # Frontend React application
│   ├── app/
│   │   ├── components/          # React components
│   │   ├── services/            # API service layer
│   │   ├── config/              # Configuration (TMDB, etc)
│   │   ├── context/             # React context (Auth, etc)
│   │   └── types/               # TypeScript types
│   └── styles/
├── server/                       # Backend Express application
│   ├── modules/                 # Feature modules (auth, torznab, etc)
│   ├── data/                    # Runtime data (users, wishlist, etc)
│   ├── config.js                # Configuration
│   ├── logger.js                # Debug logging
│   └── index.js                 # Express entry point
├── guidelines/                   # Development guidelines
└── vite.config.ts               # Vite configuration
```

## Key Routes

### Authentication
- `GET /api/auth/me` - Get current user
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/logout` - Logout
- `POST /api/auth/change-password` - Change password

### Media Discovery
- `GET /api/tmdb/movies` - Get movies with filtering
- `GET /api/tmdb/series` - Get series with filtering
- `GET /api/tmdb/search` - Search TMDB database

### Wishlist
- `GET /api/wishlist` - Get saved movies
- `POST /api/wishlist/:id` - Add/remove from wishlist
- `GET /api/wishlist/series` - Get series wishlist
- `POST /api/wishlist/series/:id` - Manage series wishlist

### Torrent Search & Downloads
- `POST /api/indexer/search` - Search releases via Torznab
- `POST /api/indexer/test` - Test Torznab connection
- `POST /api/torrent/add` - Add torrent to client
- `GET /api/torrent/downloads` - Get active downloads

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/factory-reset` - Reset to defaults

## Usage

### Browse Movies and Series
1. Navigate to Home page to see the catalog
2. Use filters (genre, language, year, rating) to narrow results
3. Click on a movie/series card to view details

### Search for Releases
1. Open a movie or series detail page
2. Scroll to "Tracker Releases" section
3. Refine with quality/language filters if needed
4. Click "Add to client" to download

### Manage Downloads
1. Go to Settings → Downloads section
2. Monitor active and completed downloads
3. Downloads are organized by media type (movies/series)

### Configure Torznab
1. Go to Settings → Indexer tab
2. Enter your Torznab indexer URL and API token
3. Use "Test Connection" to verify setup
4. Set default quality preference

## Development

### Build System
- Vite for fast builds
- Tailwind CSS for styling
- shadcn/ui component library
- TypeScript for type safety

### Debug Mode
Enable enhanced logging:
```bash
npm run dev:all -- --debug
```

Or set environment variable:
```bash
DEBUG=1 npm run dev:all
```

## Testing & Validation

```bash
# Type checking
npm run type-check

# Build validation
npm run build

# Development server
npm run dev:all
```

## Legal Notice

This application is a neutral media management tool that can be used with any legal content source. Users are responsible for:
- Complying with applicable laws in their jurisdiction
- Respecting copyright and intellectual property rights
- Obtaining proper authorization for content access
- Adhering to terms of service of indexers and media providers

The author bears no responsibility for how this application is used. By using this software, you agree to use it responsibly and legally.

---

**Note**: This application requires configuration (TMDB API key, Torznab indexer, etc.) to function fully.
  