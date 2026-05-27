# Plan 08 — Finalizing the Challenge Code

> **Scope:** Code only. Video, slides, PNG architecture diagram and the final zip are out of scope for this plan (handled manually by the team).

---

## Objective

Bring the Sektor codebase to a state where **all 6 objectives from `Challenge.md §6` are satisfied at runtime**, ready to be demonstrated in a video.

This plan only covers code changes to repository files.

---

## Mapping: Challenge → Current State → Code Action

| # | Requirement (§6) | State | Action |
|---|------------------|-------|--------|
| 1 | Multiplayer 2+ users | ✅ | Validate (Phase 6) |
| 2 | Pipeline DFL → in-app trigger | 🟡 synthetic | Replay official DFL feed (Phase 1) |
| 3 | Gamification ≥ 2 mechanics | 🟡 score + pressure | + Leaderboard + Streaks + Badges (Phase 2) |
| 4 | AI/personalization (Bedrock) | 🟡 generic | Personalized predictions per crowd + Sentiment (Phase 3) |
| 5 | Extra spatial touchpoint | 🟡 mobile-only (AR+GPS) | Watch Party Web (Phase 4) |
| 6 | North Star slide | ❌ (out of scope) | — |

---

## Simplicity Principles

- Reuse provisioned infra. Do not create new services if GSI/Lambda can solve it.
- No new packages in the app. Watch Party uses the same Expo Web project.
- Sentiment via Bedrock Nova Lite (Claude blocked by org SCP, Comprehend avoided to not add a new service).
- Personalization reads a `Mock User Preferences` JSON bundled with the Lambda — no new table.
- Watch Party is read-only — consumes existing WS/REST, no new endpoints.
- Replay DFL keeps `lambdas/simulateMatch` and only switches the hardcoded array source to the official JSON.

---

## Dependencies

- Plans 01–07 completed (status confirmed in `docs/status-and-todo.md`)
- `DFL Live Match Mock` JSON available (comes from `ISB-UserGuide.pdf`)
- AWS already provisioned (Cognito, WS, REST, Kinesis, Bedrock, Scheduler)

---

## Phase 0 — Hygiene

> Pre-requisite cleanup. ~30 min.

### Tasks

1. Remove `app/src/services/matchSimulator.ts` and its test. Find leftover imports.
2. Update `STADIUM_COORDS` in `app/src/constants/config.ts` to real coords (Allianz Arena `48.2188, 11.6247` or Signal Iduna Park `51.4926, 7.4519`). DFL feed is German.
3. Check `.env.local`: REST URL, WS URL, Cognito IDs populated.
4. Update root `README.md` (currently empty): Stack, How to run the app, How to run the simulator, Environment variables.

### Validation

- [ ] `tsc --noEmit` in `app/` passes
- [ ] `grep_search "matchSimulator"` returns zero results
- [ ] Root README populated

---

## Phase 1 — Replay Official DFL Feed

### Location

- Save the JSON at `lambdas/simulateMatch/data/dfl-match-events.json`
- Add to `.gitignore` if >1MB. Document download in README.

### Refactor `lambdas/simulateMatch/index.js`

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

### DFL → app mapping (`lambdas/simulateMatch/dfl-mapping.js`)

| DFL eventType | App eventType | Triggers prediction? |
|---|---|---|
| `Goal` | `GOAL` | Yes |
| `CornerKick` | `CORNER` | Yes |
| `FoulCommitted` | `FOUL` | Yes |
| `Caution` | `YELLOW_CARD` | Yes |
| `SendingOff` | `RED_CARD` | Yes |
| `Substitution` | `SUBSTITUTION` | No |
| `KickOff` | `KICK_OFF` | No |

Add `RED_CARD` to `processEvent.RELEVANT_EVENTS`.

### Validation

- [ ] `node lambdas/simulateMatch -- match-dfl-001 5` emits events read from the real JSON
- [ ] `wscat` receives `PREDICTION` contextualized by DFL event

---

## Phase 2 — Full Gamification

### 2.1 Leaderboard

#### GSI in `sektor-scores`
- Name: `score-index`
- PK: `matchId` (S), SK: `score` (N)
- Projection: `ALL`

#### Lambda `lambdas/getLeaderboard/index.js`

Endpoint: `GET /leaderboard?matchId={id}&limit=10`.

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

- `app/src/app/(tabs)/leaderboard.tsx` — new tab
- `app/src/hooks/useLeaderboard.ts` — fetch + 30s polling + update on `SCORE_UPDATE` WS
- `app/src/services/api.ts` — add `getLeaderboard(matchId, limit)`

UI: FlatList top N, current user highlighted, badges as icons, streak with 🔥.

