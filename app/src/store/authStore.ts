import { create } from "zustand";

import {
  confirmSignUp as confirmSignUpService,
  fetchUserAttributes,
  getCurrentUser,
  resendSignUpCode,
  signIn,
  signOut,
  signUp,
  updateUserAttributes,
} from "../services/auth";
import type { User } from "../types";
import { mapCognitoError } from "../utils/cognitoErrorMapper";

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  /** Guard de idempotência — true após initialize() ser chamado pela primeira vez. */
  _initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  setTeam: (teamId: string) => Promise<void>;
  logout: () => Promise<void>;

  /** Callback de navegação imperativa injetado pelo layout (auth). Null quando não injetado. */
  _onNavigate: ((path: string) => void) | null;
  /** Injeta o callback de navegação. Chamado pelo _layout.tsx no useEffect de montagem. */
  _setNavigate: (fn: (path: string) => void) => void;
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
  isLoading: true,
  error: null,
  _initialized: false,
  _onNavigate: null,
  _setNavigate: (fn) => set({ _onNavigate: fn }),

  initialize: async () => {
    // Guard de idempotência: impede que initialize() seja executado mais de uma vez.
    // Uma vez chamado, não executa novamente — previne o bug C1 (spinner-forever)
    // causado por double-call em React StrictMode ou re-renders do _layout.tsx.
    if (get()._initialized) return;
    set({ _initialized: true });
    console.log("[auth] initialize start");
    set({ isLoading: true, error: null });
    try {
      const user = await Promise.race([
        loadCurrentUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("initialize timeout")), 8000)
        ),
      ]);
      console.log("[auth] initialize success:", user?.email, "teamId:", user?.teamId);
      set({ user });
    } catch (e) {
      console.log("[auth] initialize error:", e instanceof Error ? e.message : String(e));
      set({ user: null });
    } finally {
      console.log("[auth] initialize finally — isLoading=false");
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
      set({ error: mapCognitoError(e) });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await Promise.race([
        signUp({
          username: email,
          password,
          options: { userAttributes: { name, email } },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("register timeout")), 10_000)
        ),
      ]);

      if (result.isSignUpComplete) {
        // Cadastro completo (pool sem confirmação) — fazer login automático
        try {
          const signInResult = await signIn({ username: email, password });
          if (signInResult.isSignedIn) {
            const user = await loadCurrentUser();
            set({ user });
            get()._onNavigate?.("/select-team");
          } else {
            set({ error: mapCognitoError(signInResult) });
          }
        } catch (e) {
          set({ error: mapCognitoError(e) });
        }
      } else {
        // Confirmação necessária → fluxo normal
        get()._onNavigate?.(`/confirm?email=${encodeURIComponent(email)}`);
      }
    } catch (e) {
      if ((e as { name?: string }).name === "UsernameExistsException") {
        // Fallback: usuário já existe mas não verificou o e-mail
        try {
          await resendSignUpCode({ username: email });
          set({ error: null });
          get()._onNavigate?.(`/confirm?email=${encodeURIComponent(email)}`);
        } catch (e2) {
          set({ error: mapCognitoError(e2) });
        }
      } else {
        set({ error: mapCognitoError(e) });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  confirmSignUp: async (email, code) => {
    set({ isLoading: true, error: null });
    try {
      await confirmSignUpService({ username: email, confirmationCode: code });
      get()._onNavigate?.("/select-team");
    } catch (e) {
      set({ error: mapCognitoError(e) });
    } finally {
      set({ isLoading: false });
    }
  },

  resendCode: async (email) => {
    set({ isLoading: true, error: null });
    try {
      await resendSignUpCode({ username: email });
      set({ error: "Código reenviado para seu e-mail." });
    } catch (e) {
      set({ error: mapCognitoError(e) });
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
      set({ error: mapCognitoError(e) });
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
