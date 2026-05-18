# Implementation Plan: auth-ux-improvements

## Overview

Implementação incremental das melhorias de UX de autenticação em três frentes: (1) utilitário `cognitoErrorMapper` puro e testável, (2) refatoração do `authStore` com novas ações e callback de navegação, e (3) nova tela `confirm.tsx` integrada ao fluxo de cadastro normal e ao fallback de re-cadastro.

## Tasks

- [x] 1. Criar utilitário `cognitoErrorMapper`
  - [x] 1.1 Criar `src/utils/cognitoErrorMapper.ts` com a função `mapCognitoError`
    - Implementar a tabela `ERROR_MAP` com os 12 códigos Cognito mapeados para strings PT-BR
    - Implementar o fallback `"Ocorreu um erro inesperado. Tente novamente."` para entradas desconhecidas, `null`, `undefined` e objetos sem `name`
    - Função pura — sem efeitos colaterais, sem imports externos
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ]* 1.2 Escrever teste de propriedade P1 para `cognitoErrorMapper`
    - **Property 1: Mapeamento de código conhecido retorna mensagem PT-BR sem o código original**
    - Usar `fast-check` com `fc.constantFrom(...Object.keys(ERROR_MAP))` para gerar códigos conhecidos
    - Verificar que a string retornada é exatamente a mensagem PT-BR e não contém o código original como substring
    - Mínimo de 100 iterações (`numRuns: 100`)
    - **Validates: Requirements 2.1, 2.5**

  - [ ]* 1.3 Escrever teste de propriedade P2 para `cognitoErrorMapper`
    - **Property 2: Entrada desconhecida ou inválida retorna fallback**
    - Usar `fast-check` com `fc.anything()` filtrado para excluir objetos com `name` mapeado
    - Incluir explicitamente `null`, `undefined`, `{}`, `{ name: "" }`, strings arbitrárias
    - Verificar que o retorno é sempre o fallback
    - Mínimo de 100 iterações (`numRuns: 100`)
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 1.4 Escrever testes unitários para casos de borda do `cognitoErrorMapper`
    - Testar `null`, `undefined`, objeto sem `name`, string vazia, objeto com `name` desconhecido
    - _Requirements: 2.2, 2.3_

- [x] 2. Estender `src/services/auth.ts` com novos re-exports
  - [x] 2.1 Adicionar `confirmSignUp` e `resendSignUpCode` aos re-exports de `aws-amplify/auth`
    - Nenhuma outra alteração na configuração do Amplify
    - _Requirements: 3.2, 3.4, 1.1_

