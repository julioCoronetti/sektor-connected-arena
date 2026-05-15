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

Cada Lambda foi criada pelo console e tem sua própria execution role auto-gerada (não existe role compartilhada `sektor-lambda-role`). Para descobrir a role de uma função:
```
aws lambda get-function-configuration --function-name <NAME> --query Role --output text
```

## DynamoDB
- `sektor-connections` (PK matchId, SK connectionId, GSI connectionId-index, TTL atributo `ttl`)

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
