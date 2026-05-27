# Roteiro — presentation_video.mp4

**Duração total:** ≤ 3 minutos | **Resolução:** 720p ou menor | **Ferramenta:** OBS / Quicktime / Loom

---

## Preparação antes de gravar

1. Abrir app no simulador Android/iOS (ou device físico)
2. Abrir Watch Party no browser: `https://vzgv26s18d.execute-api.us-east-1.amazonaws.com/prod` → navegar para `/watch-party/match-001` (após build web)
3. Ter 2 contas prontas: `fan-a` (team-a) e `fan-b` (team-b)
4. Simulador pronto para rodar: `npm run simulate match-001 3`

---

## Cenas

### 0:00 – 0:20 | Pitch (voz + slide ou tela preta com texto)

> "Fãs de futebol não querem só assistir. Querem participar, competir e sentir que fazem diferença no jogo. O Sektor transforma cada evento em campo em um momento de engajamento coletivo em tempo real."

**Tela:** Logo Sektor ou slide de abertura.

---

### 0:20 – 0:45 | Login + Seleção de Time

**Ações na tela:**
1. Abrir app → tela de login
2. Entrar com `fan-a@test.com`
3. Mostrar seleção de time (FC Team)
4. Chegar na tela Home (Community)

**Fala:**
> "Cada fã escolhe seu time. A partir daí, tudo é personalizado — o fórum, as predições, a barra de pressão."

---

### 0:45 – 1:30 | Modo Arena — Predição ao Vivo

**Ações na tela:**
1. Tocar em "Arena" → "Entrar na Partida Demo"
2. Mostrar tela da Arena: placar, barra de pressão, status "Ao vivo"
3. Em outro terminal (fora da gravação): `npm run simulate match-001 3`
4. Aguardar ~5s → PredictionCard aparece com pergunta gerada pelo Bedrock
5. Responder uma opção
6. Mostrar ANSWER_ACCEPTED + score subindo
7. Após 15s: PREDICTION_RESULT + PRESSURE_UPDATE animando a barra

**Fala:**
> "Quando um gol ou falta acontece, o Bedrock gera uma predição instantânea personalizada para a torcida. O fã responde em 15 segundos. Acertou? Pontos e pressão para o time."

---

### 1:30 – 2:00 | Multiplayer — 2 Torcidas Simultâneas

**Ações na tela:**
1. Split screen ou corte rápido: device A (FC Team) e device B (Club) lado a lado
2. Mostrar que cada um recebe uma pergunta diferente (personalização por torcida)
3. Mostrar leaderboard atualizando com os dois usuários

**Fala:**
> "Dois fãs, dois times, duas perspectivas. As predições são personalizadas por torcida. O leaderboard ao vivo mostra quem está dominando."

---

### 2:00 – 2:20 | Watch Party Web + GPS

**Ações na tela:**
1. Mostrar browser com Watch Party: placar grande, barra de pressão, top 5
2. Mostrar badge GPS "📍 Na Arena 2x" no app (simular GPS dentro do estádio)
3. Mostrar streak 🔥 e badge desbloqueado

**Fala:**
> "A Watch Party roda no browser — perfeita para telão em bares e estádios. Fãs presenciais ganham multiplicador 2x. Sequências de acertos desbloqueiam conquistas."

---

### 2:20 – 2:40 | AR + Comunidade

**Ações na tela:**
1. Tocar no botão "Modo AR" → câmera abre com overlay da barra de pressão
2. Corte rápido para aba Community: feed de posts do time, criar post

**Fala:**
> "No modo AR, a barra de pressão aparece sobre a câmera — pronto para o estádio. Entre os jogos, a comunidade mantém o engajamento vivo."

---

### 2:40 – 3:00 | North Star + Encerramento

**Tela:** Slide do ecossistema (mobile + web + AR + wearable + estádio)

**Fala:**
> "O Sektor é um ecossistema. Mobile, web, AR, wearables, estádio — tudo conectado, tudo em tempo real. Construído sobre AWS: Kinesis, Bedrock, API Gateway WebSocket, DynamoDB. Obrigado."

---

## Dicas de gravação

- Gravar em 1280x720 ou 960x540 (abaixo de 720p conforme regra do challenge)
- Usar OBS com cena "Tela + Webcam pequena" ou só tela
- Não precisa de edição — gravação contínua é aceita
- Se travar: pausar OBS, retomar, cortar no editor depois
- Fundo do app já é escuro (#0F0F0F) — fica bem em qualquer gravação
