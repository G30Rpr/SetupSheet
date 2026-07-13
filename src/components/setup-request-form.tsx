"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DiscordLoginButton } from "@/components/auth-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSetupRequest } from "@/lib/actions/setup-requests";
import { MAX_CAR_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_TRACK_LENGTH, games } from "@/lib/data";

export function SetupRequestForm() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [game, setGame] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const car = String(formData.get("car") ?? "");
    const track = String(formData.get("track") ?? "");
    const notes = String(formData.get("notes") ?? "");

    startTransition(async () => {
      const result = await createSetupRequest({ game, car, track, notes });
      if (result.error) {
        setError(result.error);
        return;
      }
      setGame("");
      e.currentTarget.reset();
      toast.success("Request posted");
      router.refresh();
    });
  }

  if (isLoading) {
    return <Card className="h-40 animate-pulse border-border/60 bg-secondary/20" />;
  }

  if (!user) {
    return (
      <Card className="items-center gap-3 border-racing-green/30 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Log in to post a setup request.
        </p>
        <DiscordLoginButton />
      </Card>
    );
  }

  return (
    <Card className="px-5 py-5 sm:px-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Post a request
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="request-game">Game</Label>
            <Select name="game" required value={game} onValueChange={setGame}>
              <SelectTrigger id="request-game" className="w-full">
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="request-car">Car</Label>
            <Input id="request-car" name="car" placeholder="e.g. Porsche 992 GT3 Cup" maxLength={MAX_CAR_LENGTH} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="request-track">Track</Label>
            <Input id="request-track" name="track" placeholder="e.g. Spa-Francorchamps" maxLength={MAX_TRACK_LENGTH} required />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-notes">Notes (optional)</Label>
          <Textarea
            id="request-notes"
            name="notes"
            placeholder="Any specifics — dry/wet, quali vs race, rig type..."
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={2}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-racing-red/30 bg-racing-red/10 px-4 py-2.5 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" disabled={isPending} className="self-start">
          <Send />
          {isPending ? "Posting..." : "Post request"}
        </Button>
      </form>
    </Card>
  );
}
