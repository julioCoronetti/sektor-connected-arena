# Corrigir Fluxo Auth Cognito — Bugfix Design

## Overview

O fluxo de autenticação do app Expo (Sektor Connected Arena) apresenta quatro bugs
distintos que impedem o usuário de completar o caminho cold start → `/login` →
`/select-team` → `/community`.

**C1 — Spinner-forever:** `initialize()` pode ser chamado múltiplas vezes em
rápida sucessão (re-renders do `_layout.tsx`), fazendo com que um `set({ isLoading: true })`
posterior sobrescreva o `set({ isLoading: false })` do `finally` de uma chamada
anterior. O fix é adicionar um guard `useRef` em `_layout.tsx` para garantir que
`initialize()` seja chamado exatamente uma vez.

**C2/C3 — HTTP 400 no `setTeam`:** O User Pool `us-east-1_cHokaMBWW` foi
provisionado sem o atributo customizado `custom:teamId`. O fix é adicionar o
atributo via AWS CLI e garantir que o App Client tenha permissão de leitura/escrita
sobre ele.

**C4 — Warning `pointerEvents` deprecado:** Nenhum código do app usa `pointerEvents`
como prop; a origem é uma dependência de terceiros. O fix é identificar a dependência
via stack trace e suprimir com `LogBox.ignoreLogs` documentado, ou fazer upgrade.

A estratégia geral é: fix mínimo e cirúrgico em cada ponto, sem refatorar código
que não está quebrado, preservando todos os fluxos existentes (signIn, signUp,
signOut, etc.).

---

## Glossary

- **Bug_Condition (C)**: Condição que identifica entradas que disparam o bug —
  `C(X)` retorna `true` quando `X` é uma entrada defeituosa.
- **Property (P)**: Comportamento correto esperado para entradas onde `C(X)` é
  verdadeiro — o que o sistema fixado `F'` deve produzir.
- **Preservation**: Comportamento existente que não pode regredir — para todo `X`
  onde `¬C(X)`, `F(X) = F'(X)`.
- **F**: O sistema antes do fix (código atual em `_layout.tsx`, `authStore.ts`,
  `auth.ts` e schema do User Pool).
- **F'**: O sistema após aplicar o fix completo de C1–C4.
- **`initialize()`**: Função assíncrona em `src/store/authStore.ts` que chama
  `loadCurrentUser()` (que por sua vez chama `getCurrentUser()` +
  `fetchUserAttributes()`), define `user` no store e libera `isLoading`.
- **`loadCurrentUser()`**: Helper em `authStore.ts` que compõe `getCurrentUser()`
  e `fetchUserAttributes()` para montar o objeto `User`.
- **`setTeam(teamId)`**: Ação do `authStore` que chama `updateUserAttributes` com
  `{ 'custom:teamId': teamId }` e atualiza `user.teamId` no estado.
- **`AppBootContext`**: Contexto de boot do app — `{ hasValidSession: boolean,
  getCurrentUserResult: 'success' | 'reject' }`.
- **`custom:teamId`**: Atributo customizado do Cognito User Pool que armazena o
  time do usuário (`team-a` ou `team-b`). Prefixo `custom:` é adicionado
  automaticamente pelo Cognito; no CLI o `Name` é `teamId`.
- **User Pool**: `us-east-1_cHokaMBWW` (conta `482712210181`, região `us-east-1`).
- **App Client ID**: `68i7il8tnlbc92r8hobs5op7t`.

---

## Bug Details

### C1 — Spinner-forever no cold start

O bug manifesta quando o app é aberto sem sessão Cognito válida. O `_layout.tsx`
seleciona `initialize` do store via `useAuthStore((s) => s.initialize)` e o
coloca no array de dependências do `useEffect`. Em Zustand v5 as actions são
referências estáveis, então o `useEffect` não re-dispara por causa da referência.
Porém, se o componente re-renderizar por qualquer outro motivo (ex.: mudança de
`segments` ou `router`) antes de `initialize()` completar, e se o React StrictMode
estiver ativo (que chama effects duas vezes em dev), `initialize()` é chamado uma
segunda vez. A segunda chamada executa `set({ isLoading: true })` imediatamente,
sobrescrevendo o `set({ isLoading: false })` que o `finally` da primeira chamada
acabou de executar. O resultado é que `isLoading` fica preso em `true`.

