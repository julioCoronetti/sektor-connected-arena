# Smoke Test — Fluxo de Autenticação (V4)

Procedimento de smoke manual para validar o fluxo completo:
**cold start → `/login` → `/select-team` → `/community`**

Spec de referência: `corrigir-fluxo-auth-cognito`

---

## Referências de Infraestrutura

| Recurso            | Valor                          |
|--------------------|-------------------------------|
| Cognito User Pool  | `us-east-1_cHokaMBWW`         |
| App Client ID      | `68i7il8tnlbc92r8hobs5op7t`   |
| Região             | `us-east-1`                   |

---

## Pré-condição: Limpar a Sessão Cognito

O device/emulator deve estar sem sessão Cognito válida antes de iniciar o teste.
Escolha **uma** das opções abaixo:

### Opção A — Sign out pelo app
1. Abra o app (se já estiver logado).
2. Navegue até o menu de perfil ou configurações.
3. Toque em **Sair** / **Sign out**.
4. Confirme que o app redireciona para `/login`.

### Opção B — Limpar AsyncStorage via DevTools (Expo)
1. Com o app aberto e o Metro rodando, abra o Expo DevTools no navegador.
2. Acesse a aba **Storage** → **AsyncStorage**.
3. Apague todas as chaves relacionadas ao Amplify/Cognito
   (prefixo `CognitoIdentityServiceProvider.*`).
4. Force-close o app e reabra.

### Opção C — Reinstalar o app (mais confiável)
```bash
# Android (emulator ou device via ADB)
adb uninstall com.sektor.connectedarena
npx expo run:android

# iOS (simulator)
xcrun simctl uninstall booted com.sektor.connectedarena
npx expo run:ios
```

> **Verificação:** Após limpar a sessão, ao abrir o app ele deve ir direto para
> `/login` sem passar por `/community` ou `/select-team`.

---

## Passos do Smoke Test

### Passo 1 — Cold start → tela `/login` aparece em ≤ 10 s

**Ação:** Feche completamente o app (force-close) e reabra a partir do ícone.

**Critério de aceite:**
- A tela `/login` (formulário de e-mail e senha) aparece em **no máximo 10 segundos**.
- **Não há spinner eterno** — o indicador de carregamento (se exibido) desaparece antes de 10 s.
- O console do Metro **não** exibe `isLoading` preso em `true`.

**Resultado:** ☐ Passou &nbsp;&nbsp; ☐ Falhou

---

### Passo 2 — Login com credenciais de teste → usuário autenticado

**Ação:** Na tela `/login`, insira as credenciais de teste e toque em **Entrar**.

> Credenciais de teste devem ser de um usuário Cognito válido no User Pool
> `us-east-1_cHokaMBWW` **sem** o atributo `custom:teamId` definido.

**Critério de aceite:**
- O indicador de carregamento (`isLoading`) aparece brevemente e **libera** após a resposta do Cognito.
- O usuário é autenticado com sucesso (sem mensagem de erro na tela).
- O console do Metro **não** exibe erros de autenticação inesperados.

**Resultado:** ☐ Passou &nbsp;&nbsp; ☐ Falhou

---

### Passo 3 — Tela `/select-team` aparece para usuário sem `custom:teamId`

**Ação:** Após o login do Passo 2, observe para qual tela o app navega.

**Critério de aceite:**
- O app navega automaticamente para `/select-team`.
- A tela exibe as opções de time (ex.: "Time A", "Time B").
- O app **não** navega para `/community` diretamente (pois `custom:teamId` ainda não está definido).

**Resultado:** ☐ Passou &nbsp;&nbsp; ☐ Falhou

---

### Passo 4 — Selecionar time → sem HTTP 400; navega para `/community`

**Ação:** Na tela `/select-team`, toque em **"Time A"** (ou o time disponível).

**Critério de aceite:**
- O console do Metro **NÃO** exibe `HTTP 400` nem a mensagem
  `user.custom:teamId: Attribute does not exist in the schema.`
- O app navega para `/community` após a seleção.
- O atributo `custom:teamId` é persistido no Cognito (verificável via AWS Console
  ou `aws cognito-idp admin-get-user --user-pool-id us-east-1_cHokaMBWW --username <email>`).

**Resultado:** ☐ Passou &nbsp;&nbsp; ☐ Falhou

---

## Seção de Evidência

Preencha após a execução do smoke test:

| Campo              | Valor                          |
|--------------------|-------------------------------|
| Data de execução   |                               |
| Executor           |                               |
| Versão do app      |                               |
| Plataforma         | ☐ Android &nbsp; ☐ iOS        |
| Device / Emulator  |                               |
| Branch / Commit    |                               |

### Resultado por passo

| Passo | Descrição                                      | Resultado              |
|-------|------------------------------------------------|------------------------|
| 1     | Cold start → `/login` em ≤ 10 s               | ☐ Passou &nbsp; ☐ Falhou |
| 2     | Login → `isLoading` libera, usuário autenticado | ☐ Passou &nbsp; ☐ Falhou |
| 3     | `/select-team` para usuário sem `custom:teamId` | ☐ Passou &nbsp; ☐ Falhou |
| 4     | Tap "Time A" → sem HTTP 400, navega `/community` | ☐ Passou &nbsp; ☐ Falhou |

### Resultado geral

☐ **APROVADO** — todos os passos passaram  
☐ **REPROVADO** — um ou mais passos falharam

### Observações / Evidências

```
(cole aqui logs relevantes do Metro, screenshots ou notas adicionais)
```

---

## Critério de Conclusão do Spec

Este smoke test corresponde à validação **V4** do spec `corrigir-fluxo-auth-cognito`.
O spec só pode ser marcado como concluído quando **todos os quatro passos** estiverem
com ☐ marcado como **Passou** e a seção de evidência estiver preenchida.

Validações relacionadas:
- **V1** — Teste automatizado: `initialize()` libera `isLoading` (Jest)
- **V2** — Teste automatizado: `setTeam()` persiste `custom:teamId` (Jest)
- **V3** — Script de infra: `scripts/check-cognito-schema.ts` → exit code 0
- **V4** — Este smoke manual
- **V5** — Ausência do warning `props.pointerEvents is deprecated` nos logs
- **V6** — Testes de preservation passando (Jest)
