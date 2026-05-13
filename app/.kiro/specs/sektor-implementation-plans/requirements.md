# Requirements Document

## Introduction

O **Sektor** é um aplicativo mobile (React Native + Expo) que conecta torcedores ao redor de seus times de futebol. O app possui duas grandes áreas funcionais:

1. **Comunidade (Fórum):** Feed de posts, comentários e curtidas segmentado por time, permitindo que torcedores interajam entre si.
2. **Modo Arena:** Durante partidas ao vivo, micro-previsões geradas por IA (Amazon Bedrock) são exibidas como pop-ups acionados por eventos reais do jogo (via pipeline DFL Feed → Kinesis → EventBridge → Lambda). Acertos geram "Pressão/Energia" para a torcida, visualizada em uma barra "Cabo de Guerra" compartilhada em tempo real via WebSocket.

Este documento organiza a implementação em **6 planos incrementais e independentes**, cada um entregando valor funcional sem quebrar o que foi construído anteriormente. O princípio central é **simplicidade**: sem over-engineering, sem abstrações prematuras.

---

## Glossary

- **App:** O aplicativo mobile Sektor (React Native + Expo).
- **Usuário:** Pessoa autenticada no App.
- **Torcedor:** Usuário que escolheu um time favorito.
- **Arena:** Modo de jogo ao vivo do App, ativado durante uma partida.
- **Partida:** Evento esportivo ao vivo com ID único (`matchId`).
- **Predição:** Pergunta de múltipla escolha gerada por IA sobre um evento iminente da partida.
- **PressureBar:** Componente visual "Cabo de Guerra" que representa a energia acumulada de cada torcida.
- **Pressão/Energia:** Pontuação coletiva gerada por acertos de predições de uma torcida.
- **Evento DFL:** Evento de jogo (gol, falta, escanteio, etc.) proveniente do feed simulado DFL.
- **Pipeline AWS:** Conjunto de serviços (Kinesis → EventBridge → Lambda → Bedrock) que processa eventos e gera predições.
- **Simulador:** Script local que emite eventos DFL simulados para o Pipeline AWS.
- **Cognito:** Serviço de autenticação AWS (Amazon Cognito).
- **Amplify:** SDK AWS Amplify usado no frontend para integração com Cognito.
- **API REST:** API Gateway REST usada para operações do fórum (posts, comentários, curtidas).
- **API WebSocket:** API Gateway WebSocket usada para comunicação em tempo real no Modo Arena.
- **DynamoDB:** Banco de dados NoSQL AWS usado para persistência de dados.
- **S3:** Serviço de armazenamento de objetos AWS usado para mídia do fórum.
- **Bedrock:** Serviço de IA generativa AWS (Amazon Bedrock) usado para gerar predições.
- **NativeWind:** Biblioteca de estilização baseada em Tailwind CSS para React Native.
- **Expo Router:** Sistema de navegação baseado em arquivos para Expo.
- **authStore:** Store Zustand responsável pelo estado de autenticação do Usuário.
- **arenaStore:** Store Zustand responsável pelo estado do Modo Arena.
- **GPS:** Módulo de geolocalização (Expo Location) usado para detectar presença física na arena.
- **AR:** Módulo de realidade aumentada mockado via câmera (Expo Camera).

---

## Requirements

---

### Requisito 1 — Plano 01: Fundação do Projeto

**User Story:** Como desenvolvedor, quero uma estrutura de pastas organizada, navegação funcional e tipos TypeScript base, para que todos os planos subsequentes possam ser implementados de forma consistente e sem retrabalho.

#### Objetivo

Estabelecer a base técnica do App: estrutura de pastas, sistema de navegação (tabs + fluxo de autenticação), tipos TypeScript compartilhados, configuração do NativeWind e telas skeleton navegáveis.

#### Dependências

Nenhuma. Este é o plano inicial.

#### Princípios de Simplicidade

