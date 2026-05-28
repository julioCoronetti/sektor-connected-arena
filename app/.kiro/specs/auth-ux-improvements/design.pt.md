# Design Document — auth-ux-improvements

## Overview

Esta feature melhora a experiência de autenticação do Sektor Connected Arena em três frentes:

1. **Fallback de re-cadastro**: detectar `UsernameExistsException` durante o `signUp`, reenviar o código automaticamente via `resendSignUpCode` e navegar para a tela de confirmação sem exibir erro confuso.
2. **Mensagens amigáveis**: introduzir um `Error_Mapper` puro que converte códigos de erro do Cognito em strings em português, substituindo a função `errorMessage` atual em todo o `authStore`.
3. **Tela de confirmação**: nova tela `confirm.tsx` com campo de 6 dígitos, botão "Confirmar" e botão "Reenviar código", integrada ao fluxo normal de cadastro e ao fallback.

O escopo é exclusivamente frontend. Nenhuma Lambda, DynamoDB ou recurso AWS é alterado.

### Contexto tecnológico

- **React Native / Expo Router** (file-based routing em `src/app/(auth)/`)
- **AWS Amplify v6** com Cognito User Pool
- **Zustand v5** para estado global de autenticação
- **Jest + jest-expo** para testes unitários e de propriedade

---

## Architecture

O diagrama abaixo mostra o fluxo de dados entre as camadas após a feature:

```mermaid
flowchart TD
    subgraph UI ["Camada UI (src/app/(auth)/)"]
        R[register.tsx]
        C[confirm.tsx]
        L[login.tsx]
    end

    subgraph Store ["Auth_Store (authStore.ts)"]
        REG[register()]
        CONF[confirmSignUp()]
        RESEND[resendCode()]
        LOGIN[login()]
    end

    subgraph Services ["Auth_Service (services/auth.ts)"]
        AMP[Amplify v6 / Cognito]
    end

    subgraph Utils ["src/utils/"]
        EM[cognitoErrorMapper.ts]
    end

    R -->|"submit(name, email, pw)"| REG
    REG -->|"signUp()"| AMP
    AMP -->|"isSignUpComplete=false"| REG
    REG -->|"navigate /confirm?email=..."| C
    AMP -->|"UsernameExistsException"| REG
    REG -->|"resendSignUpCode()"| AMP
    AMP -->|"ok"| REG
    REG -->|"navigate /confirm?email=..."| C

    C -->|"submit(code)"| CONF
    CONF -->|"confirmSignUp()"| AMP
    AMP -->|"ok"| CONF
    CONF -->|"navigate /select-team"| C

    C -->|"resend"| RESEND
    RESEND -->|"resendSignUpCode()"| AMP

    L -->|"submit(email, pw)"| LOGIN
    LOGIN -->|"signIn()"| AMP

    Store -->|"catch(e)"| EM
    EM -->|"string PT-BR"| Store
```

### Decisões de design

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Navegação disparada pelo `authStore` via callback | Navegação direta na UI | Mantém a lógica de fluxo centralizada; a UI só reage ao estado |
| `cognitoErrorMapper` como função pura em `src/utils/` | Inline no store | Testabilidade isolada; reutilizável em outros stores futuros |
| `resendCode` e `confirmSignUp` como ações do store | Chamadas diretas na tela | Consistência com o padrão existente; `isLoading`/`error` gerenciados centralmente |
| Parâmetro `email` via query string de rota (`/confirm?email=...`) | Estado global no store | Evita estado "pendente" no store; a rota é a fonte de verdade para a tela de confirmação |

---

## Components and Interfaces

### 1. `src/utils/cognitoErrorMapper.ts` (novo)

```typescript
export function mapCognitoError(e: unknown): string
```

- Recebe qualquer valor (`unknown`).
- Lê `(e as { name?: string }).name` para identificar o `Cognito_Error_Code`.
- Retorna a string mapeada ou o fallback `"Ocorreu um erro inesperado. Tente novamente."`.
- **Função pura** — sem efeitos colaterais, sem imports de módulos externos.

### 2. `src/services/auth.ts` (modificado)

Adicionar dois re-exports do `aws-amplify/auth`:

```typescript
export { confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
```

Nenhuma outra alteração na configuração do Amplify.

### 3. `src/store/authStore.ts` (modificado)

#### Interface pública estendida

