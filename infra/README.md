# Infraestrutura AWS — Sektor Connected Arena

Guia passo a passo para provisionar todos os serviços AWS necessários para o app funcionar de ponta a ponta.

## Pré-requisitos

- AWS CLI configurado (`aws configure`) com credenciais de uma conta com permissões administrativas
- Região: `us-east-1` (ou altere todas as referências abaixo)
- Node.js 18+ instalado (para deploy das Lambdas)

---

## Ordem de Provisionamento

```
1. Cognito (User Pool)          ← Plano 02
2. DynamoDB (Connections + Scores) ← Plano 04
3. S3 (Mídia do Fórum)          ← Plano 05
4. API Gateway WebSocket        ← Plano 03/04
5. Lambdas (wsConnect, wsDisconnect, processEvent, resolveAnswer) ← Plano 04
6. Kinesis Stream               ← Plano 04
7. EventBridge (opcional)       ← Plano 04
8. Bedrock (acesso ao modelo)   ← Plano 04
9. API Gateway REST (Fórum)     ← Plano 05
10. Lambdas REST (posts, comments, likes, upload-url) ← Plano 05
```

---

## Passo 1 — Amazon Cognito (User Pool)

O Cognito autentica os usuários do app. O Plano 02 usa `signIn`, `signUp`, `signOut`, `getCurrentUser` e `updateUserAttributes`.

### Criar o User Pool

```bash
aws cognito-idp create-user-pool ^
  --pool-name sektor-user-pool ^
  --auto-verified-attributes email ^
  --username-attributes email ^
  --schema Name=email,Required=true,Mutable=true Name=name,Required=false,Mutable=true Name=custom:teamId,AttributeDataType=String,Mutable=true ^
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=false,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" ^
  --mfa-configuration OFF ^
  --region us-east-1
```

Anote o `UserPoolId` retornado (formato: `us-east-1_XXXXXXXXX`).

### Criar o App Client (sem secret — para mobile)

```bash
aws cognito-idp create-user-pool-client ^
  --user-pool-id <USER_POOL_ID> ^
  --client-name sektor-mobile-client ^
  --no-generate-secret ^
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH ^
  --region us-east-1
```

Anote o `ClientId` retornado.

### Configurar no App

Crie `.env.local` na raiz do app:
```
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
EXPO_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Passo 2 — DynamoDB

### Tabela: `sektor-connections`

Rastreia conexões WebSocket ativas por partida.

```bash
aws dynamodb create-table ^
  --table-name sektor-connections ^
  --attribute-definitions AttributeName=matchId,AttributeType=S AttributeName=connectionId,AttributeType=S ^
  --key-schema AttributeName=matchId,KeyType=HASH AttributeName=connectionId,KeyType=RANGE ^
  --billing-mode PAY_PER_REQUEST ^
  --global-secondary-indexes "[{\"IndexName\":\"connectionId-index\",\"KeySchema\":[{\"AttributeName\":\"connectionId\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" ^
  --region us-east-1
```

Habilitar TTL no atributo `ttl`:
```bash
aws dynamodb update-time-to-live ^
  --table-name sektor-connections ^
  --time-to-live-specification Enabled=true,AttributeName=ttl ^
  --region us-east-1
```

### Tabela: `sektor-posts`

Feed da comunidade.

```bash
aws dynamodb create-table ^
  --table-name sektor-posts ^
  --attribute-definitions AttributeName=teamId,AttributeType=S AttributeName=createdAt,AttributeType=S ^
  --key-schema AttributeName=teamId,KeyType=HASH AttributeName=createdAt,KeyType=RANGE ^
  --billing-mode PAY_PER_REQUEST ^
  --region us-east-1
```

### Tabela: `sektor-comments`

```bash
aws dynamodb create-table ^
  --table-name sektor-comments ^
  --attribute-definitions AttributeName=postId,AttributeType=S AttributeName=createdAt,AttributeType=S ^
  --key-schema AttributeName=postId,KeyType=HASH AttributeName=createdAt,KeyType=RANGE ^
  --billing-mode PAY_PER_REQUEST ^
  --region us-east-1
```

### Tabela: `sektor-likes`

```bash
aws dynamodb create-table ^
  --table-name sektor-likes ^
  --attribute-definitions AttributeName=postId,AttributeType=S AttributeName=userId,AttributeType=S ^
  --key-schema AttributeName=postId,KeyType=HASH AttributeName=userId,KeyType=RANGE ^
  --billing-mode PAY_PER_REQUEST ^
  --region us-east-1
