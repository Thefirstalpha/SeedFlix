
  # Movie Search Website

  This is a code bundle for Movie Search Website. The original project is available at https://www.figma.com/design/VcmqeN9QJVIaWqFlnmPgJg/Movie-Search-Website.

  ## Running the code

  Run `npm i` to install the dependencies.

  ## Full-stack mode (frontend + backend in one repo)

  1. Copy `.env.example` to `.env`
  2. Set your TMDB key in `.env`:

  `TMDB_API_KEY=YOUR_TMDB_API_KEY`

  3. Run all services together:

  `npm run dev:all`

  This starts:
  - Vite frontend
  - Express backend proxy on port 4000

  The frontend calls `/api/...` and Vite proxies these requests to the backend.

  ## Frontend only

  Run `npm run dev` to start only the frontend development server.
  