```typescript
export interface AuthState {
  // campos existentes (sem alteração de assinatura)
  user: User | null;
  isLoading: boolean;
  error: string | null;
  _initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  setTeam: (teamId: string) => Promise<void>;
  logout: () => Promise<void>;

  // novas ações
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;

  // callback de navegação injetado pelo _layout
  _onNavigate: ((path: string) => void) | null;
  _setNavigate: (fn: (path: string) => void) => void;
}
```

#### Estratégia de navegação

O store não pode importar `useRouter` (hook React). A solução é injetar um callback de navegação via `_setNavigate`, chamado pelo `_layout.tsx` da rota `(auth)` no `useEffect` de montagem:

```typescript
// src/app/(auth)/_layout.tsx
const router = useRouter();
useEffect(() => {
  useAuthStore.getState()._setNavigate((path) => router.replace(path as never));
}, [router]);
```

Isso mantém o store desacoplado do React Router e testável sem mocks de navegação.

#### Fluxo `register` refatorado (pseudocódigo)

```
register(name, email, password):
  set isLoading=true, error=null
  try:
    result = await signUp(email, password, {name})
    if result.isSignUpComplete:
      signInResult = await signIn(email, password)
      if signInResult.isSignedIn:
        user = await loadCurrentUser()
        set user=user
        navigate("/select-team")
      else:
        set error=mapCognitoError(...)
    else:
      // confirmação necessária → fluxo normal
      navigate("/confirm?email=" + encodeURIComponent(email))
  catch UsernameExistsException:
    // fallback: usuário não verificado
    try:
      await resendSignUpCode(email)
      set error=null
      navigate("/confirm?email=" + encodeURIComponent(email))
    catch e2:
      set error=mapCognitoError(e2)
  catch e:
    set error=mapCognitoError(e)
  finally:
    set isLoading=false
```

#### Ação `confirmSignUp`

```
confirmSignUp(email, code):
  set isLoading=true, error=null
  try:
    await confirmSignUp(email, code)
    navigate("/select-team")
  catch e:
    set error=mapCognitoError(e)
  finally:
    set isLoading=false
```

#### Ação `resendCode`

```
resendCode(email):
  set isLoading=true, error=null
  try:
    await resendSignUpCode(email)
    set error="Código reenviado para seu e-mail."   // mensagem de sucesso
  catch e:
    set error=mapCognitoError(e)
  finally:
    set isLoading=false
```

> **Nota**: `error` é reutilizado para mensagens de sucesso de reenvio. A UI distingue pelo prefixo ou por um campo `message` separado se necessário — ver seção de Data Models.

### 4. `src/app/(auth)/confirm.tsx` (novo)

Props recebidas via `useLocalSearchParams`: `{ email: string }`.

Elementos obrigatórios:
- `TextInput` numérico, `maxLength={6}`, `testID="confirm-code-input"`
- Botão "Confirmar", `testID="confirm-submit"`, desabilitado se `code.length < 6 || isLoading`
- Botão "Reenviar código", `testID="confirm-resend"`, desabilitado se `isLoading`
- `ActivityIndicator` visível quando `isLoading`
- `Text` de erro/sucesso com `testID="confirm-message"`

### 5. `src/app/(auth)/register.tsx` (modificado)

- Remover a lógica de navegação pós-`register` do `handleSubmit` (a navegação passa a ser responsabilidade do store).
- O componente apenas chama `register(name, email, password)` e exibe `error` se presente.

---

## Data Models

### `AuthState` — campos adicionados

```typescript
// Callback de navegação imperativa (injetado pelo layout, não persistido)
_onNavigate: ((path: string) => void) | null;
_setNavigate: (fn: (path: string) => void) => void;

// Novas ações
confirmSignUp: (email: string, code: string) => Promise<void>;
resendCode: (email: string) => Promise<void>;
```

Os campos `user`, `isLoading`, `error` e `_initialized` permanecem sem alteração de tipo.

### Parâmetros de rota — `/confirm`

```typescript
// Lido via useLocalSearchParams() na Confirm_Screen
type ConfirmParams = {
  email: string; // e-mail URL-encoded
};
```

### Mapeamento de erros — tabela completa

