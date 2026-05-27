# Project status and outstanding tasks

Last update: 2026-05-14

## ✅ Completed

### Plans 01–04 (frontend + AWS pipeline)
- Plan 01 — Structure, navigation, types, NativeWind
- Plan 02 — Cognito + login/register/team selection
- Plan 03 — Arena mode with WebSocket, PressureBar, PredictionCard
- Plan 04 — AWS pipeline end-to-end:
  - Simulator script `npm run simulate <matchId> <duration>` emitting to Kinesis
  - Lambda `processEvent` filtering events, generating Bedrock predictions and distributing via WebSocket
  - Lambdas `wsConnect` / `wsDisconnect` maintaining `sektor-connections` in DynamoDB
  - App consumes real predictions (mock removed in `src/app/arena/[matchId].tsx`)

### AWS infra provisioned
- Cognito User Pool + App Client
- DynamoDB: `sektor-connections` (with GSI `connectionId-index` and TTL)
- API Gateway WebSocket `sektor-ws-api` (ID: `3bodgtvae0`, stage `prod`, auto-deploy)
- Lambdas: `wsConnect`, `wsDisconnect`, `processEvent`, `resolveAnswer`
- Kinesis Stream: `sektor-match-events` (1 shard) with trigger to `processEvent`
- Bedrock: model `amazon.nova-lite-v1:0` available (Claude blocked by org SCP)
- IAM inline policies per role (DynamoDB, Bedrock, ManageConnections, Kinesis)

Resource IDs and URLs are in `.kiro/steering/aws-resources.md`.

---

## 🟡 Partial / Pending

### Plan 04 — points to validate
- [ ] `resolveAnswer` Lambda does NOT have an automatic trigger when a `PREDICTION` expires (15s). Options:
  - Option A: create EventBridge Scheduler one-shot scheduled by `processEvent` when creating the prediction (simpler)
  - Option B: have `processEvent` invoke `resolveAnswer` with a delayed invocation (Step Functions, more complex)
- [ ] `sektor-scores` table does not exist yet. `resolveAnswer` should update scores by user/match. Define schema and provision.
- [ ] App does not yet send the real `ANSWER`; review `services/arenaProtocol.ts` + Lambda receiving answers (WS `sendMessage` route or REST endpoint).
- [ ] Remove unused mock: `src/services/matchSimulator.ts` and related test.

### Plan 05 — Community (infra not started)
- [ ] DynamoDB: create `sektor-posts`, `sektor-comments`, `sektor-likes` (infra/README step 2)
- [ ] S3: create `sektor-media-bucket` with CORS (infra/README step 3)
- [ ] API Gateway REST `sektor-rest-api` with Cognito Authorizer (infra/README step 8)
- [ ] REST Lambdas: `getPosts`, `createPost`, `likePost`, `unlikePost`, `getComments`, `createComment`, `getUploadUrl` (infra/README step 9)
- [ ] App: replace community mocks with real endpoints. `EXPO_PUBLIC_API_REST_URL` in `.env.local`.

### Plan 06 — GPS + AR + polish
- [ ] Update `STADIUM_COORDS` in `src/constants/config.ts` with real stadium coordinates
- [ ] Validate GPS permission flow on Android and iOS
- [ ] Validate `ARView` with real camera (implemented, needs device testing)
- [ ] Sektor visual theme: review palette, typography, icons
- [ ] End-to-end 2x multiplier test (GPS → ANSWER → Lambda → score)

---

## 🔧 Technical debts / notes

- **Org SCP blocks Anthropic in Bedrock** — Claude models are blocked. We use `amazon.nova-lite-v1:0`. If SCP is lifted later, switching back to Claude could improve prompt quality.
- Each Lambda was created via console with its own role (no single `sektor-lambda-role` as suggested in `infra/README.md`). Update README after changes.
- Initial WebSocket integration was created with odd flags (`PassthroughBehavior`, `ContentHandlingStrategy`) — recreated via CLI. If moving to IaC (Terraform/CDK), provision cleanly.
- `AmazonAPIGatewayInvokeFullAccess` does NOT cover `execute-api:ManageConnections`; use inline policy.

---

## ▶️ How to resume

1. Ensure `.env.local` contains:
```
EXPO_PUBLIC_API_WS_URL=wss://3bodgtvae0.execute-api.us-east-1.amazonaws.com/prod
EXPO_PUBLIC_COGNITO_USER_POOL_ID=...
EXPO_PUBLIC_COGNITO_CLIENT_ID=...
```
2. Pipeline smoke test:
- Terminal 1: `wscat -c "wss://3bodgtvae0.execute-api.us-east-1.amazonaws.com/prod?matchId=test-001"`
- Terminal 2: `npm run simulate test-001 3`
- Expected: `{"type":"PREDICTION", ...}` messages arrive in terminal 1.
3. Recommended next step: close the response cycle (item in "Plan 04 — points to validate") **or** start Plan 05 (community), which is independent.
