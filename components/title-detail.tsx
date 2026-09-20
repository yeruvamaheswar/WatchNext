"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { badgeVariants } from "@/components/ui/badge";
import { posterUrl } from "@/lib/poster";
import { cn } from "@/lib/utils";
import type { SuggestedTitle } from "@/lib/types";

export function TitleDetail({
  title,
  onClose,
}: {
  title: SuggestedTitle | null;
  onClose: () => void;
}) {
  const src = posterUrl(title?.posterPath, "w342");
  return (
    <Dialog open={Boolean(title)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden border-white/10 bg-[#160a24] p-0">
        {title ? (
          <>
            <div className="flex gap-4 p-4">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="h-40 w-28 rounded-xl object-cover"
                />
              ) : null}
              <DialogHeader className="text-left">
                <DialogTitle className="text-xl">
                  {title.name}
                  {title.year ? (
                    <span className="text-muted-foreground"> ({title.year})</span>
                  ) : null}
                </DialogTitle>
                <DialogDescription>
                  {title.mediaType === "movie" ? "Movie" : "TV"}
                  {title.voteAverage
                    ? ` · TMDB ${title.voteAverage.toFixed(1)}`
                    : ""}
                </DialogDescription>
                <div className="flex flex-wrap gap-1 pt-1">
                  {title.genres.slice(0, 4).map((g) => (
                    <span
                      key={g}
                      className={cn(badgeVariants({ variant: "secondary" }), "text-[10px]")}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </DialogHeader>
            </div>
            <div className="space-y-3 px-4 pb-5 text-sm">
              {title.reason ? (
                <p className="text-violet-200">{title.reason}</p>
              ) : null}
              {title.directors?.length ? (
                <p className="text-violet-100/80">
                  Directed by {title.directors.join(", ")}
                </p>
              ) : null}
              {title.creators?.length ? (
                <p className="text-violet-100/80">
                  Created by {title.creators.join(", ")}
                </p>
              ) : null}
              {title.topCast?.length ? (
                <p className="text-muted-foreground">
                  {title.topCast.join(" · ")}
                </p>
              ) : null}
              <p className="text-muted-foreground">{title.overview}</p>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
