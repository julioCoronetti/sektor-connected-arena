# Plano 08 — Fechamento de Código do Challenge

> **Escopo:** Apenas código. Vídeo, slides, diagrama PNG e zip final ficam fora deste plano (executados manualmente pelo time).

---

## Objetivo

Levar o código do Sektor ao estado em que **todos os 6 objetivos do `Challenge.md §6` estão cumpridos em runtime**, prontos para serem demonstrados em vídeo.

Cobre apenas o que precisa ser implementado/alterado em arquivos do repositório.

---

## Mapeamento Challenge → Estado Atual → Ação de Código

| # | Requisito (§6) | Estado | Ação |
|---|----------------|--------|------|
| 1 | Multiplayer 2+ usuários | ✅ | Validar (Fase 6) |
| 2 | Pipeline DFL → trigger in-app | 🟡 sintético | Replay do feed DFL real (Fase 1) |
| 3 | Gamificação ≥ 2 mecânicas | 🟡 score + pressão | + Leaderboard + Streaks + Badges (Fase 2) |
| 4 | IA/personalização Bedrock | 🟡 genérico | Predição personalizada por torcida + Sentiment (Fase 3) |
| 5 | Touchpoint espacial extra | 🟡 só mobile (AR+GPS) | Watch Party Web (Fase 4) |
| 6 | Slide North Star | ❌ (fora do escopo) | — |

---

## Princípios de Simplicidade

- Reaproveitar infra já provisionada. Sem criar serviços novos quando GSI/Lambda extra resolve.
- Sem novos pacotes no app. Watch Party usa Expo Web do mesmo projeto.
- Sentiment via Bedrock Nova Lite (Anthropic bloqueado por SCP, Comprehend evitado para não adicionar serviço novo).
- Personalização lê `Mock User Preferences` direto do bundle do Lambda — sem tabela nova.
- Watch Party é read-only — consome WS/REST existentes, sem endpoints novos.
- Replay DFL mantém `lambdas/simulateMatch`, só troca fonte do array hardcoded para JSON oficial.

---

## Dependências

- Planos 01–07 concluídos (status confirmado em `docs/status-and-todo.md`)
- Arquivo `DFL Live Match Mock` disponível (vem do `ISB-UserGuide.pdf`)
- AWS já provisionada (Cognito, WS, REST, Kinesis, Bedrock, Scheduler)

---

## Fase 0 — Higiene

> Limpeza pré-requisito. ~30min.

### Tarefas

1. Remover `app/src/services/matchSimulator.ts` e teste correspondente. Buscar imports residuais.
2. Atualizar `STADIUM_COORDS` em `app/src/constants/config.ts` para coords reais (Allianz Arena `48.2188, 11.6247` ou Signal Iduna Park `51.4926, 7.4519`). Feed DFL é alemão.
3. Conferir `.env.local`: REST URL, WS URL, Cognito IDs preenchidos.
4. Atualizar `README.md` raiz (atualmente vazio): seções Stack, Como rodar app, Como rodar simulador, Variáveis de ambiente.

### Validação

- [ ] `tsc --noEmit` no `app/` passa
- [ ] `grep_search "matchSimulator"` zero resultados
- [ ] README raiz preenchido

---

## Fase 1 — Replay Feed DFL Real

### Localização

- Salvar JSON em `lambdas/simulateMatch/data/dfl-match-events.json`
- Adicionar ao `.gitignore` se >1MB. Documentar download no README.

### Refator `lambdas/simulateMatch/index.js`

```javascript
const fs = require("fs");
const path = require("path");

const eventsRaw = fs.readFileSync(
  path.join(__dirname, "data/dfl-match-events.json"),
  "utf-8",
);
const events = JSON.parse(eventsRaw);

exports.handler = async (event) => {
  const { matchId, durationMinutes = 5 } = event;
  const compressionRatio = durationMinutes / 90;

  for (const dflEvent of events) {
    const delayMs = dflEvent.minute * 60 * 1000 * compressionRatio;
    setTimeout(() => putToKinesis(matchId, mapDflEvent(dflEvent)), delayMs);
  }
};
```

