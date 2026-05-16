/**
 * authStore.test.ts
 *
 * Testes de exploração da condição de bug (Bug Condition) para o authStore.
 *
 * Task 1 — Property 1: Bug Condition — Spinner-forever no cold start (C1)
 *
 * CRITICAL: O teste V1b DEVE FALHAR no código não-fixado.
 * A falha confirma que o bug existe.
 * Counterexample documentado: "segunda chamada seta `isLoading: true` após o
 * `finally` da primeira já ter setado `isLoading: false`"
 *
 * Validates: Requirements 1.1, 2.1
 */

import { useAuthStore } from "../authStore";

// Mock do módulo de serviços de auth — getCurrentUser e fetchUserAttributes
// rejeitam com NotAuthorizedException, simulando cold start sem sessão válida.
jest.mock("../../services/auth", () => ({
  getCurrentUser: jest.fn(),
  fetchUserAttributes: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  updateUserAttributes: jest.fn(),
  fetchAuthSession: jest.fn(),
}));

import {
  getCurrentUser,
  fetchUserAttributes,
} from "../../services/auth";

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
  typeof getCurrentUser
>;
const mockFetchUserAttributes = fetchUserAttributes as jest.MockedFunction<
  typeof fetchUserAttributes
>;

describe("authStore", () => {
  beforeEach(() => {
    // Resetar o store para o estado inicial antes de cada teste
    useAuthStore.setState({
      user: null,
      isLoading: true,
      error: null,
      _initialized: false,
    });

    jest.clearAllMocks();

    // Configurar mocks para rejeitar com NotAuthorizedException.
    // Usa um delay mínimo (1 ms) para garantir que a promise seja assíncrona
    // e o event loop possa intercalar as duas chamadas de initialize(),
    // reproduzindo a condição de corrida do bug C1.
    const notAuthError = new Error("NotAuthorizedException");
    notAuthError.name = "NotAuthorizedException";

    mockGetCurrentUser.mockImplementation(
      () =>
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(notAuthError), 1)
        )
    );
    mockFetchUserAttributes.mockRejectedValue(notAuthError);
  });

  /**
   * V1a — Chamada única de initialize()
   *
   * Verifica que uma única chamada a initialize() com getCurrentUser rejeitando
   * resulta em isLoading=false e user=null dentro do tempo limite.
   */
  it("V1a: initialize() chamado uma vez → isLoading=false, user=null, tempo ≤ 10 000 ms", async () => {
    const start = Date.now();

    await useAuthStore.getState().initialize();

    const elapsed = Date.now() - start;
    const state = useAuthStore.getState();

    expect(state.isLoading).toBe(false);
    expect(state.user).toBeNull();
    expect(elapsed).toBeLessThanOrEqual(10_000);
  });

  /**
   * V1b — Bug Condition: double-call de initialize() (simula React StrictMode)
   *
   * ESTE TESTE DEVE FALHAR NO CÓDIGO NÃO-FIXADO.
   *
   * Counterexample: a segunda chamada seta `isLoading: true` após o `finally`
   * da primeira já ter setado `isLoading: false`, deixando o spinner preso.
   *
   * Sequência do bug (React StrictMode monta → desmonta → remonta o componente):
   *   t=0   call1 inicia: set({ isLoading: true })
   *   t=Δ   call1.finally: set({ isLoading: false })   ← call1 termina
   *   t=Δ+ε call2 inicia: set({ isLoading: true })     ← BUG: sobrescreve false com true
   *   t=2Δ  call2.finally: set({ isLoading: false })
   *
   * O bug se manifesta quando call2 começa DEPOIS que call1 já terminou:
   * o `set({ isLoading: true })` no início de call2 sobrescreve o
   * `isLoading: false` que call1 setou no finally.
   *
   * Para capturar o bug, verificamos o estado IMEDIATAMENTE após call1 terminar
   * e call2 ter iniciado (mas antes do finally de call2 rodar).
   *
   * Validates: Requirements 1.1, 2.1
   */
  it("V1b (Bug Condition): initialize() chamado duas vezes sem await na primeira → isLoading=false ao final", async () => {
    const notAuthError = new Error("NotAuthorizedException");
    notAuthError.name = "NotAuthorizedException";

    // Mock com delay para tornar a operação assíncrona e observável
    mockGetCurrentUser.mockImplementation(
      () =>
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(notAuthError), 10)
        )
    );

    // Simula o padrão do React StrictMode:
    // call1 termina completamente, depois call2 inicia (sem await)
    // e imediatamente verificamos o estado antes de call2 terminar.
    await useAuthStore.getState().initialize();

    // Neste ponto call1 terminou: isLoading deve ser false
    expect(useAuthStore.getState().isLoading).toBe(false);

    // call2 inicia SEM await — seta isLoading=true imediatamente
    const promise2 = useAuthStore.getState().initialize();

    try {
      // ESTE ASSERT FALHA NO CÓDIGO NÃO-FIXADO:
      // call2 acabou de setar isLoading=true (no início de initialize()),
      // sobrescrevendo o isLoading=false que call1 setou no finally.
      // O spinner fica preso porque o componente lê isLoading=true aqui.
      expect(useAuthStore.getState().isLoading).toBe(false);
    } finally {
      // Sempre aguarda call2 terminar para evitar operações assíncronas pendentes
      await promise2;
    }

    const finalState = useAuthStore.getState();
    expect(finalState.isLoading).toBe(false);
    expect(finalState.user).toBeNull();
  });
});

