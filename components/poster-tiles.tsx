"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { posterUrl } from "@/lib/poster";
import { cn } from "@/lib/utils";
import type { SuggestedTitle } from "@/lib/types";
import { TitleActions } from "@/components/title-actions";
import { TitleDetail } from "@/components/title-detail";
import { useWatchNext } from "@/hooks/use-watchnext";

const SWIPE_THRESHOLD = 72;

export function PosterTiles({
  titles,
  layout = "cards",
  swipeable = false,
}: {
  titles: SuggestedTitle[];
  layout?: "cards" | "rail";
  swipeable?: boolean;
}) {
  const [open, setOpen] = useState<SuggestedTitle | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const titleKey = titles.map((title) => title.id).join("|");

  useEffect(() => {
    setHidden(new Set());
  }, [titleKey]);

  const visible = swipeable
    ? titles.filter((title) => !hidden.has(title.id))
    : titles;

  if (!titles.length) return null;

  function dismiss(title: SuggestedTitle) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(title.id);
      return next;
    });
  }

  return (
    <>
      {!visible.length ? (
        <p className="px-4 py-10 text-center text-sm text-violet-200/60">
          Want another pick? Tap the orb.
        </p>
      ) : layout === "rail" ? (
        <div className="@container h-full min-h-0 w-full">
          <div
            className="grid h-full min-h-0 w-full grid-cols-1 gap-1.5 overflow-hidden @4xl:grid-cols-3 @4xl:grid-rows-1 @4xl:place-items-center @4xl:gap-3"
            style={{ gridTemplateRows: `repeat(${visible.length}, minmax(0, 1fr))` }}
          >
            {visible.map((title) => (
              <PosterTile
                key={`${title.mediaType}-${title.tmdbId}`}
                title={title}
                layout="rail"
                swipeable={swipeable}
                onOpen={setOpen}
                onDismiss={() => dismiss(title)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {visible.map((title) => (
            <PosterTile
              key={`${title.mediaType}-${title.tmdbId}`}
              title={title}
              layout="cards"
              swipeable={swipeable}
              onOpen={setOpen}
              onDismiss={() => dismiss(title)}
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
  swipeable = false,
  onOpen,
  onDismiss,
}: {
  title: SuggestedTitle;
  layout: "cards" | "rail";
  swipeable?: boolean;
  onOpen: (title: SuggestedTitle) => void;
  onDismiss?: () => void;
}) {
  const src = posterUrl(title.posterPath, "w342");
  const { recordVerdict } = useWatchNext();
  const swipe = useCardSwipe({
    enabled: swipeable,
    onLike: () => {
      recordVerdict({
        tmdbId: title.tmdbId,
        mediaType: title.mediaType,
        verdict: "like",
        source: "favorite",
        name: title.name,
      });
      toast.success("Added to liked titles.");
      onDismiss?.();
    },
    onDislike: () => {
      recordVerdict({
        tmdbId: title.tmdbId,
        mediaType: title.mediaType,
        verdict: "dislike",
        source: "favorite",
        name: title.name,
      });
      toast.success("Dismissed.");
      onDismiss?.();
    },
  });

  return (
    <article
      data-testid={swipeable ? "home-swipe-card" : undefined}
      className={cn(
        "animate-in slide-in-from-bottom-4 fade-in-0 group overflow-hidden border border-white/10 bg-card text-left shadow-lg duration-300",
        layout === "rail"
          ? "relative flex h-full min-h-0 w-full items-stretch rounded-lg @4xl:mx-auto @4xl:block @4xl:h-auto @4xl:w-full @4xl:max-h-full @4xl:aspect-[2/3]"
          : "relative w-full rounded-2xl",
        swipe.dragging && "z-10"
      )}
      style={
        swipe.enabled
          ? {
              transform: `translateX(${swipe.dx}px) rotate(${swipe.rotate}deg)`,
              transition: swipe.dragging ? "none" : "transform 180ms ease",
              touchAction: "pan-y",
            }
          : undefined
      }
      onPointerDown={swipe.onPointerDown}
      onPointerMove={swipe.onPointerMove}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
      onClickCapture={swipe.onClickCapture}
    >
      <button
        type="button"
        onClick={() => onOpen(title)}
        className={cn(
          "bg-violet-950",
          layout === "rail"
            ? "h-full w-auto max-w-[46%] shrink-0 aspect-[2/3] @4xl:absolute @4xl:inset-0 @4xl:h-auto @4xl:w-auto @4xl:max-w-none @4xl:aspect-auto"
            : "block w-full aspect-2/3 max-md:aspect-auto max-md:h-64"
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            draggable={false}
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
        <div className="space-y-1 p-2.5 sm:p-3">
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
      {swipe.enabled ? (
        <>
          <span
            className="pointer-events-none absolute top-4 left-4 rounded-md border-2 border-emerald-400 px-2.5 py-0.5 text-xs font-bold tracking-widest text-emerald-300 md:hidden"
            style={{ opacity: swipe.likeOpacity }}
          >
            LIKE
          </span>
          <span
            className="pointer-events-none absolute top-4 right-4 rounded-md border-2 border-rose-400 px-2.5 py-0.5 text-xs font-bold tracking-widest text-rose-300 md:hidden"
            style={{ opacity: swipe.nopeOpacity }}
          >
            NOPE
          </span>
        </>
      ) : null}
    </article>
  );
}

function useCardSwipe({
  enabled,
  onLike,
  onDislike,
}: {
  enabled: boolean;
  onLike: () => void;
  onDislike: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [mobile, setMobile] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"x" | "y" | null>(null);
  const tracking = useRef(false);
  const pointerId = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const leaveTimer = useRef(0);
  const callbacks = useRef({ onLike, onDislike });
  const active = enabled && mobile;
  callbacks.current = { onLike, onDislike };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!active) return;
    function onScroll() {
      if (axis.current === "x") return;
      tracking.current = false;
      axis.current = null;
      pointerId.current = null;
    }
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.clearTimeout(leaveTimer.current);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [active]);

  function reset() {
    tracking.current = false;
    axis.current = null;
    pointerId.current = null;
    setDragging(false);
    setDx(0);
  }

  function onPointerDown(event: React.PointerEvent) {
    if (!active) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    startX.current = event.clientX;
    startY.current = event.clientY;
    axis.current = null;
    tracking.current = true;
    pointerId.current = event.pointerId;
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!active || !tracking.current) return;
    if (pointerId.current != null && event.pointerId !== pointerId.current) return;
    const nextDx = event.clientX - startX.current;
    const nextDy = event.clientY - startY.current;
    if (!axis.current) {
      if (Math.abs(nextDx) < 12 && Math.abs(nextDy) < 12) return;
      if (Math.abs(nextDx) > Math.abs(nextDy) * 1.25 && Math.abs(nextDx) >= 12) {
        axis.current = "x";
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      } else {
        tracking.current = false;
        axis.current = "y";
        return;
      }
    }
    if (axis.current !== "x") return;
    setDx(nextDx);
  }

  function finish(event: React.PointerEvent) {
    if (!active || (pointerId.current != null && event.pointerId !== pointerId.current)) {
      return;
    }
    if (axis.current === "x") {
      const nextDx = event.clientX - startX.current;
      if (nextDx > SWIPE_THRESHOLD) {
        suppressClick.current = true;
        setDx(420);
        setDragging(false);
        tracking.current = false;
        axis.current = null;
        pointerId.current = null;
        window.clearTimeout(leaveTimer.current);
        leaveTimer.current = window.setTimeout(callbacks.current.onLike, 160);
        return;
      }
      if (nextDx < -SWIPE_THRESHOLD) {
        suppressClick.current = true;
        setDx(-420);
        setDragging(false);
        tracking.current = false;
        axis.current = null;
        pointerId.current = null;
        window.clearTimeout(leaveTimer.current);
        leaveTimer.current = window.setTimeout(callbacks.current.onDislike, 160);
        return;
      }
    }
    reset();
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  }

  return {
    enabled: active,
    dx,
    dragging,
    rotate: Math.max(-18, Math.min(18, dx / 12)),
    likeOpacity: Math.max(0, Math.min(1, dx / 120)),
    nopeOpacity: Math.max(0, Math.min(1, -dx / 120)),
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: reset,
    onClickCapture,
  };
}
