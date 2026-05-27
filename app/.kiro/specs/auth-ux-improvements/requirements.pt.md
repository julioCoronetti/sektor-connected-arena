# Requirements Document

## Introduction

Esta feature melhora a experiência de autenticação do app Sektor Connected Arena (React Native / Expo com AWS Cognito via Amplify v6). Três problemas de UX foram identificados:

1. **Fallback de re-cadastro**: quando um usuário tenta se cadastrar com um e-mail que já existe mas ainda não foi verificado, o Cognito retorna `UsernameExistsException`. O sistema deve detectar esse caso, reenviar automaticamente o código de verificação e levar o usuário direto para a tela de confirmação — sem exibir mensagem de erro confusa.

2. **Mensagens de erro amigáveis**: erros do Cognito aparecem em inglês técnico na tela (ex.: `"NotAuthorizedException"`, `"UserNotFoundException"`). Todos os erros relevantes do Cognito devem ser mapeados para mensagens em português, claras e amigáveis.

3. **Tela de confirmação de código**: o fluxo de confirmação de e-mail (código de 6 dígitos enviado pelo Cognito) precisa de uma tela dedicada, acessível tanto pelo cadastro normal quanto pelo fallback de re-cadastro.

O escopo desta feature é exclusivamente frontend (camada de UX e `authStore`). Não há alterações em infraestrutura AWS ou Lambdas.

## Glossary

- **Auth_Service**: módulo `src/services/auth.ts` — configura o Amplify e re-exporta funções do `aws-amplify/auth`.
- **Auth_Store**: store Zustand em `src/store/authStore.ts` — única fonte de verdade sobre o estado de autenticação.
- **Error_Mapper**: função utilitária pura que converte um erro do Cognito (instância de `Error` com `name` ou `message` específicos) em uma string de mensagem amigável em português.
- **Confirm_Screen**: tela `src/app/(auth)/confirm.tsx` — exibe campo para o código de 6 dígitos e botão de reenvio.
- **Register_Screen**: tela `src/app/(auth)/register.tsx` — formulário de cadastro (nome, e-mail, senha).
- **Login_Screen**: tela `src/app/(auth)/login.tsx` — formulário de login (e-mail, senha).
- **Cognito_Error_Code**: propriedade `name` de um erro lançado pelo Amplify (ex.: `"UsernameExistsException"`, `"NotAuthorizedException"`).
- **Unverified_User**: usuário que completou o `signUp` mas ainda não confirmou o código de verificação enviado ao e-mail.
- **Verification_Code**: código numérico de 6 dígitos enviado pelo Cognito ao e-mail do usuário para confirmar o cadastro.

---

## Requirements

### Requirement 1: Fallback automático de re-cadastro para usuário não verificado

**User Story:** Como usuário que já tentou se cadastrar mas não confirmou o e-mail, quero que ao tentar me cadastrar novamente o app reenvie o código automaticamente e me leve para a tela de confirmação, para que eu não veja uma mensagem de erro confusa e possa concluir meu cadastro.

#### Acceptance Criteria

1. WHEN o usuário submete o formulário de cadastro com um e-mail que já existe no Cognito como Unverified_User, THEN o Auth_Store SHALL primeiro chamar `resendSignUpCode` com o e-mail informado, definir `isLoading` como `true` durante a operação, e somente após o sucesso do reenvio navegar para a Confirm_Screen passando o e-mail como parâmetro de rota — sem exibir nenhuma mensagem de erro na Register_Screen.

2. WHEN `resendSignUpCode` é chamado com sucesso durante o fallback de re-cadastro, THEN o Auth_Store SHALL definir `error` como `null` e `isLoading` como `false` antes de navegar para a Confirm_Screen.

3. IF `resendSignUpCode` falha durante o fallback de re-cadastro, THEN o Auth_Store SHALL definir `error` com a mensagem amigável correspondente ao erro retornado pelo Cognito (conforme mapeamento do Requisito 2) e `isLoading` como `false`, sem navegar para a Confirm_Screen, mantendo a Register_Screen ativa e visível.

