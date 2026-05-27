import { fetchAuthSession } from "aws-amplify/auth";

import { API_REST_URL } from "../constants/config";
import type { Comment, Post } from "../types";

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeader();
  const response = await fetch(`${API_REST_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  getPosts: (teamId: string, lastKey?: string) =>
    request<{ posts: Post[]; lastKey?: string }>(
      `/posts?teamId=${encodeURIComponent(teamId)}${lastKey ? `&lastKey=${encodeURIComponent(lastKey)}` : ""}`,
    ),

  createPost: (text: string, imageUrl?: string) =>
    request<{ post: Post }>("/posts", {
      method: "POST",
      body: JSON.stringify({ text, imageUrl }),
    }),

  likePost: (postId: string) =>
    request<{ likes: number }>(`/posts/${encodeURIComponent(postId)}/like`, {
      method: "POST",
    }),

  unlikePost: (postId: string) =>
    request<{ likes: number }>(`/posts/${encodeURIComponent(postId)}/like`, {
      method: "DELETE",
    }),

  getComments: (postId: string) =>
    request<{ comments: Comment[] }>(
      `/posts/${encodeURIComponent(postId)}/comments`,
    ),

  createComment: (postId: string, text: string) =>
    request<{ comment: Comment }>(
      `/posts/${encodeURIComponent(postId)}/comments`,
      { method: "POST", body: JSON.stringify({ text }) },
    ),

  getUploadUrl: (filename: string, type: string) =>
    request<{ uploadUrl: string; fileUrl: string }>(
      `/upload-url?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}`,
    ),

  getLeaderboard: (matchId: string, limit = 10) =>
    request<{
      leaderboard: Array<{
        rank: number;
        userId: string;
        userName: string;
        teamId: string | null;
        score: number;
        correctCount: number;
        wrongCount: number;
        currentStreak: number;
        bestStreak: number;
        badges: string[];
      }>;
    }>(
      `/leaderboard?matchId=${encodeURIComponent(matchId)}&limit=${limit}`,
    ),
};
