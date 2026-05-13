# Sektor — Planos de Implementação

Guia de implementação do app Sektor dividido em 6 planos incrementais.

**Princípio central de todos os planos:** código e arquitetura o mais simples possível. Sem over-engineering, sem abstrações prematuras. Cada plano entrega valor funcional sem quebrar o que foi feito antes.

---

## Ordem de Execução

```
Plano 01 → Plano 02 → Plano 03 → Plano 04
                                         ↘
                    Plano 05 ─────────────→ Plano 06
```

> Os Planos 04 e 05 podem ser desenvolvidos em paralelo após o Plano 03.

---

## Planos

| # | Arquivo | O que entrega | Depende de |
|---|---------|---------------|------------|
| 01 | [plano-01-fundacao.md](./plano-01-fundacao.md) | Estrutura de pastas, navegação (tabs + auth), tipos TypeScript, NativeWind, telas skeleton | — |
| 02 | [plano-02-autenticacao.md](./plano-02-autenticacao.md) | Cognito + Amplify, login, cadastro, escolha de time, authStore, proteção de rotas | 01 |
| 03 | [plano-03-modo-arena.md](./plano-03-modo-arena.md) | WebSocket, PressureBar, PredictionCard, arenaStore, fluxo completo com mock | 01, 02 |
| 04 | [plano-04-simulador-pipeline.md](./plano-04-simulador-pipeline.md) | Script simulador DFL, Kinesis → EventBridge → Lambda → Bedrock → WebSocket | 03 |
| 05 | [plano-05-comunidade.md](./plano-05-comunidade.md) | Feed de posts, criar post, curtidas otimistas, comentários, upload S3 | 01, 02 |
| 06 | [plano-06-gps-ar-polimento.md](./plano-06-gps-ar-polimento.md) | GPS multiplicador 2x, AR mockup via câmera, tema visual Sektor | 01–05 |

---

## Stack

- **Frontend:** React Native + Expo + NativeWind + Expo Router
- **Auth:** Amazon Cognito via AWS Amplify SDK
- **Backend:** API Gateway REST (fórum) + API Gateway WebSocket (arena) + AWS Lambda
- **DB:** DynamoDB + S3
- **Pipeline:** Kinesis → EventBridge → Lambda → Bedrock (Claude)
- **Espacial:** Expo Location (GPS) + Expo Camera (AR mockup)
