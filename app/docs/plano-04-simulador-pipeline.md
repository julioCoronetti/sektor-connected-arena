# Plano 04 — Simulador DFL + Pipeline AWS

> **Princípio central:** O simulador é um script standalone, não parte do app. O pipeline AWS deve ser o mais direto possível: evento entra, predição sai. Sem filas de retry, sem orquestração complexa.

---

## Objetivo

Implementar o script simulador local de eventos DFL e o pipeline AWS completo (Kinesis → EventBridge → Lambda → Bedrock → WebSocket) para que o Modo Arena receba predições reais geradas por IA a partir de eventos simulados de uma partida.

---

## Dependências

**Plano 03 concluído:**
- Modo Arena funcional com dados mockados
- Protocolo de mensagens WebSocket definido (contrato de tipos)
- `arenaStore` pronto para receber mensagens reais no mesmo formato do mock

**Infraestrutura AWS (pré-requisito externo):**
- Stream Kinesis criado
- Regras EventBridge configuradas
- Funções Lambda com permissões para Bedrock e API Gateway WebSocket
- API Gateway WebSocket com rota `$connect`, `$disconnect` e `sendMessage`
- Tabela DynamoDB `Connections` para rastrear conexões ativas por `matchId`

---

## Princípios de Simplicidade

- O Simulador é um script Node.js standalone em `scripts/simulate-match.ts` — não faz parte do app
- O Simulador emite apenas 5 tipos de eventos: `GOAL`, `YELLOW_CARD`, `CORNER`, `FOUL`, `MATCH_START`
- A Lambda de predição usa um prompt fixo e simples para o Bedrock — sem engenharia de prompt complexa
- A Lambda de distribuição envia diretamente via API Gateway WebSocket `@connections` — sem pub/sub intermediário
- Se o Bedrock falhar, a Lambda loga e descarta — sem retry, sem dead-letter queue
- **Todas as Lambdas em Node.js** para consistência com o simulador

---

## Arquitetura do Pipeline

```
scripts/simulate-match.ts
        │
        ▼ PutRecord
  Amazon Kinesis Stream
        │
        ▼ Trigger
  AWS Lambda: processEvent
        │
        ├─ Filtra eventos relevantes (GOAL, CORNER, FOUL, YELLOW_CARD)
        │
        ▼ InvokeModel
  Amazon Bedrock (Claude)
        │
        ▼ Formata predição
  AWS Lambda: distributeQuestion
        │
        ▼ PostToConnection (para cada connectionId da partida)
  API Gateway WebSocket → App (PredictionCard)
        │
        ▼ (após timer expirar)
  AWS Lambda: resolveAnswer
        │
        ▼ UpdateItem
  Amazon DynamoDB (Scores)
        │
        ▼ PostToConnection
  API Gateway WebSocket → App (PRESSURE_UPDATE)
```

---

## Script Simulador

### `scripts/simulate-match.ts`

```typescript
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';

const client = new KinesisClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

const EVENT_TYPES = ['GOAL', 'YELLOW_CARD', 'CORNER', 'FOUL'] as const;
type EventType = typeof EVENT_TYPES[number];

interface DFLEvent {
  matchId: string;
  eventType: EventType;
  timestamp: string;
  teamId: string;
  minute: number;
}

async function emitEvent(matchId: string, teamId: string, minute: number) {
  const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const event: DFLEvent = {
    matchId,
    eventType,
    timestamp: new Date().toISOString(),
    teamId,
    minute,
  };

  await client.send(new PutRecordCommand({
    StreamName: process.env.KINESIS_STREAM_NAME ?? 'sektor-match-events',
    Data: Buffer.from(JSON.stringify(event)),
    PartitionKey: matchId,
  }));

  console.log(`[${minute}'] Evento emitido: ${eventType} (${teamId})`);
}

async function simulate(matchId: string, durationMinutes: number) {
  const teams = ['team-a', 'team-b'];
  let minute = 1;

  // Emite MATCH_START
  await emitEvent(matchId, teams[0], 0);

  while (minute <= durationMinutes) {
    const delay = 10000 + Math.random() * 20000; // 10–30 segundos
    await new Promise((r) => setTimeout(r, delay));
    const teamId = teams[Math.floor(Math.random() * 2)];
    await emitEvent(matchId, teamId, minute);
    minute++;
  }

  console.log('Simulação encerrada.');
}

// Uso: npx ts-node scripts/simulate-match.ts match-001 10
const [matchId, duration] = process.argv.slice(2);
simulate(matchId ?? 'match-001', parseInt(duration ?? '10', 10));
```

---

## Lambdas AWS

### Lambda 1: `processEvent` (Kinesis Trigger)

```javascript
// handler: processEvent.handler
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

const RELEVANT_EVENTS = ['GOAL', 'CORNER', 'FOUL', 'YELLOW_CARD'];

