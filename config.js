// Public browser configuration only. Never put a Supabase service-role key here.
window.MOODTUNE_CONFIG = {
  // Deploy backend/main.py to Render and paste its base URL below, e.g. https://moodtune-ai-api.onrender.com
  API_BASE_URL: "http://localhost:8000",
  // Supabase -> Project Settings -> API. These are public browser values; enable RLS in supabase/schema.sql.
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