- [x] 3. Refatorar `src/store/authStore.ts`
  - [x] 3.1 Adicionar campos `_onNavigate` e `_setNavigate` à interface `AuthState` e ao store
    - Inicializar `_onNavigate` como `null`
    - Implementar `_setNavigate` para injetar o callback de navegação
    - Garantir que chamadas a `_onNavigate` quando `null` sejam silenciosamente ignoradas
    - _Requirements: 5.3_

  - [x] 3.2 Substituir `errorMessage` por `mapCognitoError` em todas as operações do store
    - Importar `mapCognitoError` de `src/utils/cognitoErrorMapper`
    - Substituir todos os `catch` que usam `errorMessage(e, ...)` por `mapCognitoError(e)`
    - Remover a função `errorMessage` local
    - _Requirements: 2.4, 5.2_

  - [x] 3.3 Refatorar a ação `register` com fallback de re-cadastro e timeout de 10s
    - Envolver `signUp` em `Promise.race` com timeout de 10 segundos
    - Detectar `UsernameExistsException`: chamar `resendSignUpCode`, definir `error=null` e navegar para `/confirm?email=...`
    - Se `resendSignUpCode` falhar no fallback, definir `error=mapCognitoError(e2)` sem navegar
    - Se `isSignUpComplete=false`: navegar para `/confirm?email=...` sem erro
    - Se `isSignUpComplete=true`: fazer login automático e navegar para `/select-team`; se login falhar, definir `error=mapCognitoError(e)`
    - Manter `isLoading=true` durante toda a operação e `isLoading=false` no `finally`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3_

  - [x] 3.4 Implementar ação `confirmSignUp` no store
    - Assinatura: `confirmSignUp(email: string, code: string): Promise<void>`
    - Definir `isLoading=true, error=null` no início
    - Chamar `confirmSignUp(email, code)` do serviço; em caso de sucesso navegar para `/select-team`
    - Em caso de falha, definir `error=mapCognitoError(e)`
    - Definir `isLoading=false` no `finally`
    - _Requirements: 3.2, 3.3, 3.8_

  - [x] 3.5 Implementar ação `resendCode` no store
    - Assinatura: `resendCode(email: string): Promise<void>`
    - Definir `isLoading=true, error=null` no início
    - Chamar `resendSignUpCode(email)`; em caso de sucesso definir `error="Código reenviado para seu e-mail."`
    - Em caso de falha, definir `error=mapCognitoError(e)`
    - Definir `isLoading=false` no `finally`
    - _Requirements: 3.4, 3.5, 3.6_

  - [   ]* 3.6 Escrever teste de propriedade P3 para o store
    - **Property 3: `isLoading` é sempre `false` após qualquer operação do store**
    - Usar `fast-check` para gerar combinações de operação e código de erro Cognito
    - Verificar que `isLoading=false` ao final de `register`, `login`, `confirmSignUp`, `resendCode`
    - Mínimo de 100 iterações (`numRuns: 100`)
    - **Validates: Requirements 1.2, 1.3, 1.5, 3.7, 4.3**

  - [ ]* 3.7 Escrever teste de propriedade P4 para o store
    - **Property 4: O store nunca armazena um código de erro Cognito em inglês no campo `error`**
    - Usar `fast-check` com `fc.constantFrom(...knownCognitoErrorCodes)` para gerar erros
    - Verificar que `state.error` não contém o código original como substring após qualquer operação
    - Mínimo de 100 iterações (`numRuns: 100`)
    - **Validates: Requirements 2.4, 5.2**

  - [ ]* 3.8 Escrever teste de propriedade P5 para o store
    - **Property 5: Fallback de re-cadastro bem-sucedido não exibe erro e navega para `/confirm`**
    - Mockar `signUp` para lançar `UsernameExistsException` e `resendSignUpCode` para resolver com sucesso
    - Usar `fast-check` com `fc.emailAddress()` para gerar e-mails
    - Verificar que `state.error=null` e `mockNavigate` foi chamado com path contendo `/confirm`
    - Mínimo de 100 iterações (`numRuns: 100`)
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 3.9 Escrever teste de propriedade P6 para o store
    - **Property 6: `confirmSignUp` bem-sucedido navega para `/select-team`**
    - Usar `fast-check` com `fc.emailAddress()` e `fc.stringMatching(/^\d{6}$/)` para gerar inputs
    - Verificar que `mockNavigate` foi chamado com `/select-team`
    - Mínimo de 100 iterações (`numRuns: 100`)
    - **Validates: Requirements 3.8**

  - [ ]* 3.10 Escrever teste de propriedade P7 para o store
    - **Property 7: `register` com `isSignUpComplete=false` navega para `/confirm` sem erro**
    - Usar `fast-check` com `fc.emailAddress()` para gerar e-mails
    - Mockar `signUp` para retornar `{ isSignUpComplete: false }`
    - Verificar que `state.error=null` e `mockNavigate` foi chamado com path contendo `/confirm` e o e-mail como parâmetro
    - Mínimo de 100 iterações (`numRuns: 100`)
    - **Validates: Requirements 4.1**

  - [ ]* 3.11 Escrever teste de propriedade P8 para o store
    - **Property 8: `initialize` é idempotente — executa no máximo uma vez por sessão**
    - Usar `fast-check` com `fc.integer({ min: 2, max: 10 })` para gerar N chamadas
    - Verificar que `getCurrentUser` (ou `loadCurrentUser`) foi invocado exatamente uma vez
    - Mínimo de 100 iterações (`numRuns: 100`)
    - **Validates: Requirements 5.4**

  - [ ]* 3.12 Escrever testes unitários para cenários específicos do store
    - `register` → `UsernameExistsException` → `resendSignUpCode` falha → `error` preenchido com mensagem PT-BR
    - `confirmSignUp` falha com `CodeMismatchException` → `error` = `"Código incorreto. Verifique e tente novamente."`
    - `resendCode` sucesso → `error` = `"Código reenviado para seu e-mail."`
    - Timeout de 10s no `register` → `error` = fallback, `isLoading=false`
    - _Requirements: 1.3, 3.3, 3.5, 4.3_

