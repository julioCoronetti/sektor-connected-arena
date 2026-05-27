# Sektor — Connected Arena

Aplicativo mobile de engajamento de torcidas em tempo real. Fãs competem em predições ao vivo durante partidas da Bundesliga, acumulam pontos, sobem no leaderboard e interagem na comunidade do time.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Mobile | React Native + Expo + NativeWind + Expo Router |
| Auth | Amazon Cognito via AWS Amplify |
| Backend REST | API Gateway REST + AWS Lambda |
| Backend Realtime | API Gateway WebSocket + AWS Lambda |
| Banco de dados | Amazon DynamoDB |
| Storage | Amazon S3 |
| Pipeline de partida | Amazon Kinesis → Lambda → Amazon Bedrock (Nova Lite) |
| Scheduler | Amazon EventBridge Scheduler |
| IA | Amazon Bedrock (amazon.nova-lite-v1:0) |
| Localização | Expo Location (GPS) |
| AR | Expo Camera (overlay nativo) |

---

## Pré-requisitos

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- AWS CLI configurado com credenciais da conta do challenge
- `wscat` para smoke tests: `npm install -g wscat`

---

## Variáveis de Ambiente

Criar `app/.env.local` com:

```
EXPO_PUBLIC_API_WS_URL=wss://<WS_API_ID>.execute-api.us-east-1.amazonaws.com/prod
EXPO_PUBLIC_API_REST_URL=https://<REST_API_ID>.execute-api.us-east-1.amazonaws.com/prod
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
EXPO_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Como Rodar o App

```bash
cd app
npm install
npm run start          # Expo Go (QR code)
npm run android        # Android emulator
npm run ios            # iOS simulator
npm run web            # Watch Party Web (browser)
```

---

## Como Rodar o Simulador de Partida

O simulador lê os dados DFL reais do S3 e emite eventos no Kinesis.

**Via Lambda (produção):**
O simulador é disparado automaticamente quando o primeiro usuário entra na Arena. Não é necessário rodar manualmente.

**Via script local (desenvolvimento):**
```bash
cd app
npm run simulate match-001 5
# Parâmetros: <matchId> <durationMinutes>
```

**Smoke test manual:**
```bash
# Terminal 1 — conectar ao WebSocket
wscat -c "wss://<WS_API_ID>.execute-api.us-east-1.amazonaws.com/prod?matchId=match-001"

# Terminal 2 — disparar simulador via AWS CLI
aws lambda invoke \
  --function-name simulateMatch \
  --invocation-type Event \
  --payload '{"matchId":"match-001","speedFactor":120}' \
  /dev/null
```

Esperado no Terminal 1: mensagens `{"type":"PREDICTION", ...}` chegando a cada evento relevante.

---

## Estrutura do Projeto

```
sektor-connected-arena/
├── app/                    # React Native (Expo)
│   └── src/
│       ├── app/            # Rotas (Expo Router)
│       │   ├── (auth)/     # Login, cadastro, seleção de time
│       │   ├── (tabs)/     # Community, Arena, Leaderboard, Profile
│       │   ├── arena/      # Modo Arena [matchId]
│       │   └── watch-party/# Watch Party Web [matchId]
│       ├── components/     # UI components
│       ├── hooks/          # Custom hooks
│       ├── services/       # API, WebSocket, Auth
│       ├── store/          # Zustand stores
│       └── types/          # TypeScript types
├── lambdas/                # AWS Lambda functions
│   ├── wsConnect/          # WebSocket $connect
│   ├── wsDisconnect/       # WebSocket $disconnect
│   ├── submitAnswer/       # Recebe resposta de predição
│   ├── resolveAnswer/      # Resolve predição + scores + badges
│   ├── processEvent/       # Kinesis → Bedrock → WS broadcast
│   ├── simulateMatch/      # Replay do feed DFL (S3 → Kinesis)
│   ├── getLeaderboard/     # REST GET /leaderboard
│   ├── analyzeSentiment/   # Sentiment do fórum via Bedrock
│   ├── getPosts/           # REST GET /posts
│   ├── createPost/         # REST POST /posts
│   ├── likePost/           # REST POST /posts/{id}/like
│   ├── unlikePost/         # REST DELETE /posts/{id}/like
│   ├── getComments/        # REST GET /posts/{id}/comments
│   ├── createComment/      # REST POST /posts/{id}/comments
│   └── getUploadUrl/       # REST GET /upload-url
├── infra/                  # IAM policies e configs AWS
├── docs/                   # Planos de implementação
└── challenge/              # Documentação do desafio
```

---

## Arquitetura AWS

```
[Mobile App]
  ├─ Cognito (auth)
  ├─ API GW REST → Lambdas (community + leaderboard)
  │     └─ DynamoDB (posts, comments, likes, scores) + S3 (media)
  └─ API GW WebSocket → Lambdas (wsConnect, wsDisconnect, submitAnswer)
        └─ DynamoDB (connections)

[simulateMatch Lambda]
  └─ S3 (DFL XML) → Kinesis (sektor-match-events)
        └─ processEvent Lambda
              ├─ Bedrock Nova Lite (predição personalizada por torcida)
              ├─ DynamoDB (connections)
              ├─ API GW WS ManageConnections (broadcast)
              └─ EventBridge Scheduler → resolveAnswer Lambda
                    ├─ DynamoDB (scores, answers)
                    └─ API GW WS (SCORE_UPDATE, PRESSURE_UPDATE, PREDICTION_RESULT)

[EventBridge Scheduler rate(2min)]
  └─ analyzeSentiment Lambda
        ├─ DynamoDB (posts) read
        ├─ Bedrock Nova Lite (sentiment)
        └─ API GW WS (SENTIMENT_ALERT broadcast)

[Watch Party Web — S3 + CloudFront / Amplify]
  └─ API GW WebSocket (spectator mode, read-only)
```
