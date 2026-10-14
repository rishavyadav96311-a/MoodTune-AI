# MoodTune AI — Full-stack setup

This version adds a FastAPI backend, transformer-based text emotion inference, Jamendo audio search/stream URLs, Supabase authentication, and database-backed likes/playlists. The GitHub Pages frontend is static; deploy the backend separately.

## 1. Configure music catalog (Jamendo)
1. Register for a Jamendo developer account and create an application to obtain a client ID.
2. Review the current Jamendo API terms, attribution rules, territory and commercial-use restrictions before public launch.
3. In Render, set `JAMENDO_CLIENT_ID` to the client ID. Do not put the client ID in public frontend code.
4. Jamendo catalog availability and rights vary by track. The app displays provider links/license metadata where available; do not assume every track permits every commercial use.

## 2. Deploy the API to Render
1. Create a new Render Web Service from this repository.
2. Use the included `render.yaml` blueprint, or set root directory to `backend`, build command `pip install -r requirements.txt`, start command `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. Set `JAMENDO_CLIENT_ID` and wait for `/health` to return status ok. The first model load downloads the Hugging Face model and may take several minutes / use significant memory.
4. Copy the deployed API base URL into `config.js` as `API_BASE_URL`.

## 3. Configure Supabase auth and database
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication settings, configure your website URL and allowed redirect URLs. For GitHub Pages, add the published site URL.
4. Copy the project URL and anon/public key into `config.js`. Never use the service-role key in a browser.
5. In Supabase Auth settings, configure email confirmation as desired for your launch.

## 4. Publish the frontend
1. Commit `config.js` with your public API URL and Supabase anon key.
2. GitHub Actions deploys the root site to GitHub Pages after a push to `main`.
3. Open the published Pages URL over HTTPS. Camera access is only available in secure contexts (HTTPS or localhost).

## 5. Test before sharing
- Visit `/health` on the API.
- Enter a sentence in Mood analysis; the API should return `method: transformer-model`.
- Search music and start a track. Audio URLs are supplied by Jamendo and require a valid provider setup.
- Create an account, sign in, like a track, create a playlist and verify they persist after refresh.
- Test mobile viewport, loading/error states, auth email redirects, and API uptime.

## Important limits
- Text analysis uses a real Hugging Face transformer model. It is a mood/emotion estimate, not a clinical assessment.
- Camera preview is not falsely presented as AI facial analysis. A trained facial-expression model and explicit model/privacy review are separate work before enabling that feature.
- Full commercial Bollywood/Bhojpuri catalogs require rights from the relevant providers/rightsholders. This starter uses a licensed/independent-music provider route instead.
- GitHub Pages cannot run Python. Keep the API deployed separately.
