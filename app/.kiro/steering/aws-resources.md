---
inclusion: always
---

# Recursos AWS provisionados (Sektor Connected Arena)

Conta AWS: `482712210181` · Região: `us-east-1`

## API Gateway WebSocket
- API name: `sektor-ws-api`
- API ID: `3bodgtvae0`
- Stage: `prod`
- URL cliente: `wss://3bodgtvae0.execute-api.us-east-1.amazonaws.com/prod`
- WS_ENDPOINT (backend): `https://3bodgtvae0.execute-api.us-east-1.amazonaws.com/prod`
- Rotas: `$connect` → `wsConnect`, `$disconnect` → `wsDisconnect`

## Lambdas (nomes reais, sem prefixo `sektor-`)
- `wsConnect`
- `wsDisconnect`
- `processEvent`
- `resolveAnswer`
- `submitAnswer`
- `simulateMatch`
- `getPosts`, `createPost`, `likePost`, `unlikePost`, `getComments`, `createComment`, `getUploadUrl`
- `getLeaderboard` — REST GET /leaderboard?matchId=&limit=
- `analyzeSentiment` — invocada pelo EventBridge Scheduler rate(2 minutes)

Cada Lambda foi criada pelo console e tem sua própria execution role auto-gerada (não existe role compartilhada `sektor-lambda-role`). Para descobrir a role de uma função:
```
aws lambda get-function-configuration --function-name <NAME> --query Role --output text
```

## DynamoDB
- `sektor-connections` (PK matchId, SK connectionId, GSI connectionId-index, TTL atributo `ttl`)
- `sektor-scores` (PK matchId, SK userId, GSI **score-index** PK=matchId SK=score, TTL não configurado)
- `sektor-answers` (PK predictionId, SK userId, TTL atributo `ttl`)
- `sektor-posts` (PK teamId, SK createdAt, GSI id-index)
- `sektor-comments`, `sektor-likes`
- `sektor-sentiment` (PK matchId, SK teamId, TTL atributo `ttl`) — **novo**

## API Gateway REST
- API name: `sektor-rest-api`
- API ID: `vzgv26s18d`
- Stage: `prod`
- URL: `https://vzgv26s18d.execute-api.us-east-1.amazonaws.com/prod`
- Rotas: `/posts`, `/posts/{postId}`, `/posts/{postId}/like`, `/posts/{postId}/comments`, `/upload-url`, `/leaderboard` (novo)

## EventBridge Scheduler
- Grupo `sektor-prediction-resolutions` — schedules one-shot por predição (criados por `processEvent`)
- Grupo `sektor-sentiment-jobs` — schedule `sektor-sentiment-rate` rate(2 minutes) → `analyzeSentiment` com `{"matchId":"match-001"}`

## Kinesis
- Stream: `sektor-match-events` (1 shard)

## Observações importantes
- O README de `infra/` cita uma role única `sektor-lambda-role`, mas no provisionamento real cada Lambda foi criada pelo console com sua própria role. Permissões devem ser anexadas individualmente nas roles de cada Lambda quando necessário.
- A policy `AmazonAPIGatewayInvokeFullAccess` NÃO cobre `execute-api:ManageConnections`. Para `processEvent` e `resolveAnswer` postarem nas conexões WS, precisa de policy inline.


## Roles de execução das Lambdas
- `processEvent`: `processEvent-role-j2rjl0q0`
- `wsConnect`: `wsConnect-role-s6ct3dqv`
- `wsDisconnect`: `wsDisconnect-role-96gqgrvj`
- `resolveAnswer`: `resolveAnswer-role-cwoh034c`
- `getLeaderboard`: `sektor-getLeaderboard-role`
- `analyzeSentiment`: `sektor-analyzeSentiment-role`
- Scheduler sentiment: `sektor-scheduler-invoke-sentiment`