### 2.2 Streaks

#### Change in `lambdas/resolveAnswer/index.js`

`updateUserScore` must handle 3 cases:

- **Correct:** `ADD currentStreak :one`. After return, if `currentStreak > bestStreak`, second `UpdateItem` sets `bestStreak = currentStreak`.
- **Wrong:** `SET currentStreak = :zero`.
- **Idempotency:** keep `processedPredictions` set, condition `NOT contains`.

Trade-off accepted: up to 2 writes per correct answer vs transaction.

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

After `UpdateItem` returns `ALL_NEW`, if `newlyUnlocked` exists, perform a third update `ADD badges :newBadges`.

### 2.4 WS Protocol — extend `SCORE_UPDATE`

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

Update the type guard. Update `arenaStore.UserScore` to include `currentStreak`/`bestStreak`/`badges`.

### 2.5 Extra UI

- 🔥 next to the score when `currentStreak >= 3` (in arena + leaderboard + profile)
- Toast/modal when `badgesUnlocked` arrives
- "Your achievements" card on `profile.tsx`

### Validation

- [ ] `score-index` GSI provisioned
- [ ] `/leaderboard` authorized by Cognito returns top N ordered
- [ ] Streak increments on consecutive correct answers, resets on wrong
- [ ] Badges unlocked trigger a toast

---

## Phase 3 — AI: Personalization + Sentiment

### 3.1 Personalized Predictions by Crowd

#### `lambdas/processEvent/preferences.js`

```javascript
const PREFERENCES = {
  "team-a": { teamName: "FC Team", style: "statistical", tone: "technical" },
  "team-b": { teamName: "Club", style: "casual", tone: "casual" },
};

function getTeamPreferences(teamId) {
  return PREFERENCES[teamId] ?? PREFERENCES["team-a"];
}

module.exports = { getTeamPreferences };
```

When the official `Mock User Preferences` arrives, populate this file with the real JSON.

#### Strategy

Generate 2 predictions per event (Crowd A and Crowd B), distribute by `teamId` of the connection. Cost: 2 Bedrock invocations per event. `sektor-connections` already stores `teamId`.

Refactor `lambdas/processEvent/index.js` to generate predictionTeamA and predictionTeamB and distribute them to connections grouped by team.

Ensure `schedulePredictionResolution` is called for BOTH predictions (each with its own `predictionId`). `correctOption` may differ between versions — `resolveAnswer` resolves each prediction independently.

#### Updated prompt

```
You are a football assistant for the {audienceTeamName} crowd.
Event: {eventType} at minute {minute}.
Generate a quick multiple-choice prediction (next 30s), in Portuguese, tone {tone},
with 4 options, subtly biased toward the crowd without lying about facts.
Respond ONLY JSON: {"question": "...", "options": [...], "correctOption": 0}
```

### 3.2 Forum Sentiment Analysis

#### `lambdas/analyzeSentiment/index.js`

Trigger: EventBridge Scheduler `rate(2 minutes)` during a live match. Group `sektor-sentiment-jobs`.

Flow:
1. Query `sektor-posts` by `teamId` for the last 50 posts (needs GSI `teamId-createdAt-index` — check if exists)
2. Concatenate texts (truncate to 4k chars per run)
3. Bedrock Nova Lite:

```
Analyze the dominant sentiment of these posts from {teamName} fans.
Categories: confident, anxious, euphoric, disappointed, neutral.
Respond ONLY JSON: {"sentiment": "...", "intensity": 0-100, "summary": "short sentence"}

Posts:
{texts}
```

4. Persist to `sektor-sentiment` (new table):
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

- Discrete banner above the `PressureBar` when `intensity >= 60`
- Color by sentiment (green=euphoric, yellow=anxious, red=disappointed, gray=neutral)
- Auto-dismiss after 30s or on new alert

### Validation

- [ ] Prediction differs by crowd (2 accounts on opposite teams receive distinct questions)
- [ ] Sentiment job runs every 2 minutes, writes Dynamo, emits WS
- [ ] Banner appears with correct tone

---

## Phase 4 — Watch Party Web

### Stack

Reuse Expo Web (the project is already Expo). No separate app.

- Route `app/src/app/watch-party/[matchId].tsx`
- Public URL: `/watch-party/{matchId}`
- No auth (public mode for TV/projector). Read-only.
- 16:9 layout, large font, minimal chrome for mobile.

### Main component

```
WatchPartyScreen (full-screen)
├─ Header: scoreboard + minute + WS status (font 4xl+)
├─ PressureBar (50% of the screen)
├─ MiniLeaderboard side (top 5, live)
├─ SentimentAlert banner when active
└─ PredictionCard centered (no buttons — read-only)
```

