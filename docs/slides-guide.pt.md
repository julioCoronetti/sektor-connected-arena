# Guia de Slides — executive_summary.pdf

**Máximo:** 5 slides | **Formato:** PDF (exportar do PowerPoint/Canva/Google Slides)
**Paleta:** Fundo #0F0F0F, Destaque #CC0000, Texto #F5F5F5, Secundário #888888

---

## Slide 1 — Visão North Star

**Título:** Sektor: O Ecossistema Conectado de Torcidas

**Conteúdo visual (diagrama horizontal):**

```
[📱 Mobile]  ←→  [🌐 Watch Party Web]  ←→  [🏟️ Estádio AR]
      ↕                    ↕                       ↕
[⌚ Wearable]  ←→  [🔔 Notificações]  ←→  [🛍️ Varejo]
                          ↕
              [☁️ AWS Real-Time Core]
         Kinesis · Bedrock · WebSocket · DynamoDB
```

**Texto de apoio (pequeno, rodapé):**
> "Fãs engajados antes, durante e depois dos 90 minutos — em qualquer tela, em qualquer lugar."

**Nota de design:** Usar ícones grandes, setas bidirecionais, fundo escuro. Destaque em vermelho no "AWS Real-Time Core".

---

## Slide 2 — O Produto

**Título:** Sektor em Ação

**Layout:** 3 colunas

| 🏟️ Modo Arena | 💬 Comunidade | 🏆 Gamificação |
|---|---|---|
| Predições ao vivo geradas por IA | Fórum por time | Leaderboard ao vivo |
| Barra de Pressão (cabo de guerra) | Posts + imagens + curtidas | Streaks 🔥 + Badges |
| Multiplicador GPS 2x | Sentiment alert em tempo real | Score por acerto |
| Watch Party Web (telão) | Feed personalizado por torcida | Ranking semanal |

**Screenshot:** Colocar 2-3 screenshots do app (Arena + Leaderboard + Community) no lado direito do slide.

---

## Slide 3 — Arquitetura AWS

**Título:** Construído na AWS

**Conteúdo:** Inserir o `architecture.png` gerado pelo draw.io (ver arquivo separado).

**Legenda abaixo da imagem:**

| Serviço | Uso |
|---------|-----|
| Amazon Kinesis | Ingestão do feed DFL em tempo real |
| Amazon Bedrock (Nova Lite) | Geração de predições + análise de sentimento |
| API Gateway WebSocket | Canal bidirecional para todos os fãs |
| API Gateway REST | Fórum (posts, likes, comentários, leaderboard) |
| Amazon DynamoDB | Estado da partida, scores, conexões, posts |
| Amazon Cognito | Autenticação + perfil do fã |
| EventBridge Scheduler | Resolução automática de predições + sentiment |
| Amazon S3 | Feed DFL (XML) + mídia do fórum |

---

## Slide 4 — Gamificação & IA

**Título:** Por que Fãs Voltam

**Layout:** 2 colunas

**Coluna esquerda — Loop de Engajamento:**
```
Evento em campo (gol, falta)
        ↓
Bedrock gera predição personalizada
        ↓
Fã responde em 15s
        ↓
Acerto → Pontos + Streak + Badge
        ↓
Leaderboard atualiza ao vivo
        ↓
Pressão da torcida sobe
        ↓
Próximo evento...
```

**Coluna direita — Mecânicas:**
- 🎯 Score por acerto (10pts base, 20pts com GPS)
- 🔥 Streaks: sequências de acertos consecutivos
- 🏅 7 badges desbloqueáveis
- 📊 Leaderboard ao vivo por partida
- 💬 Sentiment da torcida via Bedrock
- 📍 Multiplicador 2x para fãs no estádio

---

## Slide 5 — Resultados & Próximos Passos

**Título:** O que Construímos e Para Onde Vamos

**Seção "Construído" (lado esquerdo):**
- ✅ Multiplayer real: WebSocket com N usuários simultâneos
- ✅ Pipeline DFL real: S3 → Kinesis → Bedrock → WS em <2s
- ✅ 5 mecânicas de gamificação
- ✅ IA personalizada por torcida (2 variantes por evento)
- ✅ Watch Party Web (touchpoint extra)
- ✅ AR via câmera + GPS multiplicador

**Seção "Aprendizados" (lado direito):**
- SCP da org bloqueia Anthropic → migrado para Amazon Nova Lite
- Feed DFL é anonimizado → times como "FC Team" e "Club"
- WebSocket + Scheduler = resolução automática sem polling

**Seção "North Star" (rodapé, destaque vermelho):**
> Próximo: notificações push pré-jogo, wearable companion, ativações baseadas em localização no estádio, ligas semanais entre torcidas.

---

## Dicas de Design

- Fundo: `#0F0F0F` (preto Sektor)
- Títulos: branco `#F5F5F5`, bold, 28-32pt
- Destaques: vermelho `#CC0000`
- Texto corpo: cinza `#888888`, 14-16pt
- Screenshots: bordas arredondadas, sombra sutil
- Não usar mais de 3 cores por slide
- Exportar como PDF antes de zipar
