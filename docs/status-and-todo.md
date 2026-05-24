# Status do projeto e o que falta

Última atualização: 2026-05-14

## ✅ Concluído

### Planos 01–04 (frontend + pipeline AWS)
- Plano 01 — Estrutura, navegação, tipos, NativeWind
- Plano 02 — Cognito + login/cadastro/escolha de time
- Plano 03 — Modo Arena com WebSocket, PressureBar, PredictionCard
- Plano 04 — Pipeline AWS funcionando end-to-end:
  - Script simulador `npm run simulate <matchId> <duration>` emitindo no Kinesis
  - Lambda `processEvent` filtrando eventos, gerando predição via Bedrock (Nova Lite) e distribuindo via WebSocket
  - Lambdas `wsConnect` / `wsDisconnect` mantendo `sektor-connections` no DynamoDB
  - App consome predições reais (mock removido em `src/app/arena/[matchId].tsx`)

### Infra AWS provisionada
- Cognito User Pool + App Client
- DynamoDB: `sektor-connections` (com GSI `connectionId-index` e TTL)
- API Gateway WebSocket `sektor-ws-api` (ID: `3bodgtvae0`, stage `prod`, auto-deploy)
- Lambdas: `wsConnect`, `wsDisconnect`, `processEvent`, `resolveAnswer`
- Kinesis Stream: `sektor-match-events` (1 shard) com trigger no `processEvent`
- Bedrock: modelo `amazon.nova-lite-v1:0` liberado (Claude bloqueado por SCP da org)
- IAM policies inline em cada role (DynamoDB, Bedrock, ManageConnections, Kinesis)

URLs/IDs em `.kiro/steering/aws-resources.md`.

---

## 🟡 Parcial / Pendente

### Plano 04 — pontos a validar
- [ ] Lambda `resolveAnswer` ainda **não tem trigger automático** quando uma `PREDICTION` expira (15s). Hoje só roda se invocada manualmente. Decidir:
  - Opção A: criar `EventBridge Scheduler` com one-shot agendado pelo `processEvent` no momento que cria a predição (mais simples para hackathon)
  - Opção B: fazer o `processEvent` invocar `resolveAnswer` direto via `lambda:Invoke` com delay (Step Functions, mais complexo)
- [ ] Tabela `sektor-scores` ainda **não existe**. O `resolveAnswer` deveria atualizar score por usuário/partida. Definir schema e provisionar.
- [ ] App ainda não envia o `ANSWER` real; revisar `services/arenaProtocol.ts` + Lambda que recebe respostas (rota `sendMessage` na WS API ou endpoint REST).
- [ ] Limpar mock não utilizado: `src/services/matchSimulator.ts` e teste correspondente.

### Plano 05 — Comunidade (não iniciado na infra)
- [ ] DynamoDB: criar `sektor-posts`, `sektor-comments`, `sektor-likes` (passo 2 do `infra/README.md`)
- [ ] S3: criar bucket `sektor-media-bucket` com CORS (passo 3)
- [ ] API Gateway REST `sektor-rest-api` com Cognito Authorizer (passo 8)
- [ ] Lambdas REST: `getPosts`, `createPost`, `likePost`, `unlikePost`, `getComments`, `createComment`, `getUploadUrl` (passo 9)
- [ ] App: trocar mocks de `community` pelos endpoints reais. Variável `EXPO_PUBLIC_API_REST_URL` no `.env.local`.

### Plano 06 — GPS + AR + polimento
- [ ] Atualizar `STADIUM_COORDS` em `src/constants/config.ts` com coordenadas reais do estádio
- [ ] Validar fluxo de permissão GPS no Android e iOS
- [ ] Validar `ARView` com câmera real (já implementado, mas precisa testar em device)
- [ ] Tema visual Sektor: revisar paleta, tipografia, ícones
- [ ] Testar multiplicador 2x ponta-a-ponta (GPS → ANSWER → Lambda → score)

---

## 🔧 Débitos técnicos / observações

- **SCP da org bloqueia Anthropic no Bedrock** — Claude Haiku/Sonnet não funcionam nessa conta. Trocamos para `amazon.nova-lite-v1:0`. Se um dia a SCP for liberada, voltar para Claude pode melhorar a qualidade dos prompts JSON.
- Cada Lambda foi criada pelo console com role própria (não existe `sektor-lambda-role` único como sugere o `infra/README.md`). Atualizar o README depois.
- A integração WebSocket inicial foi criada com flags estranhas (`PassthroughBehavior`, `ContentHandlingStrategy`) — recriadas via CLI. Se for usar IaC depois (Terraform/CDK), recria limpo.
- `AmazonAPIGatewayInvokeFullAccess` NÃO cobre `execute-api:ManageConnections`; usar policy inline.

---

## ▶️ Como retomar

1. Confere se `.env.local` tem:
   ```
   EXPO_PUBLIC_API_WS_URL=wss://3bodgtvae0.execute-api.us-east-1.amazonaws.com/prod
   EXPO_PUBLIC_COGNITO_USER_POOL_ID=...
   EXPO_PUBLIC_COGNITO_CLIENT_ID=...
   ```
2. Smoke test do pipeline:
   - Terminal 1: `wscat -c "wss://3bodgtvae0.execute-api.us-east-1.amazonaws.com/prod?matchId=test-001"`
   - Terminal 2: `npm run simulate test-001 3`
   - Esperado: chegam mensagens `{"type":"PREDICTION", ...}` no terminal 1.
3. Próximo passo recomendado: fechar o ciclo de resposta (item "Plano 04 — pontos a validar") **ou** começar o Plano 05 (comunidade), que é independente.
