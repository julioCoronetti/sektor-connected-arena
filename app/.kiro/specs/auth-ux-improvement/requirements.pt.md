# Requirements Document

## Introduction

Esta feature melhora a experiência de usuário (UX) do fluxo de autenticação do app **Sektor Connected Arena** (React Native + Expo). O backend de autenticação permanece o AWS Cognito via Amplify v6 — todas as mudanças são na camada de frontend/UX.

Os problemas identificados abrangem quatro telas (`login`, `register`, `confirm`, `select-team`) e o fluxo geral: ausência de recuperação de senha, falta de validação inline, senha exposta em URL, ausência de feedback visual adequado e navegação por teclado deficiente.

---

## Glossary

- **App**: O aplicativo mobile Sektor Connected Arena (React Native + Expo).
- **Tela_Login**: Tela `(auth)/login.tsx` — entrada de e-mail e senha para autenticação.
- **Tela_Registro**: Tela `(auth)/register.tsx` — criação de nova conta.
- **Tela_Confirmacao**: Tela `(auth)/confirm.tsx` — verificação do código de 6 dígitos enviado por e-mail.
- **Tela_SelectTime**: Tela `(auth)/select-team.tsx` — seleção do time de torcida.
- **Tela_RecuperacaoSenha**: Nova tela `(auth)/forgot-password.tsx` — solicitação de redefinição de senha.
- **Tela_RedefinicaoSenha**: Nova tela `(auth)/reset-password.tsx` — inserção do código e nova senha.
- **AuthStore**: Store Zustand (`authStore.ts`) que gerencia o estado de autenticação.
- **Cognito**: AWS Cognito User Pool (`us-east-1_cHokaMBWW`) — backend de autenticação.
- **Amplify**: AWS Amplify v6 — SDK de integração com o Cognito.
- **Validador_Email**: Módulo de validação de formato de e-mail (regex RFC 5322 simplificado).
- **Validador_Senha**: Módulo de validação de força de senha conforme política do Cognito.
- **Cooldown_Reenvio**: Temporizador de 60 segundos que bloqueia reenvios consecutivos de código.
- **PasswordStrengthIndicator**: Componente visual que exibe a força da senha em tempo real.
- **ToggleSenha**: Botão que alterna a visibilidade do campo de senha entre texto oculto e visível.

---

## Requirements

### Requisito 1: Recuperação de Senha

**User Story:** Como torcedor que esqueceu sua senha, quero solicitar a redefinição diretamente no app, para que eu possa recuperar o acesso sem precisar de suporte externo.

#### Critérios de Aceitação

1. THE Tela_Login SHALL exibir um link "Esqueci minha senha" abaixo do botão de entrar.
2. WHEN o usuário aciona o link "Esqueci minha senha", THE App SHALL navegar para a Tela_RecuperacaoSenha.
3. WHEN o usuário submete um e-mail com formato válido (não vazio e satisfazendo o padrão `^[^\s@]+@[^\s@]+\.[^\s@]+$`) na Tela_RecuperacaoSenha, THE AuthStore SHALL chamar `resetPassword` do Amplify com o e-mail fornecido e exibir indicador de carregamento enquanto a chamada está em progresso.
4. WHEN o Cognito confirma o envio do código de redefinição com sucesso, THE App SHALL navegar para a Tela_RedefinicaoSenha passando apenas o e-mail como parâmetro de rota.
5. WHEN o usuário submete um código não vazio e uma nova senha não vazia na Tela_RedefinicaoSenha, THE AuthStore SHALL chamar `confirmResetPassword` do Amplify e exibir indicador de carregamento enquanto a chamada está em progresso.
6. WHEN a redefinição de senha é confirmada com sucesso pelo Cognito, THE App SHALL navegar para a Tela_Login exibindo a mensagem "Senha redefinida com sucesso. Faça login.".
7. IF o Cognito retornar qualquer erro em `confirmResetPassword`, THEN THE App SHALL exibir a mensagem mapeada pelo `cognitoErrorMapper` e manter o usuário na Tela_RedefinicaoSenha.
8. IF o Cognito retornar qualquer erro em `resetPassword`, THEN THE App SHALL exibir a mensagem mapeada pelo `cognitoErrorMapper` sem navegar.
9. WHEN o usuário está na Tela_RecuperacaoSenha ou Tela_RedefinicaoSenha, THE App SHALL exibir um botão "Voltar" que retorna à tela anterior sem alterar o estado de autenticação global.
10. WHILE a chamada a `resetPassword` ou `confirmResetPassword` está em progresso, THE App SHALL desabilitar o botão de submissão da tela correspondente.

