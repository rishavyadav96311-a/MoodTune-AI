import os
from functools import lru_cache
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_ENV = os.getenv("APP_ENV", "production")
JAMENDO_CLIENT_ID = os.getenv("JAMENDO_CLIENT_ID", "")
HF_MODEL = os.getenv("HF_EMOTION_MODEL", "j-hartmann/emotion-english-distilroberta-base")
ALLOWED_ORIGINS = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "*").split(",") if x.strip()]

app = FastAPI(title="MoodTune AI API", version="1.0.0", description="Music discovery and ML-based text emotion analysis.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in ALLOWED_ORIGINS else ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

class TextRequest(BaseModel):
    text: str = Field(min_length=2, max_length=2000)

@lru_cache(maxsize=1)
def emotion_pipeline():
    try:
        from transformers import pipeline
        return pipeline("text-classification", model=HF_MODEL, top_k=None)
    except Exception as exc:
        raise RuntimeError(f"Could not load emotion model {HF_MODEL}: {exc}") from exc

MOOD_MAP = {
    "joy": "Happy", "happiness": "Happy", "happy": "Happy",
    "sadness": "Sad", "sad": "Sad",
    "anger": "Energetic", "fear": "Stressed", "disgust": "Stressed",
    "surprise": "Energetic", "love": "Romantic", "neutral": "Calm",
}

@app.get("/")
def root():
    return {"name": "MoodTune AI API", "status": "ok", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok", "music_provider_configured": bool(JAMENDO_CLIENT_ID), "emotion_model": HF_MODEL}

@app.post("/api/analyze-text")
def analyze_text(payload: TextRequest):
    text = payload.text.strip()
    if len(text) < 2:
        raise HTTPException(status_code=422, detail="Please enter a little more text.")
    try:
        results = emotion_pipeline()(text[:2000])
        # transformers returns a list of label/score objects for top_k=None.
        scores = results[0] if results and isinstance(results[0], list) else results
        ranked = sorted(scores, key=lambda item: float(item.get("score", 0)), reverse=True)
        top = ranked[0]
        label = str(top.get("label", "neutral")).lower()
        mood = MOOD_MAP.get(label, "Calm")
        return {
            "mood": mood,
            "emotion": label,
            "confidence": round(float(top.get("score", 0)), 4),
            "model": HF_MODEL,
            "method": "transformer-model",
            "scores": [{"label": str(x.get("label", "")), "score": round(float(x.get("score", 0)), 4)} for x in ranked[:6]],
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Emotion analysis failed: {exc}")

MOOD_TAGS = {
    "Happy": "happy upbeat acoustic",
    "Calm": "ambient chill acoustic",
    "Sad": "sad piano melancholic",
    "Energetic": "rock upbeat electronic",
    "Stressed": "relaxing ambient meditation",
    "Romantic": "love romantic acoustic",
}

@app.get("/api/tracks")
async def tracks(
    mood: str = Query(default="Calm"),
    search: Optional[str] = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
):
    if not JAMENDO_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Music catalog is not configured yet. Add JAMENDO_CLIENT_ID to the backend environment.",
        )
    mood_key = next((key for key in MOOD_TAGS if key.lower() == mood.lower()), "Calm")
    params = {
        "client_id": JAMENDO_CLIENT_ID,
        "format": "json",
        "limit": limit,
        "include": "musicinfo",
        "audioformat": "mp32",
        "imagesize": "300",
        "order": "popularity_total",
    }
    params["search"] = search.strip() if search and search.strip() else MOOD_TAGS[mood_key]
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get("https://api.jamendo.com/v3.0/tracks/", params=params)
            response.raise_for_status()
            payload = response.json()
        results = payload.get("results", [])
        clean = []
        for track in results:
            audio = track.get("audio")
            if not audio:
                continue
            clean.append({
                "id": str(track.get("id", "")),
                "title": track.get("name", "Untitled"),
                "artist": track.get("artist_name", "Unknown artist"),
                "album": track.get("album_name", ""),
                "image": track.get("image", ""),
                "audio": audio,
                "duration": track.get("duration", 0),
                "license": track.get("license_ccurl", ""),
                "provider": "Jamendo",
                "providerUrl": track.get("shareurl", ""),
            })
        return {"tracks": clean, "provider": "Jamendo", "count": len(clean)}
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Music provider request failed: {exc}")