/**
 * Task 2 — Property 2: Preservation — Sessão válida e fluxos de credenciais preservados
 *
 * Estes testes verificam o comportamento BASELINE do código não-fixado para
 * entradas onde ¬C1 (sessão válida) e ¬C2 (setTeam com mock de sucesso).
 * TODOS devem PASSAR no código não-fixado — confirmam o baseline a preservar.
 *
 * Validates: Requirements 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import {
  signIn,
  signOut,
  updateUserAttributes,
} from "../../services/auth";

const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockUpdateUserAttributes = updateUserAttributes as jest.MockedFunction<
  typeof updateUserAttributes
>;

describe("authStore — Preservation (Property 2)", () => {
  beforeEach(() => {
    // Resetar o store para o estado inicial antes de cada teste
    useAuthStore.setState({
      user: null,
      isLoading: false,
      error: null,
    });

    jest.clearAllMocks();
  });

  /**
   * V6a — signIn válido: mock signIn resolvendo com isSignedIn=true
   * + getCurrentUser/fetchUserAttributes resolvendo → user populado, isLoading=false
   *
   * Validates: Requirements 3.3, 3.1
   */
  it("V6a: login() com signIn válido → user populado, isLoading=false", async () => {
    mockSignIn.mockResolvedValueOnce({
      isSignedIn: true,
      nextStep: { signInStep: "DONE" },
    } as Awaited<ReturnType<typeof signIn>>);

    mockGetCurrentUser.mockResolvedValueOnce({
      userId: "user-123",
      username: "test@test.com",
      signInDetails: { loginId: "test@test.com", authFlowType: "USER_SRP_AUTH" },
    });

    mockFetchUserAttributes.mockResolvedValueOnce({
      email: "test@test.com",
      name: "Test User",
      "custom:teamId": "team-a",
    } as Awaited<ReturnType<typeof fetchUserAttributes>>);

    await useAuthStore.getState().login("test@test.com", "password123");

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.user).not.toBeNull();
    expect(state.user?.email).toBe("test@test.com");
    expect(state.user?.name).toBe("Test User");
    expect(state.user?.teamId).toBe("team-a");
    expect(state.error).toBeNull();
  });

  /**
   * V6b — logout: chamar logout() com mock signOut resolvendo
   * → user=null, isLoading=false
   *
   * Validates: Requirements 3.4
   */
  it("V6b: logout() com signOut resolvendo → user=null, isLoading=false", async () => {
    // Pré-setar um usuário no store
    useAuthStore.setState({
      user: {
        id: "user-123",
        email: "test@test.com",
        name: "Test User",
        teamId: "team-a",
      },
      isLoading: false,
      error: null,
    });

    mockSignOut.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  /**
   * V6c — signIn inválido: mock signIn rejeitando
   * → error setado, user=null
   *
   * Validates: Requirements 3.3
   */
  it("V6c: login() com signIn rejeitando → error setado, user=null", async () => {
    const authError = new Error("NotAuthorizedException: Incorrect username or password.");
    authError.name = "NotAuthorizedException";

    mockSignIn.mockRejectedValueOnce(authError);

    await useAuthStore.getState().login("test@test.com", "wrong-password");

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeTruthy();
    expect(state.error).toContain("NotAuthorizedException");
  });

  /**
   * V2 — setTeam com mock de sucesso: mock updateUserAttributes resolvendo;
   * store com user já setado → assert user.teamId === 'team-a', sem exceção
   *
   * Validates: Requirements 2.2, 3.2
   */
  it("V2: setTeam('team-a') com updateUserAttributes resolvendo → user.teamId='team-a', sem exceção", async () => {
    // Pré-setar um usuário no store (sem teamId)
    useAuthStore.setState({
      user: {
        id: "user-123",
        email: "test@test.com",
        name: "Test User",
        teamId: "",
      },
      isLoading: false,
      error: null,
    });

    mockUpdateUserAttributes.mockResolvedValueOnce({
      "custom:teamId": { isUpdated: true },
    } as unknown as Awaited<ReturnType<typeof updateUserAttributes>>);

    await expect(
      useAuthStore.getState().setTeam("team-a")
    ).resolves.not.toThrow();

    const state = useAuthStore.getState();
    expect(state.user?.teamId).toBe("team-a");
  });

  /**
   * V2b — setTeam com mock de 400: mock updateUserAttributes rejeitando com
   * mensagem de schema ausente → exceção propagada, user.teamId inalterado
   *
   * Validates: Requirements 2.2, 3.2
   */
  it("V2b: setTeam() com updateUserAttributes rejeitando (400) → exceção propagada, user.teamId inalterado", async () => {
    const originalTeamId = "";

    // Pré-setar um usuário no store (sem teamId)
    useAuthStore.setState({
      user: {
        id: "user-123",
        email: "test@test.com",
        name: "Test User",
        teamId: originalTeamId,
      },
      isLoading: false,
      error: null,
    });

    const schemaError = new Error(
      "user.custom:teamId: Attribute does not exist in the schema."
    );
    schemaError.name = "InvalidParameterException";

    mockUpdateUserAttributes.mockRejectedValueOnce(schemaError);

    await expect(
      useAuthStore.getState().setTeam("team-a")
    ).rejects.toThrow("Attribute does not exist in the schema");

    const state = useAuthStore.getState();
    expect(state.user?.teamId).toBe(originalTeamId);
  });
});