### Mapeamento DFL → app (`lambdas/simulateMatch/dfl-mapping.js`)

| DFL eventType | App eventType | Triggera predição? |
|---|---|---|
| `Goal` | `GOAL` | Sim |
| `CornerKick` | `CORNER` | Sim |
| `FoulCommitted` | `FOUL` | Sim |
| `Caution` | `YELLOW_CARD` | Sim |
| `SendingOff` | `RED_CARD` | Sim |
| `Substitution` | `SUBSTITUTION` | Não |
| `KickOff` | `KICK_OFF` | Não |

`processEvent.RELEVANT_EVENTS` — adicionar `RED_CARD`.

### Validação

- [ ] `node lambdas/simulateMatch -- match-dfl-001 5` emite eventos lidos do JSON real
- [ ] `wscat` recebe `PREDICTION` contextualizada por evento DFL

---

## Fase 2 — Gamificação Completa

### 2.1 Leaderboard

#### GSI em `sektor-scores`
- Nome: `score-index`
- PK: `matchId` (S), SK: `score` (N)
- Projection: `ALL`

#### Lambda `lambdas/getLeaderboard/index.js`

Endpoint REST `GET /leaderboard?matchId={id}&limit=10`.

```javascript
const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const matchId = event.queryStringParameters?.matchId;
  const limit = Math.min(
    parseInt(event.queryStringParameters?.limit ?? "10", 10),
    100,
  );
  if (!matchId) {
    return { statusCode: 400, body: JSON.stringify({ error: "matchId required" }) };
  }

  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.SCORES_TABLE,
      IndexName: "score-index",
      KeyConditionExpression: "matchId = :m",
      ExpressionAttributeValues: { ":m": { S: matchId } },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );

  const leaderboard = (result.Items ?? []).map((item, idx) => ({
    rank: idx + 1,
    userId: item.userId.S,
    userName: item.userName?.S ?? "Anônimo",
    teamId: item.teamId?.S ?? null,
    score: Number(item.score.N),
    correctCount: Number(item.correctCount?.N ?? 0),
    currentStreak: Number(item.currentStreak?.N ?? 0),
    badges: item.badges?.SS ?? [],
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leaderboard }),
  };
};
```

#### Frontend

- `app/src/app/(tabs)/leaderboard.tsx` — nova aba
- `app/src/hooks/useLeaderboard.ts` — fetch + polling 30s + atualiza local em `SCORE_UPDATE` WS
- `app/src/services/api.ts` — adicionar `getLeaderboard(matchId, limit)`

UI: FlatList top N, usuário atual destacado, badges como ícones, streak com 🔥.

### 2.2 Streaks

#### Mudança em `lambdas/resolveAnswer/index.js`

`updateUserScore` precisa lidar com 3 casos:

- **Acerto**: `ADD currentStreak :one`. Após retorno, se `currentStreak > bestStreak`, segundo `UpdateItem` setando `bestStreak = currentStreak`.
- **Erro**: `SET currentStreak = :zero`.
- **Idempotência**: manter `processedPredictions` set, condição `NOT contains`.

Trade-off aceito: até 2 writes por acerto vs transação.

### 2.3 Badges

#### `lambdas/resolveAnswer/badges.js`