- Criar apenas o que os planos seguintes vão usar — sem componentes genéricos "para o futuro".
- Telas skeleton devem ser `<View>` + `<Text>` simples, sem lógica.
- Tipos TypeScript devem cobrir apenas as entidades centrais (User, Post, Match, Prediction, PressureBar).
- NativeWind configurado uma única vez; não criar utilitários de tema customizados ainda.

#### Critérios de Aceitação

1. THE App SHALL conter a estrutura de pastas exata definida no contexto do projeto (`src/app`, `src/components/arena`, `src/components/community`, `src/components/ui`, `src/services`, `src/hooks`, `src/store`, `src/types`, `src/constants`).
2. THE App SHALL utilizar Expo Router com grupos de rotas `(auth)` (login, register) e `(tabs)` (community, arena, profile).
3. THE App SHALL exibir a tab bar com três abas: "Comunidade", "Arena" e "Perfil", cada uma navegando para sua tela skeleton correspondente.
4. THE App SHALL redirecionar automaticamente para a rota `(auth)/login` quando nenhum usuário estiver autenticado.
5. THE App SHALL conter o arquivo `src/types/index.ts` com as interfaces TypeScript: `User`, `Post`, `Comment`, `Match`, `Prediction`, `PressureBarState` e `TeamId`.
6. THE App SHALL conter o arquivo `src/constants/config.ts` com as constantes de configuração: URLs de API, região AWS e identificadores de times.
7. THE NativeWind SHALL estar configurado com o arquivo `tailwind.config.js` apontando para todos os arquivos em `src/`.
8. WHEN o App é iniciado pela primeira vez, THE App SHALL exibir a tela de login sem erros de navegação ou de tipos TypeScript.
9. IF um arquivo de rota obrigatório estiver ausente, THEN THE Expo Router SHALL lançar um erro de compilação descritivo.
10. THE App SHALL compilar sem erros TypeScript (`tsc --noEmit`) após a conclusão do Plano 01.

---

### Requisito 2 — Plano 02: Autenticação

**User Story:** Como Torcedor, quero criar uma conta, fazer login e escolher meu time favorito, para que o App personalize minha experiência e eu possa acessar as funcionalidades protegidas.

#### Objetivo

Implementar o fluxo completo de autenticação usando Amazon Cognito via AWS Amplify SDK: cadastro, login, escolha de time, persistência de sessão e proteção de rotas.

#### Dependências

- **Plano 01 concluído:** Estrutura de pastas, rotas `(auth)/login`, `(auth)/register` e `authStore` (arquivo criado, mesmo que vazio) devem existir.

#### Princípios de Simplicidade

- Usar apenas `signIn`, `signUp` e `getCurrentUser` do Amplify — sem MFA, sem social login.
- `authStore` com Zustand: apenas `user`, `isLoading`, `signIn`, `signUp`, `signOut` e `setTeam`.
- A escolha de time é salva como atributo customizado no Cognito (`custom:teamId`) — sem tabela separada no DynamoDB para isso.
- Proteção de rotas via um único componente `AuthGuard` no `_layout.tsx` raiz.

#### Critérios de Aceitação

