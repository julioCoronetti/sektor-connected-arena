# Requirements Document

## Introduction

Implementação fim-a-fim do Feed da Comunidade do Sektor Connected Arena. Entrega o backend REST (7 Lambdas + DynamoDB + S3 + API Gateway com Cognito Authorizer) e o frontend faltante (UI de comentários conectada em `community.tsx`, image picker funcional no `CreatePostModal`). Mantém intactas as assinaturas de `src/services/api.ts`, os tipos `Post` e `Comment` em `src/types/index.ts` e o padrão de Lambdas individuais com role própria já adotado em `processEvent` e `resolveAnswer`. O agente executa diretamente os comandos AWS CLI necessários para provisionar a infraestrutura (DynamoDB, S3, IAM, Lambdas, API Gateway) e atualiza o `.env.local` com a URL real da API REST, observando salvaguardas estritas para não tocar em recursos pré-existentes documentados em `aws-resources.md`.

## Glossary

- **Sektor_App**: aplicativo Expo/React Native em `app/src`.
- **Agent**: o agente Kiro executando o plano deste spec, autorizado a invocar a AWS CLI no ambiente do usuário.
- **API_REST**: API Gateway REST `sektor-rest-api`, stage `prod`, na conta `482712210181`, região `us-east-1`.
- **Cognito_Authorizer**: COGNITO_USER_POOLS authorizer da `API_REST`, ligado ao User Pool `us-east-1_cHokaMBWW`, identity source `method.request.header.Authorization`.
- **Claims**: objeto `event.requestContext.authorizer.claims` recebido pelas Lambdas, contendo `sub`, `email`, `name`, `custom:teamId`.
- **Tabela_Posts**: DynamoDB `sektor-posts` (PK `teamId` String, SK `createdAt` String).
- **Tabela_Comments**: DynamoDB `sektor-comments` (PK `postId` String, SK `createdAt` String).
- **Tabela_Likes**: DynamoDB `sektor-likes` (PK `postId` String, SK `userId` String).
- **Bucket_Media**: S3 `sektor-media-bucket` em `us-east-1`, com CORS PUT/GET liberado.
- **Lambda_GetPosts**: Node.js 18 CommonJS, AWS SDK v3, integrada a `GET /posts`.
- **Lambda_CreatePost**: integrada a `POST /posts`.
- **Lambda_LikePost**: integrada a `POST /posts/{postId}/like`.
- **Lambda_UnlikePost**: integrada a `DELETE /posts/{postId}/like`.
- **Lambda_GetComments**: integrada a `GET /posts/{postId}/comments`.
- **Lambda_CreateComment**: integrada a `POST /posts/{postId}/comments`.
- **Lambda_GetUploadUrl**: integrada a `GET /upload-url`.
- **Comunidade_Lambdas**: conjunto das sete Lambdas acima.
- **Recursos_Protegidos**: conjunto de recursos AWS pré-existentes que não pertencem a esta feature e não devem ser modificados nem deletados — API Gateway WebSocket `sektor-ws-api` (id `3bodgtvae0`), Lambdas `wsConnect`, `wsDisconnect`, `processEvent`, `resolveAnswer`, DynamoDB `sektor-connections`, Kinesis `sektor-match-events`, IAM roles `processEvent-role-j2rjl0q0`, `wsConnect-role-s6ct3dqv`, `wsDisconnect-role-96gqgrvj`, `resolveAnswer-role-cwoh034c`.
- **CreatePostModal**: componente `src/components/community/CreatePostModal.tsx`.
- **CommentsModal**: novo componente que lista e cria comentários de um post.
- **CommunityScreen**: tela `src/app/(tabs)/community.tsx`.
- **Post**: tipo definido em `src/types/index.ts` com campos `id`, `authorId`, `authorName`, `teamId`, `text`, `imageUrl?`, `likes`, `commentCount`, `createdAt`.
- **Comment**: tipo definido em `src/types/index.ts` com campos `id`, `postId`, `authorId`, `authorName`, `text`, `createdAt`.

## Requirements

### Requirement 1: Listagem paginada do feed

**User Story:** Como torcedor autenticado, quero ver os posts do meu time em ordem cronológica reversa, para acompanhar a comunidade.

#### Acceptance Criteria