**Formal Specification:**

```
FUNCTION isBugCondition_C1(X)
  INPUT: X of type AppBootContext
    // X = { hasValidSession: boolean, getCurrentUserResult: 'success' | 'reject',
    //        initializeCallCount: number }
  OUTPUT: boolean

  RETURN X.hasValidSession = false
         AND X.getCurrentUserResult = 'reject'
         AND X.initializeCallCount > 1
         // OU: React StrictMode ativo (dev) → initializeCallCount = 2
END FUNCTION
```

**Exemplos concretos:**

- **Counterexample primário:** Abrir o app em device limpo (sem sessão). O spinner
  permanece indefinidamente; `/login` nunca aparece.
- **Counterexample StrictMode (dev):** Em desenvolvimento com Expo, o React
  StrictMode chama o `useEffect` duas vezes. A segunda chamada de `initialize()`
  seta `isLoading: true` após o `finally` da primeira já ter setado `isLoading: false`.
- **Caso limite:** Mesmo com sessão válida, se `initialize()` for chamado duas
  vezes em rápida sucessão, a segunda chamada pode sobrescrever o estado correto
  da primeira.

---

### C2 — `setTeam` retorna HTTP 400

O bug manifesta quando um usuário autenticado tenta selecionar um time. O
`authStore.setTeam()` chama `updateUserAttributes({ userAttributes: { 'custom:teamId': teamId } })`,
mas o User Pool `us-east-1_cHokaMBWW` não tem o atributo `custom:teamId` no
schema, então o Cognito IDP rejeita com HTTP 400.

**Formal Specification:**

```
FUNCTION isBugCondition_C2(X)
  INPUT: X of type SetTeamCall
    // X = { teamId: string, userPoolHasCustomTeamId: boolean }
  OUTPUT: boolean

  RETURN X.userPoolHasCustomTeamId = false
END FUNCTION
```

**Exemplos concretos:**

- **Counterexample:** Após login válido, tocar em "Time A" → console mostra
  `HTTP 400` com mensagem
  `user.custom:teamId: Attribute does not exist in the schema.`
- **Efeito colateral:** `user.teamId` permanece `undefined`, o gate
  `!user.teamId` em `_layout.tsx` redireciona de volta para `/select-team`
  em loop.

---

### C3 — Schema do User Pool sem `custom:teamId`

Causa raiz do C2. O User Pool foi provisionado sem o atributo customizado.

**Formal Specification:**

```
FUNCTION isBugCondition_C3(X)
  INPUT: X of type CognitoUserPoolSchema
    // X = { userPoolId: string, schemaAttributes: SchemaAttribute[] }
  OUTPUT: boolean

  RETURN X.userPoolId = 'us-east-1_cHokaMBWW'
         AND NOT EXISTS attr IN X.schemaAttributes
             WHERE attr.Name = 'custom:teamId'
                   AND attr.AttributeDataType = 'String'
                   AND attr.Mutable = true
END FUNCTION
```

**Exemplos concretos:**

- **Counterexample:** `aws cognito-idp describe-user-pool --user-pool-id us-east-1_cHokaMBWW --query 'UserPool.SchemaAttributes[?Name==\`custom:teamId\`]'`
  retorna `[]` (lista vazia).
- **Impacto downstream:** O Lambda `lambdas/createPost/index.js` lê
  `claims["custom:teamId"]` do JWT — sem o atributo no schema, o token nunca
  carrega esse claim, quebrando a lógica de autorização do Lambda.

---

### C4 — Warning `props.pointerEvents is deprecated`

O bug manifesta durante a montagem de qualquer tela do fluxo de autenticação.
Nenhum arquivo do app usa `pointerEvents` como prop (grep confirmado), portanto
a origem é uma dependência de terceiros.

**Formal Specification:**

```
FUNCTION isBugCondition_C4(X)
  INPUT: X of type RuntimeWarningCapture
    // X = { route: string, warnings: string[] }
  OUTPUT: boolean

  RETURN X.route IN { '/', '/login', '/register', '/select-team' }
         AND ANY w IN X.warnings
             WHERE w CONTAINS 'props.pointerEvents is deprecated'
END FUNCTION
```

**Exemplos concretos:**

- **Counterexample:** Abrir Metro logs ou DevTools durante qualquer tela do flow
  auth → linha `props.pointerEvents is deprecated. Use style.pointerEvents`
  aparece no console.
