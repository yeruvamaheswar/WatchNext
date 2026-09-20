"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWatchNext } from "@/hooks/use-watchnext";
import { primaryActionClass } from "@/lib/button-styles";

export default function UserPage() {
  const { guest, isGuest, setDisplayName } = useWatchNext();
  const [name, setName] = useState(guest.displayName);

  useEffect(() => {
    setName(guest.displayName);
  }, [guest.displayName]);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
      <div>
        <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">User</p>
        <h1 className="mt-1 text-3xl font-semibold">Profile</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {isGuest ? "Guest session." : "Signed in."}
      </p>
      <div className="space-y-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          className="h-11"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Button
        type="button"
        className={`w-full ${primaryActionClass}`}
        onClick={async () => {
          await setDisplayName(name);
          toast.success("Name saved.");
        }}
      >
        Save
      </Button>
    </main>
  );
}
