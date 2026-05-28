# Design Document — Comunidade Feed

## Overview

Feature do feed de comunidade entregue como um conjunto de 7 Lambdas Node.js 18 (CommonJS, AWS SDK v3 modular), expostas atrás de uma API Gateway REST (`sektor-rest-api`, stage `prod`) com Cognito Authorizer (User Pool `us-east-1_cHokaMBWW`). Persistência em três tabelas DynamoDB on-demand e mídia em S3 com upload direto via URL pré-assinada. Frontend reaproveita `src/services/api.ts` e tipos `Post`/`Comment` já existentes; ganha um `CommentsModal` novo e um image picker funcional no `CreatePostModal`.

A entrega segue o padrão de `lambdas/submitAnswer` e `lambdas/resolveAnswer`: cada Lambda em diretório próprio (`lambdas/{nome}/{index.js,package.json}`), CommonJS, clientes AWS SDK instanciados no escopo do módulo, validação de env (`assertEnv`) e logs JSON (`level`, `message`). Cada Lambda terá role própria (criada via CLI) com policy inline mínima.

O **Agent** executa diretamente os comandos AWS CLI de provisionamento (DynamoDB, S3, IAM, Lambdas, API Gateway) no ambiente do usuário, sob salvaguardas estritas: pré-flight de idempotência (`describe`/`get` antes de cada `create`), allow-list explícita de identificadores, deny-list dos `Recursos_Protegidos` documentados em `aws-resources.md`, proibição de comandos destrutivos, halt-on-error com stderr exposto e pausa para confirmação do usuário antes do primeiro lote. O usuário não roda os comandos manualmente; ele apenas autoriza a execução e acompanha os logs no chat.

## Architecture

```
Expo App (React Native)
  src/services/api.ts ──► Cognito ID token (Authorization: Bearer)
        │
        ▼
API Gateway REST  sektor-rest-api  (prod)
  COGNITO_USER_POOLS authorizer (us-east-1_cHokaMBWW)
        │  AWS_PROXY
        ▼
┌─────────────────────────────────────────────────────────┐
│  GET  /posts                       → getPosts          │
│  POST /posts                       → createPost        │
│  POST /posts/{postId}/like         → likePost          │
│  DELETE /posts/{postId}/like       → unlikePost        │
│  GET  /posts/{postId}/comments     → getComments       │
│  POST /posts/{postId}/comments     → createComment     │
│  GET  /upload-url                  → getUploadUrl      │
└─────────────────────────────────────────────────────────┘
        │                          │
        ▼                          ▼
DynamoDB                       S3
  sektor-posts (PK teamId, SK createdAt, GSI id-index)
  sektor-comments (PK postId, SK createdAt)
  sektor-likes (PK postId, SK userId)
                                 sektor-media-bucket
                                   posts/{userSub}/{ts}-{sanitized}
```

Decisões-chave:
- **Chave de `sektor-posts`** = `teamId` (PK) + `createdAt` (SK). Listagem do feed é sempre por time, então a Query nativa cobre R1 sem GSI extra.
- **GSI `id-index`** em `sektor-posts` (PK `id`, projection `KEYS_ONLY` + `likes`/`commentCount`) é necessário para like/unlike/createComment localizarem o post a partir do `postId` da URL sem que o cliente envie `teamId` e `createdAt`.
- **`sektor-likes`** garante one-like-per-user via `ConditionExpression="attribute_not_exists(userId)"`. O contador denormalizado em `sektor-posts.likes` é a fonte exibida.
- **Upload direto S3**: o app pega URL pré-assinada (`PUT`, 300s, `ContentType` fixo) e envia o blob diretamente; a Lambda nunca toca bytes da imagem.

## Components and Interfaces

### Backend — Lambdas

Todas seguem o esqueleto comum:

```js
// lambdas/{nome}/index.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, /* commands */ } = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
);

const REQUIRED_ENV = [/* per lambda */];
function assertEnv() { /* same as submitAnswer.assertEnv */ }

function ok(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}
function err(status, message) { return ok(status, { error: message }); }

function getClaims(event) {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims?.sub) return null;
  return claims;
}

exports.handler = async (event) => {
  assertEnv();
  const claims = getClaims(event);
  if (!claims) return err(401, "unauthenticated");
  // ... handler-specific branches
};
```

#### 1. `getPosts` — `GET /posts`

Env: `POSTS_TABLE`.

```text
parse teamId from event.queryStringParameters
if !teamId → 400 "teamId required"
parse lastKey (base64 → JSON) → ExclusiveStartKey | undefined
QueryCommand({
  TableName: POSTS_TABLE,
  KeyConditionExpression: "teamId = :t",
  ExpressionAttributeValues: { ":t": teamId },
  ScanIndexForward: false,
  Limit: 20,
  ExclusiveStartKey,
})
posts = Items.map(toPostShape)   // garante likes/commentCount numéricos com default 0
nextKey = LastEvaluatedKey ? base64(JSON.stringify(LastEvaluatedKey)) : undefined
return ok(200, { posts, ...(nextKey && { lastKey: nextKey }) })
```

#### 2. `createPost` — `POST /posts`

Env: `POSTS_TABLE`.