4. WHEN o usuário submete o formulário de cadastro com um e-mail que já existe no Cognito como usuário verificado (cadastro completo), THEN o Auth_Store SHALL exibir a mensagem `"Este e-mail já está cadastrado. Tente fazer login."` e não navegar para a Confirm_Screen.

5. WHILE o Auth_Store está executando o fallback de re-cadastro (entre a detecção do `UsernameExistsException` e a resolução de `resendSignUpCode`), THE Auth_Store SHALL manter `isLoading` como `true`.

---

### Requirement 2: Mapeamento de erros Cognito para mensagens amigáveis em português

**User Story:** Como usuário do app, quero ver mensagens de erro claras em português quando algo der errado na autenticação, para que eu entenda o que aconteceu e saiba o que fazer.

#### Acceptance Criteria

1. THE Error_Mapper SHALL ler a propriedade `name` do objeto de erro recebido para identificar o Cognito_Error_Code e mapear os seguintes códigos para as mensagens em português correspondentes:

   | Cognito_Error_Code | Mensagem em português |
   |---|---|
   | `NotAuthorizedException` | `"E-mail ou senha incorretos."` |
   | `UserNotFoundException` | `"Usuário não encontrado."` |
   | `UsernameExistsException` | `"Este e-mail já está cadastrado."` |
   | `InvalidPasswordException` | `"A senha não atende aos requisitos mínimos."` |
   | `InvalidParameterException` | `"Dados inválidos. Verifique os campos e tente novamente."` |
   | `CodeMismatchException` | `"Código incorreto. Verifique e tente novamente."` |
   | `ExpiredCodeException` | `"Código expirado. Solicite um novo código."` |
   | `LimitExceededException` | `"Muitas tentativas. Aguarde alguns minutos e tente novamente."` |
   | `TooManyRequestsException` | `"Muitas tentativas. Aguarde alguns minutos e tente novamente."` |
   | `NetworkError` | `"Sem conexão com a internet. Verifique sua rede."` |
   | `UserNotConfirmedException` | `"Confirme seu e-mail antes de entrar."` |
   | `PasswordResetRequiredException` | `"É necessário redefinir sua senha. Verifique seu e-mail."` |

2. IF o erro recebido não corresponde a nenhum Cognito_Error_Code mapeado, THEN o Error_Mapper SHALL retornar a mensagem `"Ocorreu um erro inesperado. Tente novamente."`.

3. IF o Error_Mapper recebe um valor `null`, `undefined` ou um objeto sem a propriedade `name`, THEN o Error_Mapper SHALL retornar a mensagem `"Ocorreu um erro inesperado. Tente novamente."`.

4. IF um erro ocorre em qualquer operação de autenticação do Auth_Store (`login`, `register`, `setTeam`, `logout`, `confirmSignUp`, `resendCode`), THEN o Auth_Store SHALL usar o Error_Mapper para converter o erro antes de armazená-lo no campo `error`.

5. WHEN o Error_Mapper recebe um Cognito_Error_Code mapeado, THEN a mensagem retornada SHALL ser exatamente a string em português definida na tabela do critério 1, sem incluir o Cognito_Error_Code original como substring.

---

### Requirement 3: Tela de confirmação de código de verificação

**User Story:** Como usuário que recebeu um código de verificação por e-mail, quero uma tela dedicada para inserir esse código e confirmar meu cadastro, para que eu possa concluir o processo de criação de conta.

#### Acceptance Criteria

1. THE Confirm_Screen SHALL exibir um campo de entrada numérico que aceita no máximo 6 dígitos para o Verification_Code e um botão "Confirmar".

2. WHEN o usuário submete um Verification_Code válido na Confirm_Screen, THEN o Auth_Store SHALL chamar `confirmSignUp` com o e-mail (recebido como parâmetro de rota) e o código informado.