1. WHEN um novo Usuário preenche nome, e-mail e senha válidos e confirma o cadastro, THE App SHALL criar a conta no Cognito e redirecionar para a tela de escolha de time.
2. WHEN o Usuário escolhe um time na tela de seleção, THE authStore SHALL persistir o `teamId` como atributo `custom:teamId` no Cognito e redirecionar para a tab `(tabs)/community`.
3. WHEN um Usuário existente insere e-mail e senha corretos, THE App SHALL autenticar via Cognito e redirecionar para `(tabs)/community`.
4. IF o Usuário inserir credenciais inválidas, THEN THE App SHALL exibir uma mensagem de erro legível abaixo do formulário sem travar a interface.
5. WHILE uma requisição de autenticação estiver em andamento, THE App SHALL exibir um indicador de carregamento e desabilitar os botões do formulário.
6. WHEN o App é reiniciado com uma sessão Cognito válida, THE App SHALL restaurar o estado do Usuário no authStore e redirecionar diretamente para `(tabs)/community` sem exibir a tela de login.
7. WHEN o Usuário aciona o botão "Sair", THE authStore SHALL chamar `signOut` do Amplify, limpar o estado local e redirecionar para `(auth)/login`.
8. IF uma rota protegida for acessada sem autenticação, THEN THE AuthGuard SHALL redirecionar para `(auth)/login`.
9. THE authStore SHALL expor `user.teamId` para que outros planos possam filtrar conteúdo por time.
10. THE App SHALL compilar sem erros TypeScript após a conclusão do Plano 02.

---

### Requisito 3 — Plano 03: Modo Arena (Core)

**User Story:** Como Torcedor, quero participar de micro-predições durante uma partida ao vivo e ver a energia da minha torcida crescer em tempo real, para que eu me sinta conectado aos outros torcedores do meu time.

#### Objetivo

Implementar o núcleo do Modo Arena: conexão WebSocket, exibição da PressureBar, pop-up de predição (`PredictionCard`), lógica de resposta e atualização do `arenaStore`. O fluxo deve funcionar de ponta a ponta com dados mockados antes do Plano 04.

#### Dependências

- **Plano 01 concluído:** Rota `arena/[matchId].tsx` e tipos `Match`, `Prediction`, `PressureBarState` devem existir.
- **Plano 02 concluído:** `authStore.user.teamId` deve estar disponível para identificar a torcida do Usuário.

#### Princípios de Simplicidade

- `useWebSocket` é um hook simples com `connect`, `disconnect` e `onMessage` — sem reconexão automática complexa (apenas uma tentativa de reconexão após 3 segundos).
- `arenaStore` com Zustand: apenas `match`, `pressureBar`, `activePrediction`, `submitAnswer` e `updatePressure`.
- `PredictionCard` é um modal simples com pergunta, opções e timer de 15 segundos — sem animações complexas inicialmente.
- A PressureBar é um componente de barra horizontal com dois lados coloridos (cor do time A vs. time B) — sem física ou animações avançadas.
- Dados mockados em `src/services/matchSimulator.ts` para testar o fluxo sem o Plano 04.

#### Critérios de Aceitação

1. WHEN o Usuário navega para `arena/[matchId]`, THE App SHALL estabelecer uma conexão WebSocket com a URL configurada em `config.ts` passando o `matchId` como parâmetro.
2. WHEN a conexão WebSocket é estabelecida, THE arenaStore SHALL atualizar o estado `match` com os dados da partida recebidos na mensagem de boas-vindas.
3. WHEN uma mensagem WebSocket do tipo `PREDICTION` é recebida, THE App SHALL exibir o `PredictionCard` como modal sobre a tela da Arena.
4. WHILE o `PredictionCard` estiver visível, THE PredictionCard SHALL exibir um timer regressivo de 15 segundos.
5. WHEN o Usuário seleciona uma opção no `PredictionCard`, THE App SHALL enviar a resposta via WebSocket e fechar o modal imediatamente.
6. IF o timer do `PredictionCard` chegar a zero sem resposta, THEN THE PredictionCard SHALL fechar automaticamente sem enviar resposta.
7. WHEN uma mensagem WebSocket do tipo `PRESSURE_UPDATE` é recebida, THE arenaStore SHALL atualizar `pressureBar` com os novos valores de pressão de cada time.
8. WHEN `pressureBar` é atualizado no arenaStore, THE PressureBar SHALL re-renderizar refletindo a nova proporção entre os dois times.
9. IF a conexão WebSocket for perdida, THEN THE App SHALL exibir um indicador de "Reconectando..." e tentar reconectar após 3 segundos.
10. WHEN o Usuário sai da tela da Arena, THE App SHALL fechar a conexão WebSocket e limpar o estado do arenaStore.
11. THE arenaStore SHALL funcionar corretamente com dados mockados do `matchSimulator` antes da integração com o Plano 04.
12. THE App SHALL compilar sem erros TypeScript após a conclusão do Plano 03.