```text
body = JSON.parse(event.body || "{}")
text = body.text
if typeof text !== "string" || text.trim().length === 0 → 400 "text required"
teamId = claims["custom:teamId"]
if !teamId → 400 "teamId claim missing"
if body.imageUrl !== undefined:
  if typeof body.imageUrl !== "string" || !body.imageUrl.startsWith("https://sektor-media-bucket.s3.")
    → 400 "invalid imageUrl"
post = {
  id: randomUUID(),
  authorId: claims.sub,
  authorName: claims.name || claims.email,
  teamId,
  text: text.trim(),
  ...(body.imageUrl && { imageUrl: body.imageUrl }),
  likes: 0,
  commentCount: 0,
  createdAt: new Date().toISOString(),
}
PutCommand({ TableName: POSTS_TABLE, Item: post })
return ok(201, { post })
```

#### 3. `likePost` — `POST /posts/{postId}/like`

Env: `POSTS_TABLE`, `LIKES_TABLE`.

```text
postId = event.pathParameters.postId
userId = claims.sub
key = await findPostKey(postId)        // GSI id-index → { teamId, createdAt }
if !key → 404 "post not found"
try:
  PutCommand({
    TableName: LIKES_TABLE,
    Item: { postId, userId, createdAt: nowISO },
    ConditionExpression: "attribute_not_exists(userId)",
  })
catch ConditionalCheckFailedException:
  current = GetCommand(POSTS_TABLE, key, ProjectionExpression: "likes")
  return ok(200, { likes: current.Item?.likes ?? 0 })
res = UpdateCommand({
  TableName: POSTS_TABLE,
  Key: key,
  UpdateExpression: "ADD likes :one",
  ExpressionAttributeValues: { ":one": 1 },
  ReturnValues: "UPDATED_NEW",
})
return ok(200, { likes: res.Attributes.likes })
```

#### 4. `unlikePost` — `DELETE /posts/{postId}/like`

Env: `POSTS_TABLE`, `LIKES_TABLE`.

Espelho de `likePost`:
- `DeleteCommand` em `LIKES_TABLE` com `ConditionExpression="attribute_exists(userId)"`.
- Em sucesso: `UpdateExpression="ADD likes :neg"` (`:neg = -1`).
- Em `ConditionalCheckFailedException`: `GetItem` para devolver `likes` atual sem alterar.

#### 5. `getComments` — `GET /posts/{postId}/comments`

Env: `COMMENTS_TABLE`.

```text
postId = event.pathParameters.postId
QueryCommand({
  TableName: COMMENTS_TABLE,
  KeyConditionExpression: "postId = :p",
  ExpressionAttributeValues: { ":p": postId },
  ScanIndexForward: true,
})
return ok(200, { comments: Items.map(toCommentShape) })
```

#### 6. `createComment` — `POST /posts/{postId}/comments`

Env: `POSTS_TABLE`, `COMMENTS_TABLE`.

```text
body = JSON.parse(event.body || "{}")
text = body.text
if typeof text !== "string" || text.trim().length === 0 → 400 "text required"
postId = event.pathParameters.postId
key = await findPostKey(postId)
if !key → 404 "post not found"
comment = {
  id: randomUUID(),
  postId,
  authorId: claims.sub,
  authorName: claims.name || claims.email,
  text: text.trim(),
  createdAt: new Date().toISOString(),
}
PutCommand({ TableName: COMMENTS_TABLE, Item: comment })
UpdateCommand({
  TableName: POSTS_TABLE,
  Key: key,
  UpdateExpression: "ADD commentCount :one",
  ExpressionAttributeValues: { ":one": 1 },
})
return ok(201, { comment })
```

#### 7. `getUploadUrl` — `GET /upload-url`

Env: `MEDIA_BUCKET`.

```js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({ region: process.env.AWS_REGION });
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitize(name) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);
}
```

```text
qs = event.queryStringParameters || {}
if !qs.filename → 400 "filename required"
if !ALLOWED.has(qs.type) → 400 "unsupported type"
key = `posts/${claims.sub}/${Date.now()}-${sanitize(qs.filename)}`
uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
  Bucket: MEDIA_BUCKET, Key: key, ContentType: qs.type,
}), { expiresIn: 300 })
fileUrl = `https://${MEDIA_BUCKET}.s3.us-east-1.amazonaws.com/${key}`
return ok(200, { uploadUrl, fileUrl })
```

#### Helper compartilhado: `findPostKey`

Implementado inline em cada Lambda que precisa (like/unlike/createComment). Sem package compartilhado para manter o padrão de Lambdas independentes.

```text
async function findPostKey(postId) {
  res = QueryCommand({
    TableName: POSTS_TABLE,
    IndexName: "id-index",
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: { ":id": postId },
    Limit: 1,
  })
  item = res.Items?.[0]
  return item ? { teamId: item.teamId, createdAt: item.createdAt } : null
}
```

### Frontend

#### `CommentsModal` (novo) — `src/components/community/CommentsModal.tsx`

Props:
```ts
interface CommentsModalProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
  onCommentAdded: (postId: string) => void; // dispara incremento no PostCard
}
```

Comportamento:
- `useEffect` em `[postId, visible]`: quando `visible && postId`, chama `useCommunity().getComments(postId)` e popula state local `comments`.
- Lista renderizada com `FlatList`, `keyExtractor=item.id`, ordem ascendente (já vem do backend), card com `authorName`, `text`, tempo relativo (reaproveitar helper de `PostCard.tsx`).
- Input no rodapé (`KeyboardAvoidingView`) com `TextInput` + botão "Enviar".
- Submit: `addComment(postId, text)` → append do `Comment` retornado em `comments` → limpa input → chama `onCommentAdded(postId)`.
- Erro de fetch ou submit: mostra `Text` discreto acima do input com mensagem em PT, mantém texto digitado.

#### `CommunityScreen` — alteração mínima

```diff
+ const [activePostId, setActivePostId] = useState<string | null>(null);
+ const { ..., addComment, getComments } = useCommunity();

  <PostCard
    ...
