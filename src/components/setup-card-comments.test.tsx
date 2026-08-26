// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import SetupCardComments from "@/components/setup-card-comments";
import type { Setup, SetupComment } from "@/lib/types";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
const { getSetupCommentsActionMock, createCommentMock, deleteCommentMock } = vi.hoisted(() => ({
  getSetupCommentsActionMock: vi.fn(),
  createCommentMock: vi.fn(),
  deleteCommentMock: vi.fn(),
}));
const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));

vi.mock("@/components/auth-provider", () => ({
  useAuth: useAuthMock,
  DiscordLoginButton: () => <button type="button">Log in with Discord</button>,
}));

vi.mock("@/lib/actions/setup-comments", () => ({
  getSetupCommentsAction: getSetupCommentsActionMock,
  createComment: createCommentMock,
  deleteComment: deleteCommentMock,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastErrorMock, success: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseSetup = { id: "setup-1" } as Setup;

const comment: SetupComment = {
  id: "comment-1",
  setupId: "setup-1",
  userId: "user-1",
  username: "Max",
  avatarUrl: null,
  body: "Great on the brakes into T1",
  createdAt: "2026-07-01T00:00:00.000Z",
  isOwner: true,
};

describe("SetupCardComments", () => {
  it("shows a login gate instead of the composer when logged out", async () => {
    useAuthMock.mockReturnValue({ user: null, signInWithDiscord: vi.fn() });
    getSetupCommentsActionMock.mockResolvedValue([]);

    render(<SetupCardComments setup={baseSetup} />);

    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
    expect(screen.getByText("Log in to join the conversation.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Add a comment...")).not.toBeInTheDocument();
  });

  it("lists fetched comments and lets the owner delete one", async () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" }, signInWithDiscord: vi.fn() });
    getSetupCommentsActionMock.mockResolvedValue([comment]);
    deleteCommentMock.mockResolvedValue({ error: null });

    render(<SetupCardComments setup={baseSetup} />);

    expect(await screen.findByText(comment.body)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));

    // Optimistically removed from the list the instant delete is clicked,
    // ahead of the undoable-delete grace period actually committing.
    await waitFor(() => expect(screen.queryByText(comment.body)).not.toBeInTheDocument());
  });

  it("posts a new comment and clears the composer on success", async () => {
    const user = { id: "user-1" };
    useAuthMock.mockReturnValue({ user, signInWithDiscord: vi.fn() });
    getSetupCommentsActionMock.mockResolvedValue([]);
    createCommentMock.mockResolvedValue({ error: null });

    render(<SetupCardComments setup={baseSetup} />);
    await screen.findByText("No comments yet.");

    const textarea = screen.getByPlaceholderText("Add a comment...");
    fireEvent.change(textarea, { target: { value: "Nice setup!" } });
    fireEvent.click(screen.getByRole("button", { name: /post/i }));

    await waitFor(() => expect(createCommentMock).toHaveBeenCalledWith("setup-1", "Nice setup!"));
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe(""));
    // Refetches after a successful post.
    expect(getSetupCommentsActionMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces the server error and keeps the draft when posting fails", async () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" }, signInWithDiscord: vi.fn() });
    getSetupCommentsActionMock.mockResolvedValue([]);
    createCommentMock.mockResolvedValue({ error: "Comment is too long." });

    render(<SetupCardComments setup={baseSetup} />);
    await screen.findByText("No comments yet.");

    const textarea = screen.getByPlaceholderText("Add a comment...");
    fireEvent.change(textarea, { target: { value: "Too long" } });
    fireEvent.click(screen.getByRole("button", { name: /post/i }));

    expect(await screen.findByText("Comment is too long.")).toBeInTheDocument();
    expect((textarea as HTMLTextAreaElement).value).toBe("Too long");
  });
});
