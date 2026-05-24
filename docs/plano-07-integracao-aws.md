# Plano 07 — Integração AWS e Próximos Passos

> **Princípio central:** Após provisionar a infra (guia em `infra/README.md`), conectar o app aos serviços reais e remover os mocks. Depois, iterar sobre melhorias incrementais.

---

## Objetivo

Conectar o app Sektor à infraestrutura AWS real, remover dados mockados, validar o fluxo end-to-end com múltiplos usuários e preparar para distribuição.

---

## Dependências

- **Planos 01–06 concluídos** (código do app pronto)
- **Infraestrutura AWS provisionada** conforme `infra/README.md`
- **`.env.local` preenchido** com IDs reais do Cognito, URLs de API REST e WebSocket

---

## Fase 1 — Conectar Autenticação (Cognito)

### Tarefas

1. Preencher `.env.local` com `EXPO_PUBLIC_COGNITO_USER_POOL_ID` e `EXPO_PUBLIC_COGNITO_CLIENT_ID` reais
2. Criar um usuário de teste via console Cognito ou CLI
3. Testar fluxo completo: cadastro → escolha de time → login → sessão persistida → logout
4. Verificar que `custom:teamId` é salvo corretamente no Cognito

### Validação

- [ ] Cadastro cria usuário no Cognito
- [ ] Login retorna tokens válidos
- [ ] `useAuthStore().user` populado com `name`, `email`, `teamId`
- [ ] Sessão persiste após fechar e reabrir o app

---

## Fase 2 — Conectar API REST (Fórum)

### Tarefas

1. Preencher `EXPO_PUBLIC_API_REST_URL` com a URL real do API Gateway REST
2. Implementar as Lambdas REST (posts, comments, likes, upload-url) — ver `infra/README.md` Passo 9
3. Testar cada endpoint com token Cognito válido
4. Verificar que o feed carrega posts filtrados por `teamId`

### Validação

- [ ] `GET /posts?teamId=team-a` retorna posts do time
- [ ] `POST /posts` cria post no DynamoDB
- [ ] `POST /posts/{id}/like` incrementa curtida
- [ ] `GET /upload-url` retorna URL pré-assinada funcional
- [ ] Upload direto para S3 funciona
- [ ] Comentários são criados e listados

---

## Fase 3 — Conectar WebSocket (Arena)

### Tarefas

1. Preencher `EXPO_PUBLIC_API_WS_URL` com a URL real do API Gateway WebSocket
2. Remover o mock do `arena/[matchId].tsx`:
   - Remover import de `MOCK_MATCH` e `startMockSimulator`
   - Remover o `useEffect` que chama `setMatch(MOCK_MATCH)` e `startMockSimulator`
   - O WebSocket já está conectado e receberá `MATCH_STATE` automaticamente
3. Testar conexão WebSocket com `wscat`
4. Rodar o simulador: `npm run simulate match-001 5`
5. Verificar que predições aparecem no app

### Código a remover de `src/app/arena/[matchId].tsx`

```diff
- import { MOCK_MATCH, startMockSimulator } from "../../services/matchSimulator";

- useEffect(() => {
-   setMatch(MOCK_MATCH);
-   const stop = startMockSimulator(setActivePrediction, updatePressure);
-   return () => { stop(); reset(); };
- }, [matchId, setMatch, setActivePrediction, updatePressure, reset]);

+ useEffect(() => {
+   return () => { reset(); };
+ }, [reset]);
```

### Validação

- [ ] WebSocket conecta ao API Gateway
- [ ] `MATCH_STATE` recebido na conexão (Lambda de boas-vindas)
- [ ] Simulador emite evento → Bedrock gera predição → app exibe PredictionCard
- [ ] Resposta do usuário é enviada via WebSocket
- [ ] `PRESSURE_UPDATE` atualiza a PressureBar

---

## Fase 4 — Teste Multijogador

### Tarefas

1. Criar 2+ usuários de teste em times diferentes
2. Abrir o app em 2 dispositivos/simuladores simultaneamente
3. Rodar o simulador e verificar que ambos recebem predições
4. Verificar que respostas de cada time afetam a PressureBar

### Validação

- [ ] 2 usuários conectados à mesma partida
- [ ] Ambos recebem a mesma predição
- [ ] PressureBar reflete respostas de ambos os times
- [ ] Multiplicador GPS funciona (se um estiver "no estádio")

---

## Fase 5 — Polimento Final e Distribuição

### Tarefas

1. Testar GPS com coordenadas reais do estádio (atualizar `STADIUM_COORDS` em `config.ts`)
2. Testar Modo AR em dispositivo físico
3. Revisar acessibilidade (labels, roles, contraste)
4. Criar build de preview: `eas build --profile preview --platform android`
5. Atualizar `README.md` com instruções de execução

### Melhorias Futuras (backlog)

| Melhoria | Prioridade | Complexidade |
|----------|-----------|--------------|
| Confirmação de e-mail no cadastro | Alta | Baixa |
| Reconexão WebSocket com backoff exponencial | Média | Baixa |
| Cache offline do feed (AsyncStorage) | Média | Média |
| Notificações push para predições | Alta | Alta |
| Ranking de torcedores por pontuação | Média | Média |
| Animações na PressureBar (Reanimated) | Baixa | Baixa |
| Múltiplos times (mais de 2) | Baixa | Média |
| Histórico de predições do usuário | Média | Baixa |
| Moderação de posts (report/block) | Alta | Média |
| Deep links para partidas específicas | Média | Baixa |

---

## Checklist Final do Projeto

- [ ] Cognito funcional (cadastro, login, sessão, logout)
- [ ] API REST funcional (posts, likes, comments, upload)
- [ ] WebSocket funcional (conexão, predições, pressão)
- [ ] Simulador emitindo eventos → Pipeline gerando predições
- [ ] GPS detectando presença no estádio
- [ ] Modo AR renderizando overlay sobre câmera
- [ ] Tema Sektor aplicado em todas as telas
- [ ] `tsc --noEmit` sem erros
- [ ] Testes passando (43 testes)
- [ ] Build de preview gerado sem erros
- [ ] README atualizado com instruções
