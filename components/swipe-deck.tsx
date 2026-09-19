"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { backdropUrl, posterUrl } from "@/lib/poster";
import type { TitleCard } from "@/lib/types";

type Item =
  | { kind: "title"; card: TitleCard }
  | { kind: "vibe"; id: string; name: string; description: string; backdropPath?: string | null };

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
  const draggingRef = useRef(false);
  const indexRef = useRef(0);
  const itemsRef = useRef(items);
  const emptiedRef = useRef(false);
  const callbacksRef = useRef({ onLike, onDislike, onEmpty });

  itemsRef.current = items;
  callbacksRef.current = { onLike, onDislike, onEmpty };
  indexRef.current = index;

  function emptyOnce() {
    if (emptiedRef.current) return;
    emptiedRef.current = true;
    callbacksRef.current.onEmpty();
  }

  function commit(dir: "like" | "dislike") {
    const current = itemsRef.current[indexRef.current];
    draggingRef.current = false;
    setDragging(false);
    setDx(0);
    if (!current) {
      emptyOnce();
      return;
    }
    try {
      if (dir === "like") callbacksRef.current.onLike(current);
      else callbacksRef.current.onDislike(current);
    } catch {
      // Keep the deck moving even if taste persistence throws.
    }
    const next = indexRef.current + 1;
    indexRef.current = next;
    setIndex(next);
    if (next >= itemsRef.current.length) emptyOnce();
  }

  useEffect(() => {
    if (items.length === 0 || index >= items.length) emptyOnce();
  }, [index, items.length]);

  useEffect(() => {
    function move(event: PointerEvent) {
      if (!draggingRef.current) return;
      setDx(event.clientX - startX.current);
    }
    function up(event: PointerEvent) {
      if (!draggingRef.current) return;
      const currentDx = event.clientX - startX.current;
      if (currentDx > 72) commit("like");
      else if (currentDx < -72) commit("dislike");
      else {
        draggingRef.current = false;
        setDragging(false);
        setDx(0);
      }
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    startX.current = event.clientX;
    draggingRef.current = true;
    setDragging(true);
  }

  const current = items[index];
  if (!current) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-muted-foreground">
        {items.length ? "Deck complete" : "Loading titles…"}
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
      <div className="relative h-[min(58dvh,480px)] w-full max-w-[320px] overflow-visible">
        {items.slice(index, index + 3).map((item, i) => {
          const isTop = i === 0;
          return (
            <article
              key={item.kind === "title" ? `${item.card.mediaType}-${item.card.tmdbId}` : item.id}
              data-testid={isTop ? "swipe-card" : undefined}
              className={cn(
                "absolute inset-0 touch-none overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl select-none",
                !isTop && "pointer-events-none"
              )}
              style={
                isTop
                  ? {
                      transform: `translateX(${dx}px) rotate(${rotate}deg)`,
                      transition: dragging ? "none" : "transform 180ms ease",
                      zIndex: 10 - i,
                      touchAction: "none",
                    }
                  : {
                      transform: `scale(${1 - i * 0.04}) translateY(${i * 10}px)`,
                      zIndex: 10 - i,
                    }
              }
              onPointerDown={isTop ? onPointerDown : undefined}
            >
              {item.kind === "title" ? (
                <TitleFace card={item.card} />
              ) : (
                <VibeFace
                  name={item.name}
                  description={item.description}
                  backdropPath={item.backdropPath}
                />
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
      <p className="text-xs text-muted-foreground">Swipe right to like · left to dislike</p>
    </div>
  );
}

function TitleFace({ card }: { card: TitleCard }) {
  const src = posterUrl(card.posterPath, "w500");
  const [broken, setBroken] = useState(false);
  const name = card.name || "Untitled";
  const genres = Array.isArray(card.genres) ? card.genres : [];
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
          <p className="text-6xl font-semibold text-white/90">{name.slice(0, 1)}</p>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 pt-24">
        <h3 className="text-lg font-semibold text-white">
          {name}
          {card.year ? <span className="text-white/60"> · {card.year}</span> : null}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-white/70">
          {genres.slice(0, 3).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function VibeFace({
  name,
  description,
  backdropPath,
}: {
  name: string;
  description: string;
  backdropPath?: string | null;
}) {
  const src = backdropUrl(backdropPath);
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative flex h-full flex-col justify-end bg-[radial-gradient(circle_at_30%_20%,#7c3aed,transparent_40%),radial-gradient(circle_at_80%_80%,#4c1d95,transparent_45%),#12061f]">
      {!broken && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          onError={() => setBroken(true)}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[#12061f] via-[#12061f]/75 to-black/20" />
      <div className="relative p-6">
        <p className="text-xs tracking-[0.3em] text-violet-200/80 uppercase">Vibe</p>
        <h3 className="mt-3 text-4xl font-semibold text-white">{name}</h3>
        <p className="mt-3 text-sm text-violet-100/85">{description}</p>
      </div>
    </div>
  );
}