```javascript
const BADGES = [
  { id: "first-correct", trigger: (s) => s.correctCount === 1, label: "Primeira Resposta Certa" },
  { id: "streak-3", trigger: (s) => s.currentStreak === 3, label: "Sequência de 3" },
  { id: "streak-5", trigger: (s) => s.currentStreak === 5, label: "Sequência de 5" },
  { id: "streak-10", trigger: (s) => s.currentStreak === 10, label: "Hot Hand" },
  { id: "in-stadium", trigger: (s) => s.multiplierAppliedCount >= 1, label: "Na Arena" },
  { id: "score-100", trigger: (s) => s.score >= 100, label: "Centena" },
  { id: "perfect-half", trigger: (s) => s.correctCount >= 5 && s.wrongCount === 0, label: "Primeiro Tempo Perfeito" },
];

function evaluateBadges(currentBadges, scoreState) {
  const owned = new Set(currentBadges ?? []);
  const newlyUnlocked = [];
  for (const b of BADGES) {
    if (!owned.has(b.id) && b.trigger(scoreState)) {
      newlyUnlocked.push(b.id);
      owned.add(b.id);
    }
  }
  return { owned: [...owned], newlyUnlocked };
}

module.exports = { BADGES, evaluateBadges };
```

Após `UpdateItem` retornar `ALL_NEW`, se houver `newlyUnlocked`, terceiro update `ADD badges :newBadges`.

### 2.4 Protocolo WS — extensão de `SCORE_UPDATE`

`app/src/services/arenaProtocol.ts`:

```typescript
| {
    type: "SCORE_UPDATE";
    userId: string;
    score: number;
    correctCount: number;
    wrongCount: number;
    currentStreak: number;
    bestStreak: number;
    badgesUnlocked?: string[];
  }
```

Atualizar type guard. Atualizar `arenaStore.UserScore` para incluir `currentStreak`/`bestStreak`/`badges`.

### 2.5 UI extras

- 🔥 ao lado do score quando `currentStreak >= 3` (em arena + leaderboard + profile)
- Toast/modal quando `badgesUnlocked` chega
- Card "Suas conquistas" em `profile.tsx`

### Validação

- [ ] `score-index` GSI provisionado
- [ ] `/leaderboard` autorizado por Cognito retorna top N ordenado
- [ ] Streak incrementa em acertos consecutivos, zera em erro
- [ ] Badges desbloqueados disparam toast

---

## Fase 3 — IA: Personalização + Sentiment

### 3.1 Predição Personalizada por Torcida

#### `lambdas/processEvent/preferences.js`

```javascript
const PREFERENCES = {
  "team-a": { teamName: "FC Team", style: "estatistico", tone: "técnico" },
  "team-b": { teamName: "Club", style: "casual", tone: "descontraído" },
};

function getTeamPreferences(teamId) {
  return PREFERENCES[teamId] ?? PREFERENCES["team-a"];
}

module.exports = { getTeamPreferences };
```

Quando o `Mock User Preferences` oficial chegar, popular este arquivo com o JSON real.

#### Estratégia

Gerar 2 predições por evento (Torcida A e Torcida B), distribuir por `teamId` da conexão. Custo: 2 invocações Bedrock por evento. `sektor-connections` já guarda `teamId`.

#### Refator `lambdas/processEvent/index.js`

```javascript
const predictionTeamA = await generatePrediction(payload, { audienceTeamId: "team-a" });
const predictionTeamB = await generatePrediction(payload, { audienceTeamId: "team-b" });

const connections = await getActiveConnections(payload.matchId);
const byTeam = groupBy(connections, (c) => c.teamId ?? "team-a");

await distributeToConnections(byTeam["team-a"] ?? [], predictionTeamA);
await distributeToConnections(byTeam["team-b"] ?? [], predictionTeamB);
```

Atualizar `getActiveConnections` para retornar `{ connectionId, teamId }` (hoje retorna só array de IDs).

`schedulePredictionResolution` precisa ser chamado para AMBAS as predições (cada uma com seu `predictionId` próprio). `correctOption` pode divergir entre versões — `resolveAnswer` resolve cada predição independente.

#### Prompt atualizado

```
Você é assistente de futebol para a torcida do {audienceTeamName}.
Evento: {eventType} no minuto {minute}.
Gere pergunta de previsão rápida (próximos 30s), em português, tom {tone},
com 4 opções, viés sutil pró-torcida sem mentir sobre fatos.
Responda APENAS JSON: {"question": "...", "options": [...], "correctOption": 0}
```