### WebSocket spectator

`app/src/hooks/useWebSocket.ts` — accept URL with `mode=spectator` (no token).

`lambdas/wsConnect/index.js` — when `mode=spectator`:
- Persist connection with `userId=spectator-{connectionId}`, `teamId=null`
- Do not receive personalized predictions (fall back to `team-a` or neutral variant)

`lambdas/submitAnswer/index.js` — reject `userId` starting with `spectator-` (`UNAUTHORIZED`).

### Build

```bash
cd app
npx expo export --platform web
```

Host via Amplify Hosting or S3+CloudFront. Put URL in README.

### Validation

- [ ] Public URL loads Watch Party on laptop/TV
- [ ] PressureBar updates live according to mobile answers
- [ ] Leaderboard updates
- [ ] Visual looks okay at 1920x1080

---

## Phase 5 — Accessibility (Code)

### Tasks

1. Add `accessibilityLabel` to all icon-only `TouchableOpacity` (AR button, create post FAB; theme switch already has one)
2. `accessibilityRole` on interactive elements (`button`, `switch`, `link`)
3. Ensure minimum touch target 44x44 (PredictionCard options, like icons)
4. First-login tutorial: 3 cards (Arena/Pressure/Community). Flag saved in `custom:onboardingComplete` in Cognito (or AsyncStorage for simplicity)

### Validation

- [ ] `accessibilityLabel` present on all icon-only buttons
- [ ] Tutorial shows only on first login

---

## Phase 6 — Smoke E2E Multiplayer

### Scenario

1. 2 Cognito users: `fan-a@test.com` (`team-a`), `fan-b@test.com` (`team-b`)
2. Simulator running: `npm run simulate match-demo-001 5`
3. Device A logged as `fan-a`, GPS mock inside stadium (mult 2x)
4. Device B logged as `fan-b`, GPS outside (mult 1x)
5. Browser at `https://.../watch-party/match-demo-001`

### Checks

- [ ] Both receive `PREDICTION` nearly simultaneously
- [ ] Variant for A differs from B (Phase 3.1)
- [ ] Both answer; `ANSWER_ACCEPTED` arrives
- [ ] After 15s, `PREDICTION_RESULT` + `SCORE_UPDATE` + `PRESSURE_UPDATE`
- [ ] A's score reflects 2x when correct and in-stadium
- [ ] Watch Party reflects everything
- [ ] Leaderboard shows A and B ordered
- [ ] After 5+ consecutive correct answers, badge `streak-5` unlocks for A
- [ ] Sentiment alert appears after forum posts

---

## Final Checklist (Code)

### Coverage of `Challenge.md §6`

- [ ] Multiplayer 2+ users (Phase 6)
- [ ] Official DFL pipeline (Phase 1)
- [ ] 5 gamification mechanics: score + pressure + leaderboard + streaks + badges (Phase 2)
- [ ] Bedrock personalization per crowd + sentiment (Phase 3)
- [ ] Extra touchpoint Watch Party Web (Phase 4)

### Debts `status-and-todo.md`

- [ ] `matchSimulator.ts` mock removed (Phase 0)
- [ ] `STADIUM_COORDS` real values (Phase 0)
- [ ] Root README populated (Phase 0)

### Build & Tests

- [ ] `tsc --noEmit` in `app/` passes
- [ ] Existing test suite passes
- [ ] Lint passes
- [ ] Web build `expo export --platform web` passes

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| DFL feed unavailable | Keep synthetic events as fallback; document |
| Bedrock returns invalid JSON | Already have try/catch in `processEvent`; add tolerant parser (regex extract JSON) |
| 2 Bedrock invocations per event exceed quota | Fall back to single prediction with throttling |
| Watch Party WS without auth allows abuse | `mode=spectator` rejects `submitAnswer` in Lambda; rate-limit `wsConnect` by IP |
| Sentiment returns wrong language | Enforce PT-BR in prompt + schema validation |

---

## Out of Scope (Manual)

The items below are NOT code and must be executed manually:

- `architecture.png`
- `executive_summary.pdf` (5 slides)
- `presentation_video.mp4`
- `github_link.txt`
- Final zip `<TeamName>.zip`
- Submission via Box

---

## Next Action

1. Confirm availability of the `DFL Live Match Mock JSON` (Phase 1)
2. Start Phase 0 (hygiene) — prerequisite for everything
3. In parallel after Phase 0:
   - branch `feat/leaderboard-streaks-badges` (Phase 2)
   - branch `feat/bedrock-personalization-sentiment` (Phase 3)
   - branch `feat/watch-party-web` (Phase 4)
4. Phase 5 (a11y) and Phase 6 (smoke) at the end