---

### Requisito 2: Visibilidade de Senha (Show/Hide)

**User Story:** Como usuário, quero alternar a visibilidade do campo de senha, para que eu possa verificar o que digitei sem precisar apagar e redigitar.

#### Critérios de Aceitação

1. THE Tela_Login SHALL exibir um ToggleSenha no campo de senha.
2. THE Tela_Registro SHALL exibir um ToggleSenha no campo de senha e um ToggleSenha independente no campo de confirmação de senha.
3. THE Tela_RedefinicaoSenha SHALL exibir um ToggleSenha no campo de nova senha.
4. WHEN qualquer tela com campo de senha é exibida, THE App SHALL inicializar todos os campos de senha no estado oculto (caracteres mascarados).
5. WHEN o usuário aciona o ToggleSenha de um campo, THE App SHALL alternar o estado de visibilidade daquele campo entre oculto e visível, sem afetar o estado dos demais campos de senha na mesma tela.
6. WHILE o campo de senha está no estado oculto, THE App SHALL mascarar os caracteres digitados e exibir o ícone de "olho aberto" no ToggleSenha correspondente.
7. WHILE o campo de senha está no estado visível, THE App SHALL exibir os caracteres em texto claro e exibir o ícone de "olho fechado" no ToggleSenha correspondente.
8. THE ToggleSenha SHALL ter `accessibilityLabel` que reflete o estado atual e a ação disponível: "Mostrar senha" quando o campo está oculto, e "Ocultar senha" quando o campo está visível.

---

### Requisito 3: Validação Inline de E-mail

**User Story:** Como usuário, quero receber feedback imediato sobre o formato do e-mail digitado, para que eu corrija erros antes de submeter o formulário.

#### Critérios de Aceitação

1. WHEN o campo de e-mail perde o foco na Tela_Login ou Tela_Registro, THE Validador_Email SHALL verificar se o valor corresponde ao padrão `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
2. IF o e-mail não corresponder ao padrão após perda de foco, THEN THE App SHALL exibir a mensagem "Formato de e-mail inválido" abaixo do campo de e-mail.
3. WHEN o usuário começa a editar o campo de e-mail após um erro de validação inline, THE App SHALL ocultar a mensagem de erro inline ao primeiro caractere digitado.
4. THE Validador_Email SHALL considerar válidos todos os e-mails que satisfazem o padrão `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
5. THE Validador_Email SHALL considerar inválidos e-mails que não satisfazem o padrão (ex.: sem `@`, sem domínio, com espaços).
6. WHILE o campo de e-mail exibe um erro de validação inline, THE App SHALL manter o botão de submissão desabilitado.

---

### Requisito 4: Indicador de Força de Senha

**User Story:** Como usuário no cadastro, quero ver a força da minha senha em tempo real, para que eu crie uma senha que atenda aos requisitos do sistema.

#### Critérios de Aceitação

1. WHILE o campo de senha da Tela_Registro contém ao menos 1 caractere, THE App SHALL exibir o PasswordStrengthIndicator abaixo do campo de senha.
2. THE Validador_Senha SHALL classificar a senha em quatro níveis mutuamente exclusivos, avaliados em ordem de prioridade decrescente: `forte`, `boa`, `razoável`, `fraca`.
3. IF a senha tem menos de 8 caracteres, THEN THE Validador_Senha SHALL classificá-la como `fraca`.
4. IF a senha tem 12 ou mais caracteres, contém letras minúsculas, números, letras maiúsculas e ao menos um símbolo, THEN THE Validador_Senha SHALL classificá-la como `forte`.
5. IF a senha tem 8 ou mais caracteres, contém letras minúsculas, números e letras maiúsculas, e não satisfaz os critérios de `forte`, THEN THE Validador_Senha SHALL classificá-la como `boa`.
6. IF a senha tem 8 ou mais caracteres, contém letras minúsculas e números, e não satisfaz os critérios de `forte` ou `boa`, THEN THE Validador_Senha SHALL classificá-la como `razoável`.
7. THE PasswordStrengthIndicator SHALL exibir uma barra de progresso colorida: vermelho para `fraca`, laranja para `razoável`, amarelo para `boa`, verde para `forte`.
8. THE PasswordStrengthIndicator SHALL exibir o rótulo textual do nível atual da senha.
9. WHILE a senha está classificada como `fraca`, THE App SHALL manter o botão "Criar conta" desabilitado.
10. WHILE o campo de senha da Tela_Registro está vazio, THE App SHALL ocultar o PasswordStrengthIndicator.