### 3.2 Sentiment Analysis do Fórum

#### `lambdas/analyzeSentiment/index.js`

Trigger: EventBridge Scheduler `rate(2 minutes)` durante partida live. Grupo `sektor-sentiment-jobs`.

Fluxo:
1. Query `sektor-posts` por `teamId` últimos 50 posts (precisa GSI `teamId-createdAt-index`; verificar se já existe — comunidade usa filtro por team)
2. Concatenar texts (truncar 4k chars/time)
3. Bedrock Nova Lite:

```
Analise o sentimento dominante destes posts da torcida do {teamName}.
Categorias: confiante, ansiosa, eufórica, decepcionada, neutra.
Responda APENAS JSON: {"sentiment": "...", "intensity": 0-100, "summary": "frase curta"}

Posts:
{textos}
```

4. Persistir em `sektor-sentiment` (tabela nova):
   - PK `matchId` (S), SK `teamId` (S)
   - `sentiment` (S), `intensity` (N), `summary` (S), `updatedAt` (S), TTL

5. Broadcast WS `SENTIMENT_ALERT`:

```typescript
| {
    type: "SENTIMENT_ALERT";
    teamId: string;
    sentiment: "confiante" | "ansiosa" | "eufórica" | "decepcionada" | "neutra";
    intensity: number;
    summary: string;
  }
```

#### UI

- Banner discreto acima da `PressureBar` quando `intensity >= 60`
- Cor por sentimento (verde=eufórica, amarelo=ansiosa, vermelho=decepcionada, cinza=neutra)
- Auto-dismiss 30s ou novo alerta

### Validação

- [ ] Predição diferente por torcida (2 contas em times opostos recebem questions distintas)
- [ ] Sentiment job roda 2/2min, escreve Dynamo, dispara WS
- [ ] Banner aparece com tom correto

---

## Fase 4 — Watch Party Web

### Stack

Reaproveitar Expo Web (projeto já é Expo). Sem app separado.

- Rota `app/src/app/watch-party/[matchId].tsx`
- URL pública: `/watch-party/{matchId}`
- Sem auth (modo público p/ TV/projetor). Só leitura.
- Layout 16:9, fonte grande, sem chrome mobile.

### Componente principal

```
WatchPartyScreen (full-screen)
├─ Cabeçalho: placar + minuto + status WS (font 4xl+)
├─ PressureBar (50% da tela)
├─ MiniLeaderboard lateral (top 5, ao vivo)
├─ SentimentAlert banner quando ativo
└─ PredictionCard centralizado (sem botões — só mostra)
```

### WebSocket spectator

`app/src/hooks/useWebSocket.ts` — aceitar URL com `mode=spectator` (sem token).

`lambdas/wsConnect/index.js` — quando `mode=spectator`:
- Persistir conexão com `userId=spectator-{connectionId}`, `teamId=null`
- Não receber predições personalizadas (cair em `team-a` por padrão ou criar variante neutra)

`lambdas/submitAnswer/index.js` — rejeitar `userId` que comece com `spectator-` (`UNAUTHORIZED`).

### Build

```bash
cd app
npx expo export --platform web
```

Hospedar via Amplify Hosting ou S3+CloudFront. URL → README.

### Validação

- [ ] URL pública carrega Watch Party em laptop/TV
- [ ] PressureBar atualiza ao vivo conforme respostas no mobile
- [ ] Leaderboard atualiza
- [ ] Visual ok em 1920x1080

---

## Fase 5 — Acessibilidade (Código)

### Tarefas