1. WHEN o `Sektor_App` invoca `GET /posts?teamId={teamId}` com token válido, THE `Lambda_GetPosts` SHALL consultar `Tabela_Posts` com `KeyConditionExpression="teamId = :t"`, `ScanIndexForward=false` e `Limit=20`, e retornar `200` com `{ "posts": Post[], "lastKey"?: string }`.
2. WHERE a query string contém `lastKey`, THE `Lambda_GetPosts` SHALL decodificar o cursor com `JSON.parse(Buffer.from(lastKey, "base64").toString("utf8"))` e usá-lo como `ExclusiveStartKey` na consulta.
3. WHEN o resultado do DynamoDB possui `LastEvaluatedKey`, THE `Lambda_GetPosts` SHALL incluir `lastKey` no response como `Buffer.from(JSON.stringify(LastEvaluatedKey)).toString("base64")`; caso contrário, o campo `lastKey` SHALL ser omitido.
4. THE `Lambda_GetPosts` SHALL devolver cada item no shape exato do tipo `Post`, com `commentCount` e `likes` numéricos (default `0` quando ausentes no item).
5. IF `teamId` está ausente ou vazio na query string, THEN THE `Lambda_GetPosts` SHALL retornar `400` com `{ "error": "teamId required" }`.

### Requirement 2: Criação de post com imagem opcional

**User Story:** Como torcedor autenticado, quero publicar um post de texto com imagem opcional, para compartilhar com meu time.

#### Acceptance Criteria

1. WHEN o `Sektor_App` invoca `POST /posts` com body `{ "text": string, "imageUrl"?: string }` e token válido, THE `Lambda_CreatePost` SHALL ler `sub`, `name` e `custom:teamId` de `Claims`, gerar `id = randomUUID()` e `createdAt = new Date().toISOString()`, e gravar em `Tabela_Posts` o item `{ teamId, createdAt, id, authorId: sub, authorName: name || email, text, imageUrl?, likes: 0, commentCount: 0 }`.
2. THE `Lambda_CreatePost` SHALL retornar `201` com `{ "post": Post }` no shape exato do tipo `Post`, incluindo `imageUrl` apenas quando recebido no body.
3. IF `text` está ausente, não-string ou com `text.trim().length === 0`, THEN THE `Lambda_CreatePost` SHALL retornar `400` com `{ "error": "text required" }`.
4. IF `Claims["custom:teamId"]` está ausente, THEN THE `Lambda_CreatePost` SHALL retornar `400` com `{ "error": "teamId claim missing" }`.
5. WHEN `imageUrl` está presente, THE `Lambda_CreatePost` SHALL aceitar somente strings que iniciem com `https://sektor-media-bucket.s3.` e rejeitar com `400 { "error": "invalid imageUrl" }` caso contrário.

### Requirement 3: Curtir e descurtir post

**User Story:** Como torcedor autenticado, quero curtir e descurtir um post, para reagir ao conteúdo.

#### Acceptance Criteria

1. WHEN o `Sektor_App` invoca `POST /posts/{postId}/like` com token válido, THE `Lambda_LikePost` SHALL inserir `{ postId, userId: sub }` em `Tabela_Likes` com `ConditionExpression="attribute_not_exists(userId)"` e, em sucesso, atualizar `Tabela_Posts` com `UpdateExpression="ADD likes :one"` (`:one = 1`) usando como chave o item identificado por `postId`.
2. WHEN o `Sektor_App` invoca `DELETE /posts/{postId}/like` com token válido, THE `Lambda_UnlikePost` SHALL remover `{ postId, userId: sub }` de `Tabela_Likes` com `ConditionExpression="attribute_exists(userId)"` e decrementar `likes` em `Tabela_Posts` via `UpdateExpression="ADD likes :neg"` (`:neg = -1`).
3. THE `Lambda_LikePost` e THE `Lambda_UnlikePost` SHALL retornar `200` com `{ "likes": number }` refletindo o `Attributes.likes` retornado por `UpdateItem` (`ReturnValues="UPDATED_NEW"`).
4. IF a `ConditionExpression` falha (curtida duplicada ou descurtida sem curtida prévia), THEN a Lambda envolvida SHALL retornar `200` com `{ "likes": number }` lendo o valor atual de `Tabela_Posts` via `GetItem`, sem alterar contadores.
5. IF a Lambda envolvida não localiza o post correspondente em `Tabela_Posts` para descobrir a chave (`teamId`, `createdAt`), THEN ela SHALL retornar `404` com `{ "error": "post not found" }`; para isso a tabela SHALL receber GSI `id-index` (PK `id`) ou a Lambda SHALL receber `teamId`/`createdAt` por outra via documentada na fase de design.

