# Implementation Plan: Comunidade Feed

## Overview

Sete Lambdas Node.js 18 (CommonJS, AWS SDK v3 modular) cobrindo todos os endpoints REST do feed, expostas atrás de uma API Gateway REST com Cognito Authorizer; persistência em três tabelas DynamoDB on-demand e mídia em S3 com upload pré-assinado. Frontend ganha `CommentsModal` novo, image picker funcional no `CreatePostModal` e ligação no `community.tsx`. Cada Lambda mora em `lambdas/{nome}/` com `package.json` próprio e tem policy inline em `infra/community-{nome}-policy.json`. **O Agent executa diretamente os comandos AWS CLI** (Windows CMD com `^`) para provisionar DynamoDB, S3, IAM, Lambdas e API Gateway, sob salvaguardas estritas (pré-flight de idempotência, deny-list dos `Recursos_Protegidos`, halt-on-error, confirmação explícita do usuário antes do primeiro lote real). `.env.local` é atualizado pelo Agent com a URL real da API após o `create-deployment`. Smoke verification (anônimo + autenticado nos 7 endpoints) e `npx tsc --noEmit` rodam pelo Agent; checklist de UI manual fica documentado para o usuário ao final.

## Tasks

- [x] 1. Lambda getPosts (`GET /posts`)
  - [x] 1.1 Implementar `lambdas/getPosts/index.js` e `lambdas/getPosts/package.json`
    - Handler CommonJS com `assertEnv`, `getClaims`, `ok`, `err` no padrão de `submitAnswer/index.js`
    - QueryCommand em `POSTS_TABLE` com `KeyConditionExpression="teamId = :t"`, `ScanIndexForward=false`, `Limit=20`
    - Cursor `lastKey` round-trip via `Buffer.from(...).toString("base64")`
    - Mapear cada item para shape `Post` com defaults numéricos (`likes ?? 0`, `commentCount ?? 0`)
    - Validações: `teamId` ausente → 400; claims ausente → 401
    - `package.json` com `@aws-sdk/client-dynamodb` e `@aws-sdk/lib-dynamodb`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.2, 8.3, 9.2, 9.3_
  
  - [x] 1.2 Criar `infra/community-getPosts-policy.json`
    - Inline policy com `dynamodb:Query` apenas em `arn:aws:dynamodb:us-east-1:482712210181:table/sektor-posts`
    - _Requirements: 10.2_
  
  - [ ]* 1.3 Property test P1 — paginação preserva ordem decrescente
    - **Property 1: Pagination preserva ordem decrescente completa**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
    - Em `lambdas/getPosts/__tests__/handler.property.test.js` com `aws-sdk-client-mock` + `fast-check`, ≥100 iterações
    - Tag: `Feature: comunidade-feed, Property 1`

- [x] 2. Lambda createPost (`POST /posts`)
  - [x] 2.1 Implementar `lambdas/createPost/index.js` e `lambdas/createPost/package.json`
    - `randomUUID` de `crypto`, `createdAt = new Date().toISOString()`
    - `authorName = claims.name || claims.email`
    - Gravar item completo (incluir `imageUrl` apenas se enviado) em `POSTS_TABLE` via `PutCommand`
    - Validações: `text` whitespace-only → 400; `custom:teamId` ausente → 400; `imageUrl` que não começa com `https://sektor-media-bucket.s3.` → 400
    - Resposta `201 { post }` com shape exato de `Post`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.2, 8.3, 9.2, 9.3_
  
  - [x] 2.2 Criar `infra/community-createPost-policy.json`
    - Inline policy com `dynamodb:PutItem` em `…/table/sektor-posts`
    - _Requirements: 10.2_
  
  - [ ]* 2.3 Property test P2 — createPost round-trip
    - **Property 2: createPost round-trip**
    - **Validates: Requirements 2.1, 2.2**
    - `lambdas/createPost/__tests__/round-trip.property.test.js` com `aws-sdk-client-mock` + `fast-check`
  
  - [ ]* 2.4 Property test P3 — text whitespace-only é rejeitado (createPost)
    - **Property 3: text whitespace-only é rejeitado**
    - **Validates: Requirements 2.3**
    - Gerar strings só com whitespace; assert `400 { error: "text required" }` e zero chamadas a `PutCommand`
  
  - [ ]* 2.5 Property test P4 — imageUrl prefix validation
    - **Property 4: imageUrl prefix validation**
    - **Validates: Requirements 2.5**
    - `fast-check` gera strings; aceito ⇔ inicia com `https://sektor-media-bucket.s3.`