---

### Requisito 5: Confirmação de Senha no Registro

**User Story:** Como usuário no cadastro, quero confirmar minha senha digitando-a duas vezes, para que eu evite erros de digitação que me impediriam de acessar a conta.

#### Critérios de Aceitação

1. THE Tela_Registro SHALL exibir um campo "Confirmar senha" após o campo de senha.
2. WHEN o campo "Confirmar senha" perde o foco e os valores de senha e confirmação são diferentes, THE App SHALL exibir a mensagem "As senhas não coincidem" abaixo do campo de confirmação.
3. WHEN o usuário digita o primeiro caractere no campo "Confirmar senha" após um erro de não-coincidência, THE App SHALL ocultar a mensagem de erro.
4. WHILE os campos de senha e confirmação contêm valores diferentes, ambos já receberam e perderam o foco ao menos uma vez, e o botão "Criar conta" não foi acionado, THE App SHALL manter o botão "Criar conta" desabilitado. O botão inicia desabilitado por padrão até que todos os campos obrigatórios sejam preenchidos.
5. IF o usuário acionar o botão "Criar conta" e os valores de senha e confirmação forem diferentes, THEN THE App SHALL não submeter o formulário ao AuthStore.

---

### Requisito 6: Navegação por Teclado entre Campos

**User Story:** Como usuário mobile, quero navegar entre os campos do formulário usando o botão de ação do teclado, para que eu preencha o formulário sem precisar tocar em cada campo manualmente.

#### Critérios de Aceitação

1. WHEN o campo de e-mail da Tela_Login está em foco, THE App SHALL exibir o botão de ação do teclado como "próximo" (next).
2. WHEN o usuário aciona o botão "próximo" no campo de e-mail da Tela_Login, THE App SHALL mover o foco para o campo de senha.
3. WHEN o campo de senha da Tela_Login está em foco, THE App SHALL exibir o botão de ação do teclado como "concluído" (done).
4. WHEN o usuário aciona o botão "concluído" no campo de senha da Tela_Login e todos os campos obrigatórios estão preenchidos e válidos, THE App SHALL acionar a submissão do formulário.
5. WHEN o usuário aciona o botão "concluído" no campo de senha da Tela_Login e algum campo obrigatório está vazio ou inválido, THE App SHALL não submeter o formulário.
6. WHEN qualquer campo da Tela_Registro exceto o último está em foco, THE App SHALL exibir o botão de ação do teclado como "próximo" (next) e mover o foco para o próximo campo na sequência nome → e-mail → senha → confirmação de senha ao ser acionado.
7. WHEN o campo de confirmação de senha da Tela_Registro está em foco, THE App SHALL exibir o botão de ação do teclado como "concluído" (done).
8. WHEN o usuário aciona o botão "concluído" no campo de confirmação de senha da Tela_Registro e todos os campos obrigatórios estão preenchidos e válidos, THE App SHALL acionar a submissão do formulário.
9. WHEN o usuário aciona o botão "concluído" no campo de confirmação de senha da Tela_Registro e algum campo obrigatório está vazio ou inválido, THE App SHALL não submeter o formulário.

---

### Requisito 7: Remoção da Senha da URL de Navegação

**User Story:** Como usuário, quero que minha senha não seja exposta em URLs de navegação, para que minhas credenciais não apareçam em logs, histórico de navegação ou ferramentas de debug.

#### Critérios de Aceitação

1. THE AuthStore SHALL armazenar a senha temporariamente em memória após o registro, sem incluí-la em parâmetros de URL.
2. WHEN o AuthStore navega para `/confirm` após o registro, THE App SHALL passar apenas o e-mail como parâmetro de rota (`/confirm?email=...`).
3. THE Tela_Confirmacao SHALL recuperar a senha do campo `pendingPassword` do AuthStore, não de `useLocalSearchParams`.
4. WHEN a confirmação de e-mail é concluída com sucesso, THE AuthStore SHALL limpar o campo `pendingPassword` (definindo-o como `null`).
5. IF `confirmSignUp` falhar 3 vezes consecutivas para o mesmo e-mail, THEN THE AuthStore SHALL limpar o campo `pendingPassword`.
6. THE App SHALL garantir que a senha não apareça em nenhuma URL de rota do Expo Router em nenhum ponto do fluxo de registro.
7. WHEN o usuário navega para fora da Tela_Confirmacao sem concluir a confirmação (ex.: pressiona "Voltar"), THE AuthStore SHALL limpar o campo `pendingPassword`.