- [x] 4. Checkpoint — Verificar store e utilitário
  - Garantir que todos os testes do `cognitoErrorMapper` e do `authStore` passam. Perguntar ao usuário se houver dúvidas antes de prosseguir.

- [x] 5. Criar tela `src/app/(auth)/confirm.tsx`
  - [x] 5.1 Implementar a tela `confirm.tsx` com campo de código, botão Confirmar e botão Reenviar
    - Ler `email` via `useLocalSearchParams()`
    - `TextInput` numérico, `maxLength={6}`, `keyboardType="number-pad"`, `testID="confirm-code-input"`
    - Botão "Confirmar" (`testID="confirm-submit"`): desabilitado se `code.length < 6 || isLoading`; chama `confirmSignUp(email, code)`
    - Botão "Reenviar código" (`testID="confirm-resend"`): desabilitado se `isLoading`; chama `resendCode(email)`
    - `ActivityIndicator` visível quando `isLoading=true`
    - `Text` de erro/sucesso com `testID="confirm-message"` exibindo `error` quando presente
    - Animação `FadeIn` consistente com as demais telas de auth
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 5.2 Escrever testes unitários para `confirm.tsx`
    - Renderiza campo de código, botão Confirmar e botão Reenviar
    - Botão Confirmar desabilitado com menos de 6 dígitos e habilitado com 6 dígitos
    - Exibe `ActivityIndicator` quando `isLoading=true`
    - Exibe mensagem de erro/sucesso quando `error` está preenchido no store
    - _Requirements: 3.1, 3.7_

- [x] 6. Atualizar `src/app/(auth)/register.tsx`
  - [x] 6.1 Remover lógica de navegação pós-`register` do `handleSubmit`
    - O `handleSubmit` passa a apenas chamar `register(name.trim(), email.trim(), password)` sem verificar `state.user` ou chamar `router.replace`
    - A navegação é responsabilidade do store via `_onNavigate`
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Atualizar `src/app/(auth)/_layout.tsx` para injetar o callback de navegação
  - [x] 7.1 Injetar `_setNavigate` no `useEffect` de montagem do layout `(auth)`
    - Importar `useAuthStore` e `useRouter`
    - No `useEffect`, chamar `useAuthStore.getState()._setNavigate((path) => router.replace(path as never))`
    - _Requirements: 1.1, 3.8, 4.1_

- [x] 8. Checkpoint final — Garantir que todos os testes passam
  - Executar a suite completa de testes. Garantir que todos os testes passam, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Os checkpoints garantem validação incremental antes de avançar para a próxima camada
- Testes de propriedade validam invariantes universais; testes unitários validam exemplos concretos e casos de borda
- O callback `_onNavigate` deve ser injetado antes de cada teste do store via `useAuthStore.getState()._setNavigate(mockNavigate)`
- O `fast-check` deve ser instalado como devDependency: `npm install --save-dev fast-check`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "3.1"] },
    { "id": 2, "tasks": ["3.2"] },
    { "id": 3, "tasks": ["3.3", "3.4", "3.5"] },
    { "id": 4, "tasks": ["3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "3.12"] },
    { "id": 5, "tasks": ["5.1", "6.1", "7.1"] },
    { "id": 6, "tasks": ["5.2"] }
  ]
}
```