- **Candidatos prováveis:** `react-native-reanimated ~4.1.1`,
  `@react-navigation/elements ^2.6.3`, ou `expo-router ~6.0.23` (que encapsula
  react-navigation).

---

## Expected Behavior

### Preservation Requirements

**Comportamentos que NÃO podem mudar após o fix:**

- `signIn`, `signUp`, `confirmSignUp`, `signOut`, `resendSignUpCode` em
  `src/services/auth.ts` devem continuar funcionando com as mesmas assinaturas
  e efeitos colaterais.
- Cold start com sessão Cognito válida deve continuar populando `user` no store,
  setando `isLoading=false` e navegando para `/community` (ou `/select-team` se
  `custom:teamId` ainda não estiver definido).
- O gate de navegação em `_layout.tsx` (`!user → /login`, `!user.teamId → /select-team`,
  `user.teamId → /community`) deve continuar funcionando exatamente como hoje.
- `Amplify.configure` deve continuar usando `EXPO_PUBLIC_COGNITO_USER_POOL_ID` e
  `EXPO_PUBLIC_COGNITO_CLIENT_ID` de `.env.local` (sem hardcode).
- Os Lambdas (`createPost`, `createComment`, etc.) devem continuar recebendo
  `claims["custom:teamId"]` no mesmo formato string (`team-a` / `team-b`).
- Telas fora do fluxo de auth (Arena, Comunidade, Simulador) não podem ter
  regressões visuais ou de navegação.
- Atributos existentes no schema do User Pool não podem ser removidos ou
  modificados pela adição de `custom:teamId`.

**Escopo do fix:**

Todas as entradas que NÃO disparam C1–C4 devem ser completamente inalteradas.
Isso inclui:
- Qualquer chamada a `initialize()` quando já existe sessão válida.
- Qualquer chamada a `setTeam()` após o schema do User Pool ser corrigido.
- Qualquer renderização de tela que não use `pointerEvents` como prop.
- Todos os fluxos de credenciais (`signIn`, `signUp`, `signOut`).

---

## Hypothesized Root Cause

### C1 — Spinner-forever

1. **Múltiplas chamadas a `initialize()`**: O `useEffect` em `_layout.tsx` pode
   disparar mais de uma vez (React StrictMode em dev chama effects duas vezes;
   re-renders por mudança de `segments` ou `router` podem re-disparar se a
   referência de `initialize` não for estável). Cada chamada executa
   `set({ isLoading: true })` no início, sobrescrevendo o `isLoading: false` do
   `finally` de uma chamada anterior.

2. **Ausência de guard de idempotência**: `initialize()` não verifica se já está
   em execução antes de setar `isLoading: true`. Um guard simples (`if (get().isLoading && alreadyRunning) return`) resolveria, mas a abordagem escolhida
   é um `useRef` no componente para garantir chamada única.

3. **React StrictMode (dev)**: Em desenvolvimento, o Expo/React StrictMode monta
   e desmonta componentes duas vezes, disparando o `useEffect` duas vezes mesmo
   com dependências estáveis.

4. **Possível race condition com timeout**: O `Promise.race` com timeout de 8s
   rejeita após 8s, mas o `finally` ainda executa `set({ isLoading: false })`.
   Se uma segunda chamada a `initialize()` ocorrer entre o timeout e o `finally`,
   o `isLoading: true` da segunda chamada pode sobrescrever o `isLoading: false`
   do `finally` da primeira.

### C2/C3 — HTTP 400 / Schema ausente

1. **User Pool provisionado sem atributo customizado**: O User Pool
   `us-east-1_cHokaMBWW` foi criado sem incluir `custom:teamId` no schema.
   Atributos customizados do Cognito devem ser declarados explicitamente no
   schema do User Pool; não são criados automaticamente ao tentar escrevê-los.

2. **App Client sem permissão de escrita**: Mesmo após adicionar o atributo ao
   schema, o App Client `68i7il8tnlbc92r8hobs5op7t` pode não ter
   `custom:teamId` na lista de `writeAttributes`, impedindo que usuários
   autenticados via esse client escrevam o atributo.

3. **Código do Lambda já dependente do atributo**: `lambdas/createPost/index.js`
   lê `claims["custom:teamId"]`, indicando que o atributo foi planejado mas
   nunca provisionado na infra.