- [x] 3. Lambda likePost (`POST /posts/{postId}/like`)
  - [x] 3.1 Implementar `lambdas/likePost/index.js` e `lambdas/likePost/package.json`
    - `findPostKey(postId)` via Query no GSI `id-index`; 404 se não encontrar
    - `PutCommand` em `LIKES_TABLE` com `ConditionExpression="attribute_not_exists(userId)"`
    - Em sucesso: `UpdateCommand` em `POSTS_TABLE` com `ADD likes :one` e `ReturnValues="UPDATED_NEW"`
    - Em `ConditionalCheckFailedException`: `GetCommand` para retornar `likes` atual sem alterar
    - Resposta `200 { likes }`
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 8.2, 8.3, 9.2, 9.3_
  
  - [x] 3.2 Criar `infra/community-likePost-policy.json`
    - `dynamodb:Query` em `…/sektor-posts/index/id-index`
    - `dynamodb:GetItem`, `dynamodb:UpdateItem` em `…/sektor-posts`
    - `dynamodb:PutItem` em `…/sektor-likes`
    - _Requirements: 10.2_

- [x] 4. Lambda unlikePost (`DELETE /posts/{postId}/like`)
  - [x] 4.1 Implementar `lambdas/unlikePost/index.js` e `lambdas/unlikePost/package.json`
    - Espelho de `likePost`: `DeleteCommand` em `LIKES_TABLE` com `ConditionExpression="attribute_exists(userId)"`
    - Em sucesso: `UpdateExpression="ADD likes :neg"` (`:neg = -1`)
    - Em `ConditionalCheckFailedException`: `GetCommand` retorna `likes` atual
    - Resposta `200 { likes }`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 8.2, 8.3, 9.2, 9.3_
  
  - [x] 4.2 Criar `infra/community-unlikePost-policy.json`
    - Mesmo de likePost trocando `dynamodb:PutItem` por `dynamodb:DeleteItem` em `…/sektor-likes`
    - _Requirements: 10.2_
  
  - [ ]* 4.3 Property test P5 — like/unlike round-trip preserva contador
    - **Property 5: like/unlike round-trip preserva contador**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Test em `lambdas/unlikePost/__tests__/round-trip.property.test.js` exercitando os dois handlers em sequência
  
  - [ ]* 4.4 Property test P6 — idempotência em condition fail
    - **Property 6: like/unlike são idempotentes em condition fail**
    - **Validates: Requirements 3.4**
    - Sequência repetida de `like` (e análoga `unlike`) não altera contador além da primeira chamada

- [x] 5. Lambda getComments (`GET /posts/{postId}/comments`)
  - [x] 5.1 Implementar `lambdas/getComments/index.js` e `lambdas/getComments/package.json`
    - QueryCommand em `COMMENTS_TABLE` com `KeyConditionExpression="postId = :p"`, `ScanIndexForward=true`
    - Mapear cada item para shape `Comment`
    - Resposta `200 { comments }`
    - _Requirements: 4.1, 8.2, 8.3, 9.2, 9.3_
  
  - [x] 5.2 Criar `infra/community-getComments-policy.json`
    - `dynamodb:Query` em `…/sektor-comments`
    - _Requirements: 10.2_
  
  - [ ]* 5.3 Property test P8 — getComments ordem ascendente
    - **Property 8: getComments retorna ordem ascendente**
    - **Validates: Requirements 4.1**

