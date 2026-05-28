# Requirements Document

## Introduction

Esta feature fecha o ciclo de resposta do Modo Arena (Plano 04) do Sektor Connected Arena. Hoje o pipeline AWS gera predições (`PREDICTION`) e as distribui via WebSocket para os apps conectados, mas:

- A Lambda `resolveAnswer` não tem trigger automático quando a janela de 15s da predição expira.
- Não existe tabela de pontuação por usuário/partida.
- O app não envia o `ANSWER` real para o backend.
- Permanece um mock não utilizado em `src/services/matchSimulator.ts`.

A feature adiciona:

1. Disparo automático da `resolveAnswer` ao expirar uma predição (via EventBridge Scheduler one-shot agendado pela `processEvent`).
2. Tabela `sektor-scores` no DynamoDB com schema que suporte multiplicador GPS (2x quando dentro do estádio).
3. Envio do `ANSWER` autenticado pelo app (rota WebSocket dedicada), com persistência idempotente em `sektor-answers`.
4. Cálculo de score na `resolveAnswer` consumindo as respostas persistidas.
5. Limpeza do mock `matchSimulator` (e teste correspondente).

## Glossary

- **Arena_App**: aplicativo Expo/React Native do Sektor que se conecta ao WebSocket `sektor-ws-api` no Modo Arena.
- **WS_API**: API Gateway WebSocket `sektor-ws-api` (ID `3bodgtvae0`, stage `prod`, URL `wss://3bodgtvae0.execute-api.us-east-1.amazonaws.com/prod`).
- **Process_Event_Lambda**: função Lambda `processEvent`, acionada pelo Kinesis `sektor-match-events`, responsável por gerar a predição via Bedrock (`amazon.nova-lite-v1:0`) e distribuí-la pelo WS_API.
- **Submit_Answer_Lambda**: nova função Lambda integrada à rota `sendMessage` do WS_API, responsável por receber e persistir `ANSWER` enviados pelo Arena_App.
- **Resolve_Answer_Lambda**: função Lambda `resolveAnswer`, responsável por encerrar uma predição expirada, calcular pontuações e notificar os clientes via WS_API.
- **Scheduler**: AWS EventBridge Scheduler, usado para criar agendamentos one-shot que invocam a Resolve_Answer_Lambda.
- **Predição**: objeto enviado pelo backend ao Arena_App contendo `id` (`predictionId`), `matchId`, `question`, `options`, `correctOption`, `createdAt`, `expiresAt`. O `expiresAt` é igual a `createdAt + 15 segundos`.
- **Janela_Predição**: intervalo de 15 segundos entre `createdAt` e `expiresAt` de uma Predição.
- **ANSWER**: mensagem enviada pelo Arena_App ao backend contendo `predictionId`, `selectedOption` (inteiro entre 0 e o índice máximo das `options`) e `gpsMultiplier` (1 ou 2).
- **Authenticated_User**: usuário autenticado no Cognito User Pool do Sektor cuja identidade (`sub` do JWT) foi validada no momento da conexão WebSocket.
- **Connection_Identity**: par `{connectionId, userId}` mantido em `sektor-connections` que associa uma conexão WebSocket ativa a um Authenticated_User.
- **Sektor_Connections_Table**: tabela DynamoDB `sektor-connections` (PK `matchId`, SK `connectionId`, GSI `connectionId-index`, atributo TTL `ttl`).
- **Sektor_Answers_Table**: nova tabela DynamoDB que armazena cada `ANSWER` recebido. Garante idempotência via chave composta `(predictionId, userId)`.
- **Sektor_Scores_Table**: nova tabela DynamoDB `sektor-scores` que mantém o score acumulado por `(matchId, userId)`.
- **GPS_Multiplier**: fator multiplicativo aplicado ao ganho de pontos quando o Authenticated_User está dentro do perímetro do estádio configurado para a partida. Vale 1 (fora) ou 2 (dentro). Determinado no Arena_App e enviado dentro do `ANSWER`.
- **Stadium_Perimeter**: perímetro geográfico do estádio configurado para a partida no Arena_App (centro + raio em `src/constants/config.ts`).
- **Acerto**: condição em que `selectedOption` recebido no `ANSWER` é igual ao `correctOption` da Predição correspondente.
- **Mock_Match_Simulator**: arquivo `src/services/matchSimulator.ts` e seu teste em `src/services/__tests__/matchSimulator.test.ts`, não mais usado pelo Arena_App após a integração com o pipeline real.