### C4 — Warning `pointerEvents`

1. **Dependência de terceiros usando API deprecada**: `react-native-reanimated`,
   `@react-navigation/elements` ou `expo-router` passam `pointerEvents` como
   prop para componentes React Native em vez de usar `style.pointerEvents`.

2. **Ausência de supressão documentada**: O warning polui o console sem
   rastreamento, dificultando a identificação de warnings reais do app.

---

## Correctness Properties

Property 1: Bug Condition — Initialize Libera o Spinner

_For any_ `AppBootContext` onde `isBugCondition_C1(X)` retorna `true`
(i.e., `hasValidSession = false` e `getCurrentUserResult = 'reject'`), a função
`initialize()` fixada SHALL completar sua execução com `isLoading = false`,
`user = null`, e tempo total de execução ≤ 10 000 ms, independentemente de
quantas vezes `initialize()` seja chamado concorrentemente.

**Validates: Requirements 2.1**

---

Property 2: Preservation — Sessão Válida Mantém Comportamento

_For any_ `AppBootContext` onde `isBugCondition_C1(X)` retorna `false`
(i.e., `hasValidSession = true` e `getCurrentUserResult = 'success'`), a função
`initialize()` fixada SHALL produzir o mesmo resultado que a função original:
`isLoading = false`, `user` populado com os atributos Cognito corretos
(incluindo `custom:teamId` se presente), preservando o comportamento de
navegação existente.

**Validates: Requirements 3.1, 3.2, 3.6**

---

Property 3: Bug Condition — `setTeam` Persiste o Time

_For any_ `SetTeamCall` onde `isBugCondition_C2(X)` retorna `false` após o fix
do C3 (i.e., `userPoolHasCustomTeamId = true`), a função `setTeam(teamId)` fixada
SHALL chamar `updateUserAttributes` sem lançar exceção, e o estado do store SHALL
refletir `user.teamId === teamId` após a chamada.

**Validates: Requirements 2.2, 2.3**

---

Property 4: Preservation — Outros Métodos do AuthStore Inalterados

_For any_ chamada a `signIn`, `signUp`, `confirmSignUp`, `signOut` ou
`resendSignUpCode` com inputs válidos, o sistema fixado SHALL produzir
exatamente o mesmo resultado que o sistema original, preservando assinaturas,
efeitos colaterais e shapes de retorno.

**Validates: Requirements 3.3, 3.4**

---

## Fix Implementation

### C1 — Guard de chamada única em `_layout.tsx`

**Arquivo:** `src/app/_layout.tsx`

**Mudanças específicas:**

1. **Importar `useRef`** do React.
2. **Adicionar `const initializedRef = useRef(false)`** dentro do componente
   `RootLayout`.
3. **Modificar o `useEffect` de `initialize`** para verificar o ref antes de
   chamar:
   ```tsx
   useEffect(() => {
     if (initializedRef.current) return;
     initializedRef.current = true;
     console.log("[layout] calling initialize (once)");
     initialize();
   }, [initialize]);
   ```
4. **Não alterar** `authStore.ts` — o guard fica no componente, zero mudanças
   no store.

**Justificativa da abordagem:** `useRef` é a solução mais simples e com menor
diff. Não requer mudanças no store, não introduz estado reativo extra, e é
idiomático para "executar efeito exatamente uma vez" em React.

---

### C2/C3 — Adicionar `custom:teamId` ao schema do User Pool

**Recurso AWS:** Cognito User Pool `us-east-1_cHokaMBWW`

**Passo 1 — Adicionar atributo ao schema:**
```bash
aws cognito-idp add-custom-attributes \
  --user-pool-id us-east-1_cHokaMBWW \
  --custom-attributes '[{
    "Name": "teamId",
    "AttributeDataType": "String",
    "Mutable": true,
    "Required": false
  }]'
```
> Nota: O `Name` no CLI é `teamId` (sem prefixo); o Cognito adiciona `custom:`
> automaticamente, resultando em `custom:teamId` no schema e nos tokens JWT.

