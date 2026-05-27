# Sektor — Connected Arena

Mobile engagement app for real-time fan interaction. Fans compete in live predictions during Bundesliga matches, earn points, climb leaderboards, and engage with their team's community.

---

## Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native + Expo + NativeWind + Expo Router |
| Auth | Amazon Cognito via AWS Amplify |
| Backend (REST) | API Gateway REST + AWS Lambda |
| Backend (Realtime) | API Gateway WebSocket + AWS Lambda |
| Database | Amazon DynamoDB |
| Storage | Amazon S3 |
| Match pipeline | Amazon Kinesis → Lambda → Amazon Bedrock (Nova Lite) |
| Scheduler | Amazon EventBridge Scheduler |
| AI | Amazon Bedrock (amazon.nova-lite-v1:0) |
| Location | Expo Location (GPS) |
| AR | Expo Camera (native overlay) |

---

## Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- AWS CLI configured with the challenge account credentials
- `wscat` for smoke tests: `npm install -g wscat`

---

## Environment Variables

Create `app/.env.local` with:

```
EXPO_PUBLIC_API_WS_URL=wss://<WS_API_ID>.execute-api.us-east-1.amazonaws.com/prod
EXPO_PUBLIC_API_REST_URL=https://<REST_API_ID>.execute-api.us-east-1.amazonaws.com/prod
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
EXPO_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Running the App

```bash
cd app
npm install
npm run start          # Expo Go (QR code)
npm run android        # Android emulator
npm run ios            # iOS simulator
npm run web            # Watch Party Web (browser)
```

Notes:
- The `simulate` script is available in `app/package.json` and can be run with `npm run simulate -- match-001 5`.

---

## Running the Match Simulator

The simulator replays real DFL match data from S3 and emits events to Kinesis.

**Via Lambda (production):**
The simulator is triggered automatically when the first user joins the Arena; manual execution is not required.

**Via local script (development):**
```bash
cd app
npm run simulate -- match-001 5
# Parameters: <matchId> <durationMinutes>
```

**Manual smoke test:**
```bash
# Terminal 1 — connect to the WebSocket
wscat -c "wss://<WS_API_ID>.execute-api.us-east-1.amazonaws.com/prod?matchId=match-001"

# Terminal 2 — trigger the simulator via AWS CLI
aws lambda invoke \
  --function-name simulateMatch \
  --invocation-type Event \
  --payload '{"matchId":"match-001","speedFactor":120}' \
  /dev/null
```

Expected in Terminal 1: `{"type":"PREDICTION", ...}` messages arriving for each relevant event.

---

## Project Structure

```
sektor-connected-arena/
├── app/                    # React Native (Expo)
│   └── src/
│       ├── app/            # Routes (Expo Router)
│       │   ├── (auth)/     # Login, signup, team selection
│       │   ├── (tabs)/     # Community, Arena, Leaderboard, Profile
│       │   ├── arena/      # Arena mode [matchId]
│       │   └── watch-party/# Watch Party Web [matchId]
│       ├── components/     # UI components
│       ├── hooks/          # Custom hooks
│       ├── services/       # API, WebSocket, Auth
│       ├── store/          # Zustand stores
│       └── types/          # TypeScript types
├── lambdas/                # AWS Lambda functions
│   ├── wsConnect/          # WebSocket $connect
│   ├── wsDisconnect/       # WebSocket $disconnect
│   ├── submitAnswer/       # Receives prediction answers
│   ├── resolveAnswer/      # Resolves predictions, scores, and badges
│   ├── processEvent/       # Kinesis → Bedrock → WS broadcast
│   ├── simulateMatch/      # Replays DFL feed (S3 → Kinesis)
│   ├── getLeaderboard/     # REST GET /leaderboard
│   ├── analyzeSentiment/   # Forum sentiment via Bedrock
│   ├── getPosts/           # REST GET /posts
│   ├── createPost/         # REST POST /posts
│   ├── likePost/           # REST POST /posts/{id}/like
│   ├── unlikePost/         # REST DELETE /posts/{id}/like
│   ├── getComments/        # REST GET /posts/{id}/comments
│   ├── createComment/      # REST POST /posts/{id}/comments
│   └── getUploadUrl/       # REST GET /upload-url
├── infra/                  # IAM policies and AWS configs
├── docs/                   # Implementation plans
└── challenge/              # Challenge documentation
```

---

## AWS Architecture

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
              ├─ Bedrock Nova Lite (team-custom predictions)
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

---

Notes:
- Commands and script names were verified against `app/package.json`.
- If any environment or deployment instructions need more detail, specify which section to expand.