---

### Requisito 8: Cooldown no Reenvio de Código

**User Story:** Como usuário na tela de confirmação, quero saber quando posso reenviar o código, para que eu não envie múltiplas requisições acidentalmente e entenda o tempo de espera.

#### Critérios de Aceitação

1. WHEN a Tela_Confirmacao é exibida pela primeira vez, THE App SHALL exibir o botão "Reenviar código" habilitado.
2. WHEN o Cognito confirma o reenvio do código com sucesso, THE Cooldown_Reenvio SHALL iniciar uma contagem regressiva de 60 segundos.
3. WHILE o Cooldown_Reenvio está ativo, THE Tela_Confirmacao SHALL exibir o botão "Reenviar código" desabilitado com o texto "Reenviar em Xs" onde X é o tempo restante em segundos.
4. WHEN o Cooldown_Reenvio expira, THE Tela_Confirmacao SHALL reabilitar o botão "Reenviar código" com o texto "Reenviar código".
5. WHEN o reenvio é bem-sucedido, THE Tela_Confirmacao SHALL exibir uma mensagem de confirmação em um componente distinto do componente de erro — a mensagem de sucesso e a mensagem de erro nunca são exibidas simultaneamente.
6. THE Tela_Confirmacao SHALL exibir a informação "O código expira em 24 horas" abaixo do campo de código.
7. IF o Cognito retornar `ExpiredCodeException`, THEN THE Tela_Confirmacao SHALL exibir a mensagem mapeada pelo `cognitoErrorMapper` e exibir o botão "Reenviar código" no estado habilitado (independente do cooldown ativo).

---

### Requisito 9: Auto-submit do Código de Confirmação

**User Story:** Como usuário na tela de confirmação, quero que o código seja submetido automaticamente ao digitar o 6º dígito, para que eu não precise pressionar um botão extra após completar o código.

#### Critérios de Aceitação

1. WHEN o campo de código da Tela_Confirmacao passa a conter exatamente 6 dígitos numéricos, THE App SHALL acionar automaticamente a confirmação sem interação adicional do usuário.
2. WHILE `isLoading` é `true` no AuthStore após o auto-submit, THE Tela_Confirmacao SHALL exibir o indicador de carregamento e manter o campo de código desabilitado.
3. IF `confirmSignUp` retornar um erro após o auto-submit, THEN THE Tela_Confirmacao SHALL exibir a mensagem de erro mapeada pelo `cognitoErrorMapper`, reabilitar o campo de código preservando os 6 dígitos digitados, e permitir nova tentativa manual ou auto-submit após correção.
4. IF o campo de código contiver menos de 6 dígitos ou caracteres não numéricos, THEN THE App SHALL não acionar o auto-submit.

---

### Requisito 10: Identidade Visual dos Times na Seleção

**User Story:** Como novo usuário, quero ver informações visuais e contextuais sobre cada time disponível, para que eu faça uma escolha informada e me identifique com o time escolhido.

#### Critérios de Aceitação

1. THE Tela_SelectTime SHALL exibir o nome de cada time conforme definido no campo `name` da constante `TEAMS` do `config.ts`.
2. THE Tela_SelectTime SHALL exibir uma área visual reservada para o logo de cada time; enquanto o logo real não estiver disponível, SHALL exibir um ícone genérico de time.
3. THE Tela_SelectTime SHALL exibir uma descrição curta para cada time, lida do campo `description` da constante `TEAMS`; o campo `description` SHALL ser adicionado à constante `TEAMS` com no máximo 80 caracteres por time.
4. THE Tela_SelectTime SHALL aplicar a cor definida no campo `color` da constante `TEAMS` como cor de destaque da borda do card de cada time.
5. WHEN o usuário toca no card de um time, THE App SHALL exibir imediatamente um indicador visual de seleção ativo naquele card (ex.: borda mais espessa ou ícone de confirmação) antes de iniciar a chamada ao AuthStore.

---

### Requisito 11: Feedback de Erro com Destaque Visual

**User Story:** Como usuário, quero que mensagens de erro sejam visualmente distintas e bem posicionadas, para que eu identifique rapidamente o problema e saiba como corrigi-lo.

#### Critérios de Aceitação

