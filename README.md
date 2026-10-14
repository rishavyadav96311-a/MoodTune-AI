# MoodTune AI — Full-stack music discovery

MoodTune AI is being developed as a full-stack music discovery and mood-personalization website. The repository contains a static web frontend, a FastAPI backend, a transformer-based text-emotion endpoint, Jamendo independent-music catalog integration, and Supabase authentication/database schema.

## What is implemented in the code
- Responsive music discovery UI and HTML audio player for provider-supplied audio URLs
- Search and mood-based catalog discovery through the backend
- Real transformer-model text emotion inference through Hugging Face Transformers
- Supabase email signup/sign-in integration (requires project configuration)
- Database-backed liked tracks and playlists with row-level security
- Optional browser camera preview; no fake camera emotion classification
- GitHub Actions deployment for the static frontend

## Start locally
1. Install Python 3.11+.
2. Configure backend environment variables (see `.env.example`).
3. Run the API:
   ```bash
   cd backend
   pip install -r requirements.txt
   export JAMENDO_CLIENT_ID=your_client_id
   uvicorn main:app --reload --port 8000
   ```
4. In `config.js`, set `API_BASE_URL` to `http://localhost:8000`.
5. Set up Supabase using `supabase/schema.sql`, then put your project URL and anon/public key into `config.js`.
6. Serve the repository root with a local web server (e.g. `python -m http.server 5500`) and open `http://localhost:5500`.

## Deploy
See [DEPLOY_FULLSTACK.md](DEPLOY_FULLSTACK.md). The included `render.yaml` describes a Render backend service. GitHub Actions publishes the static frontend to GitHub Pages after pushing to `main`.

## Required configuration
- `JAMENDO_CLIENT_ID`: obtain from a Jamendo developer account and review provider terms/track licenses.
- `API_BASE_URL`: deployed FastAPI base URL in `config.js`.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`: public client settings from your Supabase project. Never place a service-role key in frontend code.

## Important
The repository changes are the full-stack foundation, not a claim that the hosted production service is already configured. Backend hosting, provider credentials, Supabase project setup and end-to-end verification are required before the live URL has working sign-in, catalog streaming and AI inference. The text emotion model is a real ML model; camera preview is not yet facial-emotion AI. Commercial music rights vary by track and provider, and popular-label catalogs need separate permission/integration.
