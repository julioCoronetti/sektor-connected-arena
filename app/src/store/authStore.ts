import { create } from "zustand";

import {
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  updateUserAttributes,
} from "../services/auth";
import type { User } from "../types";

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  setTeam: (teamId: string) => Promise<void>;
  logout: () => Promise<void>;
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}

async function loadCurrentUser(): Promise<User> {
  const cognitoUser = await getCurrentUser();
  const attrs = await fetchUserAttributes();
  return {
    id: cognitoUser.userId,
    email: attrs.email ?? cognitoUser.signInDetails?.loginId ?? "",
    name: attrs.name ?? "",
    teamId: attrs["custom:teamId"] ?? "",
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await loadCurrentUser();
      set({ user });
    } catch {
      set({ user: null });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await signIn({ username: email, password });
      if (!result.isSignedIn) {
        // nextStep pode ser CONFIRM_SIGN_UP, RESET_PASSWORD, etc.
        const step = result.nextStep?.signInStep ?? "";
        if (step === "CONFIRM_SIGN_UP") {
          set({ error: "Confirme seu e-mail antes de entrar." });
        } else {
          set({ error: `Não foi possível entrar (${step}).` });
        }
        return;
      }
      const user = await loadCurrentUser();
      set({ user });
    } catch (e) {
      set({ error: errorMessage(e, "Erro ao fazer login") });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const signUpResult = await signUp({
        username: email,
        password,
        options: { userAttributes: { name, email } },
      });

      // Se o pool exige confirmação por e-mail, não há sessão para carregar atributos.
      if (!signUpResult.isSignUpComplete) {
        set({
          error:
            "Conta criada. Confirme o código enviado para seu e-mail antes de entrar.",
        });
        return;
      }

      const signInResult = await signIn({ username: email, password });
      if (!signInResult.isSignedIn) {
        set({
          error:
            "Conta criada, mas é preciso confirmar o e-mail antes de entrar.",
        });
        return;
      }

      const user = await loadCurrentUser();
      set({ user });
    } catch (e) {
      set({ error: errorMessage(e, "Erro ao criar conta") });
    } finally {
      set({ isLoading: false });
    }
  },

  setTeam: async (teamId) => {
    set({ error: null });
    try {
      await updateUserAttributes({
        userAttributes: { "custom:teamId": teamId },
      });
      set((state) => ({
        user: state.user ? { ...state.user, teamId } : null,
      }));
    } catch (e) {
      set({ error: errorMessage(e, "Erro ao salvar time") });
      throw e;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await signOut();
    } finally {
      set({ user: null, isLoading: false });
    }
  },
}));

// Helper síncrono para consumidores não-React (ex.: navegadores manuais).
export const getAuthState = (): AuthState => useAuthStore.getState();
