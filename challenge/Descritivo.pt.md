# Descritivo

# Documento de Especificação: Sektor

## 1. Visão Geral

Aplicativo mobile que atua como hub oficial de torcidas. Fora do horário das partidas, funciona como um fórum (rede social). Durante os jogos, a interface muda para o "Modo Arena", onde os torcedores competem em tempo real (Torcida A vs Torcida B) resolvendo micro-previsões geradas a partir de eventos reais do jogo. Os acertos geram "Pressão/Energia" para a torcida em um placar global.

## 2. Funcionalidades Principais

- **Comunidade (Fórum):** Feed de postagens, comentários e curtidas segmentado pelo time escolhido.
- **Modo Arena (Tempo Real):** Pop-ups de previsão de eventos acionados pelo andamento da partida.
- **Barra de Pressão Compartilhada:** Placar visual ao vivo em formato "Cabo de Guerra" que reage matematicamente aos acertos de cada torcida.
- **Geolocalização / Multiplicador (pode ser simulada):** Validação de presença no estádio para aplicar peso extra (ex: 2x) na pontuação da "Pressão".
- **Visão AR (pode ser simulada):** Uso da câmera do dispositivo para projetar a "Barra de Pressão" virtualmente sobre o campo.

## 3. Stack Tecnológica e Ferramentas

### Interface e Mobile (Frontend)

- **React Native + Expo:** Criação do aplicativo mobile (iOS e Android). Acesso nativo à câmera e GPS.
- **NativeWind:** Biblioteca para estilização de componentes.
- **AWS Amplify (SDK):** Biblioteca integrada ao código React Native para realizar a comunicação direta com a infraestrutura da AWS.

### Autenticação

- **Amazon Cognito:** Sistema de cadastro, login e armazenamento do atributo base do usuário (Time escolhido).

### Backend e Tempo Real

- **Amazon API Gateway (REST):** Requisições assíncronas para o fórum (ler posts, enviar mídia, curtir).
- **Amazon API Gateway (WebSocket):** Canal de comunicação bidirecional aberto durante o Modo Arena para envio das perguntas e atualização da barra de pressão simultaneamente para todos os usuários.
- **AWS Lambda:** Execução de rotinas no servidor. Processa acertos/erros de predições, calcula multiplicadores de geolocalização e envia a atualização do estado do jogo para o WebSocket.

### Banco de Dados e Storage

- **Amazon DynamoDB:** Armazenamento das tabelas: Usuários, Posts (Fórum), Estado atual da Partida (Pressão A x B) e Conexões Ativas do WebSocket.
- **Amazon S3:** Armazenamento de imagens de perfil e arquivos anexados no fórum.

### Pipeline de Dados da Partida (DFL Feed)

- **Script Local em Node/Python (Simulador):** Lê um arquivo JSON (DFL Live Match Mock) e emite os eventos com base nos timestamps.
- **Amazon Kinesis (pode ser simulada):** Recebe o fluxo contínuo de dados da partida.
- **Amazon EventBridge:** Escuta os eventos específicos do Kinesis (ex: "Falta Perigosa", "Cartão") e aciona os Lambdas correspondentes.

### Inteligência Artificial

- **Amazon Bedrock (Claude/Llama):**
    1. Recebe o contexto de um evento (via Lambda) e gera um JSON contendo uma pergunta múltipla escolha instantânea.
    2. Lê mensagens recentes do chat para gerar um alerta de sentimento (ex: "Torcida do time A está confiante").

### Integração Física (Espacial)

- **Expo Location (pode ser simulada):** Captura lat/long do dispositivo.
- **Expo Camera / ViroReact (pode ser simulada):** Renderização de camadas visuais AR em cima da captura da câmera.

## 4. Fluxo de Execução do Modo Arena (Exemplo)

1. O usuário entra no "Modo Arena". Uma conexão persistente é aberta no **API Gateway (WebSocket)**.
2. O simulador envia um evento ("Time A teve um escanteio") para o **Kinesis**.
3. O **EventBridge** captura o evento e invoca um **Lambda**.
4. O Lambda consulta o **Bedrock**: *"Gere uma pergunta de previsão rápida sobre um escanteio"* e recebe a resposta.
5. O Lambda envia a pergunta via **WebSocket** para as telas de todos os usuários conectados simultaneamente.
6. Usuário clica em uma resposta. O frontend envia a escolha e as coordenadas de GPS.
7. Um Lambda calcula: Acertou? Está na área do estádio? (Se sim, multiplica por 2).
8. Lambda atualiza a tabela de Pontuação no **DynamoDB** e devolve o novo valor da "Barra de Pressão" via **WebSocket**.
9. A tela de todos os dispositivos é atualizada.

## 5. Mapeamento de Requisitos do Desafio

- **Multiplayer / Real-time:** Sim (WebSockets via API Gateway).
- **Dados ao vivo DFL:** Sim (Ingestão via Kinesis simulado/EventBridge).
- **Gamificação:** Sim (Barra de Pressão massiva, pontuação de torcida e multiplicador de check-in).
- **IA/Personalização:** Sim (Bedrock gerando predições baseadas nos eventos e resumo de sentimentos).
- **Espacial / Cross-platform:** Sim (Validação de GPS e Mockup funcional em AR via Câmera).