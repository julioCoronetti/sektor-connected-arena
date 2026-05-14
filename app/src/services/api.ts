import type { Comment, Match, Post } from "../types";

function notImplemented(fn: string, plano: string): never {
  throw new Error(`[api.${fn}] não implementado — responsável: ${plano}`);
}

export function getFeed(_teamId: string, _cursor?: string): Promise<{ posts: Post[]; nextCursor?: string }> {
  return notImplemented("getFeed", "Plano 05");
}

export function createPost(_input: {
  authorId: string;
  text: string;
  imageUrl?: string;
}): Promise<Post> {
  return notImplemented("createPost", "Plano 05");
}

export function likePost(_postId: string): Promise<void> {
  return notImplemented("likePost", "Plano 05");
}

export function getComments(_postId: string): Promise<Comment[]> {
  return notImplemented("getComments", "Plano 05");
}

export function createComment(_input: {
  postId: string;
  text: string;
}): Promise<Comment> {
  return notImplemented("createComment", "Plano 05");
}

export function getMatch(_matchId: string): Promise<Match> {
  return notImplemented("getMatch", "Plano 03");
}