## Requirements

### Requirement 1: Agendamento automático da resolução de predições

**User Story:** Como time de produto do Sektor, eu quero que toda predição expirada seja automaticamente resolvida 15 segundos após a sua criação, para que o usuário receba o resultado e a pontuação sem necessidade de invocação manual.

#### Acceptance Criteria

1. WHEN a Process_Event_Lambda emite uma `PREDICTION` com `createdAt` para os clientes do WS_API, THE Process_Event_Lambda SHALL criar um agendamento one-shot no Scheduler para invocar a Resolve_Answer_Lambda no instante `expiresAt = createdAt + 15 segundos` da Predição.
2. WHEN o Scheduler dispara o agendamento criado para uma Predição, THE Resolve_Answer_Lambda SHALL ser invocada em até 5 segundos após o instante `expiresAt`, com payload contendo `matchId`, `predictionId`, `correctOption` e `expiresAt`.
3. THE Process_Event_Lambda SHALL incluir no payload do agendamento exatamente os campos `matchId`, `predictionId`, `correctOption` e `expiresAt`, de modo que a Resolve_Answer_Lambda resolva a Predição sem consultar a Bedrock novamente.
4. IF a chamada `scheduler:CreateSchedule` falhar para uma Predição, THEN THE Process_Event_Lambda SHALL registrar no CloudWatch um log de nível ERROR contendo `matchId`, `predictionId` e a causa da falha, descartar a Predição daquele evento e confirmar (ack) o registro do Kinesis sem propagar exceção.
5. WHEN o Scheduler invoca a Resolve_Answer_Lambda para um agendamento, THE Scheduler SHALL marcar o agendamento como concluído ou removê-lo em até 1 segundo após a invocação, garantindo que o mesmo agendamento não seja executado mais de uma vez.
6. IF a Resolve_Answer_Lambda for invocada com um `predictionId` que já produziu uma resolução anterior, THEN THE Resolve_Answer_Lambda SHALL preservar o estado existente em `Sektor_Scores_Table` sem aplicar incrementos adicionais e finalizar a invocação sem erro.

### Requirement 2: Tabela `sektor-scores` no DynamoDB

**User Story:** Como usuário do Modo Arena, eu quero que minhas pontuações sejam acumuladas por partida, para que eu possa acompanhar meu desempenho ao longo de cada jogo.

#### Acceptance Criteria

1. THE Sektor_Scores_Table SHALL existir em DynamoDB na conta `482712210181`, região `us-east-1`, com nome `sektor-scores`.
2. THE Sektor_Scores_Table SHALL armazenar uma entrada única por par `(matchId, userId)`, contendo no mínimo os atributos `matchId`, `userId`, `score`, `correctCount`, `wrongCount`, `lastUpdatedAt` e `multiplierAppliedCount`.
3. WHEN a Resolve_Answer_Lambda processa um Acerto de um Authenticated_User, THE Resolve_Answer_Lambda SHALL incrementar atomicamente, em uma única operação, `score` em `10 * gpsMultiplier` e `correctCount` em 1 na entrada `(matchId, userId)`.
4. WHEN a Resolve_Answer_Lambda processa uma resposta incorreta de um Authenticated_User, THE Resolve_Answer_Lambda SHALL incrementar atomicamente `wrongCount` em 1 na entrada `(matchId, userId)`, sem alterar `score`, `correctCount` ou `multiplierAppliedCount`.
5. WHEN a Resolve_Answer_Lambda processa um Acerto cujo `gpsMultiplier` recebido no `ANSWER` é igual a 2, THE Resolve_Answer_Lambda SHALL incluir o incremento de `multiplierAppliedCount` em 1 na mesma operação atômica do critério 2.3.
6. IF o `gpsMultiplier` recebido no `ANSWER` não for 1 nem 2, THEN THE Resolve_Answer_Lambda SHALL tratar o `gpsMultiplier` como 1 ao calcular o score e SHALL registrar no CloudWatch um log de nível WARN contendo `predictionId`, `userId` e o valor recebido.
7. WHEN a Resolve_Answer_Lambda atualiza uma entrada de `Sektor_Scores_Table`, THE Resolve_Answer_Lambda SHALL gravar `lastUpdatedAt` como timestamp UTC em formato ISO-8601 com precisão de milissegundos referente ao instante da atualização.
8. IF não existir entrada prévia para o par `(matchId, userId)` no momento da atualização, THEN THE Resolve_Answer_Lambda SHALL criar a entrada na mesma operação atômica do critério 2.3 ou 2.4, com `score`, `correctCount`, `wrongCount` e `multiplierAppliedCount` iniciados em 0 antes da aplicação do incremento.
9. IF uma operação de escrita em `Sektor_Scores_Table` falhar por timeout, throttling ou erro de serviço do DynamoDB, THEN THE Resolve_Answer_Lambda SHALL registrar no CloudWatch um log de nível ERROR contendo `matchId`, `userId`, `predictionId` e a causa da falha, e SHALL preservar o estado anterior da entrada sem deixar valores parcialmente atualizados.

