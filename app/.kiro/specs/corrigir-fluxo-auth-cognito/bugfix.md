# Bugfix Requirements Document

## Introduction

O fluxo de autenticação do app Expo (Sektor Connected Arena) está quebrado em quatro
pontos observáveis durante o cold start e a seleção de time. O usuário não consegue
chegar à tela de login porque a aplicação fica presa no spinner inicial; mesmo após
desabilitar manualmente a etapa de validação que dispara o spinner, ao escolher um
time o cliente recebe HTTP 400 do endpoint `cognito-idp.us-east-1.amazonaws.com` com
a mensagem `user.custom:teamId: Attribute does not exist in the schema.`, o que
impede a persistência do time e o avanço para `/community`. Em paralelo, um warning
de depreciação (`props.pointerEvents is deprecated. Use style.pointerEvents`)
polui o console e precisa ser rastreado até sua origem (código do app vs. dependência).

Este documento captura formalmente as quatro condições de bug (C1–C4) usando a
metodologia de bug condition (`C(X)` / `P(result)` / `¬C(X)`) e estabelece
critérios de aceitação que precisam ser TODOS satisfeitos para o spec ser
considerado concluído. As validações cobrem testes unitários/integrados sobre o
`authStore`, uma checagem de infraestrutura sobre o schema do Cognito User Pool, e
um smoke manual do cold start até `/community`.

**Escopo afetado:**

- `src/app/_layout.tsx`, `src/app/index.tsx` (gating de navegação e spinner)
- `src/store/authStore.ts` (`initialize()`, `loadCurrentUser()`, `setTeam()`)
- `src/services/auth.ts` (`Amplify.configure`)
- AWS Cognito User Pool `us-east-1_cHokaMBWW` (schema `custom:teamId`)
- Pipeline de logs/warnings durante o fluxo de autenticação

**Critério de "pronto":** o spec só é considerado concluído quando TODOS os testes
de validação descritos na seção `Validation Tests` passarem (unit/integration +
infra check + smoke manual + warning check).

## Bug Analysis

### Current Behavior (Defect)

Comportamento defeituoso observado hoje, em cold start sem sessão Cognito válida e
ao tentar selecionar um time:

1.1 WHEN o app é aberto a frio sem sessão Cognito válida (`getCurrentUser` rejeita
com `NotAuthorizedException` ou `UserUnAuthenticatedException`) THEN o sistema
permanece renderizando o `ActivityIndicator` em `src/app/index.tsx`
indefinidamente, sem nunca navegar para `/login` (o gate
`isLoading || !user || !user.teamId` no `_layout.tsx` nunca libera porque a chain
de inicialização falha silenciosamente antes de `set({ isLoading: false })`).

1.2 WHEN o usuário toca em "Time A" ou "Time B" na tela de seleção de time THEN o
sistema chama
`updateUserAttributes({ userAttributes: { 'custom:teamId': teamId } })` e o
endpoint `https://cognito-idp.us-east-1.amazonaws.com/` responde
`HTTP 400 (Bad Request)`, o `setTeam` lança erro, `user.teamId` permanece
`undefined` e a navegação para `/community` não acontece.

1.3 WHEN o `updateUserAttributes` é executado contra o User Pool
`us-east-1_cHokaMBWW` THEN o serviço Cognito IDP retorna a mensagem
`user.custom:teamId: Attribute does not exist in the schema.` (causa raiz do 400
em 1.2), porque o User Pool foi provisionado SEM o atributo customizado
`custom:teamId`, embora o Lambda `lambdas/createPost/index.js` já leia
`claims["custom:teamId"]` e dependa dele.

1.4 WHEN o app monta o fluxo de autenticação (qualquer tela do path
`_layout` → `index` → `login` → `select-team`) THEN o console emite o warning
`props.pointerEvents is deprecated. Use style.pointerEvents` durante a renderização,
sem rastreamento documentado da origem (código do app vs. dependência).

### Expected Behavior (Correct)

Comportamento correto que o sistema DEVE apresentar após a correção. Cada cláusula
2.Y é o pareamento direto da cláusula 1.Y correspondente:

