(() => {
  "use strict";
  const cfg = window.MOODTUNE_CONFIG || {};
  const apiBase = (cfg.API_BASE_URL || "").replace(/\/$/, "");
  const supabaseReady = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const db = supabaseReady ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = (id) => document.getElementById(id);
  const state = { mood: "Calm", confidence: null, tracks: [], current: null, user: null, authMode: "signin", filter: "all", playlistId: null };
  let cameraStream = null;
  let toastTimer;
  const moodTerms = { Happy: "happy upbeat", Calm: "ambient chill", Sad: "melancholic piano", Energetic: "energetic rock", Stressed: "relaxing calm", Romantic: "romantic acoustic" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200); }
  function setStatus(message, ok = false) { const el = $("connectionStatus"); el.textContent = message; el.classList.toggle("connected", ok); }
  function apiUrl(path) { return apiBase + path; }
  async function api(path, options = {}) {
    if (!apiBase) throw new Error("Backend URL is not configured. Set API_BASE_URL in config.js.");
    const response = await fetch(apiUrl(path), { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.detail || data.message || "Request failed (" + response.status + ")");
    return data;
  }
  function setMood(mood, confidence = null, source = "selected by you") {
    state.mood = mood; state.confidence = confidence;
    $("heroMood").textContent = mood;
    $("heroConfidence").textContent = confidence == null ? source : Math.round(confidence * 100) + "% model confidence · " + source;
    $("detectedMood").textContent = mood;
    $("confidence").textContent = confidence == null ? "—" : Math.round(confidence * 100) + "%";
    $("playlistTag").textContent = mood + " mood";
    document.querySelectorAll("[data-mood]").forEach((b) => b.classList.toggle("active", b.dataset.mood === mood));
    loadTracks();
  }
  function trackCard(track) {
    return '<article class="track"><img class="cover album-cover" src="' + esc(track.image || "") + '" alt="" onerror="this.style.display=\\'none\\'"><div class="track-info"><h4>' + esc(track.title) + '</h4><p>' + esc(track.artist) + '</p><span class="lang">' + esc(track.provider || "Independent") + (track.license ? ' · <a href="' + esc(track.license) + '" target="_blank" rel="noopener">license</a>' : "") + '</span></div><button class="play" data-play="' + esc(track.id) + '" aria-label="Play ' + esc(track.title) + '">▶</button><button class="like-button" data-like="' + esc(track.id) + '" aria-label="Like ' + esc(track.title) + '">♡</button><button class="add-button" data-add="' + esc(track.id) + '" aria-label="Add to playlist">＋</button></article>';
  }
  function renderTracks() {
    const list = $("tracks");
    list.innerHTML = state.tracks.length ? state.tracks.map(trackCard).join("") : '<div class="empty-state">No tracks loaded yet. Check backend configuration or try another search.</div>';
    list.querySelectorAll("[data-play]").forEach((button) => button.addEventListener("click", () => playTrack(button.dataset.play)));
    list.querySelectorAll("[data-like]").forEach((button) => button.addEventListener("click", () => likeTrack(button.dataset.like)));
    list.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => addTrackToPlaylist(button.dataset.add)));
  }
  async function loadTracks(search = "") {
    $("catalogMessage").textContent = "Loading independent music…";
    $("tracks").innerHTML = '<div class="empty-state">Finding tracks for your ' + esc(state.mood.toLowerCase()) + ' mood…</div>';
    try {
      let q = search.trim();
      if (!q && state.filter !== "all") q = ({ hindi: "Indian instrumental", bhojpuri: "Indian folk", english: "indie pop" })[state.filter];
      const params = new URLSearchParams({ mood: state.mood, limit: "24" });
      if (q) params.set("search", q);
      const data = await api("/api/tracks?" + params.toString());
      state.tracks = data.tracks || [];
      $("catalogMessage").textContent = state.tracks.length ? state.tracks.length + " tracks from " + (data.provider || "music provider") + ". Playback is streamed from the provider." : "No playable tracks returned. Try a different search.";
      renderTracks();
    } catch (error) {
      state.tracks = []; renderTracks();
      $("catalogMessage").textContent = error.message;
    }
  }
  function playTrack(id) {
    const track = state.tracks.find((item) => String(item.id) === String(id));
    if (!track || !track.audio) return toast("This provider did not return an audio stream for that track.");
    state.current = track;
    $("playerTitle").textContent = track.title;
    $("playerArtist").textContent = track.artist + " · " + (track.provider || "Music provider");
    $("playerCover").innerHTML = track.image ? '<img class="player-art" src="' + esc(track.image) + '" alt="">' : "♪";
    $("audioPlayer").src = track.audio;
    $("playerBar").classList.add("visible");
    $("audioPlayer").play().then(() => {}).catch(() => toast("Press play in the player to start streaming."));
    $("playerLike").textContent = "♡";
  }
  async function requireUser() {
    if (!db) { toast("Set Supabase URL and anon key in config.js first."); $("authDialog").showModal(); return false; }
    if (!state.user) { $("authDialog").showModal(); return false; }
    return true;
  }
  async function likeTrack(id) {
    if (!(await requireUser())) return;
    const track = state.tracks.find((item) => String(item.id) === String(id));
    if (!track) return;
    const { error } = await db.from("liked_tracks").upsert({
      user_id: state.user.id, provider_track_id: String(track.id), title: track.title, artist: track.artist,
      audio_url: track.audio, image_url: track.image || null, provider: track.provider || "Jamendo", license_url: track.license || null
    }, { onConflict: "user_id,provider_track_id" });
    if (error) return toast(error.message);
    toast("Added to your liked tracks ♡"); loadLibrary();
  }
  async function loadLibrary() {
    if (!db || !state.user) {
      $("likedTracks").innerHTML = '<p class="hint">Sign in to sync your liked tracks.</p>';
      $("userPlaylists").innerHTML = '<p class="hint">Sign in to create and save playlists.</p>';
      return;
    }
    const [likes, lists] = await Promise.all([
      db.from("liked_tracks").select("*").eq("user_id", state.user.id).order("created_at", { ascending: false }).limit(50),
      db.from("playlists").select("*").eq("user_id", state.user.id).order("created_at", { ascending: false })
    ]);
    $("likedTracks").innerHTML = likes.error ? '<p class="hint">' + esc(likes.error.message) + '</p>' : (likes.data || []).length ? likes.data.map((t) => '<div class="saved-row"><div><strong>' + esc(t.title) + '</strong><p>' + esc(t.artist) + '</p></div><button class="play" data-saved-audio="' + esc(t.audio_url) + '" data-title="' + esc(t.title) + '" data-artist="' + esc(t.artist) + '">▶</button></div>').join("") : '<p class="hint">Your liked tracks will show up here.</p>';
    $("userPlaylists").innerHTML = lists.error ? '<p class="hint">' + esc(lists.error.message) + '</p>' : (lists.data || []).length ? lists.data.map((p) => '<div class="saved-row"><div><strong>' + esc(p.name) + '</strong><p>' + esc(p.mood) + ' mood</p></div><button class="secondary" data-open-playlist="' + esc(p.id) + '">Open</button></div>').join("") : '<p class="hint">Create your first playlist.</p>';
    document.querySelectorAll("[data-saved-audio]").forEach((b) => b.addEventListener("click", () => {
      state.current = { title: b.dataset.title, artist: b.dataset.artist, audio: b.dataset.savedAudio };
      $("playerTitle").textContent = state.current.title; $("playerArtist").textContent = state.current.artist;
      $("audioPlayer").src = state.current.audio; $("playerBar").classList.add("visible");
      $("audioPlayer").play().catch(() => toast("Press play to start playback."));
    }));
    document.querySelectorAll("[data-open-playlist]").forEach((b) => b.addEventListener("click", () => openPlaylist(b.dataset.openPlaylist)));
  }
  async function openPlaylist(id) {
    const { data, error } = await db.from("playlist_tracks").select("*").eq("user_id", state.user.id).eq("playlist_id", id).order("created_at", { ascending: false });
    if (error) return toast(error.message);
    state.tracks = (data || []).map((t) => ({ id: t.provider_track_id, title: t.title, artist: t.artist, audio: t.audio_url, image: t.image_url, provider: t.provider, license: t.license_url }));
    state.playlistId = id; renderTracks(); $("discover").scrollIntoView({ behavior: "smooth" });
    $("catalogMessage").textContent = "Playlist loaded · " + state.tracks.length + " tracks";
  }
  async function addTrackToPlaylist(id) {
    if (!(await requireUser())) return;
    const track = state.tracks.find((item) => String(item.id) === String(id));
    if (!track) return;
    const { data: playlists, error: listError } = await db.from("playlists").select("id,name").eq("user_id", state.user.id).order("created_at", { ascending: false });
    if (listError) return toast(listError.message);
    if (!playlists?.length) { toast("Create a playlist first."); return; }
    const selection = prompt("Add to which playlist?\n" + playlists.map((p, i) => (i + 1) + ". " + p.name).join("\n") + "\n\nEnter a number:");
    const index = Number(selection) - 1;
    if (!selection || !Number.isInteger(index) || index < 0 || index >= playlists.length) return;
    const { error } = await db.from("playlist_tracks").upsert({
      playlist_id: playlists[index].id, user_id: state.user.id, provider_track_id: String(track.id),
      title: track.title, artist: track.artist, audio_url: track.audio, image_url: track.image || null,
      provider: track.provider || "Jamendo", license_url: track.license || null
    }, { onConflict: "playlist_id,provider_track_id" });
    if (error) return toast(error.message);
    toast("Added to " + playlists[index].name); loadLibrary();
  }
  async function createPlaylist() {
    if (!(await requireUser())) return;
    const name = prompt("Name your playlist:");
    if (!name || !name.trim()) return;
    const { error } = await db.from("playlists").insert({ user_id: state.user.id, name: name.trim().slice(0, 80), mood: state.mood });
    if (error) return toast(error.message);
    toast("Playlist created. Use ＋ on any track to add it."); loadLibrary();
  }
  async function authSubmit(event) {
    event.preventDefault();
    if (!db) return $("authMessage").textContent = "Add SUPABASE_URL and SUPABASE_ANON_KEY to config.js first.";
    const email = $("authEmail").value.trim(), password = $("authPassword").value;
    $("authSubmit").disabled = true; $("authMessage").textContent = "Please wait…";
    try {
      let result;
      if (state.authMode === "signup") {
        result = await db.auth.signUp({ email, password, options: { data: { display_name: $("displayName").value.trim() } } });
        if (!result.error && !result.data.session) $("authMessage").textContent = "Check your email to confirm your account, then sign in.";
      } else result = await db.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) { $("authDialog").close(); toast("You're signed in."); }
    } catch (error) { $("authMessage").textContent = error.message || "Authentication failed."; }
    finally { $("authSubmit").disabled = false; refreshAuth(); }
  }
  async function refreshAuth() {
    if (!db) { $("accountButton").textContent = "Set up account"; return; }
    const { data } = await db.auth.getSession();
    state.user = data.session?.user || null;
    $("accountButton").textContent = state.user ? "Sign out" : "Sign in";
    setStatus("API + auth configured", true);
    await loadLibrary();
  }
  function toggleAuthMode() {
    state.authMode = state.authMode === "signin" ? "signup" : "signin";
    $("authTitle").textContent = state.authMode === "signin" ? "Welcome to MoodTune" : "Create your account";
    $("authSubmit").textContent = state.authMode === "signin" ? "Sign in" : "Create account";
    $("toggleAuthMode").textContent = state.authMode === "signin" ? "New here? Create account" : "Already have an account? Sign in";
    $("displayNameLabel").hidden = state.authMode !== "signup"; $("displayName").hidden = state.authMode !== "signup";
    $("authPassword").autocomplete = state.authMode === "signin" ? "current-password" : "new-password";
    $("authMessage").textContent = "";
  }
  async function init() {
    document.querySelectorAll("[data-mood]").forEach((button) => button.addEventListener("click", () => setMood(button.dataset.mood)));
    $("textAnalyze").addEventListener("click", async () => {
      const text = $("textInput").value.trim();
      if (text.length < 2) return toast("Write a sentence about how you're feeling.");
      $("textAnalyze").disabled = true; $("textAnalyze").textContent = "Analyzing with AI…";
      try {
        const result = await api("/api/analyze-text", { method: "POST", body: JSON.stringify({ text }) });
        setMood(result.mood, result.confidence, "AI model: " + result.emotion);
        $("modelStatus").textContent = "Model: " + result.model + " · " + result.method;
        toast("Mood analysis complete.");
      } catch (error) { toast(error.message); $("modelStatus").textContent = "AI backend not connected"; }
      finally { $("textAnalyze").disabled = false; $("textAnalyze").textContent = "Analyze with AI ✦"; }
    });
    $("searchButton").addEventListener("click", () => loadTracks($("musicSearch").value));
    $("musicSearch").addEventListener("keydown", (event) => { if (event.key === "Enter") loadTracks($("musicSearch").value); });
    $("refreshButton").addEventListener("click", () => loadTracks());
    document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b === button));
      const query = ({ all: "", hindi: "Indian music", bhojpuri: "Bhojpuri folk", english: "English indie" })[state.filter];
      $("musicSearch").value = query; loadTracks(query);
    }));
    $("cameraBtn").addEventListener("click", async () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop()); cameraStream = null; $("video").srcObject = null;
        document.querySelector(".camera").classList.remove("active"); $("cameraPlaceholder").style.display = "flex"; $("cameraBtn").textContent = "Enable camera"; return;
      }
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        $("video").srcObject = cameraStream; document.querySelector(".camera").classList.add("active");
        $("cameraPlaceholder").style.display = "none"; $("cameraBtn").textContent = "Disable camera";
      } catch { toast("Camera permission was denied or the camera is unavailable."); }
    });
    $("accountButton").addEventListener("click", async () => {
      if (state.user && db) { await db.auth.signOut(); state.user = null; await loadLibrary(); $("accountButton").textContent = "Sign in"; toast("Signed out."); }
      else { $("authMessage").textContent = db ? "" : "Add Supabase URL and anon key to config.js first."; $("authDialog").showModal(); }
    });
    $("closeAuth").addEventListener("click", () => $("authDialog").close());
    $("authForm").addEventListener("submit", authSubmit);
    $("toggleAuthMode").addEventListener("click", toggleAuthMode);
    $("createPlaylist").addEventListener("click", createPlaylist);
    $("playerLike").addEventListener("click", () => state.current && likeTrack(state.current.id));
    window.addEventListener("beforeunload", () => cameraStream?.getTracks().forEach((track) => track.stop()));
    if (db) { await refreshAuth(); db.auth.onAuthStateChange(() => setTimeout(refreshAuth, 0)); }
    else setStatus("SETUP REQUIRED");
    try {
      const health = await api("/health");
      $("modelStatus").textContent = "AI model configured · " + health.emotion_model;
      setStatus("API connected", true);
    } catch (error) { $("modelStatus").textContent = "Backend needs deployment/configuration"; }
    await loadTracks();
  }
  document.addEventListener("DOMContentLoaded", init);
})();