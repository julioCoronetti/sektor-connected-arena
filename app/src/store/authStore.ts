import type { User } from "../types";

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; name: string }) => Promise<void>;
  signOut: () => Promise<void>;
  setTeam: (teamId: string) => Promise<void>;
}

export function useAuthStore(): AuthState {
  throw new Error("[useAuthStore] não implementado — responsável: Plano 02");
}