**Passo 2 — Atualizar App Client para permitir leitura/escrita:**
```bash
# Descobrir atributos atuais do client
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_cHokaMBWW \
  --client-id 68i7il8tnlbc92r8hobs5op7t \
  --query 'UserPoolClient.[ReadAttributes,WriteAttributes]'

# Atualizar incluindo custom:teamId (adicionar aos arrays existentes)
aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_cHokaMBWW \
  --client-id 68i7il8tnlbc92r8hobs5op7t \
  --read-attributes <atributos_existentes> custom:teamId \
  --write-attributes <atributos_existentes> custom:teamId
```

**Passo 3 — Verificar:**
```bash
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_cHokaMBWW \
  --query 'UserPool.SchemaAttributes[?Name==`custom:teamId`]'
# Deve retornar: [{ "Name": "custom:teamId", "AttributeDataType": "String", "Mutable": true, ... }]
```

**Nenhuma mudança de código** é necessária em `authStore.ts` ou `auth.ts` —
o código já usa `'custom:teamId'` corretamente; o problema era puramente de infra.

---

### C4 — Suprimir warning de dependência com documentação

**Arquivo:** `src/app/_layout.tsx`

**Mudanças específicas:**

1. **Importar `LogBox`** do `react-native`.
2. **Adicionar supressão antes do componente** (ou em um `useEffect` de setup):
   ```tsx
   import { LogBox } from "react-native";

   // Suprime warning de prop deprecada originado por dependência de terceiros.
   // Candidatos: react-native-reanimated ~4.1.1, @react-navigation/elements ^2.6.3,
   // expo-router ~6.0.23. Remover quando a dependência for atualizada.
   LogBox.ignoreLogs(["props.pointerEvents is deprecated"]);
   ```
3. **Criar `docs/warnings-suprimidos.md`** documentando a origem identificada,
   a versão da dependência, e a estratégia adotada (supressão vs. upgrade).

**Alternativa (se upgrade resolver):** Atualizar a dependência causadora para
uma versão que use `style.pointerEvents`. Verificar com `npx expo install
--fix` se há versão compatível com o SDK atual.

---

## Testing Strategy

### Validation Approach

A estratégia segue duas fases:

1. **Exploratory (pré-fix):** Escrever testes que demonstram o bug no código
   atual. Esses testes devem FALHAR no código não-fixado, confirmando a causa
   raiz.
2. **Fix + Preservation Checking (pós-fix):** Verificar que o fix resolve o bug
   (Property 1 e 3) e que o comportamento existente é preservado (Property 2 e 4).

---

### Exploratory Bug Condition Checking

**Objetivo:** Surfaçar counterexamples que demonstram os bugs ANTES do fix.
Confirmar ou refutar a análise de causa raiz.

**Plano de teste:** Escrever testes em `src/store/__tests__/authStore.test.ts`
que mockam `getCurrentUser` rejeitando e chamam `initialize()` duas vezes em
rápida sucessão. Executar no código não-fixado para observar `isLoading` preso
em `true`.

**Casos de teste exploratórios:**

1. **C1 — Double-call spinner:** Chamar `initialize()` duas vezes sem await na
   primeira — verificar que `isLoading` fica `true` após ambas completarem
   (demonstra o bug no código não-fixado).
2. **C2 — setTeam com mock de 400:** Mockar `updateUserAttributes` rejeitando
   com `{ message: 'user.custom:teamId: Attribute does not exist in the schema.' }`
   — verificar que o erro é propagado e `user.teamId` permanece `undefined`.
3. **C3 — Schema check script:** Executar `scripts/check-cognito-schema.ts`
   contra o User Pool real — deve retornar exit code ≠ 0 (schema ausente).
4. **C4 — Warning spy:** Spy em `console.warn` durante renderização do flow auth
   — deve capturar o warning `props.pointerEvents is deprecated`.

**Counterexamples esperados:**

- `isLoading` permanece `true` após double-call de `initialize()` com mock de
  rejeição.
- `updateUserAttributes` lança erro com mensagem de schema ausente.
- Script de infra retorna lista vazia para `custom:teamId`.

---

### Fix Checking

**Objetivo:** Verificar que para todas as entradas onde a condição de bug se
aplica, o sistema fixado produz o comportamento correto.

**Pseudocódigo:**

