# Serviços

### Frontend (Mobile)

- **React Native com Expo:** Framework principal para desenvolvimento do aplicativo móvel nativo (iOS e Android).
- **NativeWind (Tailwind para React Native):** Estilização das interfaces.
- **Expo Router:** Gerenciamento de navegação entre as telas (Feed da comunidade, Modo Arena, Perfil).

### Autenticação e Usuários

- **Amazon Cognito:** Gerenciamento de login, cadastro e sessão dos usuários, associando cada torcedor ao seu respectivo time.

### Backend e Tempo Real

- **Amazon API Gateway (REST):** Gerenciamento das requisições HTTP padrão para a área de comunidade (carregar posts, curtir, comentar).
- **Amazon API Gateway (WebSocket):** Manutenção das conexões bidirecionais em tempo real durante o Modo Arena para envio de perguntas e atualização da barra de pressão simultaneamente.
- **AWS Lambda:** Execução de regras de negócio (processamento de palpites, cálculo de multiplicadores, atualização de pontuação).

### Banco de Dados e Storage

- **Amazon DynamoDB:** Armazenamento de dados NoSQL (perfis de usuários, posts da comunidade, estado atual da barra de pressão e controle de conexões WebSocket ativas).
- **Amazon S3:** Armazenamento de arquivos de mídia (fotos de perfil e imagens/vídeos postados na comunidade).

### Pipeline de Dados do Jogo

- **Amazon Kinesis (pode ser simulado):** Ingestão em tempo real dos dados recebidos do DFL Live Match Event Feed.
- **AWS Lambda / Script local (pode ser simulada):** Leitura de um arquivo JSON com o histórico da partida para emissão sequencial de eventos no Kinesis, simulando o jogo ao vivo.
- **Amazon EventBridge:** Roteamento dos eventos da partida para acionar os Lambdas específicos (ex: evento de falta aciona a IA para criar uma pergunta).

### Inteligência Artificial e Personalização

- **Amazon Bedrock (Claude / Llama):**
    - Geração de perguntas de predição contextuais com base no evento recém-ocorrido na partida.
    - Análise de sentimento do chat da torcida para gerar alertas de texto no aplicativo.

### Geolocalização e Experiência Espacial (AR)

- **Expo Location (pode ser simulada):** Coleta de coordenadas GPS do aparelho para validar o check-in do usuário no estádio e aplicar o multiplicador de pontos (2x) na barra de pressão da torcida.
- **Expo Camera / ViroReact (pode ser simulada):** Acesso à câmera do celular e renderização de elementos de Realidade Aumentada (AR) para projetar os dados da barra de energia e placar de torcidas sobre a imagem do campo.