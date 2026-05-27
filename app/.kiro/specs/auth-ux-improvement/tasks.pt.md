# Implementation Plan: auth-ux-improvement

## Overview

Implementação incremental das melhorias de UX no fluxo de autenticação do Sektor Connected Arena. As mudanças são exclusivamente no frontend (React Native + Expo + TypeScript), sem alterações no backend Cognito. A ordem das tarefas prioriza fundações reutilizáveis (validadores, componentes UI) antes das telas e do AuthStore.

## Tasks

- [x] 1. Criar módulos de validação
  - [x] 1.1 Implementar `src/utils/validators/email.ts`
    - Exportar `isValidEmail(value: string): boolean` usando o regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ]* 1.2 Escrever testes de propriedade para `isValidEmail` (P1 e P2)
    - **Property 1: isValidEmail retorna true para qualquer e-mail que satisfaz o padrão**
    - **Validates: Requirements 3.4**
    - **Property 2: isValidEmail retorna false para qualquer e-mail que não satisfaz o padrão**
    - **Validates: Requirements 3.5**
    - Usar `fast-check` com `fc.emailAddress()` para P1 e strings sem `@` / com espaços para P2
    - Arquivo: `src/utils/validators/__tests__/email.test.ts`

  - [x] 1.3 Implementar `src/utils/validators/password.ts`
    - Exportar tipos `PasswordLevel` e `PasswordStrength`
    - Exportar `getPasswordStrength(password: string): PasswordStrength` com os quatro níveis mutuamente exclusivos conforme design
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 1.4 Escrever testes de propriedade para `getPasswordStrength` (P3 e P4)
    - **Property 3: getPasswordStrength retorna exatamente um nível para qualquer senha**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6**
    - **Property 4: adicionar caracteres nunca reduz o score da senha**
    - **Validates: Requirements 4.2**
    - Arquivo: `src/utils/validators/__tests__/password.test.ts`

- [ ] 2. Criar componentes UI reutilizáveis
  - [x] 2.1 Implementar `src/components/ui/InlineError.tsx`
    - Props: `message: string | null`, `testID?: string`
    - Renderiza `null` quando `message` é nulo ou vazio; caso contrário exibe texto em `text-red-400`
    - _Requirements: 3.2, 5.2_

  - [x] 2.2 Implementar `src/components/ui/AlertBanner.tsx`
    - Props: `message: string | null`, `type: "error" | "success"`, `testID?: string`
    - Renderiza `null` quando `message` é nulo
    - Estilos distintos para `error` (fundo `bg-red-900/30`, borda `border-red-500`) e `success` (fundo `bg-green-900/30`, borda `border-green-500`)
    - _Requirements: 11.1, 11.2, 11.3, 8.5_

  - [x] 2.3 Implementar `src/components/ui/ToggleSenha.tsx`
    - Props: `isVisible: boolean`, `onToggle: () => void`, `testID?: string`
    - Ícone `Eye` (Lucide) quando `isVisible=false`, `EyeOff` quando `isVisible=true`
    - `accessibilityLabel`: `"Mostrar senha"` / `"Ocultar senha"` conforme estado
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8_

  - [ ] 2.4 Implementar `src/components/ui/PasswordStrengthIndicator.tsx`
    - Props: `password: string`
    - Oculto quando `password.length === 0`
    - Barra de progresso com 4 segmentos coloridos usando cores do design
    - Rótulo textual do nível atual
    - Usa `getPasswordStrength` de `validators/password.ts`
    - _Requirements: 4.1, 4.7, 4.8, 4.10_

  - [ ]* 2.5 Escrever testes de propriedade para `PasswordStrengthIndicator` (P5)
    - **Property 5: PasswordStrengthIndicator exibe cor e rótulo consistentes com getPasswordStrength para qualquer senha não vazia**
    - **Validates: Requirements 4.7, 4.8**
    - Arquivo: `src/components/ui/__tests__/PasswordStrengthIndicator.test.tsx`

- [x] 3. Criar hook `useCooldown`
  - [x] 3.1 Implementar `src/hooks/useCooldown.ts`
    - Retorna `{ remaining: number, isActive: boolean, start: () => void }`
    - Contagem regressiva de `durationSeconds` até 0 usando `setInterval` de 1s
    - Limpa o intervalo ao desmontar ou quando `isActive` se torna `false`
    - _Requirements: 8.2, 8.3, 8.4_