### Requirement 4: Listagem e criação de comentários

**User Story:** Como torcedor autenticado, quero ler e adicionar comentários em um post, para participar da conversa.

#### Acceptance Criteria

1. WHEN o `Sektor_App` invoca `GET /posts/{postId}/comments` com token válido, THE `Lambda_GetComments` SHALL consultar `Tabela_Comments` com `KeyConditionExpression="postId = :p"`, `ScanIndexForward=true` e retornar `200` com `{ "comments": Comment[] }` no shape exato do tipo `Comment`.
2. WHEN o `Sektor_App` invoca `POST /posts/{postId}/comments` com body `{ "text": string }` e token válido, THE `Lambda_CreateComment` SHALL gerar `id = randomUUID()` e `createdAt = new Date().toISOString()`, gravar `{ postId, createdAt, id, authorId: sub, authorName: name || email, text }` em `Tabela_Comments`, e incrementar `commentCount` em `Tabela_Posts` via `UpdateExpression="ADD commentCount :one"`.
3. THE `Lambda_CreateComment` SHALL retornar `201` com `{ "comment": Comment }` no shape exato do tipo `Comment`.
4. IF `text` está ausente, não-string ou com `text.trim().length === 0`, THEN THE `Lambda_CreateComment` SHALL retornar `400` com `{ "error": "text required" }`.
5. IF o post referenciado não existe em `Tabela_Posts`, THEN THE `Lambda_CreateComment` SHALL retornar `404` com `{ "error": "post not found" }` e não gravar o comentário.

### Requirement 5: URL pré-assinada para upload de mídia

**User Story:** Como torcedor autenticado, quero fazer upload direto de uma imagem para o S3, para anexá-la a um post sem proxy de mídia.

#### Acceptance Criteria

1. WHEN o `Sektor_App` invoca `GET /upload-url?filename={name}&type={mime}` com token válido, THE `Lambda_GetUploadUrl` SHALL gerar `key = "posts/${sub}/${Date.now()}-${sanitize(filename)}"` e retornar `200` com `{ "uploadUrl": string, "fileUrl": string }`, onde `uploadUrl` é uma URL pré-assinada `PUT` para `Bucket_Media` com `ContentType=type` e expiração de `300` segundos, e `fileUrl` é `https://sektor-media-bucket.s3.us-east-1.amazonaws.com/${key}`.
2. THE `Lambda_GetUploadUrl` SHALL aceitar somente `type` ∈ {`image/jpeg`, `image/png`, `image/webp`}; caso contrário SHALL retornar `400` com `{ "error": "unsupported type" }`.
3. IF `filename` está ausente ou vazio, THEN THE `Lambda_GetUploadUrl` SHALL retornar `400` com `{ "error": "filename required" }`.
4. THE `sanitize(filename)` SHALL remover qualquer caractere fora de `[A-Za-z0-9._-]` e truncar o nome resultante em `64` caracteres.

### Requirement 6: UI de comentários conectada ao feed

**User Story:** Como torcedor autenticado, quero abrir os comentários de um post e adicionar um novo, sem sair da tela do feed.

#### Acceptance Criteria

1. WHEN o usuário toca no botão de comentários de um `PostCard`, THE `CommunityScreen` SHALL abrir o `CommentsModal` para aquele `postId`.
2. WHEN o `CommentsModal` é aberto, THE `CommentsModal` SHALL invocar `useCommunity().getComments(postId)` e renderizar a lista ordenada por `createdAt` ascendente, exibindo `authorName`, texto e tempo relativo.
3. WHEN o usuário envia um novo comentário com texto não vazio, THE `CommentsModal` SHALL invocar `useCommunity().addComment(postId, text)` e prepender (ou append, conforme ordem ascendente) o `Comment` retornado à lista local sem recarregar todos os comentários.
4. WHEN `addComment` resolve com sucesso, THE `CommunityScreen` SHALL exibir `commentCount` incrementado no `PostCard` correspondente.
5. IF `getComments` ou `addComment` rejeita, THEN THE `CommentsModal` SHALL exibir mensagem de erro discreta no próprio modal e manter o texto digitado pelo usuário.

### Requirement 7: Image picker funcional no CreatePostModal

**User Story:** Como torcedor autenticado, quero anexar uma foto da galeria a um novo post, para enriquecer a publicação.

#### Acceptance Criteria