```typescript
const ERROR_MAP: Record<string, string> = {
  NotAuthorizedException:       "E-mail ou senha incorretos.",
  UserNotFoundException:        "Usuário não encontrado.",
  UsernameExistsException:      "Este e-mail já está cadastrado.",
  InvalidPasswordException:     "A senha não atende aos requisitos mínimos.",
  InvalidParameterException:    "Dados inválidos. Verifique os campos e tente novamente.",
  CodeMismatchException:        "Código incorreto. Verifique e tente novamente.",
  ExpiredCodeException:         "Código expirado. Solicite um novo código.",
  LimitExceededException:       "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  TooManyRequestsException:     "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  NetworkError:                 "Sem conexão com a internet. Verifique sua rede.",
  UserNotConfirmedException:    "Confirme seu e-mail antes de entrar.",
  PasswordResetRequiredException: "É necessário redefinir sua senha. Verifique seu e-mail.",
};

const FALLBACK = "Ocorreu um erro inesperado. Tente novamente.";
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Mapeamento de código conhecido retorna mensagem PT-BR sem o código original

*Para qualquer* `Cognito_Error_Code` presente na tabela de mapeamento, `mapCognitoError` deve retornar exatamente a string em português correspondente, e essa string não deve conter o código original como substring.

> *Reflexão*: os critérios 2.1 e 2.5 são cobertos por esta única propriedade — 2.5 é uma asserção adicional (ausência do código) dentro do mesmo teste.

**Validates: Requirements 2.1, 2.5**

---

### Property 2: Entrada desconhecida ou inválida retorna fallback

*Para qualquer* valor que não seja um objeto com `name` correspondente a um código mapeado — incluindo `null`, `undefined`, objetos sem `name`, strings arbitrárias e erros com `name` desconhecido — `mapCognitoError` deve retornar `"Ocorreu um erro inesperado. Tente novamente."`.

> *Reflexão*: os critérios 2.2 e 2.3 são cobertos por esta propriedade; 2.3 é um edge case que o gerador de inputs deve incluir explicitamente.

**Validates: Requirements 2.2, 2.3**

---

### Property 3: `isLoading` é sempre `false` após qualquer operação do store

*Para qualquer* combinação de operação (`register`, `login`, `confirmSignUp`, `resendCode`) e resultado (sucesso ou falha com qualquer código de erro Cognito), o campo `isLoading` do store deve ser `false` ao final da operação.

> *Reflexão*: consolida os critérios 1.2, 1.3, 1.5, 3.7 e 4.3 — todos exigem `isLoading=false` ao término, independentemente do caminho percorrido.

**Validates: Requirements 1.2, 1.3, 1.5, 3.7, 4.3**

---

### Property 4: O store nunca armazena um código de erro Cognito em inglês no campo `error`

*Para qualquer* operação do store (`login`, `register`, `confirmSignUp`, `resendCode`) e qualquer código de erro Cognito lançado como exceção, o campo `error` resultante não deve conter o código original como substring — garantindo que apenas mensagens PT-BR cheguem à UI.

> *Reflexão*: consolida os critérios 2.4 e 5.2 — ambos exigem que o mapper seja usado em todas as operações. Property 4 é mais geral e subsume 5.2.

**Validates: Requirements 2.4, 5.2**

---

### Property 5: Fallback de re-cadastro bem-sucedido não exibe erro e navega para `/confirm`

*Para qualquer* e-mail que dispare `UsernameExistsException` no `signUp`, se `resendSignUpCode` for bem-sucedido, o campo `error` do store deve ser `null` e o callback de navegação deve ter sido chamado com um path contendo `/confirm`.

> *Reflexão*: consolida os critérios 1.1 e 1.2 em uma única propriedade composta que verifica tanto a ausência de erro quanto a navegação correta.

**Validates: Requirements 1.1, 1.2**

---

### Property 6: `confirmSignUp` bem-sucedido navega para `/select-team`

*Para qualquer* e-mail e código de verificação de 6 dígitos, quando `confirmSignUp` é concluído com sucesso, o callback de navegação deve ser chamado com `/select-team`.

**Validates: Requirements 3.8**

---

### Property 7: `register` com `isSignUpComplete=false` navega para `/confirm` sem erro

*Para qualquer* combinação de nome, e-mail e senha válidos, quando `signUp` retorna `isSignUpComplete=false`, o campo `error` deve ser `null` e o callback de navegação deve ser chamado com um path contendo `/confirm` e o e-mail como parâmetro.

**Validates: Requirements 4.1**

---

### Property 8: `initialize` é idempotente — executa no máximo uma vez por sessão

*Para qualquer* número N ≥ 2 de chamadas a `initialize()`, a função `loadCurrentUser` (ou equivalente) deve ser invocada exatamente uma vez — o guard `_initialized` deve impedir execuções subsequentes.

**Validates: Requirements 5.4**

---

## Error Handling

### Erros do Cognito

Todos os erros capturados em `catch` dentro do `authStore` passam pelo `mapCognitoError` antes de serem armazenados em `state.error`. Isso garante que nenhuma mensagem técnica em inglês chegue à UI.

### Timeout de cadastro (Requisito 4.3)

O `register` envolve a chamada `signUp` em um `Promise.race` com timeout de 10 segundos:

```typescript
await Promise.race([
  signUp(...),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("register timeout")), 10_000)
  ),
]);
```

O erro de timeout é capturado pelo `catch` genérico e mapeado para o fallback `"Ocorreu um erro inesperado. Tente novamente."`.

### Callback de navegação ausente

Se `_onNavigate` for `null` quando o store tentar navegar (ex.: store usado fora do contexto do layout de auth), a chamada é silenciosamente ignorada. Isso evita crashes em testes unitários onde o callback não é injetado.

### `UsernameExistsException` com usuário verificado

O Cognito lança `UsernameExistsException` tanto para usuários não verificados quanto para verificados. O store não consegue distinguir os dois casos antes de tentar `resendSignUpCode`. Se o usuário já estiver verificado, `resendSignUpCode` pode lançar um erro diferente (ex.: `InvalidParameterException`). Nesse caso, o store exibe a mensagem amigável correspondente — o Requisito 1.4 é satisfeito indiretamente, pois o usuário vê uma mensagem que o orienta a fazer login.

---

## Testing Strategy

### Abordagem dual

- **Testes unitários (Jest + jest-expo)**: cobrem exemplos concretos, casos de borda e integrações entre componentes.
- **Testes de propriedade (fast-check)**: verificam as propriedades universais do `cognitoErrorMapper` e do `authStore` com centenas de inputs gerados.

### Por que `fast-check`

O projeto usa Jest. A biblioteca [fast-check](https://fast-check.io/) integra nativamente com Jest sem configuração adicional, é a escolha padrão para PBT em TypeScript e não requer dependências nativas — adequada para o ambiente `jest-expo`.

### Configuração de propriedades

Cada teste de propriedade deve rodar com mínimo de **100 iterações** (`numRuns: 100`). Tag de referência no comentário do teste:

```
// Feature: auth-ux-improvements, Property N: <texto da propriedade>
```

### Cobertura por arquivo

#### `src/utils/cognitoErrorMapper.ts`

| Tipo | O que testa |
|---|---|
| Property (P1) | Todos os 12 códigos mapeados retornam a string PT-BR correta e sem o código original como substring |
| Property (P2) | Qualquer entrada não mapeada (incluindo `null`, `undefined`, objetos sem `name`) retorna o fallback |
| Unit | `null`, `undefined`, objeto sem `name`, string vazia — casos de borda explícitos |

#### `src/store/authStore.ts`

| Tipo | O que testa |
|---|---|
| Property (P3) | `isLoading=false` após qualquer operação com qualquer resultado |
| Property (P4) | `error` nunca contém código Cognito em inglês após qualquer operação |
| Property (P5) | Fallback de re-cadastro: `error=null` e navigate chamado com `/confirm` |
| Property (P6) | `confirmSignUp` bem-sucedido: navigate chamado com `/select-team` |
| Property (P7) | `register` com `isSignUpComplete=false`: navigate com `/confirm` e `error=null` |
| Property (P8) | `initialize` idempotente: `loadCurrentUser` chamado exatamente uma vez para N≥2 chamadas |
| Unit | Fluxo `register` → `UsernameExistsException` → `resendSignUpCode` falha → `error` preenchido |
| Unit | `confirmSignUp` falha `CodeMismatchException` → `error` = mensagem PT-BR |
| Unit | `resendCode` sucesso → `error` = mensagem de confirmação de reenvio |
| Unit | Timeout de 10s no `register` → `error` = fallback, `isLoading=false` |

#### `src/app/(auth)/confirm.tsx`

| Tipo | O que testa |
|---|---|
| Unit | Renderiza campo, botão Confirmar e botão Reenviar |
| Unit | Botão Confirmar desabilitado com menos de 6 dígitos |
| Unit | Exibe `ActivityIndicator` quando `isLoading=true` |
| Unit | Exibe mensagem de erro/sucesso quando `error` preenchido |

### Mocks necessários

```typescript
jest.mock("../services/auth", () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  confirmSignUp: jest.fn(),
  resendSignUpCode: jest.fn(),
  getCurrentUser: jest.fn(),
  fetchUserAttributes: jest.fn(),
  updateUserAttributes: jest.fn(),
}));
```

O callback `_onNavigate` é injetado diretamente no store antes de cada teste:

```typescript
beforeEach(() => {
  mockNavigate = jest.fn();
  useAuthStore.getState()._setNavigate(mockNavigate);
});
```