```

---

## Passo 3 — S3 (Mídia do Fórum)

```bash
aws s3 mb s3://sektor-media-bucket --region us-east-1
```

Configurar CORS para upload direto do app:
```bash
aws s3api put-bucket-cors --bucket sektor-media-bucket --cors-configuration "{\"CORSRules\":[{\"AllowedHeaders\":[\"*\"],\"AllowedMethods\":[\"PUT\",\"GET\"],\"AllowedOrigins\":[\"*\"],\"MaxAgeSeconds\":3600}]}"
```

---

## Passo 4 — API Gateway WebSocket

### Criar a API

```bash
aws apigatewayv2 create-api ^
  --name sektor-ws-api ^
  --protocol-type WEBSOCKET ^
  --route-selection-expression "$request.body.type" ^
  --region us-east-1
```

Anote o `ApiId`.

### Criar rotas

Após criar as Lambdas (Passo 5), integre:
- `$connect` → Lambda `wsConnect`
- `$disconnect` → Lambda `wsDisconnect`
- `sendMessage` → Lambda `processEvent` (ou rota default)

### Deploy

```bash
aws apigatewayv2 create-stage ^
  --api-id <API_ID> ^
  --stage-name prod ^
  --auto-deploy ^
  --region us-east-1
```

A URL WebSocket será: `wss://<API_ID>.execute-api.us-east-1.amazonaws.com/prod`

Atualize `.env.local`:
```
EXPO_PUBLIC_API_WS_URL=wss://<API_ID>.execute-api.us-east-1.amazonaws.com/prod
```

---

## Passo 5 — Lambdas (Pipeline WebSocket)

### IAM Role para as Lambdas

Crie uma role com as seguintes policies:
- `AWSLambdaBasicExecutionRole` (logs)
- Acesso DynamoDB (`sektor-connections`)
- Acesso Bedrock (`bedrock:InvokeModel`)
- Acesso API Gateway Management (`execute-api:ManageConnections`)

```bash
aws iam create-role ^
  --role-name sektor-lambda-role ^
  --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"lambda.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}" ^
  --region us-east-1
```

Attach policies:
```bash
aws iam attach-role-policy --role-name sektor-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam attach-role-policy --role-name sektor-lambda-role --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam attach-role-policy --role-name sektor-lambda-role --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
aws iam attach-role-policy --role-name sektor-lambda-role --policy-arn arn:aws:iam::aws:policy/AmazonAPIGatewayInvokeFullAccess
```

### Deploy cada Lambda

Para cada pasta em `lambdas/` (wsConnect, wsDisconnect, processEvent, resolveAnswer):

```bash
cd lambdas\wsConnect
powershell Compress-Archive -Path index.js -DestinationPath function.zip -Force
aws lambda create-function ^
  --function-name sektor-wsConnect ^
  --runtime nodejs18.x ^
  --handler index.handler ^
  --role arn:aws:iam::<ACCOUNT_ID>:role/sektor-lambda-role ^
  --zip-file fileb://function.zip ^
  --environment "Variables={AWS_REGION=us-east-1,CONNECTIONS_TABLE=sektor-connections}" ^
  --region us-east-1
```

Repita para `wsDisconnect`, `processEvent` e `resolveAnswer`, adicionando `WS_ENDPOINT` nas envs de `processEvent` e `resolveAnswer`.

### Integrar com API Gateway WebSocket

```bash
aws apigatewayv2 create-integration ^
  --api-id <API_ID> ^
  --integration-type AWS_PROXY ^
  --integration-uri arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:sektor-wsConnect ^
  --region us-east-1
```

Repita para cada rota (`$connect`, `$disconnect`).

Dê permissão ao API Gateway para invocar as Lambdas:
```bash
aws lambda add-permission ^
  --function-name sektor-wsConnect ^
  --statement-id apigateway-invoke ^
  --action lambda:InvokeFunction ^
  --principal apigateway.amazonaws.com ^
  --source-arn "arn:aws:execute-api:us-east-1:<ACCOUNT_ID>:<API_ID>/*" ^
  --region us-east-1
```

---

## Passo 6 — Kinesis Stream

```bash
aws kinesis create-stream ^
  --stream-name sektor-match-events ^
  --shard-count 1 ^
  --region us-east-1
```

### Trigger: Kinesis → Lambda processEvent

```bash
aws lambda create-event-source-mapping ^
  --function-name sektor-processEvent ^
  --event-source-arn arn:aws:kinesis:us-east-1:<ACCOUNT_ID>:stream/sektor-match-events ^
  --starting-position LATEST ^
  --batch-size 1 ^
  --region us-east-1
```

---

## Passo 7 — Amazon Bedrock