2.1 WHEN o app é aberto a frio sem sessão Cognito válida THEN o sistema SHALL
concluir `authStore.initialize()` em até 10 segundos (limite duro: timeout interno
de 8s + margem), definir `isLoading=false` e `user=null`, e navegar
automaticamente para `/login` sem permanecer no `ActivityIndicator`.

2.2 WHEN o usuário toca em "Time A" ou "Time B" na tela de seleção de time
(autenticado, com tokens Cognito válidos) THEN o sistema SHALL chamar
`updateUserAttributes` com sucesso (200 OK do endpoint Cognito IDP), persistir
`user.teamId` no estado do `authStore`, e navegar para `/community`.

2.3 WHEN qualquer chamada `updateUserAttributes` envia
`{ 'custom:teamId': <valor> }` para o User Pool `us-east-1_cHokaMBWW` THEN o User
Pool SHALL aceitar o atributo (porque o schema SHALL conter `custom:teamId` como
String, mutable, com `DeveloperOnlyAttribute=false`), retornando 200 OK.

2.4 WHEN o app monta o fluxo de autenticação THEN o sistema SHALL não emitir o
warning `props.pointerEvents is deprecated` originado de código do app; se o
warning for originado por dependência de terceiros, a origem SHALL estar
documentada (em `docs/` ou no próprio task) com a estratégia adotada (upgrade,
patch, ou supressão explícita via `LogBox.ignoreLogs`).

### Unchanged Behavior (Regression Prevention)

Comportamento existente que NÃO pode regredir após o fix. Preservation Checking:
para todo `X` onde `¬C(X)`, `F(X) = F'(X)`.

3.1 WHEN existe sessão Cognito válida em cold start (`getCurrentUser` resolve com
`username`, `userId` e `fetchUserAttributes` retorna atributos válidos incluindo
`custom:teamId`) THEN o sistema SHALL CONTINUE TO popular `user` no `authStore`,
definir `isLoading=false`, e navegar para `/community` (gating já existente em
`_layout.tsx`).

3.2 WHEN existe sessão Cognito válida MAS o usuário ainda não tem
`custom:teamId` definido em cold start THEN o sistema SHALL CONTINUE TO navegar
para `/select-team` (caminho já tratado pelo gate
`!user.teamId` em `_layout.tsx`).

3.3 WHEN o usuário executa `signIn`, `signUp`, `confirmSignUp`, `signOut` ou
`resendSignUpCode` (fluxos hoje funcionais expostos por `src/services/auth.ts`)
THEN esses métodos SHALL CONTINUE TO funcionar exatamente como hoje (mesmas
assinaturas, mesmos efeitos colaterais), pois a correção não pode quebrar fluxos
de credenciais que não envolvem `custom:teamId`.

3.4 WHEN o backend (`lambdas/createPost`, `lambdas/createComment`, etc.) consome
`claims["custom:teamId"]` THEN ele SHALL CONTINUE TO receber o mesmo formato de
claim (string, valores `team-a` / `team-b` ou similares já em uso), garantindo
que o ajuste de schema no User Pool não altere a forma como o token JWT entrega
o atributo aos Lambdas.

3.5 WHEN o app renderiza qualquer tela fora do fluxo de autenticação (Modo
Arena, Comunidade, Simulador) THEN ele SHALL CONTINUE TO funcionar sem
regressões visuais ou de navegação (a remoção/substituição da prop
`pointerEvents` deprecada não pode mudar layout ou interatividade existentes).

3.6 WHEN `Amplify.configure` é executado em `src/services/auth.ts` THEN ele SHALL
CONTINUE TO usar `EXPO_PUBLIC_COGNITO_USER_POOL_ID` e
`EXPO_PUBLIC_COGNITO_CLIENT_ID` lidos de `.env.local` (sem hardcode), e qualquer
ajuste de configuração feito como parte do fix do C1 não pode romper imports
existentes (`react-native-get-random-values`, `@aws-amplify/react-native`).

## Bug Conditions (Pseudocode)

A seguir, formalização das quatro condições de bug usadas para Fix Checking e
Preservation Checking. Cada `Cn(X)` identifica entradas que disparam o bug; a
propriedade `Pn(result)` define o comportamento correto esperado para essas
entradas.