1. Adicionar `accessibilityLabel` em todos os `TouchableOpacity` ícone-only (botão AR, FAB de criar post, switch de tema já tem)
2. `accessibilityRole` em interativos (`button`, `switch`, `link`)
3. Garantir tamanho mínimo de toque 44x44 (PredictionCard options, ícones de like)
4. Modo tutorial primeiro login: 3 cards (Arena/Pressão/Comunidade). Flag salva em `custom:onboardingComplete` no Cognito (ou AsyncStorage para ser mais simples)

### Validação

- [ ] `accessibilityLabel` em todos os ícone-only botões
- [ ] Tutorial aparece só no primeiro login

---

## Fase 6 — Smoke E2E Multi-jogador

### Cenário

1. 2 usuários no Cognito: `fan-a@test.com` (`team-a`), `fan-b@test.com` (`team-b`)
2. Simulador rodando: `npm run simulate match-demo-001 5`
3. Dispositivo A logado como `fan-a`, GPS mock dentro do estádio (mult 2x)
4. Dispositivo B logado como `fan-b`, GPS fora (mult 1x)
5. Browser em `https://.../watch-party/match-demo-001`

### Verificações

- [ ] Ambos recebem `PREDICTION` quase simultânea
- [ ] Variante de A diferente de B (Fase 3.1)
- [ ] Ambos respondem; `ANSWER_ACCEPTED` chega
- [ ] Após 15s, `PREDICTION_RESULT` + `SCORE_UPDATE` + `PRESSURE_UPDATE`
- [ ] Score de A reflete 2x quando acerta
- [ ] Watch Party reflete tudo
- [ ] Leaderboard mostra A e B ordenados
- [ ] Após 5+ acertos seguidos, badge `streak-5` desbloqueia em A
- [ ] Sentiment alert aparece após posts no fórum

---

## Checklist Final (Código)

### Cobertura `Challenge.md §6`

- [ ] Multijogador 2+ usuários (Fase 6)
- [ ] Pipeline DFL real (Fase 1)
- [ ] Gamificação 5 mecânicas: score + pressão + leaderboard + streaks + badges (Fase 2)
- [ ] Bedrock personalização por torcida + sentiment (Fase 3)
- [ ] Touchpoint extra Watch Party Web (Fase 4)

### Débitos `status-and-todo.md`

- [ ] `matchSimulator.ts` mock removido (Fase 0)
- [ ] `STADIUM_COORDS` reais (Fase 0)
- [ ] README raiz preenchido (Fase 0)

### Build & Tests

- [ ] `tsc --noEmit` no `app/` sem erros
- [ ] Suite de testes existentes passa
- [ ] Lint passa
- [ ] Build web `expo export --platform web` sem erros

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Feed DFL não disponível | Manter eventos sintéticos como fallback; documentar |
| Bedrock retorna JSON inválido | Já tem try/catch em `processEvent`; adicionar parser tolerante (regex extrair JSON) |
| 2 invocações Bedrock por evento estouram quota | Cair para predição única em throttle |
| Watch Party WS sem auth abre abuso | `mode=spectator` rejeita `submitAnswer` no Lambda; rate-limit no `wsConnect` por IP |
| Sentiment retorna idioma errado | Reforçar prompt PT-BR + validação de schema |

---

## Fora do Escopo (Manual)

Os itens abaixo NÃO são código e ficam para execução manual:

- `architecture.png`
- `executive_summary.pdf` (5 slides)
- `presentation_video.mp4`
- `github_link.txt`
- Zip final `<NomeDoTime>.zip`
- Submissão via Box

---

## Próxima Ação

1. Confirmar disponibilidade do `DFL Live Match Mock JSON` (Fase 1)
2. Iniciar Fase 0 (higiene) — pré-requisito de tudo
3. Em paralelo após Fase 0:
   - branch `feat/leaderboard-streaks-badges` (Fase 2)
   - branch `feat/bedrock-personalization-sentiment` (Fase 3)
   - branch `feat/watch-party-web` (Fase 4)
4. Fase 5 (a11y) e Fase 6 (smoke) ao final