---

### Requisito 4 — Plano 04: Simulador DFL + Pipeline AWS

**User Story:** Como desenvolvedor, quero um simulador de eventos de jogo e um pipeline AWS funcional, para que o Modo Arena receba predições reais geradas por IA a partir de eventos simulados de uma partida.

#### Objetivo

Implementar o script simulador local de eventos DFL, a integração com o Pipeline AWS (Kinesis → EventBridge → Lambda → Bedrock) e a geração de perguntas de predição via Amazon Bedrock. O resultado final é que eventos simulados disparem predições reais no Modo Arena do Plano 03.

#### Dependências

- **Plano 03 concluído:** O Modo Arena deve estar funcional com dados mockados. O Pipeline AWS deve publicar mensagens no mesmo formato que o `matchSimulator` do Plano 03 usa.
- **Infraestrutura AWS:** Stream Kinesis, regras EventBridge, funções Lambda e acesso ao Bedrock devem estar provisionados (fora do escopo deste plano, mas pré-requisito de execução).

#### Princípios de Simplicidade

- O Simulador é um script Node.js standalone (`scripts/simulate-match.ts`) — não faz parte do App.
- O Simulador emite apenas 5 tipos de eventos: `GOAL`, `YELLOW_CARD`, `CORNER`, `FOUL`, `MATCH_START`.
- A Lambda de geração de predições usa um prompt fixo e simples para o Bedrock — sem engenharia de prompt complexa.
- A Lambda de distribuição envia a predição gerada diretamente para a conexão WebSocket via API Gateway WebSocket `@connections`.
- Sem filas de retry complexas: se o Bedrock falhar, a Lambda loga o erro e descarta o evento.

#### Critérios de Aceitação

1. THE Simulador SHALL emitir eventos no formato `{ matchId, eventType, timestamp, teamId, minute }` para o stream Kinesis configurado.
2. WHEN o Simulador emite um evento, THE Pipeline AWS SHALL processar o evento em menos de 10 segundos até a entrega da predição ao cliente WebSocket.
3. WHEN um evento DFL é recebido pelo EventBridge, THE Lambda de Predição SHALL invocar o Amazon Bedrock com um prompt contendo o tipo de evento e o contexto da partida.
4. WHEN o Bedrock retorna uma predição válida, THE Lambda de Predição SHALL formatar a resposta como `{ type: "PREDICTION", question, options: string[], correctOption, expiresAt }`.
5. IF o Bedrock retornar um erro ou resposta malformada, THEN THE Lambda de Predição SHALL registrar o erro no CloudWatch e encerrar o processamento sem propagar a falha.
6. WHEN uma predição é gerada, THE Lambda de Distribuição SHALL enviar a mensagem para todas as conexões WebSocket ativas da partida via API Gateway `@connections`.
7. WHEN o resultado de uma predição é conhecido (evento de confirmação do jogo), THE Lambda de Resultado SHALL calcular o delta de Pressão/Energia e enviar uma mensagem `PRESSURE_UPDATE` para todas as conexões ativas.
8. THE Simulador SHALL aceitar `matchId` e `durationMinutes` como argumentos de linha de comando.
9. WHEN executado, THE Simulador SHALL emitir eventos em intervalos aleatórios entre 10 e 30 segundos para simular o ritmo de uma partida.
10. THE Pipeline AWS SHALL processar os 5 tipos de eventos do Simulador sem erros de configuração (verificado via logs do CloudWatch).

---

### Requisito 5 — Plano 05: Comunidade (Fórum)

