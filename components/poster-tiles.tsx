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
        <div className="grid h-full min-h-0 w-full grid-cols-1 grid-rows-3 gap-1.5 overflow-hidden md:grid-cols-3 md:grid-rows-none md:gap-3">
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
          ? "relative flex h-full min-h-0 w-full items-stretch rounded-lg md:mx-auto md:block md:max-h-full md:w-auto md:max-w-full md:aspect-[2/3]"
          : "rounded-2xl"
      )}
    >
      <div
        className={cn(
          "bg-violet-950",
          layout === "rail"
            ? "h-full w-auto max-w-[46%] shrink-0 aspect-[2/3] md:absolute md:inset-0 md:h-auto md:w-auto md:max-w-none"
            : "aspect-[2/3]"
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
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-2 md:absolute md:inset-x-0 md:bottom-0 md:flex-none md:bg-gradient-to-t md:from-black/85 md:via-black/45 md:to-transparent md:px-2 md:pt-8 md:pb-2">
          <p className="line-clamp-2 text-base font-semibold leading-snug md:line-clamp-1 md:text-xs md:font-medium md:leading-tight">
            {title.name}
            {title.year ? (
              <span className="font-medium text-muted-foreground md:font-medium md:text-white/60">
                {" "}
                ({title.year})
              </span>
            ) : null}
          </p>
          <p className="mt-1 line-clamp-3 text-sm leading-snug text-violet-100/85 md:mt-0.5 md:line-clamp-1 md:text-[10px]">
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