- [x] 6. Lambda createComment (`POST /posts/{postId}/comments`)
  - [x] 6.1 Implementar `lambdas/createComment/index.js` e `lambdas/createComment/package.json`
    - `findPostKey(postId)` via GSI `id-index`; 404 se não existir
    - Validações: `text` whitespace-only → 400
    - `PutCommand` em `COMMENTS_TABLE`; `UpdateCommand` em `POSTS_TABLE` com `ADD commentCount :one`
    - Resposta `201 { comment }`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 8.2, 8.3, 9.2, 9.3_
  
  - [x] 6.2 Criar `infra/community-createComment-policy.json`
    - `dynamodb:Query` em `…/sektor-posts/index/id-index`
    - `dynamodb:UpdateItem` em `…/sektor-posts`
    - `dynamodb:PutItem` em `…/sektor-comments`
    - _Requirements: 10.2_
  
  - [ ]* 6.3 Property test P7 — createComment grava + incrementa commentCount
    - **Property 7: createComment grava comentário e incrementa commentCount**
    - **Validates: Requirements 4.2, 4.3**
  
  - [ ]* 6.4 Property test P3 — text whitespace-only é rejeitado (createComment)
    - **Property 3: text whitespace-only é rejeitado**
    - **Validates: Requirements 4.4**