1. WHEN o usuário toca no botão de imagem do `CreatePostModal`, THE `CreatePostModal` SHALL solicitar permissão via `expo-image-picker` (`requestMediaLibraryPermissionsAsync`) e, se concedida, abrir `launchImageLibraryAsync` com `mediaTypes: Images`, `quality: 0.8`, `allowsEditing: false`.
2. WHEN o usuário seleciona uma imagem, THE `CreatePostModal` SHALL armazenar `imageUri` em estado e exibir um preview visual com opção de remover.
3. WHEN o usuário toca em "Publicar", THE `CreatePostModal` SHALL chamar `onSubmit(text, imageUri)` passando o `imageUri` selecionado (ou `undefined`).
4. IF a permissão de galeria é negada, THEN THE `CreatePostModal` SHALL exibir um `Alert` com mensagem em português explicando que a permissão é necessária e SHALL manter o post sem imagem como ação possível.
5. WHILE `isSubmitting` é `true`, THE `CreatePostModal` SHALL desabilitar o botão de imagem e o botão de remover preview.

### Requirement 8: Compatibilidade de cliente e tipos preservada

**User Story:** Como mantenedor do app, quero que o backend respeite as assinaturas existentes, para não quebrar telas e hooks já em produção.

#### Acceptance Criteria

1. THE `Sektor_App` SHALL continuar usando `src/services/api.ts` com paths, query params e shapes idênticos aos atuais (`getPosts`, `createPost`, `likePost`, `unlikePost`, `getComments`, `createComment`, `getUploadUrl`).
2. THE `Comunidade_Lambdas` SHALL responder em conformidade com as interfaces de retorno declaradas em `api.ts`: `{ posts, lastKey? }`, `{ post }`, `{ likes }`, `{ comments }`, `{ comment }`, `{ uploadUrl, fileUrl }`.
3. THE `Comunidade_Lambdas` SHALL emitir os campos `Post` e `Comment` exatamente como definidos em `src/types/index.ts`, sem adicionar nem renomear chaves.
4. THE `Sektor_App` SHALL ler a URL da `API_REST` exclusivamente de `EXPO_PUBLIC_API_REST_URL` (já consumido por `src/constants/config.ts`).

### Requirement 9: Autenticação Cognito em todos os endpoints

**User Story:** Como responsável pela segurança, quero que toda chamada do feed exija um token Cognito válido, para impedir acesso anônimo.

#### Acceptance Criteria

1. THE `API_REST` SHALL anexar o `Cognito_Authorizer` (User Pool `us-east-1_cHokaMBWW`) a todos os 7 endpoints da feature.
2. THE `Comunidade_Lambdas` SHALL ler `sub`, `email`, `name` e `custom:teamId` exclusivamente de `event.requestContext.authorizer.claims`.
3. IF `event.requestContext.authorizer` está ausente ou sem `claims.sub`, THEN a Lambda envolvida SHALL retornar `401` com `{ "error": "unauthenticated" }`.
4. THE `API_REST` SHALL habilitar CORS nos 7 endpoints permitindo `Authorization, Content-Type` em `Access-Control-Allow-Headers` e métodos `GET, POST, DELETE, OPTIONS`.

### Requirement 10: Provisionamento de Lambdas com role própria e policies inline

**User Story:** Como operador da AWS, quero que cada Lambda da feature siga o mesmo padrão de `processEvent`/`resolveAnswer` (role própria + policies inline) e seja criada pelo `Agent` via AWS CLI, para manter consistência e princípio do menor privilégio sem trabalho manual.

#### Acceptance Criteria

1. THE `Agent` SHALL produzir um diretório `lambdas/{nome}/` para cada uma das 7 Lambdas, contendo `index.js` (CommonJS), `package.json` declarando dependências mínimas do AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` conforme aplicável) e gerar `function.zip` localmente executando `npm ci --omit=dev` seguido de `Compress-Archive` (PowerShell) no diretório da Lambda.
2. THE `Agent` SHALL produzir, em `infra/`, um arquivo `community-{nome}-policy.json` por Lambda com policy inline de menor privilégio, restrita aos ARNs de `Tabela_Posts`, `Tabela_Comments`, `Tabela_Likes` e/ou `Bucket_Media` necessários, complementada pela policy gerenciada `AWSLambdaBasicExecutionRole`.
3. THE `Agent` SHALL executar via AWS CLI, para cada Lambda da feature, na ordem: `aws iam create-role --role-name {fn}-role --assume-role-policy-document file://infra/lambda-trust-policy.json`, `aws iam attach-role-policy --role-name {fn}-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`, `aws iam put-role-policy --role-name {fn}-role --policy-name {fn}-inline --policy-document file://infra/community-{fn}-policy.json`, `aws lambda create-function --function-name {fn} --runtime nodejs18.x --handler index.handler --role <roleArn> --zip-file fileb://function.zip --environment Variables={...}` e `aws lambda add-permission --function-name {fn} --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:482712210181:{restApiId}/*/*/*`.
4. THE `Agent` SHALL configurar cada Lambda com `runtime=nodejs18.x`, `handler=index.handler`, região `us-east-1` e variáveis de ambiente apropriadas (`POSTS_TABLE`, `COMMENTS_TABLE`, `LIKES_TABLE`, `MEDIA_BUCKET`, `AWS_REGION` quando necessário).
5. WHERE a Lambda assina URLs S3, THE policy inline SHALL conceder `s3:PutObject` apenas para `arn:aws:s3:::sektor-media-bucket/posts/*`.