-   onComment={() => {}}
+   onComment={() => setActivePostId(item.id)}
  />

+ <CommentsModal
+   visible={activePostId !== null}
+   postId={activePostId}
+   onClose={() => setActivePostId(null)}
+   onCommentAdded={(postId) =>
+     setPosts(prev => prev.map(p =>
+       p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p))
+   }
+ />
```

Como `setPosts` não é exportado por `useCommunity`, o incremento já ocorre dentro do próprio hook (linha 96–101 de `useCommunity.ts`). `onCommentAdded` apenas notifica o modal-pai sem duplicar; basta o estado interno do hook.

#### `CreatePostModal` — image picker

Estado adicionado:
```ts
const [imageUri, setImageUri] = useState<string | undefined>(undefined);
```

Fluxo do botão "📷":
```text
1. ImagePicker.requestMediaLibraryPermissionsAsync()
2. if status !== "granted" → Alert("Permissão necessária", "Habilite acesso à galeria para anexar uma foto. Você ainda pode publicar sem imagem.")
3. result = ImagePicker.launchImageLibraryAsync({
     mediaTypes: ImagePicker.MediaTypeOptions.Images,
     quality: 0.8,
     allowsEditing: false,
   })
4. if !result.canceled → setImageUri(result.assets[0].uri)
```

Preview: `<Image source={{uri: imageUri}} />` 80×80 com botão "X" (desabilitado quando `isSubmitting`). Submit chama `onSubmit(text.trim(), imageUri)`. `imageUri` resetado no `setText("")` pós-sucesso.

Botão de imagem e o "X" recebem `disabled={isSubmitting}`.

## Data Models

### DynamoDB

#### `sektor-posts`
| Attr           | Type | Role                            |
|----------------|------|---------------------------------|
| teamId         | S    | PK                              |
| createdAt      | S    | SK (ISO-8601, ScanIndexForward=false para feed) |
| id             | S    | UUID v4 (GSI PK)                |
| authorId       | S    |                                 |
| authorName     | S    |                                 |
| text           | S    |                                 |
| imageUrl       | S    | opcional                        |
| likes          | N    | denormalizado                   |
| commentCount   | N    | denormalizado                   |

GSI `id-index`: PK `id`, projection `INCLUDE` (`teamId`, `createdAt`, `likes`, `commentCount`). On-demand throughput.

#### `sektor-comments`
| Attr        | Type | Role                          |
|-------------|------|-------------------------------|
| postId      | S    | PK                            |
| createdAt   | S    | SK (ScanIndexForward=true)    |
| id          | S    |                               |
| authorId    | S    |                               |
| authorName  | S    |                               |
| text        | S    |                               |

#### `sektor-likes`
| Attr        | Type | Role                          |
|-------------|------|-------------------------------|
| postId      | S    | PK                            |
| userId      | S    | SK (ConditionExpression único) |
| createdAt   | S    | metadata                      |

Todas: `BillingMode=PAY_PER_REQUEST`, sem TTL.

### S3 — `sektor-media-bucket`

- Region: `us-east-1`
- Bloqueio de ACL público desabilitado para permitir GET via URL pública (`s3:GetObject` aberto via bucket policy ou `--no-public-access-block` ajustado conforme já-feito para uploads).
- CORS:
  ```json
  {
    "CORSRules": [{
      "AllowedMethods": ["PUT", "GET"],
      "AllowedOrigins": ["*"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }]
  }
  ```
- Layout de keys: `posts/{userSub}/{epochMs}-{sanitizedFilename}`.

## API Gateway REST

### Estrutura de recursos

```
/                             (root)
  /posts                      GET, POST                   → getPosts, createPost
    /{postId}
      /like                   POST, DELETE                → likePost, unlikePost
      /comments               GET, POST                   → getComments, createComment
  /upload-url                 GET                         → getUploadUrl
```

### Authorizer

- Tipo: `COGNITO_USER_POOLS`
- Provider: `arn:aws:cognito-idp:us-east-1:482712210181:userpool/us-east-1_cHokaMBWW`
- Identity source: `method.request.header.Authorization`
- Anexado a TODOS os métodos `GET/POST/DELETE` (não a `OPTIONS`).

### CORS

`OPTIONS` em cada recurso com `MOCK` integration e response:
```
Access-Control-Allow-Headers: Authorization,Content-Type
Access-Control-Allow-Methods: GET,POST,DELETE,OPTIONS
Access-Control-Allow-Origin: *
```

### Integrações

Todas `AWS_PROXY`. URI:
`arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:482712210181:function:{NAME}/invocations`.

Cada Lambda recebe `lambda:InvokeFunction` permission com `SourceArn=arn:aws:execute-api:us-east-1:482712210181:{restApiId}/*/*/*`.

## Error Handling

Padrão único de resposta de erro:
```json
{ "error": "<mensagem-curta>" }
```
Status codes:
- `400` validação de payload (text vazio, teamId ausente, imageUrl inválida, type inválido, filename ausente).
- `401` `event.requestContext.authorizer` ou `claims.sub` ausente.
- `404` post não encontrado em `findPostKey`.
- `500` erros não-categorizados; logar JSON `level=ERROR` e devolver `{"error":"internal"}`.

`ConditionalCheckFailedException` em like/unlike NÃO é erro — é fluxo de idempotência (200 com contador atual).

Logs JSON estruturados (mesmo padrão de `submitAnswer.js`): `{ level, message, ...context, durationMs? }`.

## Environment Variables

| Lambda          | Vars                                              |
|-----------------|---------------------------------------------------|
| getPosts        | `POSTS_TABLE`, `AWS_REGION`*                      |
| createPost      | `POSTS_TABLE`                                     |
| likePost        | `POSTS_TABLE`, `LIKES_TABLE`                      |
| unlikePost      | `POSTS_TABLE`, `LIKES_TABLE`                      |
| getComments     | `COMMENTS_TABLE`                                  |
| createComment   | `POSTS_TABLE`, `COMMENTS_TABLE`                   |
| getUploadUrl    | `MEDIA_BUCKET`                                    |

`*AWS_REGION` é injetado automaticamente pelo Lambda runtime; usado como fallback.

App (`.env.local`):
- `EXPO_PUBLIC_API_REST_URL=https://REPLACE_REST_API_ID.execute-api.us-east-1.amazonaws.com/prod` (substituído após criação da API).

## IAM Policies (inline, por Lambda)

Constantes: `ACCOUNT=482712210181`, `REGION=us-east-1`.

| Lambda          | Recursos / Ações                                                                                                                    |
|-----------------|-------------------------------------------------------------------------------------------------------------------------------------|
| getPosts        | `dynamodb:Query` em `arn:aws:dynamodb:{R}:{A}:table/sektor-posts`                                                                   |
| createPost      | `dynamodb:PutItem` em `…/sektor-posts`                                                                                              |
| likePost        | `dynamodb:Query` em `…/sektor-posts/index/id-index`; `dynamodb:GetItem`, `dynamodb:UpdateItem` em `…/sektor-posts`; `dynamodb:PutItem` em `…/sektor-likes` |
| unlikePost      | mesmos de likePost trocando `PutItem` por `DeleteItem` em `…/sektor-likes`                                                          |
| getComments     | `dynamodb:Query` em `…/sektor-comments`                                                                                             |
| createComment   | `dynamodb:Query` em `…/sektor-posts/index/id-index`; `dynamodb:UpdateItem` em `…/sektor-posts`; `dynamodb:PutItem` em `…/sektor-comments` |
| getUploadUrl    | `s3:PutObject` em `arn:aws:s3:::sektor-media-bucket/posts/*`                                                                        |

Todas adicionalmente recebem `AWSLambdaBasicExecutionRole` (managed) para CloudWatch Logs.

## Agent-Executed Provisioning Playbook

O **Agent** é o único executor dos comandos AWS CLI deste spec. Toda a sequência abaixo deve ser corrida pelo Agent no ambiente do usuário (Windows CMD), com pré-flights de idempotência e salvaguardas obrigatórias. Comandos AWS CLI usam quebra de linha com `^` (Windows CMD).

### Safeguards (mirror Requirement 14)

1. **Pré-flight de idempotência**: antes de cada `create-*`, executar o `describe-*` / `get-*` correspondente. Se o recurso já existe, **pular** a criação, logar `skip: already exists` no chat e seguir. Sem rollback, sem update silencioso.
2. **Deny-list dos `Recursos_Protegidos`**: o Agent NUNCA emite comando AWS CLI cujo `--name`, `--function-name`, `--role-name`, `--table-name`, `--stream-name`, `--rest-api-id` ou `--bucket` referencie qualquer um destes identificadores:
   - API Gateway WebSocket: `sektor-ws-api`, id `3bodgtvae0`
   - Lambdas: `wsConnect`, `wsDisconnect`, `processEvent`, `resolveAnswer`
   - DynamoDB: `sektor-connections`
   - Kinesis: `sektor-match-events`
   - IAM roles: `processEvent-role-j2rjl0q0`, `wsConnect-role-s6ct3dqv`, `wsDisconnect-role-96gqgrvj`, `resolveAnswer-role-cwoh034c`
   
   Se um candidato for detectado, abortar o passo, reportar ao usuário e aguardar instrução (Req 14.3).
3. **Sem comandos destrutivos**: proibido `delete-*`, `remove-*`, `aws s3 rb`, `--force`, `cloudformation destroy`, exclusões recursivas amplas. **Única exceção**: `aws s3 rm s3://sektor-media-bucket/posts/...` para limpeza pontual de objetos de teste sob o prefixo `posts/` — nunca `aws s3 rb` no bucket (Req 14.2).
4. **Halt on non-zero exit**: se qualquer comando AWS CLI retornar exit code ≠ 0, parar a sequência, expor o stderr completo no chat e aguardar instrução do usuário. Sem rollback automático (Reqs 14.4, 14.7).
5. **Confirmação explícita do usuário**: pausar e pedir confirmação no chat (a) antes do primeiro lote de comandos de provisionamento da sessão e (b) antes de re-executar a sequência se o pré-flight 14.1 detectar recursos órfãos de um run anterior parcial (Req 14.6).
6. **Audit log no chat**: para cada comando executado, registrar o comando emitido (com argumentos sensíveis truncados quando aplicável) e um resumo do resultado — recurso criado, identificador retornado ou mensagem `skip: already exists` (Req 14.5).

### Execution Sequence

#### 1. Pre-flight environment check

Confirmar que a AWS CLI está apontando para a conta correta e a região correta antes de qualquer outra coisa.

```
aws sts get-caller-identity --query Account --output text
```

Asserção: o output deve ser exatamente `482712210181`. Se diferente, abortar com mensagem clara ao usuário ("conta AWS errada — abortando, configure o profile correto antes de seguir") e NÃO executar nenhum dos passos seguintes.

```
aws configure get region
```

Asserção: output `us-east-1`. Se diferente, abortar.

#### 2. DynamoDB tables

Para cada tabela em `sektor-posts`, `sektor-comments`, `sektor-likes`:

**Pré-flight (idempotência):**
```
aws dynamodb describe-table --table-name sektor-posts
```
Se exit code = 0: log `skip: already exists` e seguir para a próxima tabela.
Se exit code ≠ 0 e stderr contém `ResourceNotFoundException`: prosseguir com create.

**Create — `sektor-posts`:**
```
aws dynamodb create-table ^
  --table-name sektor-posts ^
  --attribute-definitions AttributeName=teamId,AttributeType=S AttributeName=createdAt,AttributeType=S ^
  --key-schema AttributeName=teamId,KeyType=HASH AttributeName=createdAt,KeyType=RANGE ^
  --billing-mode PAY_PER_REQUEST ^
  --region us-east-1
```

**Create — `sektor-comments`:**
```
aws dynamodb create-table ^
  --table-name sektor-comments ^
  --attribute-definitions AttributeName=postId,AttributeType=S AttributeName=createdAt,AttributeType=S ^
  --key-schema AttributeName=postId,KeyType=HASH AttributeName=createdAt,KeyType=RANGE ^
  --billing-mode PAY_PER_REQUEST ^
  --region us-east-1
```

**Create — `sektor-likes`:**
```
aws dynamodb create-table ^
  --table-name sektor-likes ^
  --attribute-definitions AttributeName=postId,AttributeType=S AttributeName=userId,AttributeType=S ^
  --key-schema AttributeName=postId,KeyType=HASH AttributeName=userId,KeyType=RANGE ^
  --billing-mode PAY_PER_REQUEST ^
  --region us-east-1
```

**Pós-step (verificação):**
```
aws dynamodb wait table-exists --table-name sektor-posts
aws dynamodb wait table-exists --table-name sektor-comments
aws dynamodb wait table-exists --table-name sektor-likes
```

**GSI `id-index` em `sektor-posts`:**

Pré-flight: parsear `aws dynamodb describe-table --table-name sektor-posts` e procurar `GlobalSecondaryIndexes[?IndexName=='id-index']`. Se presente: log `skip: GSI id-index already exists` e seguir. Caso contrário:

```
aws dynamodb update-table ^
  --table-name sektor-posts ^
  --attribute-definitions AttributeName=id,AttributeType=S ^
  --global-secondary-index-updates "[{\"Create\":{\"IndexName\":\"id-index\",\"KeySchema\":[{\"AttributeName\":\"id\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"INCLUDE\",\"NonKeyAttributes\":[\"teamId\",\"createdAt\",\"likes\",\"commentCount\"]}}}]" ^
  --region us-east-1
```

Aguardar GSI ficar ativo antes de criar Lambdas que dependem dele:
```
aws dynamodb wait table-exists --table-name sektor-posts
```
(e poll subsequente em `describe-table` até `IndexStatus=ACTIVE`).

#### 3. S3 bucket

**Pré-flight:**
```
aws s3api head-bucket --bucket sektor-media-bucket
```
Exit code 0: bucket já existe → log `skip: already exists` e pular para `put-public-access-block` + CORS (que devem ser aplicados de qualquer forma para garantir configuração esperada).

**Create:**
```
aws s3 mb s3://sektor-media-bucket --region us-east-1
```

**Public access block (libera GET público para mídia, mantém ACLs travadas):**
```
aws s3api put-public-access-block ^
  --bucket sektor-media-bucket ^
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
```

**CORS:**
```
aws s3api put-bucket-cors ^
  --bucket sektor-media-bucket ^
  --cors-configuration file://infra/community-s3-cors.json
```

**Verificação:**
```
aws s3api get-bucket-cors --bucket sektor-media-bucket
```

#### 4. IAM roles + inline policies

Para cada `{fn}` em `getPosts`, `createPost`, `likePost`, `unlikePost`, `getComments`, `createComment`, `getUploadUrl`:

**Pré-flight:**
```
aws iam get-role --role-name {fn}-role
```
Exit 0: log `skip: role already exists`, pular `create-role` mas seguir aplicando `attach-role-policy` e `put-role-policy` (idempotentes).

**Create role:**
```
aws iam create-role ^
  --role-name {fn}-role ^
  --assume-role-policy-document file://infra/lambda-trust-policy.json
```

**Anexar managed policy:**
```
aws iam attach-role-policy ^
  --role-name {fn}-role ^
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

**Inline policy:**
```
aws iam put-role-policy ^
  --role-name {fn}-role ^
  --policy-name {fn}-inline ^
  --policy-document file://infra/community-{fn}-policy.json
```

**Pós-step:** após a criação da primeira role nova da sessão, aguardar ~10 segundos para consistência eventual do IAM antes de criar Lambdas que assumam essas roles. Verificação:
```
aws iam get-role --role-name {fn}-role --query Role.Arn --output text
```
para capturar o ARN da role e injetá-lo no `create-function` correspondente.

#### 5. Lambda zips (build local)

Para cada `{fn}` (mesmo loop), o Agent executa o build com `cwd=lambdas/{fn}`:

**Pré-flight:** verificar que `lambdas/{fn}/index.js` e `lambdas/{fn}/package.json` existem. Se ausentes, abortar o passo e pedir que o usuário rode antes as tasks de implementação.

**Build:**
```
npm ci --omit=dev
```
(executado em `cwd=lambdas/{fn}`, não em uma única linha com `cd`).

**Zip (PowerShell via cmd):**
```
powershell -Command "Compress-Archive -Path *.js,node_modules,package.json -DestinationPath function.zip -Force"
```
(executado também em `cwd=lambdas/{fn}`).

**Verificação:** confirmar que `lambdas/{fn}/function.zip` foi gerado.

#### 6. Lambda functions

Para cada `{fn}`:

**Pré-flight:**
```
aws lambda get-function --function-name {fn}
```
Exit 0: a função já existe. **Abortar com mensagem explícita** ao usuário ("Lambda `{fn}` já existe — não vou atualizar silenciosamente. Diga se quer que eu rode `update-function-code`/`update-function-configuration` ou se prefere deletar manualmente antes."). NÃO executar `update-function-code` automaticamente (Req 14.2 / safeguard contra alteração silenciosa).

**Create:**
```
aws lambda create-function ^
  --function-name {fn} ^
  --runtime nodejs18.x ^
  --handler index.handler ^
  --role arn:aws:iam::482712210181:role/{fn}-role ^
  --zip-file fileb://function.zip ^
  --environment "Variables={POSTS_TABLE=sektor-posts,COMMENTS_TABLE=sektor-comments,LIKES_TABLE=sektor-likes,MEDIA_BUCKET=sektor-media-bucket}" ^
  --region us-east-1
```
(O conjunto exato de env vars varia por Lambda — ver tabela "Environment Variables".)

**Pós-step:**
```
aws lambda get-function --function-name {fn} --query Configuration.State --output text
```
Esperar `Active`.

#### 7. REST API (`sektor-rest-api`)

**Pré-flight:**
```
aws apigateway get-rest-apis --query "items[?name=='sektor-rest-api'].id" --output text
```
Se output não-vazio: **abortar com mensagem explícita** ao usuário ("REST API `sektor-rest-api` já existe com id `{x}`. Não vou recriar. Diga como proceder — reusar id existente ou deletar manualmente antes."). NÃO recriar.

**Create:**
```
aws apigateway create-rest-api ^
  --name sektor-rest-api ^
  --endpoint-configuration types=REGIONAL ^
  --region us-east-1
```
Capturar `restApiId` do output.

**Root resource id:**
```
aws apigateway get-resources --rest-api-id {restApiId} --query "items[?path=='/'].id" --output text
```

**Criar resources** (capturar ids retornados em variáveis locais do Agent):
```
aws apigateway create-resource --rest-api-id {restApiId} --parent-id {rootId} --path-part posts
aws apigateway create-resource --rest-api-id {restApiId} --parent-id {postsId} --path-part {postId}
aws apigateway create-resource --rest-api-id {restApiId} --parent-id {postIdId} --path-part like
aws apigateway create-resource --rest-api-id {restApiId} --parent-id {postIdId} --path-part comments
aws apigateway create-resource --rest-api-id {restApiId} --parent-id {rootId} --path-part upload-url
```

**Authorizer Cognito:**
```
aws apigateway create-authorizer ^
  --rest-api-id {restApiId} ^
  --name cognito ^
  --type COGNITO_USER_POOLS ^
  --provider-arns arn:aws:cognito-idp:us-east-1:482712210181:userpool/us-east-1_cHokaMBWW ^
  --identity-source method.request.header.Authorization
```
Capturar `authorizerId`.

**Para cada um dos 7 endpoints**, executar (exemplo `GET /posts` → `getPosts`):
```
aws apigateway put-method ^
  --rest-api-id {restApiId} --resource-id {postsId} ^
  --http-method GET ^
  --authorization-type COGNITO_USER_POOLS --authorizer-id {authorizerId}

aws apigateway put-integration ^
  --rest-api-id {restApiId} --resource-id {postsId} ^
  --http-method GET ^
  --type AWS_PROXY ^
  --integration-http-method POST ^
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:482712210181:function:getPosts/invocations

aws apigateway put-method-response ^
  --rest-api-id {restApiId} --resource-id {postsId} ^
  --http-method GET --status-code 200 ^
  --response-models "application/json=Empty"
```

Repetir esse trio para todos os 7 endpoints (`POST /posts` → `createPost`, `POST /posts/{postId}/like` → `likePost`, `DELETE /posts/{postId}/like` → `unlikePost`, `GET /posts/{postId}/comments` → `getComments`, `POST /posts/{postId}/comments` → `createComment`, `GET /upload-url` → `getUploadUrl`).

**OPTIONS MOCK + CORS** em cada um dos 5 resources (`/posts`, `/posts/{postId}`, `/posts/{postId}/like`, `/posts/{postId}/comments`, `/upload-url`):
```
aws apigateway put-method ^
  --rest-api-id {restApiId} --resource-id {resId} ^
  --http-method OPTIONS --authorization-type NONE

aws apigateway put-integration ^
  --rest-api-id {restApiId} --resource-id {resId} ^
  --http-method OPTIONS --type MOCK ^
  --request-templates "application/json={\"statusCode\":200}"

aws apigateway put-method-response ^
  --rest-api-id {restApiId} --resource-id {resId} ^
  --http-method OPTIONS --status-code 200 ^
  --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true"

aws apigateway put-integration-response ^
  --rest-api-id {restApiId} --resource-id {resId} ^
  --http-method OPTIONS --status-code 200 ^
  --response-parameters "method.response.header.Access-Control-Allow-Headers='Authorization,Content-Type',method.response.header.Access-Control-Allow-Methods='GET,POST,DELETE,OPTIONS',method.response.header.Access-Control-Allow-Origin='*'"
```

**Permission para cada Lambda ser invocada pela API REST** (loop 7 nomes):
```
aws lambda add-permission ^
  --function-name {fn} ^
  --statement-id apigw-{fn} ^
  --action lambda:InvokeFunction ^
  --principal apigateway.amazonaws.com ^
  --source-arn arn:aws:execute-api:us-east-1:482712210181:{restApiId}/*/*/*
```

**Deploy:**
```
aws apigateway create-deployment ^
  --rest-api-id {restApiId} ^
  --stage-name prod
```

**Pós-step:**
```
aws apigateway get-stage --rest-api-id {restApiId} --stage-name prod --query stageName --output text
```
Esperar `prod`.

#### 8. `.env.local` update

Ler `.env.local` existente, atualizar/adicionar a chave `EXPO_PUBLIC_API_REST_URL` preservando integralmente as outras chaves (`EXPO_PUBLIC_API_WS_URL`, `EXPO_PUBLIC_COGNITO_USER_POOL_ID`, `EXPO_PUBLIC_COGNITO_CLIENT_ID`).

```
EXPO_PUBLIC_API_REST_URL=https://{restApiId}.execute-api.us-east-1.amazonaws.com/prod
```

Se a chave já existir com valor diferente: substituir pelo novo valor e logar a substituição. Se já existir com o mesmo valor: log `skip: .env.local already up to date`.

#### 9. Smoke verification

**(a) Anonymous request expecting 401** — uma chamada sem header `Authorization` em qualquer um dos endpoints autenticados:
```
curl -i https://{restApiId}.execute-api.us-east-1.amazonaws.com/prod/posts?teamId=test
```
Asserção: status `401`. Se diferente, halt e reportar ao usuário.

**(b) Authenticated requests expecting 200/201** — para cada um dos 7 endpoints, executar curl com `Authorization: Bearer {idToken}`. O token vem de:
```
aws cognito-idp admin-initiate-auth ^
  --user-pool-id us-east-1_cHokaMBWW ^
  --client-id {clientId} ^
  --auth-flow ADMIN_NO_SRP_AUTH ^
  --auth-parameters USERNAME={testUser},PASSWORD={testPass}
```
ou um token fornecido explicitamente pelo usuário (Req 13.1). Asserção: cada endpoint retorna `200` ou `201`. Se algum falhar, halt e reportar.

**(c) Type-check do app:**
```
npx tsc --noEmit
```
(executado em `cwd=app/`). Asserção: `0 errors`. Se falhar, halt e reportar (Reqs 12.2, 13.2).

### Identifier Allow-list

O Agent SOMENTE pode emitir comandos de criação/configuração contra os identificadores abaixo. Qualquer comando candidato com identificador fora desta lista DEVE ser abortado imediatamente, com erro reportado ao usuário (mirror Req 14.3):

- **DynamoDB tables**: `sektor-posts`, `sektor-comments`, `sektor-likes`
- **DynamoDB GSI**: `id-index` (em `sektor-posts`)
- **S3 bucket**: `sektor-media-bucket` (criar/configurar bucket; `aws s3 rm` permitido apenas sob prefixo `posts/` para limpeza pontual de testes)
- **IAM roles**: `getPosts-role`, `createPost-role`, `likePost-role`, `unlikePost-role`, `getComments-role`, `createComment-role`, `getUploadUrl-role`
- **IAM inline policies**: `getPosts-inline`, `createPost-inline`, `likePost-inline`, `unlikePost-inline`, `getComments-inline`, `createComment-inline`, `getUploadUrl-inline`
- **Lambdas**: `getPosts`, `createPost`, `likePost`, `unlikePost`, `getComments`, `createComment`, `getUploadUrl`
- **API Gateway REST API**: `sektor-rest-api` (e seus resources/methods/authorizer/deployment associados, todos sob o `restApiId` retornado por `create-rest-api`)
- **API Gateway authorizer**: `cognito` (filho de `sektor-rest-api`)

Qualquer referência aos `Recursos_Protegidos` (`sektor-ws-api` / `3bodgtvae0`, `wsConnect`, `wsDisconnect`, `processEvent`, `resolveAnswer`, `sektor-connections`, `sektor-match-events`, `processEvent-role-j2rjl0q0`, `wsConnect-role-s6ct3dqv`, `wsDisconnect-role-96gqgrvj`, `resolveAnswer-role-cwoh034c`) está fora desta allow-list e DEVE causar abort imediato (Req 14.3).

## Frontend Upload Flow

```
CreatePostModal.handleSubmit
 ├─ if imageUri:
 │    api.getUploadUrl(filename, "image/jpeg")
 │      ▶ GET /upload-url?filename=…&type=image/jpeg (Bearer)
 │      ◀ { uploadUrl, fileUrl }
 │    fetch(uploadUrl, { method:"PUT", body:blob, headers:{Content-Type:"image/jpeg"} })
 │    imageUrl = fileUrl
 ├─ api.createPost(text, imageUrl)
 │      ▶ POST /posts {text, imageUrl?}
 │      ◀ { post }
 └─ setPosts(prev => [post, ...prev])
```

Esse fluxo já está implementado em `useCommunity.createPost`; design preserva contrato.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Pagination preserva ordem decrescente completa

For any conjunto de posts em `sektor-posts` para um dado `teamId`, percorrer o feed via páginas sucessivas de `/posts?lastKey=...` (cursor base64 round-trip) deve produzir a sequência completa dos posts ordenados por `createdAt` descendente, sem repetições nem omissões, e `lastKey` deve estar presente se e somente se há mais resultados.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: createPost round-trip

For any payload válido `(text, imageUrl?)` e claims válidas, o `Post` retornado em `201` é exatamente o item gravado em `sektor-posts`, com `id` UUID, `authorId=claims.sub`, `authorName=claims.name||claims.email`, `teamId=claims["custom:teamId"]`, `likes=0`, `commentCount=0`, `createdAt` ISO-8601 e `imageUrl` presente se e somente se enviado no body.

**Validates: Requirements 2.1, 2.2**

### Property 3: text whitespace-only é rejeitado

For any string composta exclusivamente por caracteres de whitespace (` `, `\t`, `\n`, `\r`, `\f`, `\v`), enviá-la como `text` para `POST /posts` ou `POST /posts/{postId}/comments` resulta em `400 { "error": "text required" }` sem efeito colateral em DynamoDB.

**Validates: Requirements 2.3, 4.4**

### Property 4: imageUrl prefix validation

For any string `imageUrl` enviada no body de `POST /posts`, a request é aceita se e somente se a string começa com `https://sektor-media-bucket.s3.`; caso contrário retorna `400 { "error": "invalid imageUrl" }`.

**Validates: Requirements 2.5**

### Property 5: like/unlike round-trip preserva contador

For any post existente e qualquer `userId`, executar `POST /posts/{postId}/like` seguido de `DELETE /posts/{postId}/like` retorna `likes` ao valor original, e o contador final reportado no `200` da segunda chamada é igual ao valor antes da primeira.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 6: like/unlike são idempotentes em condition fail

For any sequência de chamadas repetidas `POST /posts/{postId}/like` pelo mesmo `userId`, somente a primeira altera `sektor-posts.likes`; chamadas subsequentes retornam `200 { likes }` com o valor atual lido por `GetItem`. Análogo para `DELETE` quando não há like prévio.

**Validates: Requirements 3.4**

### Property 7: createComment grava comentário e incrementa commentCount

For any post existente e qualquer `text` válido, `POST /posts/{postId}/comments` resulta em (a) um item gravado em `sektor-comments` com shape `Comment` exato e (b) `sektor-posts.commentCount` incrementado em 1, ambos atomicamente do ponto de vista do cliente (resposta `201` somente após ambos sucessos).

**Validates: Requirements 4.2, 4.3**

### Property 8: getComments retorna ordem ascendente

For any conjunto de comentários de um `postId`, `GET /posts/{postId}/comments` retorna a sequência completa ordenada por `createdAt` ascendente.

**Validates: Requirements 4.1**

### Property 9: upload-url consistency

For any par `(filename, type)` válido, a `uploadUrl` assinada e a `fileUrl` retornadas referenciam a mesma `key` no bucket `sektor-media-bucket`, com `key` no padrão `posts/{claims.sub}/{ts}-{sanitize(filename)}` e `ContentType` da assinatura igual ao `type` recebido.

**Validates: Requirements 5.1**

### Property 10: type allow-list

For any `type` recebido em `GET /upload-url`, a request é aceita se e somente se `type ∈ {"image/jpeg","image/png","image/webp"}`; caso contrário retorna `400 { "error": "unsupported type" }`.

**Validates: Requirements 5.2**

### Property 11: sanitize idempotência, character set e tamanho

For any string `s`, `sanitize(s)` (a) só contém caracteres em `[A-Za-z0-9._-]`, (b) tem comprimento `≤ 64`, e (c) é idempotente: `sanitize(sanitize(s)) === sanitize(s)`.

**Validates: Requirements 5.4**

### Property 12: claims.sub ausente → 401 universalmente

For any evento recebido por qualquer das 7 Lambdas onde `event.requestContext.authorizer?.claims?.sub` é ausente ou vazio, a Lambda responde `401 { "error": "unauthenticated" }` sem executar lógica de negócio nem tocar DynamoDB/S3.

**Validates: Requirements 9.3**

## Testing Strategy

**Property tests** (Jest + `fast-check`, ≥100 iterações cada, tag `Feature: comunidade-feed, Property N: ...`):
- P1–P12 acima, executadas como unit tests em cada Lambda com `aws-sdk-client-mock` para DynamoDB/S3.
- `sanitize` (P11) testada como função pura sem mocks.

**Example tests** (Jest + React Native Testing Library):
- `CommentsModal`: abrir → lista carregada → submit → comment aparece → erro mostrado.
- `CreatePostModal` com image picker: tap em "📷" → permissão concedida → preview aparece; permissão negada → Alert; submit chama `onSubmit(text, imageUri)`.

**Integration / smoke tests** (manuais, em `infra/README.md`):
- 1 chamada sem token → `401` (cobre R9.1, R9.3 ponta-a-ponta).
- 1 chamada com token válido → `200` para cada um dos 7 endpoints.
- Checklist E2E pelo app: login Cognito → publicar (texto e texto+imagem) → curtir/descurtir → comentar.
- `npx tsc --noEmit` deve passar sem erros (R8.x, R13.3).
