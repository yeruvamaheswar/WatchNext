"use client";

import { useState } from "react";
import { posterUrl } from "@/lib/poster";
import { cn } from "@/lib/utils";
import type { SuggestedTitle } from "@/lib/types";
import { TitleDetail } from "@/components/title-detail";

export function PosterTiles({
  titles,
  layout = "cards",
}: {
  titles: SuggestedTitle[];
  layout?: "cards" | "rail";
}) {
  const [open, setOpen] = useState<SuggestedTitle | null>(null);

  if (!titles.length) return null;

  return (
    <>
      {layout === "rail" ? (
        <div className="grid h-full min-h-0 w-full grid-cols-3 gap-2 md:gap-3">
          {titles.map((title) => (
            <PosterTile
              key={`${title.mediaType}-${title.tmdbId}`}
              title={title}
              layout="rail"
              onOpen={setOpen}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {titles.map((title) => (
            <PosterTile
              key={`${title.mediaType}-${title.tmdbId}`}
              title={title}
              layout="cards"
              onOpen={setOpen}
            />
          ))}
        </div>
      )}
      <TitleDetail title={open} onClose={() => setOpen(null)} />
    </>
  );
}

function PosterTile({
  title,
  layout,
  onOpen,
}: {
  title: SuggestedTitle;
  layout: "cards" | "rail";
  onOpen: (title: SuggestedTitle) => void;
}) {
  const src = posterUrl(title.posterPath, "w342");

  return (
    <button
      type="button"
      onClick={() => onOpen(title)}
      className={cn(
        "animate-in slide-in-from-bottom-4 fade-in-0 group overflow-hidden border border-white/10 bg-card text-left shadow-lg duration-300",
        layout === "rail"
          ? "relative mx-auto h-full max-h-full w-auto max-w-full aspect-[2/3] rounded-lg"
          : "rounded-2xl"
      )}
    >
      <div
        className={cn(
          "bg-violet-950",
          layout === "rail" ? "absolute inset-0" : "aspect-[2/3]"
        )}
      >
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
      {layout === "rail" ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 pt-8 pb-2">
          <p className="line-clamp-1 text-xs font-medium leading-tight">
            {title.name}
            {title.year ? (
              <span className="text-white/60"> ({title.year})</span>
            ) : null}
          </p>
          <p className="line-clamp-1 text-[10px] text-violet-100/80">
            {title.reason}
          </p>
        </div>
      ) : (
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
      )}
    </button>
  );
}