### C1 — Spinner-forever no cold start

```pascal
FUNCTION isBugCondition_C1(X)
  INPUT: X of type AppBootContext
    // X = { hasValidSession: boolean, getCurrentUserResult: 'success' | 'reject' }
  OUTPUT: boolean

  // Bug dispara quando não há sessão válida no cold start
  RETURN X.hasValidSession = false
         AND X.getCurrentUserResult = 'reject'
END FUNCTION

// Property: Fix Checking — initialize() resolves bounded
FOR ALL X WHERE isBugCondition_C1(X) DO
  result ← authStore.initialize'(X)
  ASSERT result.isLoading = false
         AND result.user = null
         AND elapsed(initialize') <= 10_000  // ms
END FOR

// Property: Preservation Checking — sessão válida mantém comportamento
FOR ALL X WHERE NOT isBugCondition_C1(X) DO
  ASSERT authStore.initialize(X) = authStore.initialize'(X)
END FOR
```

### C2 — `setTeam` resulta em HTTP 400

```pascal
FUNCTION isBugCondition_C2(X)
  INPUT: X of type SetTeamCall
    // X = { teamId: 'team-a' | 'team-b', userPoolHasCustomTeamId: boolean }
  OUTPUT: boolean

  // Bug dispara quando o User Pool NÃO tem o schema custom:teamId
  RETURN X.userPoolHasCustomTeamId = false
END FUNCTION

// Property: Fix Checking — setTeam succeeds end-to-end
FOR ALL X WHERE isBugCondition_C2(X) DO
  // após o fix do C3, userPoolHasCustomTeamId = true
  result ← authStore.setTeam'(X.teamId)
  ASSERT result.httpStatus = 200
         AND authStore.user.teamId = X.teamId
END FOR

// Property: Preservation Checking — outros métodos do authStore inalterados
FOR ALL X WHERE NOT isBugCondition_C2(X) DO
  ASSERT authStore.setTeam(X) = authStore.setTeam'(X)
END FOR
```

### C3 — Schema do User Pool sem `custom:teamId`

```pascal
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

// Property: Fix Checking — schema contém custom:teamId
FOR ALL X WHERE isBugCondition_C3(X) DO
  schema' ← describeUserPool(X.userPoolId).Schema
  ASSERT EXISTS attr IN schema'
         WHERE attr.Name = 'custom:teamId'
               AND attr.AttributeDataType = 'String'
               AND attr.Mutable = true
END FOR

// Property: Preservation Checking — demais atributos do schema preservados
FOR ALL X WHERE NOT isBugCondition_C3(X) DO
  ASSERT schemaBefore(X) ⊆ schemaAfter(X)
  // adicionar custom:teamId é não-destrutivo: nenhum atributo existente é removido
END FOR
```

### C4 — Warning `pointerEvents is deprecated`

```pascal
FUNCTION isBugCondition_C4(X)
  INPUT: X of type RuntimeWarningCapture
    // X = { route: string, warnings: string[] }
  OUTPUT: boolean

  RETURN X.route IN { '/', '/login', '/register', '/select-team' }
         AND ANY w IN X.warnings
             WHERE w CONTAINS 'props.pointerEvents is deprecated'
END FUNCTION

// Property: Fix Checking — warning não emitido por código do app
FOR ALL X WHERE isBugCondition_C4(X) DO
  capture' ← runAuthFlowAndCaptureWarnings'(X.route)
  ASSERT (NOT ANY w IN capture'.warnings
              WHERE w CONTAINS 'props.pointerEvents is deprecated'
                    AND originatesFrom(w) = 'app-code')
         AND (originatesFrom(w) = 'dependency'
              IMPLIES isDocumented(w) = true)
END FOR
```

**Definições:**

- **F**: o `authStore` / `_layout` / config Cognito / fluxo de auth como existem
  hoje (antes do fix).
- **F'**: o sistema após aplicar o fix completo de C1–C4.
- **Counterexample C1:** abrir o app em um device limpo (sem sessão) — o spinner
  permanece para sempre.
