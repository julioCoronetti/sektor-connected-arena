import type { Post } from "../types";

export interface UseCommunityResult {
  posts: Post[];
  loading: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useCommunity(_teamId: string): UseCommunityResult {
  throw new Error("[useCommunity] não implementado — responsável: Plano 05");
}
