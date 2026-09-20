"use client";

import { useState } from "react";
import { posterUrl } from "@/lib/poster";
import { cn } from "@/lib/utils";
import type { SuggestedTitle } from "@/lib/types";
import { TitleActions } from "@/components/title-actions";
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
        <div className="@container h-full min-h-0 w-full">
          <div className="grid h-full min-h-0 w-full grid-cols-1 grid-rows-3 gap-1.5 overflow-hidden @4xl:grid-cols-3 @4xl:grid-rows-1 @4xl:place-items-center @4xl:gap-3">
            {titles.map((title) => (
              <PosterTile
                key={`${title.mediaType}-${title.tmdbId}`}
                title={title}
                layout="rail"
                onOpen={setOpen}
              />
            ))}
          </div>
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
    <article
      className={cn(
        "animate-in slide-in-from-bottom-4 fade-in-0 group overflow-hidden border border-white/10 bg-card text-left shadow-lg duration-300",
        layout === "rail"
          ? "relative flex h-full min-h-0 w-full items-stretch rounded-lg @4xl:mx-auto @4xl:block @4xl:h-auto @4xl:w-full @4xl:max-h-full @4xl:aspect-[2/3]"
          : "rounded-2xl"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(title)}
        className={cn(
          "bg-violet-950",
          layout === "rail"
            ? "h-full w-auto max-w-[46%] shrink-0 aspect-[2/3] @4xl:absolute @4xl:inset-0 @4xl:h-auto @4xl:w-auto @4xl:max-w-none @4xl:aspect-auto"
            : "block w-full aspect-[2/3]"
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
      </button>
      {layout === "rail" ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-2 @4xl:absolute @4xl:inset-x-0 @4xl:bottom-0 @4xl:flex-none @4xl:bg-gradient-to-t @4xl:from-black/85 @4xl:via-black/45 @4xl:to-transparent @4xl:px-2 @4xl:pt-8 @4xl:pb-2">
          <button type="button" className="text-left" onClick={() => onOpen(title)}>
            <p className="line-clamp-2 text-base font-semibold leading-snug @4xl:line-clamp-1 @4xl:text-xs @4xl:font-medium @4xl:leading-tight">
              {title.name}
              {title.year ? (
                <span className="font-medium text-muted-foreground @4xl:font-medium @4xl:text-white/60">
                  {" "}
                  ({title.year})
                </span>
              ) : null}
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-violet-100/85 @4xl:mt-0.5 @4xl:line-clamp-1 @4xl:text-[10px]">
              {title.reason}
            </p>
          </button>
          <TitleActions title={title} layout="rail" />
        </div>
      ) : (
        <div className="space-y-1 p-3">
          <button type="button" className="w-full text-left" onClick={() => onOpen(title)}>
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
          </button>
          <TitleActions title={title} layout="cards" />
        </div>
      )}
    </article>
  );
}
