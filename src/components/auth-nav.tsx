"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { normalizeHttpsUrl } from "@/lib/safe-url";
import { getUserDisplayName } from "@/lib/user-display";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DiscordLoginButton({ className }: { className?: string }) {
  const { signInWithDiscord } = useAuth();

  return (
    <Button
      onClick={() => void signInWithDiscord()}
      size="sm"
      className={cn(
        "bg-[#5865F2] text-white hover:bg-[#4752C4] hover:shadow-[0_0_24px_-4px_rgba(88,101,242,0.6)]",
        className
      )}
    >
      <DiscordIcon className="size-4" />
      Login with Discord
    </Button>
  );
}

export function UserMenu() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  if (!user) return null;

  const displayName = getUserDisplayName(user);
  const avatarUrl = normalizeHttpsUrl(user.user_metadata?.avatar_url);

  async function handleSignOut() {
    await signOut();
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full ring-offset-background transition-shadow outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Account menu"
        >
          <Avatar className="ring-1 ring-border transition-colors hover:ring-racing-coral/50">
            <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-racing-coral/15 text-racing-coral">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-foreground font-medium">{displayName}</span>
          {user.email && (
            <span className="text-muted-foreground text-xs font-normal">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User />
            My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AuthNav() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="size-9 animate-pulse rounded-full bg-secondary" />;
  }

  return user ? <UserMenu /> : <DiscordLoginButton />;
}