### Requirement 3: Envio do `ANSWER` pelo Arena_App

**User Story:** Como usuário do Modo Arena, eu quero que minha resposta a uma predição seja registrada no servidor, para que ela conte para a minha pontuação na partida.

#### Acceptance Criteria

1. WHEN o Authenticated_User seleciona uma opção em uma Predição cujo `expiresAt` ainda não foi atingido no momento da seleção, THE Arena_App SHALL enviar uma única mensagem `ANSWER` pela WS_API, usando a rota `sendMessage`, em até 2 segundos após a seleção, contendo `predictionId`, `selectedOption` e `gpsMultiplier`.
2. WHEN o Arena_App receber confirmação do envio do `ANSWER` pela WS_API sem erro de transporte para um `predictionId`, THE Arena_App SHALL bloquear o envio de novos `ANSWER` para o mesmo `predictionId` na sessão atual.
3. WHILE o instante atual for maior ou igual ao `expiresAt` da Predição exibida, THE Arena_App SHALL desabilitar visualmente as opções daquela Predição e impedir o envio de qualquer `ANSWER` para o seu `predictionId`.
4. WHEN o Arena_App envia um `ANSWER` para o qual o Authenticated_User está fora do Stadium_Perimeter no instante da seleção, THE Arena_App SHALL preencher `gpsMultiplier` com o valor 1.
5. WHEN o Arena_App detecta que o Authenticated_User está dentro do Stadium_Perimeter no instante da seleção via GPS, THE Arena_App SHALL preencher `gpsMultiplier` com o valor 2.
6. IF o GPS retornar erro de permissão, indisponibilidade, precisão horizontal pior que 100 metros ou não responder em 5 segundos, THEN THE Arena_App SHALL usar `gpsMultiplier` igual a 1 ao montar o `ANSWER`.
7. IF o WebSocket estiver desconectado no momento do envio, THEN THE Arena_App SHALL exibir uma indicação visual de falha de envio perceptível associada à Predição correspondente na tela do Modo Arena.
8. IF o WebSocket estiver desconectado no momento do envio, THEN THE Arena_App SHALL NÃO retentar o envio do `ANSWER` automaticamente.

### Requirement 4: Recepção e persistência do `ANSWER`

**User Story:** Como time de plataforma do Sektor, eu quero que cada `ANSWER` recebido seja autenticado e persistido com idempotência, para que a pontuação não possa ser fraudada nem duplicada.

#### Acceptance Criteria