- **Counterexample C2/C3:** após login válido, tocar em Time A produz HTTP 400 com
  `user.custom:teamId: Attribute does not exist in the schema.`
- **Counterexample C4:** abrir DevTools / Metro logs em qualquer tela do flow auth
  e observar a linha `props.pointerEvents is deprecated. Use style.pointerEvents`.

## Validation Tests (acceptance criteria)

Estes testes são o gate de conclusão do spec. O fix é considerado completo
SOMENTE quando TODOS os itens abaixo estão verdes. As tasks da fase de
implementação devem implementar e executar cada um destes testes.

### V1 — Unit/Integration: `authStore.initialize()` libera o spinner

Cobre **C1**.

- Test ID: `V1`
- Mock: `getCurrentUser` rejeita com `NotAuthorizedException`;
  `fetchUserAttributes` rejeita pela mesma razão.
- Asserts:
  - `state.isLoading === false` ao final.
  - `state.user === null`.
  - Tempo total de `initialize()` ≤ 10 000 ms.

### V2 — Unit/Integration: `authStore.setTeam('team-a')` persiste o time

Cobre **C2**.

- Test ID: `V2`
- Mock: `updateUserAttributes` resolve com sucesso; `fetchUserAttributes` retorna
  `{ 'custom:teamId': 'team-a' }`.
- Asserts:
  - Nenhuma exceção propagada.
  - `state.user.teamId === 'team-a'`.

### V3 — Infra check: schema do Cognito User Pool contém `custom:teamId`

Cobre **C3**.

- Test ID: `V3`
- Implementação: script (`scripts/check-cognito-schema.ts` ou shell equivalente)
  invoca `aws cognito-idp describe-user-pool --user-pool-id us-east-1_cHokaMBWW`.
- Asserts:
  - `Schema` contém um item com `Name === 'custom:teamId'`.
  - Esse item tem `AttributeDataType === 'String'` e `Mutable === true`.
  - Exit code 0 quando válido; ≠ 0 quando ausente.

### V4 — Smoke manual: cold start → `/login` → `/select-team` → `/community`

Cobre **C1 + C2 + C3** end-to-end.

- Test ID: `V4`
- Procedimento documentado em `docs/` ou no próprio spec, executado em um
  device/emulator com app instalado limpo.
- Asserts (manuais, com checkbox no relatório de execução):
  - Cold start não fica preso no spinner; `/login` aparece em ≤ 10 s.
  - Login com credenciais de teste funciona.
  - Tela `/select-team` aparece para usuário sem `custom:teamId`.
  - Toque em "Time A" não emite HTTP 400 no console; usuário é levado a
    `/community`.

### V5 — Warning check: `pointerEvents is deprecated` rastreado

Cobre **C4**.

- Test ID: `V5`
- Implementação: spy de `console.warn` (ou listener `LogBox`) durante um teste
  de smoke do flow auth (Jest + RTL ou script equivalente).
- Asserts:
  - Nenhuma ocorrência do warning originada por código do app durante o flow
    auth, OU
  - Se a ocorrência vier de dependência, há um documento em `docs/` (ou um
    comentário no task) identificando a dependência exata e a estratégia
    aplicada (upgrade, patch, ou `LogBox.ignoreLogs([...])` explícito).

### V6 — Regression: fluxos não relacionados continuam funcionando

Cobre as cláusulas 3.x.

- Test ID: `V6`
- Mock: cenários de `signIn`, `signUp`, `confirmSignUp`, `signOut`,
  `resendSignUpCode` com inputs válidos.
- Asserts:
  - Cada método retorna o mesmo shape de hoje.
  - Nenhuma chamada extra ao Cognito é introduzida em paths que não envolvem
    `custom:teamId`.
  - Telas fora do flow auth (Arena, Comunidade, Simulador) continuam
    renderizando sem erros novos.

**Critério de conclusão do spec:** V1, V2, V3, V4, V5 e V6 SHALL todos passar
(testes automatizados verdes; smoke manual com checkbox marcado e evidência
anexada). Enquanto qualquer um falhar, o spec NÃO está concluído.
