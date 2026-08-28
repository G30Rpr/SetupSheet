"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions/follows";

export function FollowButton({
  targetUserId,
  initialIsFollowing,
}: {
  targetUserId: string;
  initialIsFollowing: boolean;
}) {
  const { user, signInWithDiscord } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!user) {
      void signInWithDiscord();
      return;
    }

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    startTransition(async () => {
      try {
        const result = await toggleFollow(targetUserId, wasFollowing);
        if (result.error) {
          setIsFollowing(wasFollowing);
          toast.error(result.error);
        }
      } catch {
        setIsFollowing(wasFollowing);
        toast.error("Couldn't update your follow status right now.");
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      variant={isFollowing ? "outline" : "default"}
      size="sm"
    >
      {isFollowing ? <UserCheck /> : <UserPlus />}
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}