### Requirement 11: Provisionamento de DynamoDB, S3 e API Gateway pelo Agent

**User Story:** Como operador da AWS, quero que o `Agent` execute diretamente os comandos para criar tabelas, bucket e API REST, para subir a infra em uma sessão sem intervenção manual.

#### Acceptance Criteria

1. THE `Agent` SHALL executar via AWS CLI `aws dynamodb create-table` para `Tabela_Posts`, `Tabela_Comments` e `Tabela_Likes` com `BillingMode=PAY_PER_REQUEST` e os esquemas exatos definidos no Glossary, e SHALL aguardar com `aws dynamodb wait table-exists` até que cada tabela atinja status `ACTIVE` antes de prosseguir para a próxima etapa.
2. THE `Agent` SHALL executar `aws dynamodb update-table` para criar GSI `id-index` em `Tabela_Posts` com PK `id`, `Projection.ProjectionType=INCLUDE` e `NonKeyAttributes=[teamId,createdAt,likes,commentCount]`.
3. THE `Agent` SHALL executar `aws s3 mb s3://sektor-media-bucket --region us-east-1`, `aws s3api put-public-access-block` e `aws s3api put-bucket-cors --bucket sektor-media-bucket --cors-configuration file://infra/community-s3-cors.json` aplicando a CORS rule definida no design (`AllowedMethods=["PUT","GET"]`, `AllowedOrigins=["*"]`, `AllowedHeaders=["*"]`, `MaxAgeSeconds=3600`).
4. THE `Agent` SHALL executar `aws apigateway create-rest-api --name sektor-rest-api`, criar os resources de path para `/posts`, `/posts/{postId}`, `/posts/{postId}/like`, `/posts/{postId}/comments` e `/upload-url`, criar um `aws apigateway create-authorizer --type COGNITO_USER_POOLS --provider-arns arn:aws:cognito-idp:us-east-1:482712210181:userpool/us-east-1_cHokaMBWW`, executar `put-method` (com `--authorization-type COGNITO_USER_POOLS --authorizer-id <auth>`) e `put-integration` (`--type AWS_PROXY`) para cada um dos 7 endpoints, criar `OPTIONS` MOCK + CORS em cada recurso e finalizar com `aws apigateway create-deployment --rest-api-id <id> --stage-name prod`.
5. WHEN a `API_REST` é criada, THE `Agent` SHALL capturar o `restApiId` retornado e SHALL utilizá-lo para preencher `EXPO_PUBLIC_API_REST_URL` em `.env.local` no formato `https://{restApiId}.execute-api.us-east-1.amazonaws.com/prod`.

### Requirement 12: Configuração do app

**User Story:** Como desenvolvedor, quero o `.env.local` atualizado com a URL real da API REST após o deploy, para o app funcionar imediatamente sem edição manual.

#### Acceptance Criteria

1. THE `Agent` SHALL adicionar a chave `EXPO_PUBLIC_API_REST_URL=https://{realRestApiId}.execute-api.us-east-1.amazonaws.com/prod` ao arquivo `.env.local` do projeto, usando o `restApiId` real capturado em 11.5 e preservando integralmente as chaves existentes (`EXPO_PUBLIC_API_WS_URL`, `EXPO_PUBLIC_COGNITO_USER_POOL_ID`, `EXPO_PUBLIC_COGNITO_CLIENT_ID`).
2. THE `Agent` SHALL executar `npx tsc --noEmit` na raiz do app após editar `.env.local` e SHALL reportar ao usuário qualquer erro retornado, sem prosseguir para etapas seguintes em caso de falha.

