"use client";

import { useRef, useState } from "react";
import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { posterUrl } from "@/lib/poster";
import type { TitleCard } from "@/lib/types";

type Item =
  | { kind: "title"; card: TitleCard }
  | { kind: "vibe"; id: string; name: string; description: string };

export function SwipeDeck({
  items,
  onLike,
  onDislike,
  onEmpty,
}: {
  items: Item[];
  onLike: (item: Item) => void;
  onDislike: (item: Item) => void;
  onEmpty: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const current = items[index];
  const done = index >= items.length;

  function finish(dir: "like" | "dislike") {
    if (!current) {
      onEmpty();
      return;
    }
    if (dir === "like") onLike(current);
    else onDislike(current);
    setDx(0);
    setDragging(false);
    const next = index + 1;
    setIndex(next);
    if (next >= items.length) onEmpty();
  }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDx(e.clientX - startX.current);
  }
  function onPointerUp(e: React.PointerEvent) {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    if (!dragging) return;
    if (dx > 90) finish("like");
    else if (dx < -90) finish("dislike");
    else {
      setDx(0);
      setDragging(false);
    }
  }

  if (done || !current) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-muted-foreground">
        Deck complete
      </div>
    );
  }

  const rotate = Math.max(-18, Math.min(18, dx / 12));
  const likeOpacity = Math.max(0, Math.min(1, dx / 120));
  const nopeOpacity = Math.max(0, Math.min(1, -dx / 120));

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
        {index + 1} / {items.length}
      </p>
      <div className="relative h-[min(42dvh,320px)] w-full max-w-[280px] overflow-hidden">
        {items.slice(index, index + 3).map((item, i) => {
          const isTop = i === 0;
          return (
            <article
              key={item.kind === "title" ? `${item.card.mediaType}-${item.card.tmdbId}` : item.id}
              className={cn(
                "absolute inset-0 touch-none overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl",
                !isTop && "pointer-events-none"
              )}
              style={
                isTop
                  ? {
                      transform: `translateX(${dx}px) rotate(${rotate}deg)`,
                      transition: dragging ? "none" : "transform 180ms ease",
                      zIndex: 10 - i,
                    }
                  : {
                      transform: `scale(${1 - i * 0.04}) translateY(${i * 10}px)`,
                      zIndex: 10 - i,
                    }
              }
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerUp : undefined}
            >
              {item.kind === "title" ? (
                <TitleFace card={item.card} />
              ) : (
                <VibeFace name={item.name} description={item.description} />
              )}
              {isTop && (
                <>
                  <span
                    className="absolute top-6 left-5 rounded-md border-2 border-emerald-400 px-3 py-1 text-sm font-bold tracking-widest text-emerald-300"
                    style={{ opacity: likeOpacity }}
                  >
                    LIKE
                  </span>
                  <span
                    className="absolute top-6 right-5 rounded-md border-2 border-rose-400 px-3 py-1 text-sm font-bold tracking-widest text-rose-300"
                    style={{ opacity: nopeOpacity }}
                  >
                    NOPE
                  </span>
                </>
              )}
            </article>
          );
        })}
      </div>
      <div className="flex items-center gap-6">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-14 rounded-full border-rose-400/40 text-rose-300"
          onClick={() => finish("dislike")}
          aria-label="Dislike, swipe left"
        >
          <X className="size-6" />
        </Button>
        <Button
          type="button"
          size="icon-lg"
          className="size-14 rounded-full bg-violet-500 text-white hover:bg-violet-400"
          onClick={() => finish("like")}
          aria-label="Like, swipe right"
        >
          <Heart className="size-6 fill-current" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Right = like · Left = dislike</p>
    </div>
  );
}

function TitleFace({ card }: { card: TitleCard }) {
  const src = posterUrl(card.posterPath, "w500");
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative h-full bg-[radial-gradient(circle_at_30%_20%,#7c3aed,transparent_40%),#1a0b2e]">
      {!broken && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex h-full flex-col justify-center px-5">
          <p className="text-6xl font-semibold text-white/90">{card.name.slice(0, 1)}</p>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 pt-24">
        <h3 className="text-lg font-semibold text-white">
          {card.name}
          {card.year ? <span className="text-white/60"> · {card.year}</span> : null}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-white/70">
          {card.genres.slice(0, 3).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function VibeFace({ name, description }: { name: string; description: string }) {
  return (
    <div className="flex h-full flex-col justify-end bg-[radial-gradient(circle_at_30%_20%,#7c3aed,transparent_40%),radial-gradient(circle_at_80%_80%,#4c1d95,transparent_45%),#12061f] p-6">
      <p className="text-xs tracking-[0.3em] text-violet-200/70 uppercase">Vibe</p>
      <h3 className="mt-3 text-4xl font-semibold text-white">{name}</h3>
      <p className="mt-3 text-sm text-violet-100/80">{description}</p>
    </div>
  );
}