- [x] 7. Lambda getUploadUrl (`GET /upload-url`)
  - [x] 7.1 Implementar `lambdas/getUploadUrl/index.js` e `lambdas/getUploadUrl/package.json`
    - Set `ALLOWED = {"image/jpeg","image/png","image/webp"}`; `sanitize(name)` com regex `/[^A-Za-z0-9._-]/g` e truncamento em 64 chars
    - Validações: `filename` ausente → 400; `type` fora do allow-list → 400
    - `key = posts/${claims.sub}/${Date.now()}-${sanitize(filename)}`
    - `getSignedUrl` para `PutObjectCommand` com `ContentType=type`, `expiresIn=300`
    - Resposta `200 { uploadUrl, fileUrl }` com `fileUrl=https://sektor-media-bucket.s3.us-east-1.amazonaws.com/${key}`
    - `package.json` com `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.2, 9.3, 10.1_
  
  - [x] 7.2 Criar `infra/community-getUploadUrl-policy.json`
    - `s3:PutObject` apenas em `arn:aws:s3:::sektor-media-bucket/posts/*`
    - _Requirements: 10.2, 10.5_
  
  - [ ]* 7.3 Property test P9 — upload-url consistency
    - **Property 9: upload-url consistency**
    - **Validates: Requirements 5.1**
    - Asserir que `uploadUrl` e `fileUrl` referenciam a mesma `key`; `ContentType` da assinatura igual ao `type` recebido
  
  - [ ]* 7.4 Property test P10 — type allow-list
    - **Property 10: type allow-list**
    - **Validates: Requirements 5.2**
    - Aceito ⇔ `type ∈ {"image/jpeg","image/png","image/webp"}`
  
  - [ ]* 7.5 Property test P11 — sanitize idempotência, character set e tamanho
    - **Property 11: sanitize idempotência, character set e tamanho**
    - **Validates: Requirements 5.4**
    - Função pura sem mocks: `sanitize(s)` só contém `[A-Za-z0-9._-]`, comprimento ≤ 64, idempotente

- [ ] 8. Property test universal de auth (cross-lambda)
  - [ ]* 8.1 Property test P12 — claims.sub ausente → 401 universalmente
    - **Property 12: claims.sub ausente → 401 universalmente**
    - **Validates: Requirements 9.3**
    - Em `lambdas/__tests__/auth.property.test.js`, importar todos os 7 handlers e exercitar com eventos cujo `requestContext.authorizer?.claims?.sub` é ausente/vazio; asserir `401 { error: "unauthenticated" }` e zero chamadas em DynamoDB/S3 mocks

- [x] 9. Checkpoint — Lambdas e policies
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 10. Provisionamento — Pre-flight + DynamoDB (executado pelo Agent)
  - [ ] 10.1 Pre-flight de ambiente AWS
    - Executar `aws sts get-caller-identity --query Account --output text`; assert account == `482712210181`; abortar se diferente
    - Executar `aws configure get region`; assert `us-east-1`; abortar se diferente
    - **Pausar e pedir confirmação explícita do usuário antes do primeiro lote de comandos** (Req 14.6)
    - _Requirements: 14.1, 14.6_
  
  - [x] 10.2 Criar `infra/community-s3-cors.json`
    - JSON com `CORSRules: [{ AllowedMethods:["PUT","GET"], AllowedOrigins:["*"], AllowedHeaders:["*"], MaxAgeSeconds:3600 }]`
    - _Requirements: 11.3_
  
  - [ ] 10.3 Criar/garantir tabelas DynamoDB
    - Para cada `sektor-posts`, `sektor-comments`, `sektor-likes`: `aws dynamodb describe-table` (skip se exit 0); `aws dynamodb create-table` PAY_PER_REQUEST com schema do design; `aws dynamodb wait table-exists`
    - Após `sektor-posts` ativa, parsear `describe-table` para detectar GSI `id-index`; se ausente, executar `aws dynamodb update-table` para criar GSI `id-index` com Projection INCLUDE (`teamId,createdAt,likes,commentCount`); aguardar `IndexStatus=ACTIVE`
    - Logar cada comando executado e resumo do resultado
    - _Requirements: 11.1, 11.2, 14.1, 14.4, 14.5_

- [ ] 11. Provisionamento — S3 (executado pelo Agent)
  - [ ] 11.1 Criar/configurar `sektor-media-bucket`
    - `aws s3api head-bucket --bucket sektor-media-bucket`; se ausente, `aws s3 mb s3://sektor-media-bucket --region us-east-1`
    - `aws s3api put-public-access-block --bucket sektor-media-bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false`
    - `aws s3api put-bucket-cors --bucket sektor-media-bucket --cors-configuration file://infra/community-s3-cors.json`
    - Verificar com `aws s3api get-bucket-cors --bucket sektor-media-bucket`
    - _Requirements: 11.3, 14.1, 14.5_

- [ ] 12. Provisionamento — IAM roles + inline policies + Lambda zips + create-function (executado pelo Agent)
  - [ ] 12.1 Para cada uma das 7 funções (`getPosts`, `createPost`, `likePost`, `unlikePost`, `getComments`, `createComment`, `getUploadUrl`):
    - `aws iam get-role --role-name {fn}-role` (skip create se exit 0)
    - `aws iam create-role --role-name {fn}-role --assume-role-policy-document file://infra/lambda-trust-policy.json`
    - `aws iam attach-role-policy --role-name {fn}-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`
    - `aws iam put-role-policy --role-name {fn}-role --policy-name {fn}-inline --policy-document file://infra/community-{fn}-policy.json`
    - Capturar role ARN via `aws iam get-role --role-name {fn}-role --query Role.Arn --output text`
    - Wait ~10s após primeira role nova para consistência IAM
    - _Requirements: 10.3, 10.5, 14.1, 14.5_
  
  - [ ] 12.2 Build dos zips Lambda
    - Para cada `lambdas/{fn}/`: validar que `index.js` e `package.json` existem; rodar `npm ci --omit=dev` (cwd=`lambdas/{fn}`); `powershell -Command "Compress-Archive -Path *.js,node_modules,package.json -DestinationPath function.zip -Force"` (cwd=`lambdas/{fn}`)
    - Se algum zip não for gerado, abortar
    - _Requirements: 10.1_
  
  - [x] 12.3 Create-function de cada Lambda
    - `aws lambda get-function --function-name {fn}` — se exit 0, **abortar** com mensagem explícita ao usuário (não atualizar silenciosamente; Req 14.2/14.3)
    - `aws lambda create-function --function-name {fn} --runtime nodejs18.x --handler index.handler --role <roleArn> --zip-file fileb://function.zip --environment "Variables={...env vars apropriadas...}" --region us-east-1`
    - Aguardar `Configuration.State=Active`
    - _Requirements: 10.3, 10.4, 14.1, 14.4, 14.5_

- [ ] 13. Provisionamento — API Gateway REST (executado pelo Agent)
  - [ ] 13.1 Criar `sektor-rest-api`, resources e authorizer
    - `aws apigateway get-rest-apis --query "items[?name=='sektor-rest-api'].id" --output text`; se não-vazio, **abortar** com mensagem ao usuário (Req 14.3 — não recriar)
    - `aws apigateway create-rest-api --name sektor-rest-api --endpoint-configuration types=REGIONAL --region us-east-1`; capturar `restApiId`
    - `aws apigateway get-resources --query "items[?path=='/'].id" --output text`; capturar `rootId`
    - `aws apigateway create-resource` para cada path-part: `posts`, `{postId}`, `like`, `comments`, `upload-url`; capturar resource ids
    - `aws apigateway create-authorizer --type COGNITO_USER_POOLS --name cognito --provider-arns arn:aws:cognito-idp:us-east-1:482712210181:userpool/us-east-1_cHokaMBWW --identity-source method.request.header.Authorization`; capturar `authorizerId`
    - _Requirements: 9.1, 11.4, 14.1_
  
  - [x] 13.2 Configurar os 7 endpoints
    - Para cada `(httpMethod, resourceId, lambdaName)` em `[(GET, postsId, getPosts), (POST, postsId, createPost), (POST, likeId, likePost), (DELETE, likeId, unlikePost), (GET, commentsId, getComments), (POST, commentsId, createComment), (GET, uploadUrlId, getUploadUrl)]`:
      - `aws apigateway put-method --authorization-type COGNITO_USER_POOLS --authorizer-id {authorizerId}`
      - `aws apigateway put-integration --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:482712210181:function:{lambdaName}/invocations`
      - `aws apigateway put-method-response --status-code 200 --response-models "application/json=Empty"`
    - _Requirements: 9.1, 11.4_
  
  - [ ] 13.3 OPTIONS MOCK + CORS em cada um dos 5 resources
    - Para cada resource em `[postsId, postIdId, likeId, commentsId, uploadUrlId]`:
      - `aws apigateway put-method --http-method OPTIONS --authorization-type NONE`
      - `aws apigateway put-integration --type MOCK --request-templates "application/json={\"statusCode\":200}"`
      - `aws apigateway put-method-response --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true"`
      - `aws apigateway put-integration-response --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Headers='Authorization,Content-Type',method.response.header.Access-Control-Allow-Methods='GET,POST,DELETE,OPTIONS',method.response.header.Access-Control-Allow-Origin='*'"`
    - _Requirements: 9.4, 11.4_
  
  - [x] 13.4 Add-permission para API Gateway invocar cada Lambda
    - Para cada `{fn}` das 7: `aws lambda add-permission --function-name {fn} --statement-id apigw-{fn} --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:482712210181:{restApiId}/*/*/*`
    - _Requirements: 10.3, 11.4_
  
  - [ ] 13.5 Deploy stage `prod`
    - `aws apigateway create-deployment --rest-api-id {restApiId} --stage-name prod`
    - Verificar com `aws apigateway get-stage --rest-api-id {restApiId} --stage-name prod --query stageName --output text` esperando `prod`
    - _Requirements: 11.4, 11.5_

- [x] 14. Frontend — CommentsModal (novo)
  - [x] 14.1 Implementar `src/components/community/CommentsModal.tsx`
    - Props `{ visible, postId, onClose, onCommentAdded }`
    - `useEffect([postId, visible])`: quando aberto, `getComments(postId)` e popular state local `comments`
    - `FlatList` com `keyExtractor=item.id`, ordem ascendente, exibindo `authorName`, texto e tempo relativo (reusar helper de `PostCard.tsx`)
    - `KeyboardAvoidingView` com `TextInput` + botão "Enviar"
    - Submit: `addComment(postId, text)` → append do `Comment` retornado em `comments` local, limpa input, chama `onCommentAdded(postId)`
    - Erro: `Text` discreto acima do input com mensagem em PT, mantém texto digitado
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 14.2 Testes do CommentsModal
    - `src/components/community/__tests__/CommentsModal.test.tsx` com React Native Testing Library
    - Casos: abrir → lista carregada; submit → comment aparece; erro → mensagem mostrada e texto preservado
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 15. Frontend — CreatePostModal image picker
  - [x] 15.1 Adicionar image picker em `src/components/community/CreatePostModal.tsx`
    - Estado novo `imageUri: string | undefined`
    - Botão "📷": chamar `requestMediaLibraryPermissionsAsync`; se negado → `Alert` em PT informando que permissão é necessária e que o post pode seguir sem imagem
    - Se concedido → `launchImageLibraryAsync({ mediaTypes: Images, quality: 0.8, allowsEditing: false })`; em sucesso `setImageUri(result.assets[0].uri)`
    - Preview 80×80 com botão "X" para remover; ambos `disabled={isSubmitting}`
    - `handleSubmit` passa `imageUri` (ou `undefined`) para `onSubmit(text.trim(), imageUri)`
    - `imageUri` resetado junto com `setText("")` no sucesso
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 15.2 Testes do CreatePostModal
    - `src/components/community/__tests__/CreatePostModal.test.tsx`
    - Mock `expo-image-picker`; casos: tap "📷" → permissão concedida → preview aparece; permissão negada → Alert; submit chama `onSubmit(text, imageUri)`; durante `isSubmitting`, botões desabilitados
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 16. Frontend — Wire CommunityScreen
  - [x] 16.1 Atualizar `src/app/(tabs)/community.tsx` para abrir `CommentsModal`
    - Adicionar `useState<string | null>(null)` para `activePostId`
    - `PostCard.onComment={() => setActivePostId(item.id)}`
    - Renderizar `<CommentsModal visible={activePostId !== null} postId={activePostId} onClose={() => setActivePostId(null)} onCommentAdded={() => {}} />` (incremento de `commentCount` já é feito dentro de `useCommunity.addComment`)
    - Importar `CommentsModal` de `../../components/community/CommentsModal`
    - _Requirements: 6.1, 6.4_

- [ ] 17. Configuração do app — atualizar `.env.local` com URL real (executado pelo Agent)
  - [ ] 17.1 Substituir/adicionar `EXPO_PUBLIC_API_REST_URL` em `.env.local`
    - Ler `.env.local` existente, preservar `EXPO_PUBLIC_API_WS_URL`, `EXPO_PUBLIC_COGNITO_USER_POOL_ID`, `EXPO_PUBLIC_COGNITO_CLIENT_ID`
    - Substituir/adicionar `EXPO_PUBLIC_API_REST_URL=https://{restApiId}.execute-api.us-east-1.amazonaws.com/prod` usando o `restApiId` capturado em 13.1
    - Logar o valor final no chat (mascarando se julgar necessário)
    - _Requirements: 11.5, 12.1_

- [ ] 18. Smoke verification e tsc (executado pelo Agent)
  - [ ] 18.1 Smoke autenticação anônima
    - `curl -i https://{restApiId}.execute-api.us-east-1.amazonaws.com/prod/posts?teamId=test` (sem `Authorization`)
    - Asserir `HTTP/1.1 401`; halt e reportar se diferente
    - _Requirements: 13.1, 9.3_
  
  - [ ] 18.2 Smoke autenticação válida nos 7 endpoints
    - Obter idToken via `aws cognito-idp admin-initiate-auth --user-pool-id us-east-1_cHokaMBWW --client-id {clientId} --auth-flow ADMIN_NO_SRP_AUTH --auth-parameters USERNAME={user},PASSWORD={pass}` (ou aceitar token fornecido pelo usuário)
    - Para cada um dos 7 endpoints: `curl -i -H "Authorization: Bearer {idToken}"` com payload mínimo apropriado; asserir `200` ou `201`
    - Halt e reportar se algum falhar
    - _Requirements: 13.1_
  
  - [ ] 18.3 Type-check do app
    - `npx tsc --noEmit` (cwd=`app/`); asserir `0 errors`
    - Halt e reportar se falhar
    - _Requirements: 12.2, 13.2_
  
  - [ ] 18.4 Listar checklist UI manual ao usuário
    - Após smoke OK, listar no chat os passos manuais que continuam a cargo do usuário: publicar post sem imagem, publicar post com imagem (image picker), curtir/descurtir, abrir `CommentsModal` e adicionar comentário
    - _Requirements: 13.3_

- [ ] 19. Checkpoint final — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais (testes) e podem ser puladas para um MVP mais rápido; tasks sem `*` são obrigatórias.
- Tasks **10–13** e **17–18** são executadas pelo Agent diretamente via AWS CLI/cmd (Windows CMD com `^` para quebras de linha) — o usuário não roda os comandos manualmente, apenas autoriza e acompanha o audit log no chat.
- **Salvaguardas obrigatórias do Agent** (espelham Requirement 14):
  - **Pré-flight de idempotência**: cada `create-*` é precedido pelo `describe`/`get` correspondente; se o recurso já existe, `skip: already exists` e segue sem erro (exceto Lambdas e REST API, onde a existência prévia força **abort** com mensagem explícita ao usuário, sem update silencioso).
  - **Confirmação explícita do usuário antes do wave 3** (`10.3`, primeiro batch real de criação — DynamoDB), e novamente antes de re-executar provisionamento se o pré-flight detectar recursos órfãos de um run anterior parcial.
  - **Halt-on-error sem rollback automático**: qualquer comando AWS CLI com exit ≠ 0 interrompe a sequência, expõe stderr completo no chat, lista o que já foi criado e aguarda instrução.
  - **Deny-list dos `Recursos_Protegidos`**: o Agent NUNCA emite comando referenciando `sektor-ws-api`, `3bodgtvae0`, `wsConnect`, `wsDisconnect`, `processEvent`, `resolveAnswer`, `sektor-connections`, `sektor-match-events`, `processEvent-role-j2rjl0q0`, `wsConnect-role-s6ct3dqv`, `wsDisconnect-role-96gqgrvj`, `resolveAnswer-role-cwoh034c`.
  - **Allow-list dos identificadores permitidos**: tabelas `sektor-posts`/`sektor-comments`/`sektor-likes`, bucket `sektor-media-bucket`, roles `{fn}-role` (7 nomes), Lambdas `getPosts`/`createPost`/`likePost`/`unlikePost`/`getComments`/`createComment`/`getUploadUrl`, REST API `sektor-rest-api`.
  - **Sem comandos destrutivos**: proibido `delete-*`, `remove-*`, `aws s3 rb`, `--force`. Única exceção: `aws s3 rm s3://sektor-media-bucket/posts/...` para limpeza pontual de objetos de teste.
  - **Audit log no chat**: cada comando emitido (com argumentos sensíveis truncados) e seu resumo (recurso criado, identificador retornado ou skip) é registrado para auditoria do usuário.
- Cada task referencia requisitos granulares (sub-cláusulas como `1.2`, `4.4`) e, quando aplicável, a property exata do design (P1–P12).
- Property tests usam `aws-sdk-client-mock` + `fast-check` (≥100 iterações) e ficam em `lambdas/{nome}/__tests__/*.property.test.js`, exceto P12 que vive em `lambdas/__tests__/auth.property.test.js` por ser cross-lambda.
- O frontend não modifica `src/services/api.ts` nem `src/types/index.ts` — contratos preservados conforme R8.
- Cada Lambda recebe execution role própria (`{fn}-role`) seguindo o padrão real da conta `482712210181` (Lambdas existentes têm roles auto-geradas individuais, ver steering `aws-resources.md`).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2", "7.1", "7.2", "14.1", "15.1"] },
    { "id": 1, "tasks": ["1.3", "2.3", "2.4", "2.5", "4.3", "4.4", "5.3", "6.3", "6.4", "7.3", "7.4", "7.5", "8.1", "10.2", "14.2", "15.2", "16.1"] },
    { "id": 2, "tasks": ["10.1"] },
    { "id": 3, "tasks": ["10.3"] },
    { "id": 4, "tasks": ["11.1"] },
    { "id": 5, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 6, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5"] },
    { "id": 7, "tasks": ["17.1"] },
    { "id": 8, "tasks": ["18.1", "18.2", "18.3", "18.4"] }
  ]
}
```