1. THE WS_API SHALL expor a rota `sendMessage` apontando para a Submit_Answer_Lambda.
2. WHEN o Arena_App estabelece a conexão WebSocket no `$connect`, THE WS_API SHALL exigir um JWT emitido pelo Cognito User Pool do Sektor e validar sua assinatura, emissor e expiração em até 2 segundos antes de aceitar a conexão.
3. IF o JWT estiver ausente, expirado ou tiver assinatura inválida no `$connect`, THEN THE WS_API SHALL rejeitar a conexão e SHALL NÃO inserir item em `Sektor_Connections_Table`.
4. WHEN o `$connect` é aceito, THE Sektor_Connections_Table SHALL armazenar `userId` (igual ao `sub` do JWT), `matchId` e `connectionId` no item da conexão.
5. WHEN a Submit_Answer_Lambda recebe uma mensagem da rota `sendMessage`, THE Submit_Answer_Lambda SHALL recuperar `userId` e `matchId` a partir do `connectionId` da requisição, consultando o `Sektor_Connections_Table` (incluindo seu GSI `connectionId-index`), em até 2 segundos.
6. IF a Submit_Answer_Lambda não conseguir resolver `userId` para o `connectionId` recebido, THEN THE Submit_Answer_Lambda SHALL responder ao cliente com `{type:"ANSWER_REJECTED", reason:"UNAUTHORIZED"}` e SHALL NÃO persistir o `ANSWER`.
7. WHEN a Submit_Answer_Lambda recebe um `ANSWER` com `predictionId` não vazio (até 64 caracteres), `selectedOption` válido e `gpsMultiplier` válido, THE Submit_Answer_Lambda SHALL persistir uma entrada em Sektor_Answers_Table com chave única `(predictionId, userId)` por meio de escrita condicional atômica, contendo `matchId`, `selectedOption`, `gpsMultiplier` e `submittedAt` em ISO-8601 UTC com precisão de milissegundos.
8. IF a escrita condicional do critério 4.7 falhar por já existir entrada para a chave `(predictionId, userId)`, THEN THE Submit_Answer_Lambda SHALL preservar a entrada original e responder ao cliente com `{type:"ANSWER_REJECTED", reason:"DUPLICATE"}`.
9. IF o `selectedOption` recebido não for um inteiro entre 0 e o índice máximo das `options` da Predição, ou o `gpsMultiplier` recebido não estiver no conjunto {1, 2}, ou o `predictionId` não pertencer ao `matchId` da conexão, THEN THE Submit_Answer_Lambda SHALL responder ao cliente com `{type:"ANSWER_REJECTED", reason:"INVALID_OPTION"}` e SHALL NÃO persistir o `ANSWER`.
10. WHEN a Submit_Answer_Lambda persiste com sucesso um `ANSWER`, THE Submit_Answer_Lambda SHALL responder ao cliente com `{type:"ANSWER_ACCEPTED", predictionId}`.
11. THE Sektor_Answers_Table SHALL definir TTL automático de 86400 segundos a partir do `submittedAt` em cada entrada para limitar custo de armazenamento da feature.

### Requirement 5: Cálculo de pontuação na expiração

**User Story:** Como usuário do Modo Arena, eu quero receber o resultado da predição e ver minha pontuação atualizada assim que a janela expirar, para que o feedback seja imediato.

#### Acceptance Criteria

1. WHEN a Resolve_Answer_Lambda é invocada para um `predictionId`, THE Resolve_Answer_Lambda SHALL ler todas as entradas de Sektor_Answers_Table cuja chave de partição é o `predictionId` recebido, suportando até 500 respostas por `predictionId`.
2. IF a leitura em Sektor_Answers_Table falhar por timeout, throttling ou erro de serviço do DynamoDB, THEN THE Resolve_Answer_Lambda SHALL registrar no CloudWatch um log de nível ERROR contendo `predictionId` e a causa, e SHALL abortar o envio de `SCORE_UPDATE` mantendo apenas o envio de `PREDICTION_RESULT`.
3. WHEN a Resolve_Answer_Lambda processa as respostas de um `predictionId`, THE Resolve_Answer_Lambda SHALL atualizar Sektor_Scores_Table conforme Requirement 2 para cada `userId` que respondeu àquela Predição.
4. WHEN a Resolve_Answer_Lambda termina o processamento de um `predictionId`, THE Resolve_Answer_Lambda SHALL enviar uma mensagem `PREDICTION_RESULT` contendo `predictionId` e `correctOption` para todas as conexões do `matchId` no Sektor_Connections_Table, suportando até 100 conexões por `matchId`.
5. WHEN a Resolve_Answer_Lambda atualizou ao menos uma entrada em `Sektor_Scores_Table` para o `predictionId`, THE Resolve_Answer_Lambda SHALL enviar uma mensagem `SCORE_UPDATE` para cada conexão do `matchId` cujo `userId` está em Sektor_Scores_Table, contendo `userId`, `score`, `correctCount` e `wrongCount` daquele usuário.
6. IF nenhum `ANSWER` foi recebido para o `predictionId` antes da expiração, THEN THE Resolve_Answer_Lambda SHALL enviar apenas a mensagem `PREDICTION_RESULT`, SHALL NÃO ler nem atualizar Sektor_Scores_Table e SHALL NÃO emitir `SCORE_UPDATE`.
7. IF o envio de `PREDICTION_RESULT` ou `SCORE_UPDATE` para uma conexão específica falhar com erro `GoneException`, THEN THE Resolve_Answer_Lambda SHALL ignorar a falha daquela conexão e continuar enviando para as demais conexões do `matchId`.
8. THE Resolve_Answer_Lambda SHALL ter como meta de desempenho a publicação das mensagens `PREDICTION_RESULT` e `SCORE_UPDATE` em até 2000 ms após sua invocação pelo Scheduler, em condições normais de operação (Sektor_Connections_Table com até 100 conexões para o `matchId` e Sektor_Answers_Table com até 500 respostas para o `predictionId`).
9. WHEN a Resolve_Answer_Lambda excede a meta definida no critério 5.8 por carga ou indisponibilidade temporária, THE Resolve_Answer_Lambda SHALL continuar a execução até concluir o envio de `PREDICTION_RESULT` e `SCORE_UPDATE` ou esgotar o timeout configurado da função, registrando a duração total no CloudWatch.