**User Story:** Como Torcedor, quero criar posts, comentar e curtir publicações de outros torcedores do meu time, para que eu possa interagir com a comunidade mesmo fora de uma partida ao vivo.

#### Objetivo

Implementar o fórum da Comunidade: feed de posts filtrado por time, criação de post com upload de mídia para S3, sistema de curtidas e comentários via API REST.

#### Dependências

- **Plano 01 concluído:** Rota `(tabs)/community.tsx`, tipos `Post` e `Comment`, e hook `useCommunity` (arquivo criado) devem existir.
- **Plano 02 concluído:** `authStore.user` (com `teamId` e token Cognito) deve estar disponível para autenticar requisições à API REST e filtrar o feed por time.

#### Princípios de Simplicidade

- `useCommunity` encapsula toda a lógica de fetch — a tela `community.tsx` apenas consome o hook.
- Upload de mídia: gerar URL pré-assinada S3 via Lambda, fazer upload direto do cliente — sem proxy de mídia.
- Paginação simples com cursor (`lastKey` do DynamoDB) — sem paginação por offset ou bibliotecas externas.
- Curtidas são otimistas: atualizar o estado local imediatamente, reverter em caso de erro da API.
- Sem editor de rich text: posts são texto simples + uma imagem opcional.

#### Critérios de Aceitação

1. WHEN o Usuário acessa a aba "Comunidade", THE App SHALL exibir um feed de posts filtrado pelo `teamId` do Usuário autenticado, ordenado por data de criação decrescente.
2. WHEN o feed é carregado, THE App SHALL exibir no máximo 20 posts por página e um botão "Carregar mais" ao final da lista.
3. WHEN o Usuário aciona "Carregar mais", THE App SHALL buscar a próxima página usando o cursor `lastKey` retornado pela API REST.
4. WHEN o Usuário aciona o botão de criar post, THE App SHALL exibir um formulário com campo de texto (obrigatório) e opção de anexar uma imagem (opcional).
5. WHEN o Usuário submete um post com imagem, THE App SHALL obter uma URL pré-assinada S3 via API REST, fazer upload da imagem diretamente para o S3 e então criar o post com a URL da imagem.
6. IF o upload da imagem falhar, THEN THE App SHALL exibir uma mensagem de erro e permitir que o Usuário tente novamente sem perder o texto digitado.
7. WHEN o Usuário aciona o ícone de curtida em um post, THE App SHALL atualizar o contador de curtidas imediatamente na interface e enviar a requisição para a API REST em segundo plano.
8. IF a requisição de curtida falhar, THEN THE App SHALL reverter o contador de curtidas ao valor anterior e exibir uma notificação de erro discreta.
9. WHEN o Usuário aciona "Ver comentários" em um post, THE App SHALL exibir os comentários do post em uma lista abaixo do post ou em uma tela dedicada.
10. WHEN o Usuário submete um comentário, THE App SHALL enviar o comentário via API REST e exibi-lo imediatamente na lista sem recarregar o feed completo.
11. THE App SHALL exibir nome do autor, avatar (inicial do nome), texto, imagem (se houver), contagem de curtidas e data relativa em cada card de post.
12. THE App SHALL compilar sem erros TypeScript após a conclusão do Plano 05.

---

### Requisito 6 — Plano 06: GPS, AR e Polimento

**User Story:** Como Torcedor presente fisicamente na arena, quero receber um multiplicador de energia e ver elementos de AR na câmera, para que minha presença física seja recompensada e a experiência seja mais imersiva.

#### Objetivo

Adicionar o multiplicador de Pressão/Energia baseado em geolocalização (GPS), o mockup de AR via câmera, ajustes finais de UX e aplicação do tema visual Sektor em todo o App.

#### Dependências