3. IF `confirmSignUp` falha com `CodeMismatchException` ou `ExpiredCodeException`, THEN o Auth_Store SHALL exibir a mensagem amigável correspondente (conforme Requisito 2) na Confirm_Screen sem navegar.

4. WHEN o usuário pressiona o botão "Reenviar código" na Confirm_Screen, THEN o Auth_Store SHALL chamar `resendSignUpCode` com o e-mail recebido como parâmetro de rota.

5. WHEN `resendSignUpCode` é chamado com sucesso a partir da Confirm_Screen, THEN o Auth_Store SHALL exibir uma mensagem de confirmação de reenvio na Confirm_Screen.

6. IF `resendSignUpCode` falha a partir da Confirm_Screen, THEN o Auth_Store SHALL exibir a mensagem amigável correspondente ao erro (conforme Requisito 2) na Confirm_Screen.

7. WHILE o Auth_Store está processando `confirmSignUp` ou `resendSignUpCode`, THE Confirm_Screen SHALL desabilitar o campo de entrada e os botões e exibir um indicador de carregamento.

8. WHEN `confirmSignUp` é concluído com sucesso, THEN o Auth_Store SHALL navegar para a tela de seleção de time (`/select-team`).

---

### Requirement 4: Integração do fluxo de confirmação no cadastro normal

**User Story:** Como novo usuário, quero que após preencher o formulário de cadastro o app me leve automaticamente para a tela de confirmação de código, para que eu possa concluir meu cadastro sem precisar navegar manualmente.

#### Acceptance Criteria

1. WHEN o usuário submete o formulário de cadastro com dados válidos e o Cognito retorna `isSignUpComplete = false` (confirmação por e-mail necessária), THEN o Auth_Store SHALL navegar para a Confirm_Screen passando o e-mail como parâmetro de rota, sem exibir mensagem de erro.

2. WHEN o usuário submete o formulário de cadastro com dados válidos e o Cognito retorna `isSignUpComplete = true` (confirmação não necessária), THEN o Auth_Store SHALL fazer login automático e navegar para `/select-team`. IF o login automático falhar, THEN o Auth_Store SHALL exibir a mensagem amigável correspondente ao erro (conforme Requisito 2) e permanecer na Register_Screen.

3. WHILE o Auth_Store está processando o cadastro, THE Register_Screen SHALL desabilitar o botão "Criar conta" e exibir um indicador de carregamento. IF o processamento exceder 10 segundos sem resposta, THEN o Auth_Store SHALL cancelar a operação e exibir a mensagem `"Ocorreu um erro inesperado. Tente novamente."`.

---

### Requirement 5: Preservação dos fluxos de autenticação existentes

**User Story:** Como usuário existente, quero que o login, logout e seleção de time continuem funcionando exatamente como antes, para que as melhorias de UX não quebrem funcionalidades que já estão corretas.

#### Acceptance Criteria

1. WHEN o usuário submete credenciais válidas na Login_Screen, THEN o Auth_Store SHALL autenticar o usuário e navegar para `/select-team` (se time não selecionado) ou para a tela principal da comunidade (se time já selecionado).

2. IF o usuário submete credenciais inválidas na Login_Screen, THEN o Auth_Store SHALL exibir a mensagem amigável correspondente ao erro (conforme Requisito 2) sem navegar.

3. THE Auth_Store SHALL manter as assinaturas existentes de `initialize(void): Promise<void>`, `login(email: string, password: string): Promise<void>`, `register(name: string, email: string, password: string): Promise<void>`, `setTeam(team: string): Promise<void>` e `logout(): Promise<void>` sem alterações.

4. WHEN `authStore.initialize()` é chamado, THEN o Auth_Store SHALL executar no máximo uma vez por sessão (guard `_initialized`) e respeitar o timeout de 8 segundos antes de definir `isLoading` como `false`.