### Requirement 6: Limpeza do mock `matchSimulator`

**User Story:** Como mantenedor do código, eu quero remover o simulador mock do app que não é mais usado, para que o repositório reflita o pipeline real e não confunda novos contribuidores.

#### Acceptance Criteria

1. THE Arena_App SHALL não conter o arquivo `src/services/matchSimulator.ts`.
2. THE Arena_App SHALL não conter o arquivo `src/services/__tests__/matchSimulator.test.ts`.
3. THE Arena_App SHALL não conter declarações `import` ou `require` referenciando o módulo `matchSimulator` em qualquer arquivo `.ts` ou `.tsx` sob `src/` e `scripts/`.
4. IF o build do TypeScript ou a análise estática encontrar referência simbólica residual ao identificador `matchSimulator` em qualquer arquivo `.ts` ou `.tsx` sob `src/` e `scripts/`, THEN THE feature SHALL ser considerada não conforme com o Requirement 6.
5. WHEN a suite de testes do Arena_App é executada via `npm test` após a remoção dos critérios 6.1 a 6.3, THE suite SHALL terminar com exit code 0 e sem suítes ou casos no estado `failed`.

### Requirement 7: Permissões IAM e variáveis de ambiente

**User Story:** Como time de plataforma do Sektor, eu quero que cada Lambda tenha apenas as permissões necessárias para esta feature, para que o princípio de menor privilégio seja respeitado.

#### Acceptance Criteria

1. THE Process_Event_Lambda SHALL ter, anexadas via policy inline na role `processEvent-role-j2rjl0q0`, as ações `scheduler:CreateSchedule` e `scheduler:DeleteSchedule` restritas aos schedules do grupo dedicado da feature, e `iam:PassRole` restrita à role usada como target do Scheduler.
2. THE Submit_Answer_Lambda SHALL ter, anexadas via policy inline na role da função, as ações `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:Query` restritas a `Sektor_Answers_Table`; `dynamodb:GetItem` e `dynamodb:Query` restritas a `Sektor_Connections_Table` e seu GSI `connectionId-index`; e `execute-api:ManageConnections` restrita ao ARN do WS_API.
3. THE Resolve_Answer_Lambda SHALL ter, anexadas via policy inline na role `resolveAnswer-role-cwoh034c`, as ações `dynamodb:Query` em `Sektor_Answers_Table`; `dynamodb:UpdateItem` e `dynamodb:GetItem` em `Sektor_Scores_Table`; `dynamodb:Query` em `Sektor_Connections_Table`; e `execute-api:ManageConnections` restrita ao ARN do WS_API.
4. THE Process_Event_Lambda, Submit_Answer_Lambda e Resolve_Answer_Lambda SHALL receber, via variáveis de ambiente, os valores de `CONNECTIONS_TABLE`, `ANSWERS_TABLE`, `SCORES_TABLE` e `WS_ENDPOINT`; THE Process_Event_Lambda SHALL receber adicionalmente `SCHEDULER_TARGET_ROLE_ARN` e `SCHEDULER_GROUP_NAME`.
5. IF qualquer uma das variáveis de ambiente exigidas no critério 7.4 estiver ausente ou vazia no início da invocação, THEN THE Lambda correspondente SHALL falhar imediatamente registrando um log de nível ERROR no CloudWatch contendo o nome da variável ausente.
6. THE rota `$connect` do WS_API SHALL utilizar um Cognito User Pool Authorizer configurado com o User Pool e App Client referenciados em `.env.local` como `EXPO_PUBLIC_COGNITO_USER_POOL_ID` e `EXPO_PUBLIC_COGNITO_CLIENT_ID`.
7. IF o Cognito User Pool Authorizer rejeitar o JWT no `$connect`, THEN THE WS_API SHALL responder com falha de handshake e SHALL NÃO encaminhar a requisição para a Lambda `wsConnect`.
