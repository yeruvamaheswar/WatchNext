"use client";

import { useState, useTransition } from "react";
import { getRecommendations } from "@/app/actions";
import type { RankedRecommendation } from "@/lib/types";

type Props = {
  moods: string[];
  genres: string[];
};

export function RecommendForm({ moods, genres }: Props) {
  const [mood, setMood] = useState("");
  const [genre, setGenre] = useState("");
  const [favorites, setFavorites] = useState("");
  const [results, setResults] = useState<RankedRecommendation[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [source, setSource] = useState<"catalog" | "tmdb" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await getRecommendations({
          mood: mood || null,
          genre: genre || null,
          favoritesText: favorites || null,
        });
        setResults(result.recommendations);
        setMessage(result.message ?? null);
        setSource(result.source);
      } catch {
        setResults([]);
        setMessage(null);
        setSource(null);
        setError("Something went sideways. Refresh and try again.");
      }
    });
  }

  return (
    <div className="recommend-panel">
      <form onSubmit={onSubmit} className="recommend-form">
        <div className="field-row">
          <label className="field">
            <span className="field-label">Mood</span>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="field-control"
              aria-label="Mood"
            >
              <option value="">Any mood</option>
              {moods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Genre</span>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="field-control"
              aria-label="Genre"
            >
              <option value="">Any genre</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field-label">Favorites you already love</span>
          <textarea
            value={favorites}
            onChange={(e) => setFavorites(e.target.value)}
            className="field-control field-textarea"
            rows={3}
            placeholder="e.g. Arrival, The Bear, anything with a heist vibe…"
            aria-label="Favorites"
          />
        </label>

        <button type="submit" className="submit-btn" disabled={pending}>
          {pending ? "Lining up picks…" : "What should I watch?"}
        </button>
      </form>

      <div className="results" aria-live="polite">
        {error && <p className="status status-error">{error}</p>}
        {!error && message && results !== null && (
          <p className="status">{message}</p>
        )}
        {results && results.length > 0 && (
          <ul className="result-list">
            {results.map((row, index) => (
              <li key={row.item.id} className="result-card" style={{ animationDelay: `${index * 80}ms` }}>
                <div className="result-rank">#{index + 1}</div>
                <div className="result-body">
                  <div className="result-title-row">
                    <h2 className="result-title">{row.item.title}</h2>
                    <span className="result-meta">
                      {row.item.year} · {row.item.mediaType === "tv" ? "TV" : "Film"}
                    </span>
                  </div>
                  <p className="result-why">{row.why}</p>
                  <p className="result-overview">{row.item.overview}</p>
                  <div className="result-tags">
                    {row.item.genres.slice(0, 3).map((g) => (
                      <span key={g} className="tag">
                        {g}
                      </span>
                    ))}
                    {row.item.moods.slice(0, 2).map((m) => (
                      <span key={m} className="tag tag-mood">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {source && results && results.length > 0 && (
          <p className="source-line">
            Sourced from {source === "catalog" ? "local WatchNext shelf" : "TMDB"}
          </p>
        )}
      </div>
    </div>
  );
}
