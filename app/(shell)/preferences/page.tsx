"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWatchNext } from "@/hooks/use-watchnext";
import { primaryActionClass } from "@/lib/button-styles";
import { VIBE_CARDS } from "@/lib/onboarding-catalog";
import type { TitleMark } from "@/lib/types";

export default function PreferencesPage() {
  const router = useRouter();
  const { resetOnboarding, removeLikedTitle, toggleWatchlist, toggleSeen, guest } =
    useWatchNext();
  const [likesOpen, setLikesOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [seenOpen, setSeenOpen] = useState(false);
  const [redoOpen, setRedoOpen] = useState(false);
  const likedTitles = guest.likes.filter((like) => like.verdict === "like");
  const vibeNames = guest.likedVibes.map(
    (id) => VIBE_CARDS.find((vibe) => vibe.id === id)?.name ?? id
  );

  function confirmRedo() {
    resetOnboarding();
    setRedoOpen(false);
    router.push("/onboarding");
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
      <div>
        <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">
          Preferences
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Taste controls</h1>
      </div>
      <ListButton
        testId="open-liked-titles"
        title="Liked titles"
        empty="None yet. Add titles from search results."
        names={likedTitles.map((like) => like.name || `#${like.tmdbId}`)}
        onClick={() => setLikesOpen(true)}
      />
      <section className="rounded-2xl border border-white/10 p-4">
        <h2 className="font-medium">Liked vibes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {vibeNames.length ? vibeNames.join(", ") : "None yet."}
        </p>
      </section>
      <ListButton
        testId="open-watchlist"
        title="Watchlist"
        empty="None yet. Save titles from search results."
        names={guest.watchlist.map((mark) => mark.name || `#${mark.tmdbId}`)}
        onClick={() => setWatchlistOpen(true)}
      />
      <ListButton
        testId="open-seen"
        title="Seen-it"
        empty="None yet. Mark titles from search results."
        names={guest.seen.map((mark) => mark.name || `#${mark.tmdbId}`)}
        onClick={() => setSeenOpen(true)}
      />
      <Button
        type="button"
        data-testid="redo-onboarding"
        className={`w-full ${primaryActionClass}`}
        onClick={() => setRedoOpen(true)}
      >
        Redo onboarding
      </Button>

      <TitleListDialog
        open={likesOpen}
        onOpenChange={setLikesOpen}
        title="Liked titles"
        description="Remove anything you no longer want used for recommendations."
        empty="No liked titles yet. Open a search result and add it here."
        items={likedTitles.map((like) => ({
          tmdbId: like.tmdbId,
          mediaType: like.mediaType,
          name: like.name,
          meta: like.source === "favorite" ? "Added from search" : "Onboarding",
        }))}
        onRemove={(mark) => {
          removeLikedTitle(mark);
          toast.success("Removed from liked titles.");
        }}
      />
      <TitleListDialog
        open={watchlistOpen}
        onOpenChange={setWatchlistOpen}
        title="Watchlist"
        description="Titles you saved to watch later. These stay if you redo onboarding."
        empty="No watchlist titles yet. Tap Watchlist on a search result."
        items={guest.watchlist.map((mark) => ({
          ...mark,
          meta: "Saved for later",
        }))}
        onRemove={(mark) => {
          toggleWatchlist(mark);
          toast.success("Removed from watchlist.");
        }}
      />
      <TitleListDialog
        open={seenOpen}
        onOpenChange={setSeenOpen}
        title="Seen-it"
        description="Titles you have already watched. Search will skip these."
        empty="No seen titles yet. Tap Seen-it on a search result."
        items={guest.seen.map((mark) => ({
          ...mark,
          meta: "Already watched",
        }))}
        onRemove={(mark) => {
          toggleSeen(mark);
          toast.success("Unmarked as seen.");
        }}
      />

      <Dialog open={redoOpen} onOpenChange={setRedoOpen}>
        <DialogContent className="border-white/10 bg-[#160a24]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Redo onboarding?</DialogTitle>
            <DialogDescription>
              This clears every liked title and vibe, including titles you added
              from search. Watchlist and seen-it stay. You will swipe a new
              taste profile from scratch.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRedoOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="confirm-redo-onboarding"
              onClick={confirmRedo}
            >
              Redo onboarding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ListButton({
  title,
  names,
  empty,
  testId,
  onClick,
}: {
  title: string;
  names: string[];
  empty: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="rounded-2xl border border-white/10 p-4 text-left transition hover:border-white/20 hover:bg-white/5"
      onClick={onClick}
    >
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {names.length ? names.join(", ") : empty}
      </p>
      <p className="mt-2 text-xs text-violet-300">Tap to edit</p>
    </button>
  );
}

function TitleListDialog({
  open,
  onOpenChange,
  title,
  description,
  empty,
  items,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  empty: string;
  items: Array<TitleMark & { meta?: string }>;
  onRemove: (mark: TitleMark) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(80dvh,36rem)] overflow-hidden border-white/10 bg-[#160a24]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {items.length ? (
          <ul className="max-h-[50dvh] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <li
                key={`${item.mediaType}-${item.tmdbId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name || `#${item.tmdbId}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.mediaType === "tv" ? "TV" : "Movie"}
                    {item.meta ? ` · ${item.meta}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  data-testid="remove-list-title"
                  onClick={() => onRemove(item)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