1. WHEN `AuthStore.error` é definido por uma operação de login com falha, THE Tela_Login SHALL exibir a mensagem de erro em um componente de alerta posicionado acima do botão de submissão.
2. WHEN `AuthStore.error` é definido por uma operação de registro com falha, THE Tela_Registro SHALL exibir a mensagem de erro em um componente de alerta posicionado acima do botão de submissão.
3. WHEN `AuthStore.error` é definido por uma operação de confirmação com falha, THE Tela_Confirmacao SHALL exibir a mensagem de erro em um componente de alerta distinto do componente de mensagem de sucesso de reenvio.
4. WHEN `AuthStore.error` recebe um novo valor não nulo, THE App SHALL substituir atomicamente a mensagem exibida pelo novo valor, sem exibir estado intermediário vazio.
5. WHEN o usuário começa a editar qualquer campo editável na tela ativa após um erro global do AuthStore, THE App SHALL limpar `AuthStore.error` (definindo-o como `null`).

---

### Requisito 12: Identificadores de Teste (testID)

**User Story:** Como desenvolvedor, quero que os campos e botões principais das telas de autenticação tenham `testID`, para que os testes automatizados possam localizar elementos de forma confiável.

#### Critérios de Aceitação

1. THE Tela_Login SHALL atribuir `testID="login-email-input"` ao campo de e-mail e `testID="login-password-input"` ao campo de senha.
2. THE Tela_Login SHALL atribuir `testID="login-submit-button"` ao botão "Entrar" e `testID="login-forgot-password-link"` ao link "Esqueci minha senha".
3. THE Tela_Registro SHALL atribuir `testID="register-name-input"` ao campo de nome, `testID="register-email-input"` ao campo de e-mail, `testID="register-password-input"` ao campo de senha e `testID="register-confirm-password-input"` ao campo de confirmação de senha.
4. THE Tela_Registro SHALL atribuir `testID="register-submit-button"` ao botão "Criar conta".
5. THE Tela_RecuperacaoSenha SHALL atribuir `testID="forgot-email-input"` ao campo de e-mail e `testID="forgot-submit-button"` ao botão de envio do formulário de recuperação.
6. THE Tela_RedefinicaoSenha SHALL atribuir `testID="reset-code-input"` ao campo de código de redefinição, `testID="reset-password-input"` ao campo de nova senha e `testID="reset-submit-button"` ao botão de confirmação da redefinição.
7. WHEN qualquer tela de autenticação é renderizada, THE App SHALL garantir que cada `testID` listado nos critérios 1–6 seja único dentro da tela e esteja presente no elemento renderizado.

---

## Propriedades de Corretude

As propriedades abaixo são candidatas a testes baseados em propriedades (property-based testing) para validar a lógica pura dos módulos de validação e do mecanismo de armazenamento em memória.

### P1: Validador_Email — Propriedade de Classificação Correta

Para qualquer string `s`:
- Se `s` satisfaz `^[^\s@]+@[^\s@]+\.[^\s@]+$`, então `Validador_Email.isValid(s)` retorna `true`.
- Se `s` não satisfaz o padrão, então `Validador_Email.isValid(s)` retorna `false`.
- **Tipo**: Propriedade metamórfica (partição de entrada em válidos/inválidos).

### P2: Validador_Senha — Monotonicidade da Força

Para qualquer senha `p1` e `p2` onde `p2 = p1 + caractere_adicional`:
- `Validador_Senha.getLevel(p2) >= Validador_Senha.getLevel(p1)` (adicionar caracteres nunca reduz a força).
- **Tipo**: Propriedade metamórfica (relação de ordem entre entradas relacionadas).

### P3: Validador_Senha — Idempotência

Para qualquer senha `p`:
- `Validador_Senha.getLevel(p) === Validador_Senha.getLevel(p)` (chamadas repetidas retornam o mesmo resultado).
- **Tipo**: Idempotência (função pura sem efeitos colaterais).

### P4: Cooldown_Reenvio — Invariante de Estado

Para qualquer instância do Cooldown_Reenvio após `start()`:
- `remainingSeconds` está sempre no intervalo `[0, 60]`.
- `isActive` é `true` se e somente se `remainingSeconds > 0`.
- **Tipo**: Invariante de estado.

### P5: Armazenamento em Memória — Limpeza Após Uso

Para qualquer fluxo de registro:
- Após `confirmSignUp` ser chamado com sucesso, ou após 3 falhas consecutivas, ou após o usuário abandonar a Tela_Confirmacao, `AuthStore.pendingPassword` é `null`.
- **Tipo**: Propriedade de ciclo de vida (garantia de limpeza).