- [ ] 4. Estender o AuthStore
  - [ ] 4.1 Adicionar campos e actions ao `AuthStore`
    - Adicionar campos: `pendingPassword: string | null`, `resendSuccessMessage: string | null`, `loginSuccessMessage: string | null`
    - Adicionar actions: `forgotPassword(email: string): Promise<void>`, `confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void>`
    - Modificar `register`: armazenar `pendingPassword` no store antes de navegar; remover senha da URL (passar apenas `email` para `/confirm`)
    - Modificar `confirmSignUp`: ler `pendingPassword` do store; limpar após sucesso ou 3 falhas consecutivas; limpar ao navegar para fora da tela
    - Modificar `resendCode`: separar resultado em `resendSuccessMessage` (sucesso) vs `error` (falha)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 1.3, 1.5, 8.5_

  - [ ]* 4.2 Escrever testes de propriedade para o AuthStore (P6, P7, P12)
    - **Property 6: nenhuma URL de navegação gerada pelo AuthStore contém a senha como parâmetro de rota**
    - **Validates: Requirements 7.1, 7.2, 7.6**
    - **Property 7: pendingPassword é null após confirmSignUp com sucesso, 3 falhas consecutivas ou abandono da tela**
    - **Validates: Requirements 7.4, 7.5, 7.7**
    - **Property 12: botão de submissão está desabilitado enquanto isLoading=true**
    - **Validates: Requirements 1.10, 1.3, 1.5**
    - Arquivo: `src/store/__tests__/authStore.test.ts`

- [ ] 5. Checkpoint — Fundações prontas
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Atualizar `config.ts` com campo `description` nos times
  - [x] 6.1 Adicionar campo `description` à constante `TEAMS` em `config.ts`
    - Máximo 80 caracteres por time
    - _Requirements: 10.3_

- [ ] 7. Criar novas telas de recuperação de senha
  - [ ] 7.1 Criar `src/app/(auth)/forgot-password.tsx`
    - Campo de e-mail com `testID="forgot-email-input"` e validação inline via `isValidEmail` + `InlineError`
    - Botão de submissão com `testID="forgot-submit-button"`, desabilitado durante loading e com e-mail inválido
    - Botão "Voltar" chamando `router.back()`
    - `AlertBanner type="error"` para erros do AuthStore
    - Chama `forgotPassword(email)` do AuthStore ao submeter
    - _Requirements: 1.1, 1.2, 1.3, 1.8, 1.9, 1.10, 12.5_

  - [ ] 7.2 Criar `src/app/(auth)/reset-password.tsx`
    - Campo de código com `testID="reset-code-input"`
    - Campo de nova senha com `testID="reset-password-input"` e `ToggleSenha`
    - Botão de submissão com `testID="reset-submit-button"`, desabilitado durante loading
    - Botão "Voltar" chamando `router.back()`
    - `AlertBanner type="error"` para erros do AuthStore
    - Chama `confirmForgotPassword(email, code, newPassword)` ao submeter
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.9, 1.10, 12.6_

  - [ ]* 7.3 Escrever testes de exemplo para `forgot-password.tsx` e `reset-password.tsx`
    - Verificar presença dos `testID`s obrigatórios (P11)
    - Testar fluxo de navegação completo: login → forgot-password → reset-password → login
    - Testar estado desabilitado do botão durante loading
    - Arquivos: `src/app/(auth)/__tests__/forgot-password.test.tsx`, `reset-password.test.tsx`

- [ ] 8. Atualizar `login.tsx`
  - [ ] 8.1 Aplicar melhorias de UX ao `login.tsx`
    - Adicionar `testID="login-email-input"` e `testID="login-password-input"` nos campos
    - Adicionar `testID="login-submit-button"` no botão "Entrar"
    - Adicionar link "Esqueci minha senha" com `testID="login-forgot-password-link"` navegando para `/forgot-password`
    - Adicionar `ToggleSenha` no campo de senha (estado local `isPasswordVisible`)
    - Adicionar validação inline de e-mail via `InlineError` (dispara no `onBlur`)
    - Substituir exibição de erro por `AlertBanner type="error"`
    - Exibir `AlertBanner type="success"` quando `loginSuccessMessage` está definido
    - Adicionar `returnKeyType="next"` no campo de e-mail com `onSubmitEditing` focando o campo de senha via `useRef`
    - Adicionar `returnKeyType="done"` no campo de senha com `onSubmitEditing` acionando submit se válido
    - Limpar `AuthStore.error` ao editar qualquer campo
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 3.2, 3.3, 6.1, 6.2, 6.3, 6.4, 6.5, 11.1, 11.4, 11.5, 12.1, 12.2_

  - [ ]* 8.2 Escrever testes de exemplo para `login.tsx`
    - Verificar presença dos `testID`s obrigatórios (P11)
    - Testar toggle de senha, validação inline de e-mail, link "Esqueci minha senha"
    - Arquivo: `src/app/(auth)/__tests__/login.test.tsx`

