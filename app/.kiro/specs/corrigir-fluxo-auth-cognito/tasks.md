# Implementation Plan

## Overview

Plano de implementação para o bugfix `corrigir-fluxo-auth-cognito`. Cobre quatro bugs (C1–C4) que impedem o fluxo cold start → `/login` → `/select-team` → `/community`. A ordem segue a metodologia de bug condition: exploração do bug → preservation baseline → fix de infra (C3) → fix de código (C1, C4) → validação completa (V1–V6).

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3", "4", "5", "6"] },
    { "wave": 3, "tasks": ["7", "8"] },
    { "wave": 4, "tasks": ["9"] }
  ]
}
```

## Tasks

- [x] 1. Escrever teste de exploração da condição de bug (Bug Condition)
  - **Property 1: Bug Condition** - Spinner-forever no cold start (C1)
  - **CRITICAL**: Este teste DEVE FALHAR no código não-fixado — a falha confirma que o bug existe
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: Este teste codifica o comportamento esperado — ele validará o fix quando passar após a implementação
  - **GOAL**: Surfaçar counterexamples que demonstram o bug de double-call de `initialize()`
  - **Scoped PBT Approach**: Para o bug determinístico C1, escopar a propriedade ao caso concreto: chamar `initialize()` duas vezes em rápida sucessão com `getCurrentUser` rejeitando
  - Arquivo: `src/store/__tests__/authStore.test.ts`
  - Padrão: Jest + Zustand sem RTL, igual a `arenaStore.test.ts` — usar `useAuthStore.getState()`
  - Mock: `jest.mock('../services/auth')` — `getCurrentUser` rejeita com `NotAuthorizedException`; `fetchUserAttributes` rejeita pela mesma razão
  - Teste V1a: chamar `initialize()` uma vez → aguardar → assert `isLoading === false`, `user === null`, tempo ≤ 10 000 ms
  - Teste V1b (Bug Condition): chamar `initialize()` duas vezes sem await na primeira (simula double-call / StrictMode) → aguardar ambas → assert `isLoading === false` ao final (este assert FALHA no código não-fixado, confirmando o bug)
  - Documentar o counterexample encontrado: "segunda chamada seta `isLoading: true` após o `finally` da primeira já ter setado `isLoading: false`"
  - Executar no código não-fixado: `npx jest src/store/__tests__/authStore.test.ts --run` (ou `--testNamePattern "V1b"`)
  - **EXPECTED OUTCOME**: Teste V1b FALHA (correto — prova que o bug existe); marcar task completa quando o teste estiver escrito, executado e a falha documentada
  - _Requirements: 1.1, 2.1_

- [x] 2. Escrever testes de preservation (ANTES de implementar o fix)
  - **Property 2: Preservation** - Sessão válida e fluxos de credenciais preservados
  - **IMPORTANT**: Seguir metodologia observation-first
  - Arquivo: `src/store/__tests__/authStore.test.ts` (mesmo arquivo do task 1)
  - Padrão: Jest + Zustand sem RTL, usar `useAuthStore.getState()`
  - **Observar no código não-fixado** (¬C1 — sessão válida):
    - `getCurrentUser` resolve com `{ userId: 'u1', username: 'test@test.com' }`; `fetchUserAttributes` resolve com `{ email: 'test@test.com', name: 'Test', 'custom:teamId': 'team-a' }` → observar: `user.teamId === 'team-a'`, `isLoading === false`
    - `getCurrentUser` resolve mas `fetchUserAttributes` retorna sem `custom:teamId` → observar: `user.teamId === ''`, `isLoading === false`
  - Teste V6a (signIn válido): mock `signIn` resolvendo com `{ isSignedIn: true }` + `getCurrentUser`/`fetchUserAttributes` resolvendo → assert `user` populado, `isLoading === false`
  - Teste V6b (logout): chamar `logout()` com mock `signOut` resolvendo → assert `user === null`, `isLoading === false`
  - Teste V6c (signIn inválido): mock `signIn` rejeitando → assert `error` setado, `user === null`
  - Teste V2 (setTeam com mock de sucesso): mock `updateUserAttributes` resolvendo; `fetchUserAttributes` retornando `{ 'custom:teamId': 'team-a' }` → assert `user.teamId === 'team-a'`, sem exceção
  - Teste V2b (setTeam com mock de 400): mock `updateUserAttributes` rejeitando com `{ message: 'user.custom:teamId: Attribute does not exist in the schema.' }` → assert exceção propagada, `user.teamId` inalterado
  - Executar no código não-fixado: `npx jest src/store/__tests__/authStore.test.ts --run`
  - **EXPECTED OUTCOME**: Todos os testes de preservation PASSAM no código não-fixado (confirma baseline a preservar); marcar task completa quando escritos, executados e passando
  - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix C3 — Adicionar `custom:teamId` ao schema do Cognito User Pool (infra)

  - [x] 3.1 Adicionar atributo customizado ao User Pool
    - Executar via AWS CLI (conta `482712210181`, região `us-east-1`):
      ```bash
      aws cognito-idp add-custom-attributes \
        --user-pool-id us-east-1_cHokaMBWW \
        --custom-attributes '[{"Name":"teamId","AttributeDataType":"String","Mutable":true,"Required":false}]'
      ```
    - O `Name` no CLI é `teamId` (sem prefixo); o Cognito adiciona `custom:` automaticamente → resultado: `custom:teamId`
    - _Bug_Condition: isBugCondition_C3(X) onde X.userPoolId = 'us-east-1_cHokaMBWW' AND NOT EXISTS attr WHERE attr.Name = 'custom:teamId'_
    - _Expected_Behavior: schema contém custom:teamId com AttributeDataType=String e Mutable=true_
    - _Preservation: atributos existentes no schema NÃO são removidos ou modificados (adição é não-destrutiva)_
    - _Requirements: 2.3, 3.4_

  - [x] 3.2 Atualizar App Client para incluir `custom:teamId` em read/write attributes
    - Descobrir atributos atuais do client:
      ```bash
      aws cognito-idp describe-user-pool-client \
        --user-pool-id us-east-1_cHokaMBWW \
        --client-id 68i7il8tnlbc92r8hobs5op7t \
        --query 'UserPoolClient.[ReadAttributes,WriteAttributes]'
      ```
    - Atualizar incluindo `custom:teamId` nos arrays existentes (não substituir — concatenar):
      ```bash
      aws cognito-idp update-user-pool-client \
        --user-pool-id us-east-1_cHokaMBWW \
        --client-id 68i7il8tnlbc92r8hobs5op7t \
        --read-attributes <atributos_existentes> custom:teamId \
        --write-attributes <atributos_existentes> custom:teamId
      ```
    - _Requirements: 2.2, 2.3_

  - [x] 3.3 Criar script de verificação de schema `scripts/check-cognito-schema.ts`
    - Implementar script que chama `aws cognito-idp describe-user-pool --user-pool-id us-east-1_cHokaMBWW`
    - Asserts: `Schema` contém item com `Name === 'custom:teamId'`, `AttributeDataType === 'String'`, `Mutable === true`
    - Exit code 0 quando válido; exit code ≠ 0 quando ausente (para uso em CI)
    - Executar o script após o passo 3.1 para confirmar que o atributo foi adicionado
    - _Requirements: 2.3_

- [x] 4. Fix C1 — Guard de chamada única em `_layout.tsx`

  - [x] 4.1 Importar `useRef` e adicionar guard de idempotência
    - Arquivo: `src/app/_layout.tsx`
    - Adicionar `useRef` ao import do React: `import { useEffect, useRef } from "react";`
    - Adicionar `const initializedRef = useRef(false)` dentro do componente `RootLayout`, antes do primeiro `useEffect`
    - Modificar o `useEffect` de `initialize` para verificar o ref antes de chamar:
      ```tsx
      useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;
        console.log("[layout] calling initialize (once)");
        initialize();
      }, [initialize]);
      ```
    - **Não alterar** `authStore.ts` — o guard fica no componente, zero mudanças no store
    - _Bug_Condition: isBugCondition_C1(X) onde X.hasValidSession = false AND X.getCurrentUserResult = 'reject' AND X.initializeCallCount > 1_
    - _Expected_Behavior: initialize() completa com isLoading=false, user=null, elapsed ≤ 10 000 ms, independentemente de quantas vezes seja chamado concorrentemente_
    - _Preservation: cold start com sessão válida continua populando user, setando isLoading=false e navegando para /community ou /select-team_
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.6_

- [x] 5. Fix C4 — Suprimir warning `pointerEvents is deprecated` com documentação

  - [x] 5.1 Adicionar `LogBox.ignoreLogs` em `_layout.tsx`
    - Arquivo: `src/app/_layout.tsx`
    - Adicionar `LogBox` ao import do `react-native`: `import { LogBox } from "react-native";`
    - Adicionar supressão no escopo do módulo (fora do componente), logo após os imports:
      ```tsx
      // Suprime warning de prop deprecada originado por dependência de terceiros.
      // Candidatos: react-native-reanimated ~4.1.1, @react-navigation/elements ^2.6.3,
      // expo-router ~6.0.23. Remover quando a dependência for atualizada.
      LogBox.ignoreLogs(["props.pointerEvents is deprecated"]);
      ```
    - _Bug_Condition: isBugCondition_C4(X) onde X.route IN {'/', '/login', '/register', '/select-team'} AND ANY w IN X.warnings WHERE w CONTAINS 'props.pointerEvents is deprecated'_
    - _Expected_Behavior: warning não emitido por código do app; se originado por dependência, origem documentada_
    - _Preservation: telas fora do fluxo de auth (Arena, Comunidade, Simulador) continuam sem regressões visuais ou de navegação_
    - _Requirements: 1.4, 2.4, 3.5_

  - [x] 5.2 Criar `docs/warnings-suprimidos.md` documentando a origem e estratégia
    - Criar arquivo `docs/warnings-suprimidos.md` com:
      - Warning suprimido: `props.pointerEvents is deprecated. Use style.pointerEvents`
      - Origem confirmada: dependência de terceiros (candidatos: `react-native-reanimated ~4.1.1`, `@react-navigation/elements ^2.6.3`, `expo-router ~6.0.23`)
      - Estratégia adotada: `LogBox.ignoreLogs` explícito em `_layout.tsx`
      - Condição de remoção: quando a dependência causadora for atualizada para versão que use `style.pointerEvents`
      - Referência ao task e ao spec: `corrigir-fluxo-auth-cognito`
    - _Requirements: 2.4_

- [x] 6. Criar `docs/smoke-auth-flow.md` (procedimento V4)
  - Criar arquivo `docs/smoke-auth-flow.md` com procedimento de smoke manual:
    - Pré-condição: device/emulator com app instalado limpo (sem sessão Cognito válida)
    - Passo 1: cold start → verificar que `/login` aparece em ≤ 10 s (sem spinner eterno) ☐
    - Passo 2: login com credenciais de teste → verificar que `isLoading` libera e usuário é autenticado ☐
    - Passo 3: tela `/select-team` aparece para usuário sem `custom:teamId` ☐
    - Passo 4: toque em "Time A" → verificar que NÃO há HTTP 400 no console; usuário é levado a `/community` ☐
    - Seção de evidência: campo para anotar data de execução, executor, e resultado de cada checkbox
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. Verificar que o teste de Bug Condition (Property 1) agora passa

  - [x] 7.1 Re-executar o teste V1b com o código fixado
    - **Property 1: Expected Behavior** - Spinner-forever resolvido pelo guard `useRef`
    - **IMPORTANT**: Re-executar o MESMO teste do task 1 — NÃO escrever novo teste
    - O teste do task 1 codifica o comportamento esperado; quando passar, confirma que o fix funciona
    - Executar: `npx jest src/store/__tests__/authStore.test.ts --run --testNamePattern "V1b"`
    - **EXPECTED OUTCOME**: Teste V1b PASSA (confirma que o bug C1 está corrigido)
    - _Requirements: 2.1_

- [x] 8. Verificar que os testes de preservation ainda passam

  - [x] 8.1 Re-executar todos os testes de preservation com o código fixado
    - **Property 2: Preservation** - Sessão válida e fluxos de credenciais preservados
    - **IMPORTANT**: Re-executar os MESMOS testes do task 2 — NÃO escrever novos testes
    - Executar: `npx jest src/store/__tests__/authStore.test.ts --run`
    - **EXPECTED OUTCOME**: Todos os testes PASSAM (confirma que não há regressões)
    - Confirmar especificamente: V6a (signIn válido), V6b (logout), V6c (signIn inválido), V2 (setTeam sucesso), V2b (setTeam 400)
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 9. Checkpoint — Garantir que todos os testes passam (V1–V6)
  - Executar suite completa: `npx jest src/store/__tests__/authStore.test.ts --run`
  - Executar script de infra: `npx ts-node scripts/check-cognito-schema.ts` → exit code 0 (V3)
  - Executar smoke manual conforme `docs/smoke-auth-flow.md` e marcar todos os checkboxes (V4)
  - Verificar ausência do warning `pointerEvents` nos logs do Metro durante o flow auth (V5)
  - **O spec NÃO está concluído enquanto qualquer um de V1–V6 falhar**
  - Critério de conclusão: V1 ✓, V2 ✓, V3 ✓, V4 ✓ (manual), V5 ✓, V6 ✓
  - Em caso de falha, identificar qual validação falhou e retornar ao task correspondente antes de marcar este checkpoint como completo
  - Perguntar ao usuário se houver dúvidas antes de marcar o spec como concluído

## Notes

- O spec é considerado concluído SOMENTE quando V1, V2, V3, V4, V5 e V6 estiverem todos verdes.
- Testes automatizados usam Jest + Zustand sem RTL, seguindo o padrão de `arenaStore.test.ts`.
- O mock de `../services/auth` deve ser feito via `jest.mock('../services/auth')` no topo do arquivo de teste.
- O fix C3 (infra) deve ser aplicado ANTES de executar V2 em ambiente real; os testes unitários de V2 usam mock e podem ser escritos antes.
- O fix C1 (`useRef` guard) não requer mudanças em `authStore.ts` — apenas em `_layout.tsx`.
- O fix C4 (`LogBox.ignoreLogs`) deve ser acompanhado de documentação em `docs/warnings-suprimidos.md`.
- O smoke manual V4 requer device/emulator com app instalado limpo e credenciais de teste válidas.
- Não marcar o checkpoint (task 9) como completo enquanto qualquer validação V1–V6 falhar.
