import { useCallback, useRef, useState } from "react";

import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type { Comment, Post } from "../types";

export interface UseCommunityResult {
  posts: Post[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  loadPosts: (reset?: boolean) => Promise<void>;
  createPost: (text: string, imageUri?: string) => Promise<void>;
  toggleLike: (postId: string, isLiked: boolean) => Promise<void>;
  getComments: (postId: string) => Promise<Comment[]>;
  addComment: (postId: string, text: string) => Promise<Comment>;
}

export function useCommunity(): UseCommunityResult {
  const user = useAuthStore((s) => s.user);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const lastKeyRef = useRef<string | undefined>(undefined);

  const loadPosts = useCallback(
    async (reset = false) => {
      console.log("[community] loadPosts — teamId:", user?.teamId, "reset:", reset);
      if (!user?.teamId) {
        console.log("[community] no teamId, skipping");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const cursor = reset ? undefined : lastKeyRef.current;
        const result = await api.getPosts(user.teamId, cursor);
        console.log("[community] loadPosts result — posts:", result.posts.length, "lastKey:", result.lastKey);
        setPosts((prev) => (reset ? result.posts : [...prev, ...result.posts]));
        lastKeyRef.current = result.lastKey;
        setHasMore(!!result.lastKey);
      } catch (e) {
        console.log("[community] loadPosts error:", e instanceof Error ? e.message : String(e));
        setError(e instanceof Error ? e.message : "Erro ao carregar posts");
      } finally {
        setIsLoading(false);
      }
    },
    [user?.teamId],
  );

  const createPost = useCallback(async (text: string, imageUri?: string) => {
    let imageUrl: string | undefined;

    if (imageUri) {
      const filename = `post-${Date.now()}.jpg`;
      const { uploadUrl, fileUrl } = await api.getUploadUrl(
        filename,
        "image/jpeg",
      );
      const blob = await fetch(imageUri).then((r) => r.blob());
      await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/jpeg" },
      });
      imageUrl = fileUrl;
    }

    const { post } = await api.createPost(text, imageUrl);
    setPosts((prev) => [post, ...prev]);
  }, []);

  const toggleLike = useCallback(async (postId: string, isLiked: boolean) => {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes: p.likes + (isLiked ? -1 : 1) }
          : p,
      ),
    );
    try {
      if (isLiked) {
        await api.unlikePost(postId);
      } else {
        await api.likePost(postId);
      }
    } catch {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likes: p.likes + (isLiked ? 1 : -1) }
            : p,
        ),
      );
    }
  }, []);

  const getComments = useCallback(async (postId: string) => {
    const { comments } = await api.getComments(postId);
    return comments;
  }, []);

  const addComment = useCallback(async (postId: string, text: string) => {
    const { comment } = await api.createComment(postId, text);
    // Increment comment count in the post
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
      ),
    );
    return comment;
  }, []);

  return {
    posts,
    isLoading,
    hasMore,
    error,
    loadPosts,
    createPost,
    toggleLike,
    getComments,
    addComment,
  };
}