### Habilitar acesso ao modelo

No console AWS:
1. Vá para **Amazon Bedrock** → **Model access**
2. Solicite acesso ao modelo `anthropic.claude-3-haiku-20240307-v1:0`
3. Aguarde aprovação (geralmente instantâneo para Haiku)

Não há CLI para isso — é feito via console.

---

## Passo 8 — API Gateway REST (Fórum)

### Criar a API REST

```bash
aws apigateway create-rest-api ^
  --name sektor-rest-api ^
  --endpoint-configuration "types=REGIONAL" ^
  --region us-east-1
```

Anote o `id` retornado.

### Recursos e métodos necessários

```
GET    /posts
POST   /posts
POST   /posts/{postId}/like
DELETE /posts/{postId}/like
GET    /posts/{postId}/comments
POST   /posts/{postId}/comments
GET    /upload-url
```

Cada recurso é integrado com uma Lambda correspondente. Use o Authorizer do Cognito para validar o token Bearer.

### Authorizer Cognito

```bash
aws apigateway create-authorizer ^
  --rest-api-id <REST_API_ID> ^
  --name cognito-authorizer ^
  --type COGNITO_USER_POOLS ^
  --provider-arns arn:aws:cognito-idp:us-east-1:<ACCOUNT_ID>:userpool/<USER_POOL_ID> ^
  --identity-source "method.request.header.Authorization" ^
  --region us-east-1
```

### Deploy

```bash
aws apigateway create-deployment ^
  --rest-api-id <REST_API_ID> ^
  --stage-name prod ^
  --region us-east-1
```

URL: `https://<REST_API_ID>.execute-api.us-east-1.amazonaws.com/prod`

Atualize `.env.local`:
```
EXPO_PUBLIC_API_REST_URL=https://<REST_API_ID>.execute-api.us-east-1.amazonaws.com/prod
```

---

## Passo 9 — Lambdas REST (Fórum)

Crie Lambdas para cada endpoint do fórum. Elas acessam DynamoDB (`sektor-posts`, `sektor-comments`, `sektor-likes`) e S3 (`sektor-media-bucket`).

As Lambdas REST estão documentadas em `infra/lambdas-rest/` (ver arquivos nesta pasta).

---

## Passo 10 — Variáveis de Ambiente Finais

### `.env.local` completo

```
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
EXPO_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
EXPO_PUBLIC_API_REST_URL=https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/prod
EXPO_PUBLIC_API_WS_URL=wss://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/prod
```

### Variáveis das Lambdas

| Lambda | Variáveis |
|--------|-----------|
| wsConnect | `CONNECTIONS_TABLE=sektor-connections` |
| wsDisconnect | `CONNECTIONS_TABLE=sektor-connections` |
| processEvent | `CONNECTIONS_TABLE=sektor-connections`, `WS_ENDPOINT=https://<WS_API_ID>.execute-api.us-east-1.amazonaws.com/prod` |
| resolveAnswer | `CONNECTIONS_TABLE=sektor-connections`, `WS_ENDPOINT=https://<WS_API_ID>.execute-api.us-east-1.amazonaws.com/prod` |
| REST Lambdas | `POSTS_TABLE=sektor-posts`, `COMMENTS_TABLE=sektor-comments`, `LIKES_TABLE=sektor-likes`, `MEDIA_BUCKET=sektor-media-bucket` |

---

## Verificação

Após provisionar tudo:

1. **Cognito:** Crie um usuário de teste via console ou CLI
2. **WebSocket:** Conecte via `wscat -c "wss://<URL>?matchId=test-001"` e confirme que a conexão é salva no DynamoDB
3. **Simulador:** Rode `npm run simulate test-001 3` e verifique nos logs do CloudWatch que a Lambda `processEvent` é invocada
4. **Bedrock:** Confirme que a predição é gerada (verifique no CloudWatch)
5. **REST:** Teste `GET /posts?teamId=team-a` com token Cognito válido
6. **S3:** Teste `GET /upload-url?filename=test.jpg&type=image/jpeg` e faça upload

---

## Custos Estimados (uso baixo / hackathon)

| Serviço | Custo estimado |
|---------|---------------|
| Cognito | Grátis (até 50k MAU) |
| DynamoDB | Grátis (tier free: 25 WCU/RCU) |
| S3 | ~$0.02/mês |
| API Gateway | ~$1-3/mês |
| Lambda | Grátis (tier free: 1M requests) |
| Kinesis | ~$0.36/mês (1 shard) |
| Bedrock (Haiku) | ~$0.25/1000 invocações |

**Total estimado para hackathon: < $5/mês**