- [ ] 9. Atualizar `register.tsx`
  - [ ] 9.1 Aplicar melhorias de UX ao `register.tsx`
    - Adicionar `testID` nos campos e botão (Requisitos 12.3–12.4)
    - Adicionar campo "Confirmar senha" com `testID="register-confirm-password-input"`
    - Adicionar `ToggleSenha` independente nos campos de senha e confirmação
    - Adicionar `PasswordStrengthIndicator` abaixo do campo de senha
    - Adicionar validação inline de e-mail via `InlineError` (dispara no `onBlur`)
    - Adicionar validação de coincidência de senhas via `InlineError` (dispara no `onBlur` do campo de confirmação)
    - Atualizar lógica de `canSubmit`: incluir força de senha (`level !== "fraca"`), coincidência de senhas e e-mail válido
    - Adicionar navegação por teclado: nome → e-mail → senha → confirmação com `returnKeyType` e `useRef`
    - Substituir exibição de erro por `AlertBanner type="error"`
    - Limpar `AuthStore.error` ao editar qualquer campo
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 4.1, 4.9, 5.1, 5.2, 5.3, 5.4, 5.5, 6.6, 6.7, 6.8, 6.9, 11.2, 11.4, 11.5, 12.3, 12.4_

  - [ ]* 9.2 Escrever testes de exemplo para `register.tsx`
    - Verificar presença dos `testID`s obrigatórios (P11)
    - Testar validação inline de e-mail, coincidência de senhas, PasswordStrengthIndicator, toggles independentes
    - Arquivo: `src/app/(auth)/__tests__/register.test.tsx`

- [ ] 10. Atualizar `confirm.tsx`
  - [ ] 10.1 Aplicar melhorias de UX ao `confirm.tsx`
    - Remover leitura de `password` de `useLocalSearchParams`; ler `pendingPassword` do `AuthStore`
    - Implementar auto-submit: quando `code.length === 6` e todos os caracteres são numéricos, chamar `confirmSignUp` automaticamente
    - Desabilitar campo de código e exibir loading durante `isLoading`; reabilitar preservando os 6 dígitos em caso de erro
    - Integrar `useCooldown(60)`: iniciar após reenvio bem-sucedido; exibir botão desabilitado com texto `"Reenviar em Xs"`; reabilitar ao expirar
    - Exibir `AlertBanner type="success"` para `resendSuccessMessage` (separado do `AlertBanner type="error"`)
    - Adicionar texto "O código expira em 24 horas" abaixo do campo de código
    - Tratar `ExpiredCodeException`: habilitar botão de reenvio mesmo com cooldown ativo
    - Limpar `pendingPassword` ao navegar para fora da tela (listener de foco/blur do Expo Router)
    - _Requirements: 7.3, 7.4, 7.5, 7.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4, 11.3_

  - [ ]* 10.2 Escrever testes de propriedade e de exemplo para `confirm.tsx` (P8, P9, P10, P11)
    - **Property 8: confirmSignUp é chamado automaticamente para exatamente 6 dígitos numéricos e não é chamado para outros inputs**
    - **Validates: Requirements 9.1, 9.4**
    - **Property 9: botão "Reenviar código" exibe "Reenviar em Xs" para qualquer valor de segundos restantes em [1, 60]**
    - **Validates: Requirements 8.3**
    - **Property 10: AlertBanner success e error nunca são exibidos simultaneamente**
    - **Validates: Requirements 8.5**
    - **Property 11: todos os testIDs obrigatórios estão presentes e são únicos na tela**
    - **Validates: Requirements 12.7**
    - Arquivo: `src/app/(auth)/__tests__/confirm.test.tsx`

- [ ] 11. Atualizar `select-team.tsx`
  - [ ] 11.1 Aplicar melhorias visuais ao `select-team.tsx`
    - Adicionar área de logo com ícone genérico de time (via `@expo/vector-icons`) enquanto logo real não está disponível
    - Exibir campo `description` de cada time lido da constante `TEAMS`
    - Aplicar `team.color` como cor de borda do card
    - Adicionar estado local `selectedId` para exibir indicador visual de seleção imediata antes da chamada async ao AuthStore
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 12. Checkpoint final — Integração completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- O design usa TypeScript com React Native + Expo + NativeWind
- Instalar `fast-check` antes de executar os testes de propriedade: `npm install --save-dev fast-check`
- Checkpoints garantem validação incremental antes de avançar para as próximas telas
- Propriedades P1–P12 do design são cobertas pelos testes de propriedade marcados com `*`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "1.4", "2.1", "2.2", "2.3", "3.1", "6.1"] },
    { "id": 2, "tasks": ["2.4"] },
    { "id": 3, "tasks": ["2.5", "4.1"] },
    { "id": 4, "tasks": ["4.2", "7.1", "7.2"] },
    { "id": 5, "tasks": ["7.3", "8.1", "9.1"] },
    { "id": 6, "tasks": ["8.2", "9.2", "10.1"] },
    { "id": 7, "tasks": ["10.2", "11.1"] }
  ]
}
```