exports.handler = async (event) => {
  for (const record of event.Records) {
    const payload = JSON.parse(Buffer.from(record.kinesis.data, 'base64').toString());
    
    if (!RELEVANT_EVENTS.includes(payload.eventType)) continue;

    // Gerar predição via Bedrock
    const prompt = buildPrompt(payload);
    let prediction;
    try {
      prediction = await generatePrediction(prompt, payload);
    } catch (e) {
      console.error('[Bedrock] Falha ao gerar predição:', e);
      continue; // Descartar evento sem propagar erro
    }

    // Buscar conexões ativas da partida
    const connections = await getActiveConnections(payload.matchId);

    // Distribuir para todos os clientes
    await distributeToConnections(connections, prediction);
  }
};

function buildPrompt(event) {
  return `Você é um assistente de futebol. Ocorreu um evento: ${event.eventType} no minuto ${event.minute}.
Gere uma pergunta de predição rápida em português com 4 opções de resposta.
Responda APENAS com JSON válido no formato:
{"question": "...", "options": ["...", "...", "...", "..."], "correctOption": 0}
A pergunta deve ser sobre o que vai acontecer nos próximos 30 segundos.`;
}

async function generatePrediction(prompt, event) {
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
    contentType: 'application/json',
    accept: 'application/json',
  }));

  const body = JSON.parse(Buffer.from(response.body).toString());
  const parsed = JSON.parse(body.content[0].text);

  return {
    type: 'PREDICTION',
    prediction: {
      id: `pred-${Date.now()}`,
      matchId: event.matchId,
      question: parsed.question,
      options: parsed.options,
      correctOption: parsed.correctOption,
      expiresAt: new Date(Date.now() + 15000).toISOString(),
    },
  };
}

async function getActiveConnections(matchId) {
  const result = await dynamo.send(new QueryCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    KeyConditionExpression: 'matchId = :matchId',
    ExpressionAttributeValues: { ':matchId': { S: matchId } },
  }));
  return result.Items?.map((item) => item.connectionId.S) ?? [];
}

async function distributeToConnections(connectionIds, message) {
  const api = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_ENDPOINT,
  });

  await Promise.allSettled(
    connectionIds.map((connectionId) =>
      api.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message)),
      }))
    )
  );
}
```

### Lambda 2: `wsConnect` (WebSocket $connect)

```javascript
// Salva connectionId + matchId no DynamoDB
exports.handler = async (event) => {
  const { connectionId } = event.requestContext;
  const matchId = event.queryStringParameters?.matchId ?? 'unknown';

  await dynamo.send(new PutItemCommand({
    TableName: process.env.CONNECTIONS_TABLE,
    Item: {
      matchId: { S: matchId },
      connectionId: { S: connectionId },
      ttl: { N: String(Math.floor(Date.now() / 1000) + 7200) }, // 2h TTL
    },
  }));

  return { statusCode: 200 };
};
```

### Lambda 3: `wsDisconnect` (WebSocket $disconnect)

```javascript
// Remove connectionId do DynamoDB
exports.handler = async (event) => {
  const { connectionId } = event.requestContext;
  // Query por connectionId (GSI) e deletar
  return { statusCode: 200 };
};
```

---

## Tabela DynamoDB: `Connections`

```
PK: matchId (String)
SK: connectionId (String)
Atributo: ttl (Number) — TTL automático de 2 horas
GSI: connectionId-index (para lookup no disconnect)
```

---

## Variáveis de Ambiente das Lambdas

```
AWS_REGION=us-east-1
CONNECTIONS_TABLE=sektor-connections
WS_ENDPOINT=https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/prod
```

---

## Integração com o App (Plano 03)

Após o Plano 04 estar funcional, **remover o mock** do `src/app/arena/[matchId].tsx`:

```tsx
// REMOVER estas linhas do Plano 03:
// import { MOCK_MATCH, startMockSimulator } from '../../services/matchSimulator';
// setMatch(MOCK_MATCH);
// const stop = startMockSimulator(setActivePrediction, updatePressure);

// O WebSocket já está conectado e receberá MATCH_STATE automaticamente
// quando o servidor enviar a mensagem de boas-vindas no $connect
```

---

## Critérios de Aceitação (Checklist de Done)

- [ ] Script simulador emite eventos no formato `{ matchId, eventType, timestamp, teamId, minute }`
- [ ] Simulador aceita `matchId` e `durationMinutes` como argumentos CLI
- [ ] Simulador emite eventos em intervalos de 10–30 segundos
- [ ] Lambda `processEvent` filtra apenas os 5 tipos de eventos relevantes
- [ ] Lambda `processEvent` invoca Bedrock e recebe predição válida
- [ ] Falha no Bedrock é logada no CloudWatch sem propagar erro
- [ ] Predição é distribuída para todas as conexões ativas da partida
- [ ] App recebe `PREDICTION` via WebSocket e exibe `PredictionCard`
- [ ] Lambda `wsConnect` salva connectionId no DynamoDB
- [ ] Lambda `wsDisconnect` remove connectionId do DynamoDB
- [ ] Pipeline processa evento em menos de 10 segundos end-to-end
- [ ] Logs do CloudWatch sem erros de configuração para os 5 tipos de eventos

---

## O que este plano entrega para os próximos

| Plano | O que usa deste plano |
|-------|----------------------|
| Plano 06 | Pipeline AWS enviando `PRESSURE_UPDATE` para que o multiplicador GPS tenha efeito real nos scores |
