"use client";

import { useState } from "react";
import { posterUrl } from "@/lib/poster";
import type { SuggestedTitle } from "@/lib/types";
import { TitleDetail } from "@/components/title-detail";

export function PosterTiles({ titles }: { titles: SuggestedTitle[] }) {
  const [open, setOpen] = useState<SuggestedTitle | null>(null);

  if (!titles.length) return null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {titles.map((title) => {
          const src = posterUrl(title.posterPath, "w342");
          return (
            <button
              key={`${title.mediaType}-${title.tmdbId}`}
              type="button"
              onClick={() => setOpen(title)}
              className="animate-in slide-in-from-bottom-4 fade-in-0 group overflow-hidden rounded-2xl border border-white/10 bg-card text-left shadow-lg duration-300"
            >
              <div className="aspect-[2/3] bg-violet-950">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    onError={(e) => {
                      e.currentTarget.style.opacity = "0";
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">
                    {title.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="font-medium leading-tight">
                  {title.name}
                  {title.year ? (
                    <span className="text-muted-foreground"> ({title.year})</span>
                  ) : null}
                </p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {title.genres.slice(0, 3).join(" · ")}
                </p>
                <p className="line-clamp-2 text-xs text-violet-200/80">{title.reason}</p>
              </div>
            </button>
          );
        })}
      </div>
      <TitleDetail title={open} onClose={() => setOpen(null)} />
    </>
  );
}
