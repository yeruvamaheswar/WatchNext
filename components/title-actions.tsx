"use client";

import { Bookmark, Eye, Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWatchNext } from "@/hooks/use-watchnext";
import { hasMark, isLikedTitle } from "@/lib/guest-store";
import { primaryActionClass } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import type { SuggestedTitle, TitleMark } from "@/lib/types";

export function titleMarkFrom(title: { tmdbId: number; mediaType: TitleMark["mediaType"]; name?: string }): TitleMark {
  return {
    tmdbId: title.tmdbId,
    mediaType: title.mediaType,
    name: title.name,
  };
}

export function TitleActions({
  title,
  layout = "detail",
}: {
  title: SuggestedTitle;
  layout?: "detail" | "cards" | "rail";
}) {
  const { guest, recordVerdict, removeLikedTitle, toggleWatchlist, toggleSeen } =
    useWatchNext();
  const mark = titleMarkFrom(title);
  const liked = isLikedTitle(guest.likes, mark);
  const saved = hasMark(guest.watchlist, mark);
  const seen = hasMark(guest.seen, mark);
  function onLike() {
    if (liked) {
      removeLikedTitle(mark);
      toast.success("Removed from liked titles.");
      return;
    }
    recordVerdict({
      tmdbId: title.tmdbId,
      mediaType: title.mediaType,
      verdict: "like",
      source: "favorite",
      name: title.name,
    });
    toast.success("Added to liked titles.");
  }

  function onWatchlist() {
    toggleWatchlist(mark);
    toast.success(saved ? "Removed from watchlist." : "Added to watchlist.");
  }

  function onSeen() {
    toggleSeen(mark);
    toast.success(seen ? "Unmarked as seen." : "Marked as seen.");
  }

  if (layout === "detail") {
    return (
      <div className="grid gap-2">
        <Button
          type="button"
          data-testid="like-title"
          className={`w-full ${liked ? "" : primaryActionClass}`}
          variant={liked ? "outline" : "default"}
          onClick={onLike}
        >
          {liked ? "Remove from liked titles" : "Add to liked titles"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            data-testid="watchlist-title"
            variant={saved ? "secondary" : "outline"}
            onClick={onWatchlist}
          >
            {saved ? "On watchlist" : "Watchlist"}
          </Button>
          <Button
            type="button"
            data-testid="seen-title"
            variant={seen ? "secondary" : "outline"}
            onClick={onSeen}
          >
            {seen ? "Seen" : "Seen-it"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-1",
        layout === "rail" ? "mt-1 @4xl:mt-1" : "mt-2"
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ActionChip
        pressed={liked}
        label={liked ? "Liked" : "Like"}
        showLabel={layout === "cards"}
        testId="like-title"
        onClick={onLike}
      >
        <Heart className={cn("size-3.5", liked && "fill-current")} />
      </ActionChip>
      <ActionChip
        pressed={saved}
        label={saved ? "Saved" : "Watchlist"}
        showLabel={layout === "cards"}
        testId="watchlist-title"
        onClick={onWatchlist}
      >
        <Bookmark className={cn("size-3.5", saved && "fill-current")} />
      </ActionChip>
      <ActionChip
        pressed={seen}
        label={seen ? "Seen" : "Seen-it"}
        showLabel={layout === "cards"}
        testId="seen-title"
        onClick={onSeen}
      >
        <Eye className="size-3.5" />
      </ActionChip>
    </div>
  );
}

function ActionChip({
  pressed,
  label,
  showLabel,
  testId,
  onClick,
  children,
}: {
  pressed: boolean;
  label: string;
  showLabel: boolean;
  testId: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={pressed ? "secondary" : "outline"}
      data-testid={testId}
      aria-pressed={pressed}
      aria-label={label}
      className="h-7 min-w-7 gap-1 px-2 text-[11px]"
      onClick={onClick}
    >
      {children}
      <span className={showLabel ? undefined : "sr-only"}>{label}</span>
    </Button>
  );
}
