# Challenge

CONNECTED ARENA: Um Ecossistema de Engajamento de Fãs Multijogador em Tempo Real

## 1. Título do Desafio

Connected Arena: Construindo um Ecossistema de Engajamento de Fãs Multijogador em Tempo Real

## 2. Nível (Dificuldade / Especialização Necessária)

Nível 400 (Avançado) — voltado a participantes com habilidades em:

- Desenvolvimento full-stack
- Processamento de eventos em tempo real
- Multijogador e gerenciamento de estado sincronizado
- IA generativa + personalização
- Computação espacial (AR/VR/MR) (um diferencial)

## 3. Contexto de Fundo / Visão North Star

O fandom esportivo está evoluindo de uma experiência de espectador passivo para conexões interativas e sempre ativas — em que fãs esperam participar, co-criar e se conectar de forma fluida. Nesse novo cenário, a lealdade deixa de ser apenas transacional — passa a ser experiencial, emocional e continuamente moldada pelos momentos que fãs vivem e compartilham.

O fã moderno não apenas assiste a uma partida — ele prevê resultados com amigos, compete em desafios em tempo real, desbloqueia recompensas pelo seu conhecimento e leva essas experiências do celular para a sala e para o estádio.

A adidas imagina um futuro em que fãs interagem por meio de um ecossistema digital conectado — interfaces mobile, web e espaciais, ambientes de estádio e pontos de contato no varejo. Fãs esperam uma identidade persistente, interatividade em tempo real e experiências aprimoradas por IA que tornem cada momento do jogo mais significativo.

## 4. O Desafio

Projetar e construir um protótipo funcional de uma experiência de engajamento de fãs multijogador em tempo real que transforme a forma como grupos de fãs interagem com dados ao vivo da partida — e entre si.

Sua solução deve permitir que múltiplos usuários simultâneos participem de uma experiência compartilhada e sincronizada, impulsionada por eventos ao vivo da partida (gols, mudanças de posse, cartões, finalizações no gol etc.). Ela deve parecer uma camada social, competitiva e recompensadora sobre a transmissão ao vivo.

Especificamente, sua experiência deve contemplar:

- **MULTIJOGADOR** — Como os fãs jogam, competem ou colaboram juntos em tempo real? Pense além do consumo individual. Projete para grupos: squads de amigos, setores do estádio, comunidades globais de fãs. Estado compartilhado, interações ao vivo e dinâmicas sociais são essenciais.
- **DADOS EM TEMPO REAL** — Como os dados ao vivo da partida impulsionam a experiência no momento? Eventos em campo devem acionar momentos no app — desafios sendo liberados, placares/leaderboards mudando, previsões sendo resolvidas, recompensas sendo distribuídas. A experiência deve parecer viva e reativa ao que acontece.
- **GAMIFICAÇÃO** — Como tornar o engajamento “grudento”, recompensador e progressivamente mais significativo? Considere pontos/pontuação, sequências (streaks), conquistas/badges, recompensas por níveis, rankings de acerto em previsões, ligas semanais/por temporada e conteúdo desbloqueável. Fãs devem ter um motivo para voltar a cada dia de jogo.
- **PONTOS DE CONTATO ESPACIAIS / MULTIPLATAFORMA (North Star)** — Como essa experiência pode ir além de uma única tela? Descreva (e, quando possível, prototype) como seu conceito pode se estender para experiências espaciais — sobreposições em AR no estádio, telas compartilhadas em watch parties, modos de segunda tela como companheiro, ou ativações baseadas em localização. A visão north star é um ecossistema conectado em que fãs engajam em ambientes mobile, web, wearables e físicos.

Você é livre para escolher o formato específico da experiência — um jogo de previsões em tempo real, uma sala colaborativa de análise da partida, uma camada competitiva de fantasy, uma experiência social em AR no estádio ou algo totalmente novo. O requisito central é que seja multijogador, alimentado por dados ao vivo e projetado para engajamento contínuo por meio de gamificação.

## 5. Dados & Recursos Disponíveis

- **DFL Live Match Event Feed** — Eventos em tempo real da partida, incluindo gols, assistências, cartões, substituições, % de posse, finalizações, escanteios e timestamps.
- **Dados Mock de Preferências do Usuário** — Perfis simulados de fãs
- **Conta AWS Totalmente Provisionada** — Acesso completo incluindo:
    - Tempo real & Multijogador: Kinesis, EventBridge, Lambda, API Gateway (REST/WebSockets)
    - Computação & lógica: Lambda, API Gateway (incluindo APIs WebSocket)
    - GenAI & Personalização: Bedrock (Claude, Llama), SageMaker
    - Armazenamento & dados: DynamoDB, RDS, S3
    - Front-end & hospedagem: Amplify, S3 + CloudFront
    - Notificações & continuidade multi-touchpoint: SNS, SES
    - Mídia & visão: Rekognition, Bedrock, Transcribe
    - Social & interativo: DynamoDB, Lambda, API Gateway, Comprehend

## 6. Objetivos / O que os Participantes Devem Almejar Criar