### Requirement 13: Verificação fim-a-fim

**User Story:** Como desenvolvedor, quero verificar rapidamente que o feed funciona após o deploy, para confirmar que a feature está fechada.

#### Acceptance Criteria

1. THE `Agent` SHALL executar, após o provisionamento, (a) uma requisição anônima (sem header `Authorization`) contra um dos 7 endpoints e SHALL exigir resposta `401`, e (b) uma requisição autenticada contra cada um dos 7 endpoints exigindo resposta `200` ou `201`, utilizando um token Cognito obtido via `aws cognito-idp admin-initiate-auth` para um usuário de teste ou um token fornecido explicitamente pelo usuário.
2. THE `Agent` SHALL executar `npx tsc --noEmit` na raiz do app e SHALL reportar o resultado, sendo `0 errors` o critério explícito de done desta verificação.
3. THE `Agent` SHALL listar, na mensagem final ao usuário, o checklist manual de UI a ser executado por ele (publicar post sem imagem, publicar post com imagem, curtir e descurtir, abrir `CommentsModal` e adicionar comentário) com identificação clara de que esses passos não foram automatizados.

### Requirement 14: Salvaguardas de execução AWS CLI pelo Agent

**User Story:** Como dono do ambiente AWS, quero que o `Agent` execute os comandos de provisionamento com salvaguardas estritas, para que recursos pré-existentes (`Recursos_Protegidos`) não sejam alterados nem destruídos durante a entrega da feature.

#### Acceptance Criteria

1. BEFORE criar qualquer recurso AWS, THE `Agent` SHALL executar o comando `describe`, `get` ou equivalente correspondente (ex.: `aws dynamodb describe-table`, `aws s3api head-bucket`, `aws iam get-role`, `aws lambda get-function`, `aws apigateway get-rest-apis`) e, IF um recurso com o mesmo nome já existir, THEN THE `Agent` SHALL pular a criação, registrar no chat a mensagem `skip: already exists` e prosseguir para o próximo passo sem retornar erro.
2. THE `Agent` SHALL NOT executar comandos de classe destrutiva (`aws * delete-*`, `aws * remove-*`, `aws s3 rb`, `aws cloudformation destroy`, qualquer comando com `--force` em recursos existentes ou exclusões recursivas amplas) contra recursos não criados nesta sessão; o único comando destrutivo permitido SHALL ser `aws s3 rm s3://sektor-media-bucket/posts/...` para limpeza pontual de objetos de teste sob o prefixo `posts/`, nunca `aws s3 rb`.
3. THE `Agent` SHALL NOT emitir qualquer comando AWS CLI cujo `--name`, `--function-name`, `--role-name`, `--table-name`, `--stream-name`, `--rest-api-id`, `--bucket` ou parâmetro equivalente referencie um nome ou identificador presente em `Recursos_Protegidos`; IF um comando candidato for detectado contendo um desses identificadores, THEN THE `Agent` SHALL abortar imediatamente o passo, reportar o erro ao usuário e aguardar instruções.
4. THE `Agent` SHALL executar os comandos na ordem documentada no design (DynamoDB → S3 → IAM roles e policies → build de zips Lambda → `create-function` → API Gateway resources/methods/authorizer/integrations → CORS OPTIONS → deploy `prod` → atualização de `.env.local`) e, IF qualquer comando AWS CLI retornar status diferente de zero, THEN THE `Agent` SHALL interromper a sequência, expor o stderr completo ao usuário e aguardar instrução antes de prosseguir.
5. THE `Agent` SHALL registrar no chat, para cada comando AWS CLI executado, o comando emitido (com argumentos sensíveis truncados quando aplicável) e um resumo do resultado (recurso criado, identificador retornado ou mensagem de skip), de forma que o usuário possa auditar o run.
6. BEFORE executar o primeiro lote de comandos de provisionamento da sessão, THE `Agent` SHALL pausar e solicitar confirmação explícita do usuário; THE `Agent` SHALL repetir essa confirmação BEFORE qualquer comando cujo blast radius não esteja claro e BEFORE re-executar o provisionamento se o passo 14.1 detectar recursos órfãos de uma execução anterior parcial.
7. IF qualquer passo de provisionamento falhar no meio da sequência, THEN THE `Agent` SHALL NOT executar rollback automático; instead THE `Agent` SHALL parar a execução, listar no chat todos os recursos criados até aquele ponto (com nomes e ARNs quando disponíveis) e perguntar ao usuário como proceder.