```
// C1 Fix Check
FOR ALL X WHERE isBugCondition_C1(X) DO
  result := authStore.initialize_fixed(X)
  ASSERT result.isLoading = false
         AND result.user = null
         AND elapsed(initialize_fixed) <= 10_000
END FOR

// C2/C3 Fix Check
FOR ALL X WHERE isBugCondition_C2(X) = false  // após fix do C3
  AND X.teamId IN { 'team-a', 'team-b' } DO
  result := authStore.setTeam_fixed(X.teamId)
  ASSERT result.user.teamId = X.teamId
         AND no exception thrown
END FOR
```

---

### Preservation Checking

**Objetivo:** Verificar que para todas as entradas onde a condição de bug NÃO
se aplica, o sistema fixado produz o mesmo resultado que o original.

**Pseudocódigo:**

```
// C1 Preservation
FOR ALL X WHERE NOT isBugCondition_C1(X) DO
  ASSERT authStore.initialize(X) = authStore.initialize_fixed(X)
  // user populado, isLoading=false, teamId preservado
END FOR

// C2/C3 Preservation
FOR ALL X WHERE NOT isBugCondition_C2(X) DO
  ASSERT authStore.setTeam(X) = authStore.setTeam_fixed(X)
  // outros métodos (signIn, signOut, etc.) inalterados
END FOR
```

**Por que property-based testing para preservation:** O PBT gera automaticamente
muitos cenários de input (diferentes combinações de `user`, `teamId`, estado do
store) e verifica que o comportamento é idêntico antes e depois do fix. Isso
captura edge cases que testes manuais podem perder.

**Plano de preservation:**

1. **Sessão válida com `custom:teamId`:** Mock de `getCurrentUser` e
   `fetchUserAttributes` resolvendo com dados completos — verificar que
   `user.teamId` é populado corretamente após o fix do guard.
2. **Sessão válida sem `custom:teamId`:** Mock retornando sem o atributo —
   verificar que `user.teamId` é `""` (comportamento atual preservado).
3. **`signIn` / `signOut` inalterados:** Verificar que esses métodos continuam
   com o mesmo shape de retorno e efeitos colaterais.

---

### Unit Tests

Arquivo: `src/store/__tests__/authStore.test.ts`
Padrão: Jest + Zustand (sem RTL, igual a `arenaStore.test.ts`)

- **V1:** `initialize()` com mock de `getCurrentUser` rejeitando → `isLoading=false`,
  `user=null`, tempo ≤ 10 000 ms.
- **V1b:** `initialize()` chamado duas vezes em rápida sucessão (simulando
  double-call) → `isLoading=false` ao final (verifica o guard).
- **V2:** `setTeam('team-a')` com mock de `updateUserAttributes` resolvendo →
  `user.teamId === 'team-a'`, sem exceção.
- **V2b:** `setTeam('team-a')` com mock de `updateUserAttributes` rejeitando →
  exceção propagada, `user.teamId` inalterado.
- **V6a:** `login()` com mock de `signIn` resolvendo → `user` populado,
  `isLoading=false`.
- **V6b:** `logout()` → `user=null`, `isLoading=false`.

---

### Property-Based Tests

- **PBT-P1:** Para qualquer `AppBootContext` com `hasValidSession=false`,
  `initialize()` sempre termina com `isLoading=false` e `user=null` dentro do
  limite de tempo (gera múltiplos cenários de rejeição do Cognito).
- **PBT-P2:** Para qualquer `AppBootContext` com `hasValidSession=true`,
  `initialize()` sempre termina com `isLoading=false` e `user` não-nulo
  (gera múltiplos cenários de atributos Cognito válidos).
- **PBT-P4:** Para qualquer sequência de chamadas a `signIn`/`signOut` com
  inputs válidos, o shape de retorno é sempre o mesmo antes e depois do fix
  (verifica preservation dos fluxos de credenciais).

---

### Integration Tests

- **V3:** Script `scripts/check-cognito-schema.ts` — chama
  `aws cognito-idp describe-user-pool` e verifica que `custom:teamId` existe
  com `AttributeDataType=String` e `Mutable=true`. Exit code 0 quando válido.
- **V4:** Smoke manual documentado em `docs/smoke-auth-flow.md`:
  cold start → `/login` (≤10s) → login com credenciais de teste → `/select-team`
  → tap "Time A" → `/community` (sem HTTP 400).
- **V5:** Spy de `console.warn` durante renderização do flow auth — nenhuma
  ocorrência de `props.pointerEvents is deprecated` originada de código do app,
  ou origem documentada em `docs/warnings-suprimidos.md`.
