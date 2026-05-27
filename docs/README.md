# Sektor — Implementation Plans

Implementation guide for the Sektor app split into incremental plans.

**Core principle for all plans:** keep code and architecture as simple as possible. No over-engineering, no premature abstractions. Each plan must deliver functional value without breaking previous work.

---

## Execution order

```
Plan 01 → Plan 02 → Plan 03 → Plan 04
                                         ↘
                    Plan 05 ─────────────→ Plan 06
```

> Plans 04 and 05 can be developed in parallel after Plan 03.

---

## Plans

| # | File | What it delivers | Depends on |
|---|------|------------------|------------|
| 01 | [plano-01-fundacao.md](./plano-01-fundacao.md) | Folder structure, navigation (tabs + auth), TypeScript types, NativeWind, skeleton screens | — |
| 02 | [plano-02-autenticacao.md](./plano-02-autenticacao.md) | Cognito + Amplify, login, register, team selection, authStore, route protection | 01 |
| 03 | [plano-03-modo-arena.md](./plano-03-modo-arena.md) | WebSocket, PressureBar, PredictionCard, arenaStore, flow with mock | 01, 02 |
| 04 | [plano-04-simulador-pipeline.md](./plano-04-simulador-pipeline.md) | DFL simulator script, Kinesis → EventBridge → Lambda → Bedrock → WebSocket | 03 |
| 05 | [plano-05-comunidade.md](./plano-05-comunidade.md) | Posts feed, create post, optimistic likes, comments, S3 uploads | 01, 02 |
| 06 | [plano-06-gps-ar-polimento.md](./plano-06-gps-ar-polimento.md) | GPS 2x multiplier, AR mockup via camera, visual polish | 01–05 |
| 07 | [plano-07-integracao-aws.md](./plano-07-integracao-aws.md) | Connect the app to real AWS infra, remove mocks, multiplayer smoke | 01–06 |
| 08 | [plano-08-final-challenge.md](./plano-08-final-challenge.md) | Challenge finalization: DFL real feed, leaderboard/streaks/badges, sentiment, Watch Party Web, deliverables | 07 |

---

## Stack

- **Frontend:** React Native + Expo + NativeWind + Expo Router
- **Auth:** Amazon Cognito via AWS Amplify SDK
- **Backend:** API Gateway REST (forum) + API Gateway WebSocket (arena) + AWS Lambda
- **DB:** DynamoDB + S3
- **Pipeline:** Kinesis → EventBridge → Lambda → Bedrock (Claude)
- **Spatial:** Expo Location (GPS) + Expo Camera (AR mockup)