1. Um protótipo multijogador funcional em que 2+ usuários possam engajar simultaneamente em uma experiência compartilhada, impulsionada por dados ao vivo da partida (via WebSocket, pub/sub ou equivalente de sincronização em tempo real)
2. Um pipeline de eventos em tempo real que ingira dados de partidas da DFL e traduza eventos em campo em gatilhos dentro do app (por exemplo, um gol dispara um desafio de previsão, altera um leaderboard ou desbloqueia uma recompensa)
3. Um sistema de gamificação com pelo menos dois dos seguintes itens: pontos/pontuação, leaderboards, conquistas/badges, streaks, recompensas por níveis ou mecânicas de progressão
4. Uma camada de personalização ou IA que adapte conteúdo, desafios ou recomendações para perfis individuais de fãs (usando Amazon Bedrock)
5. Uma articulação de conceito espacial/multiplataforma — mesmo que não esteja totalmente construída, descreva claramente e faça mockups de como a experiência se estende para pelo menos um touchpoint adicional (AR no estádio, modo em telão compartilhado, notificação em wearable, ativação baseada em localização)
6. Um slide de visão north star mostrando como essa experiência se encaixa em um ecossistema conectado de fãs, abrangendo dia de jogo, meio de semana e ambientes físicos e digitais

## 7. Critérios de Avaliação

- **Profundidade Multijogador** — A experiência é genuinamente multiusuário? Participantes influenciam a experiência uns dos outros? O estado compartilhado é tratado de forma elegante em tempo real?
- **Integração de Dados em Tempo Real** — Quão bem os dados ao vivo da partida conduzem a experiência? O app parece vivo e reativo aos eventos em campo?
- **Gamificação & Retenção** — O loop de engajamento é convincente? Fãs voltariam a cada rodada/dia de jogo? A progressão é significativa?
- **Sofisticação Técnica** — Qualidade de arquitetura, uso adequado de serviços AWS, qualidade de código, considerações de escalabilidade e resiliência do pipeline em tempo real
- **Visão Espacial & Pensamento de Ecossistema** — Quão bem o time articula (e idealmente demonstra) a visão north star de ecossistema conectado e multiplataforma?
- **Criatividade & Foco no Fã** — A experiência parece nova, emocionalmente envolvente e enraizada em comportamento real de fãs? É algo que fãs realmente quereriam usar?

## 8. Observações Adicionais

- Times devem simular dados de partida em tempo real se um feed ao vivo não estiver disponível durante a hackathon — um emissor de eventos baseado em replay de uma partida gravada é aceitável e incentivado
- A funcionalidade multijogador deve ser demonstrável — submissões apenas de usuário único não atenderão ao nível exigido do desafio
- O componente espacial/AR é uma aspiração north star; um conceito bem articulado com mockups ou uma prova de conceito leve é tão valorizado quanto uma implementação técnica parcial
- Times são incentivados a pensar na jornada do fã além dos 90 minutos — antecipação pré-jogo, engajamento no intervalo, reflexão pós-jogo e retenção no meio da semana são espaços de design válidos
- Considere acessibilidade e inclusão — a experiência deve acolher fãs casuais, não apenas usuários avançados orientados a dados
- Todos os serviços AWS na conta provisionada podem ser usados; combinações criativas e inesperadas de serviços são incentivadas. Não tem problema se seu protótipo rodar majoritariamente local (com chamadas de API para a AWS); pontos extras por usar serviços AWS.

## 9. Como acessar o ambiente AWS e os dados

Você receberá um documento separado, ISB-UserGuide.pdf, com instruções sobre como acessar a Conta AWS e os dados do desafio.

## 10. Entregáveis

Uma única pasta zip (o nome deve ser o nome do seu time, por exemplo, [MyTeamName.zip](http://MyTeamName.zip)) contendo:

1. **github_link.txt** — Um arquivo de texto contendo a URL do seu repositório no GitHub. O repositório deve incluir seu código-fonte (.ipynb, scripts etc.) e um [README.md](http://README.md) com instruções claras de como executar seu código e reproduzir seus resultados. Se quiser manter o repositório privado, convide o usuário MoellerO para o repositório. Não faça upload de quaisquer dados da hackathon no repositório.
2. **presentation_video.mp4** — Um vídeo curto em que você pode apresentar uma demo do que construiu ou explicar o KPI que calculou (por exemplo, usando PowerPoint). Máx. 3 min. Baixa resolução (<720p).
3. **executive_summary.pdf** — PowerPoint de até cinco slides resumindo sua solução e exibindo o principal resultado da sua abordagem. Observação: valorizamos resolução criativa de problemas e aprendizados vindos de falhas
4. **architecture.png** — Imagem da sua arquitetura AWS, se construída na AWS
5. *(Opcional)* **prfaq.pdf** — Um documento PRFAQ (formato PDF) em que você pode detalhar o que fez e por quê

## 11. Como enviar

1. Crie sua pasta zip ([MyTeamName.zip](http://MyTeamName.zip)) contendo os quatro itens listados acima. Mantenha o tamanho total pequeno.
2. Use este link de solicitação de arquivos. Pode ser necessário criar uma conta gratuita no Box.
3. Faça upload da sua pasta zip.
4. Se precisar reenviar, faça upload de um novo zip com o mesmo nome do time e adicione um sufixo de versão (por exemplo, MyTeamName_[v2.zip](http://v2.zip)). Por favor, evite reenviar muitas vezes.

## 12. Dúvidas?

- Fale com a organização no Discord: [https://discord.gg/EBYZNDbwzp](https://discord.gg/EBYZNDbwzp)