- **Plano 01 concluído:** Estrutura de pastas e configuração NativeWind devem estar prontos para receber o tema visual.
- **Plano 02 concluído:** `authStore.user` deve estar disponível para associar o multiplicador GPS ao Usuário.
- **Plano 03 concluído:** `arenaStore` e `PressureBar` devem estar funcionais para receber o multiplicador de energia.
- **Plano 04 concluído:** O Pipeline AWS deve estar enviando `PRESSURE_UPDATE` para que o multiplicador GPS tenha efeito real.
- **Plano 05 concluído:** O fórum deve estar funcional para receber o polimento visual final.

#### Princípios de Simplicidade

- GPS: comparar coordenadas do Usuário com um raio fixo de 500 metros ao redor das coordenadas do estádio (hardcoded em `config.ts`) — sem geofencing dinâmico.
- O multiplicador GPS é aplicado localmente no `arenaStore` antes de enviar a resposta de predição — sem lógica de validação no servidor.
- AR: exibir a câmera como fundo com um overlay SVG simples (escudo do time + barra de energia) — sem bibliotecas de AR reais.
- Polimento visual: aplicar paleta de cores, tipografia e espaçamentos do tema Sektor via NativeWind — sem criar um design system completo.
- Sem testes de performance ou otimizações de bundle neste plano.

#### Critérios de Aceitação

1. WHEN o Usuário acessa o Modo Arena, THE App SHALL solicitar permissão de localização usando Expo Location.
2. WHEN a permissão de localização é concedida, THE App SHALL verificar se as coordenadas do Usuário estão dentro de um raio de 500 metros das coordenadas do estádio configuradas em `config.ts`.
3. WHILE o Usuário estiver dentro do raio do estádio, THE arenaStore SHALL aplicar um multiplicador de 2x ao valor de Pressão/Energia gerado por cada predição correta do Usuário.
4. WHILE o Usuário estiver fora do raio do estádio, THE arenaStore SHALL aplicar o multiplicador padrão de 1x.
5. IF a permissão de localização for negada, THEN THE App SHALL continuar funcionando normalmente com multiplicador 1x, sem exibir erros.
6. WHEN o Usuário aciona o botão "Modo AR" na tela da Arena, THE App SHALL solicitar permissão de câmera usando Expo Camera.
7. WHEN a permissão de câmera é concedida, THE App SHALL exibir o feed da câmera como fundo com um overlay contendo o escudo do time do Usuário e a PressureBar em formato compacto.
8. IF a permissão de câmera for negada, THEN THE App SHALL exibir uma mensagem informativa e retornar à tela normal da Arena.
9. THE App SHALL aplicar a paleta de cores do tema Sektor (cores primárias, secundárias e de fundo) em todas as telas via classes NativeWind.
10. THE App SHALL exibir transições de tela suaves usando `react-native-reanimated` nas navegações principais (login → tabs, arena → AR).
11. THE App SHALL exibir um badge "📍 Na Arena" visível na tela do Modo Arena enquanto o multiplicador GPS de 2x estiver ativo.
12. THE App SHALL compilar sem erros TypeScript após a conclusão do Plano 06.

---

## Matriz de Dependências entre Planos

| Plano | Depende de | Entrega para |
|-------|-----------|--------------|
| Plano 01 — Fundação | — | Todos os planos |
| Plano 02 — Autenticação | Plano 01 | Planos 03, 05, 06 |
| Plano 03 — Modo Arena (Core) | Planos 01, 02 | Planos 04, 06 |
| Plano 04 — Simulador + Pipeline | Plano 03 | Plano 06 |
| Plano 05 — Comunidade | Planos 01, 02 | Plano 06 |
| Plano 06 — GPS, AR e Polimento | Planos 01, 02, 03, 04, 05 | — |

## Ordem de Implementação Recomendada

```
Plano 01 → Plano 02 → Plano 03 → Plano 04
                                         ↘
                    Plano 05 ─────────────→ Plano 06
```

Os Planos 04 e 05 podem ser desenvolvidos em paralelo após a conclusão do Plano 03.
