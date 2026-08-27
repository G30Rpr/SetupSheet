"use client";

import { useEffect, useState, useTransition } from "react";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DiscordLoginButton } from "@/components/auth-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createComment, deleteComment, getSetupCommentsAction } from "@/lib/actions/setup-comments";
import { MAX_COMMENT_LENGTH } from "@/lib/data";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { getInitials } from "@/lib/utils";
import type { Setup, SetupComment } from "@/lib/types";

function formatTimestamp(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The expandable "Comments" panel on a SetupCard -- split out and
 * lazy-loaded via next/dynamic() like the other panels, fetched (and
 * refetched after posting/deleting) on demand rather than eagerly for
 * every card.
 */
export default function SetupCardComments({ setup }: { setup: Setup }) {
  const { user, signInWithDiscord } = useAuth();
  const [comments, setComments] = useState<SetupComment[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const runUndoableDelete = useUndoableDelete();

  function refetch() {
    getSetupCommentsAction(setup.id).then(setComments);
  }

  useEffect(refetch, [setup.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      void signInWithDiscord();
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createComment(setup.id, body);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBody("");
      refetch();
    });
  }

  function handleDelete(commentId: string) {
    setPendingDeleteIds((prev) => new Set(prev).add(commentId));
    runUndoableDelete({
      key: commentId,
      message: "Comment deleted",
      onUndo: () => {
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      },
      commit: async () => {
        const result = await deleteComment(commentId, setup.id);
        if (result.error) {
          setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            next.delete(commentId);
            return next;
          });
          toast.error(result.error);
          return;
        }
        setComments((prev) => prev?.filter((comment) => comment.id !== commentId) ?? prev);
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      },
    });
  }

  const visibleComments = comments?.filter((c) => !pendingDeleteIds.has(c.id)) ?? null;

  return (
    <div className="mt-2 flex flex-col gap-3 text-xs">
      {visibleComments === null ? (
        <p className="text-muted-foreground">Loading comments...</p>
      ) : visibleComments.length === 0 ? (
        <p className="text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visibleComments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-2">
              <Avatar className="size-6 shrink-0 ring-1 ring-border">
                <AvatarImage src={comment.avatarUrl ?? undefined} alt={comment.username} />
                <AvatarFallback className="bg-racing-green/15 text-[9px] text-racing-green">
                  {getInitials(comment.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{comment.username}</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {formatTimestamp(comment.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">{comment.body}</p>
              </div>
              {comment.isOwner && (
                <button
                  type="button"
                  onClick={() => handleDelete(comment.id)}
                  aria-label="Delete comment"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-racing-red disabled:opacity-60"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment..."
            maxLength={MAX_COMMENT_LENGTH}
            rows={2}
            className="text-xs"
          />
          {error && (
            <p role="alert" className="text-racing-red">
              {error}
            </p>
          )}
          <Button type="submit" size="sm" disabled={isPending || !body.trim()} className="self-end">
            <Send className="size-3.5" />
            {isPending ? "Posting..." : "Post"}
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
          <span className="text-muted-foreground">Log in to join the conversation.</span>
          <DiscordLoginButton />
        </div>
      )}
    </div>
  );
}
