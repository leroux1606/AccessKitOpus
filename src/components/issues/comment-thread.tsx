"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { Send } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface CommentThreadProps {
  violationId: string;
  comments: Comment[];
  currentUserId: string;
}

export function CommentThread({ violationId, comments }: CommentThreadProps) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    startTransition(async () => {
      await fetch(`/api/issues/${violationId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      setContent("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No comments yet. Start the conversation.</p>
      )}

      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <Avatar className="h-7 w-7 mt-0.5 flex-shrink-0">
              {comment.user.image && (
                <AvatarImage src={comment.user.image} alt={comment.user.name ?? comment.user.email} />
              )}
              <AvatarFallback className="text-[10px]">
                {getInitials(comment.user.name, comment.user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {comment.user.name ?? comment.user.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(comment.createdAt)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment..."
          className="min-h-[60px] resize-none"
          maxLength={5000}
          aria-label="Comment text"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !content.trim()}
          className="self-end"
          aria-label="Post comment"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
