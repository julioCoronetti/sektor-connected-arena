# Requirements Document

## Introduction

O **Plano 01 — Fundação** estabelece a base técnica do App Sektor (React Native + Expo). O escopo é exclusivamente estrutural: criar a árvore de pastas de `src/`, configurar o Expo Router com grupos `(auth)` e `(tabs)`, definir as interfaces TypeScript centrais, listar as constantes de configuração, criar stubs tipados para serviços/hooks/stores e configurar o NativeWind apontando para `src/`.

Este plano não entrega funcionalidade ao usuário final. Ele entrega a fundação que os Planos 02 a 06 vão consumir, garantindo que `tsc --noEmit` passe sem erros e que o App inicie sem falhas de navegação.

Os documentos de referência são:
- `docs/plano-01-fundacao.md` (especificação técnica e código de exemplo).
- `.kiro/specs/sektor-implementation-plans/requirements.md` (Requisito 1).

## Glossary

- **App**: Aplicativo mobile Sektor (React Native + Expo) localizado em `c:\Users\times\Documents\Workspace\sektor-connected-arena\app`.
- **Expo_Router**: Sistema de navegação baseado em arquivos do Expo, configurado neste plano com grupos `(auth)` e `(tabs)` e rota dinâmica `arena/[matchId]`.
- **NativeWind**: Biblioteca de estilização baseada em Tailwind CSS para React Native, já presente nas dependências do projeto.
- **Tela_Skeleton**: Componente React Native composto apenas por `<View>` + `<Text>`, sem estado, sem efeitos colaterais e sem chamadas externas.
- **Stub_Tipado**: Arquivo TypeScript que exporta apenas assinaturas (interfaces, tipos e funções vazias com tipo de retorno) sem implementação de lógica.
- **Tipos_Centrais**: Conjunto das 7 interfaces TypeScript definidas em `src/types/index.ts`: `User`, `Post`, `Comment`, `Match`, `Prediction`, `PressureBarState` e o alias `TeamId`.
- **Constantes_Config**: Conjunto de constantes definidas em `src/constants/config.ts`: `AWS_REGION`, `API_REST_URL`, `API_WS_URL`, `STADIUM_COORDS`, `TEAMS`.
- **Tab_Bar**: Barra de navegação inferior renderizada pelo layout `src/app/(tabs)/_layout.tsx` contendo as três abas Comunidade, Arena e Perfil.
- **Auth_Guard_Stub**: Lógica mínima no layout raiz que, neste plano, redireciona qualquer acesso à raiz para `(auth)/login` (a verificação real de sessão será implementada no Plano 02).
- **Compilador_TypeScript**: Comando `tsc --noEmit` executado a partir da raiz do App.

## Requirements

### Requirement 1 — Estrutura de Pastas

**User Story:** Como desenvolvedor, quero uma árvore de pastas determinística em `src/`, para que os Planos 02 a 06 saibam exatamente onde criar e consumir arquivos sem retrabalho.

#### Acceptance Criteria

1. THE App SHALL conter o diretório `src/app/(auth)/` com os arquivos `_layout.tsx`, `login.tsx` e `register.tsx`.
2. THE App SHALL conter o diretório `src/app/(tabs)/` com os arquivos `_layout.tsx`, `community.tsx`, `arena.tsx` e `profile.tsx`.
3. THE App SHALL conter o diretório `src/app/arena/` com o arquivo `[matchId].tsx`.
4. THE App SHALL conter os diretórios `src/components/arena/`, `src/components/community/` e `src/components/ui/`, cada um preservando um arquivo `.gitkeep` enquanto estiver vazio.
5. THE App SHALL conter o diretório `src/services/` com os arquivos `api.ts`, `websocket.ts`, `auth.ts` e `matchSimulator.ts`.
6. THE App SHALL conter o diretório `src/hooks/` com os arquivos `useArena.ts`, `useWebSocket.ts` e `useCommunity.ts`.
7. THE App SHALL conter o diretório `src/store/` com os arquivos `arenaStore.ts` e `authStore.ts`.
8. THE App SHALL conter o diretório `src/types/` com o arquivo `index.ts`.
9. THE App SHALL conter o diretório `src/constants/` com o arquivo `config.ts`.

### Requirement 2 — Navegação com Expo Router

**User Story:** Como desenvolvedor, quero que o Expo Router esteja configurado com grupos `(auth)` e `(tabs)` e com a rota dinâmica `arena/[matchId]`, para que os Planos 02, 03 e 05 possam adicionar lógica nas telas existentes sem alterar a topologia de rotas.

#### Acceptance Criteria

1. THE Expo_Router SHALL reconhecer o grupo `(auth)` contendo as rotas `login` e `register` agrupadas por um Stack layout em `src/app/(auth)/_layout.tsx`.
2. THE Expo_Router SHALL reconhecer o grupo `(tabs)` contendo as rotas `community`, `arena` e `profile` agrupadas por um Tabs layout em `src/app/(tabs)/_layout.tsx`.
3. THE Expo_Router SHALL reconhecer a rota dinâmica `arena/[matchId]` definida em `src/app/arena/[matchId].tsx`.
4. WHEN o App é iniciado a partir da rota raiz, THE Auth_Guard_Stub SHALL redirecionar a navegação para `(auth)/login`.
5. IF um arquivo de rota declarado nos critérios 1, 2 ou 3 estiver ausente em tempo de build, THEN THE Expo_Router SHALL produzir um erro de compilação que identifique o nome da rota ausente.

### Requirement 3 — Tab Bar com Três Abas

**User Story:** Como Torcedor, quero ver uma barra de abas inferior com Comunidade, Arena e Perfil, para que eu consiga navegar entre as três áreas principais do App.

#### Acceptance Criteria

1. THE Tab_Bar SHALL exibir exatamente três abas, com os títulos "Comunidade", "Arena" e "Perfil" e nesta ordem.
2. WHEN o usuário toca na aba "Comunidade", THE Expo_Router SHALL navegar para a rota `(tabs)/community`.
3. WHEN o usuário toca na aba "Arena", THE Expo_Router SHALL navegar para a rota `(tabs)/arena`.
4. WHEN o usuário toca na aba "Perfil", THE Expo_Router SHALL navegar para a rota `(tabs)/profile`.
5. WHEN qualquer rota dentro de `(tabs)` é renderizada, THE App SHALL renderizar a Tela_Skeleton correspondente sem lançar exceções.

### Requirement 4 — Telas Skeleton

**User Story:** Como desenvolvedor, quero que todas as telas criadas neste plano sejam skeletons triviais, para que os Planos seguintes substituam o conteúdo sem precisar remover lógica intermediária.

#### Acceptance Criteria

1. THE App SHALL renderizar a Tela_Skeleton em cada um dos arquivos `src/app/(auth)/login.tsx`, `src/app/(auth)/register.tsx`, `src/app/(tabs)/community.tsx`, `src/app/(tabs)/arena.tsx`, `src/app/(tabs)/profile.tsx` e `src/app/arena/[matchId].tsx`.
2. THE Tela_Skeleton SHALL conter exclusivamente componentes `View` e `Text` importados de `react-native`.
3. THE Tela_Skeleton SHALL exibir um título textual identificando a tela e uma referência textual ao Plano que a implementará de fato.
4. THE Tela_Skeleton SHALL NOT importar módulos das pastas `src/services/`, `src/hooks/` ou `src/store/`.
5. WHERE uma Tela_Skeleton aplicar qualquer estilização, THE Tela_Skeleton SHALL aplicá-la exclusivamente via classes NativeWind (atributo `className`) e SHALL NOT importar nem usar `StyleSheet` de `react-native`. Telas sem qualquer estilização aplicada permanecem em conformidade com este critério.

### Requirement 5 — Tipos Centrais em `src/types/index.ts`

**User Story:** Como desenvolvedor, quero que `src/types/index.ts` exporte as 7 entidades centrais do domínio Sektor, para que os Planos 02 a 06 importem tipos consistentes em vez de redefini-los.

#### Acceptance Criteria

1. THE App SHALL exportar de `src/types/index.ts` o alias `TeamId` correspondente a `string`.
2. THE App SHALL exportar de `src/types/index.ts` a interface `User` com os campos `id: string`, `email: string`, `name: string` e `teamId: TeamId`.
3. THE App SHALL exportar de `src/types/index.ts` a interface `Post` com os campos `id: string`, `authorId: string`, `authorName: string`, `teamId: TeamId`, `text: string`, `imageUrl?: string`, `likes: number`, `commentCount: number` e `createdAt: string`.
4. THE App SHALL exportar de `src/types/index.ts` a interface `Comment` com os campos `id: string`, `postId: string`, `authorId: string`, `authorName: string`, `text: string` e `createdAt: string`.
5. THE App SHALL exportar de `src/types/index.ts` a interface `Match` com os campos `id: string`, `teamA: { id: TeamId; name: string; color: string }`, `teamB: { id: TeamId; name: string; color: string }`, `minute: number` e `status: 'upcoming' | 'live' | 'finished'`.
6. THE App SHALL exportar de `src/types/index.ts` a interface `Prediction` com os campos `id: string`, `matchId: string`, `question: string`, `options: string[]`, `correctOption?: number` e `expiresAt: string`.
7. THE App SHALL exportar de `src/types/index.ts` a interface `PressureBarState` com os campos `teamA: number` e `teamB: number`, ambos representando valores entre 0 e 100.

### Requirement 6 — Constantes em `src/constants/config.ts`

**User Story:** Como desenvolvedor, quero que `src/constants/config.ts` centralize URLs de API, região AWS e identificadores de times, para que os Planos seguintes consumam configuração estática a partir de um único módulo.

#### Acceptance Criteria

1. THE App SHALL exportar de `src/constants/config.ts` a constante `AWS_REGION` com o valor literal `'us-east-1'`.
2. THE App SHALL exportar de `src/constants/config.ts` a constante `API_REST_URL` cujo valor SHALL provir de `process.env.EXPO_PUBLIC_API_REST_URL` quando definido, caindo para um placeholder textual `https://PLACEHOLDER...` em caso contrário.
3. THE App SHALL exportar de `src/constants/config.ts` a constante `API_WS_URL` cujo valor SHALL provir de `process.env.EXPO_PUBLIC_API_WS_URL` quando definido, caindo para um placeholder textual `wss://PLACEHOLDER...` em caso contrário.
4. THE App SHALL exportar de `src/constants/config.ts` a constante `STADIUM_COORDS` contendo os campos numéricos `latitude`, `longitude` e `radiusMeters`.
5. THE App SHALL exportar de `src/constants/config.ts` a constante `TEAMS` como uma tupla literal (`as const`) contendo dois objetos com os campos `id`, `name` e `color`, correspondentes a "Time A" e "Time B".

### Requirement 7 — Stubs Tipados de Serviços, Hooks e Stores

**User Story:** Como desenvolvedor, quero que os módulos de `services/`, `hooks/` e `store/` existam como Stub_Tipado neste plano, para que os Planos 02 a 05 substituam apenas a implementação interna sem precisar criar arquivos.

#### Acceptance Criteria

1. THE App SHALL exportar de cada arquivo em `src/services/`, `src/hooks/` e `src/store/` ao menos uma assinatura pública (função, hook ou store) tipada com tipos importados de `src/types/index.ts` ou tipos primitivos do TypeScript.
2. THE App SHALL implementar cada Stub_Tipado de modo que sua execução em tempo de carga do módulo SHALL NOT realizar chamadas de rede, acesso a armazenamento, conexões WebSocket ou registros no `console`.
3. IF qualquer função exportada por um Stub_Tipado for invocada em tempo de execução, THEN THE Stub_Tipado SHALL tentar lançar um `Error` cuja mensagem identifique o nome da função e o Plano responsável pela implementação real; se o lançamento do erro em si falhar por motivos do runtime, o Stub_Tipado PODE retornar silenciosamente sem impedir a navegação do App.
4. THE App SHALL declarar para cada hook em `src/hooks/` um tipo de retorno explícito que será consumido pelos Planos 03 e 05.
5. THE App SHALL declarar `arenaStore` e `authStore` em `src/store/` como módulos que exportam ao menos a assinatura de seu estado e suas ações, sem dependência da biblioteca Zustand neste plano.

### Requirement 8 — Configuração do NativeWind

**User Story:** Como desenvolvedor, quero o NativeWind configurado para escanear `src/`, para que classes utilitárias funcionem em todas as telas do App.

#### Acceptance Criteria

1. THE App SHALL conter na raiz do projeto o arquivo `tailwind.config.js` com o campo `content` igual a `['./src/**/*.{js,jsx,ts,tsx}']`.
2. THE App SHALL conter no `tailwind.config.js` o preset `require('nativewind/preset')`.
3. THE App SHALL conter o arquivo `src/global.css` com as três diretivas `@tailwind base;`, `@tailwind components;` e `@tailwind utilities;`.
4. THE App SHALL conter na raiz do projeto o arquivo `babel.config.js` configurado para usar o preset `babel-preset-expo` com a opção `jsxImportSource: 'nativewind'` e o plugin `'react-native-worklets/plugin'`.
5. THE App SHALL conter na raiz do projeto o arquivo `metro.config.js` que estende a configuração padrão do Expo via `withNativeWind`, apontando para `./src/global.css`.
6. WHEN uma Tela_Skeleton aplica uma classe utilitária NativeWind via `className`, THE App SHALL renderizar a tela com o estilo correspondente sem produzir nenhum aviso (warning) do compilador NativeWind.

### Requirement 9 — Compilação TypeScript Sem Erros

**User Story:** Como desenvolvedor, quero que `tsc --noEmit` passe sem erros após a conclusão do plano, para que os Planos 02 a 06 herdem uma base TypeScript saudável.

#### Acceptance Criteria

1. WHEN o Compilador_TypeScript é executado a partir da raiz do App, THE Compilador_TypeScript SHALL terminar com código de saída zero, e este código de saída SHALL ser tratado como veredito final do critério, independentemente de mensagens internas.
2. WHEN o Compilador_TypeScript é executado, THE Compilador_TypeScript SHALL processar todos os arquivos `.ts` e `.tsx` dentro de `src/` sem ignorá-los via `// @ts-ignore` ou `// @ts-nocheck`.
3. IF qualquer arquivo criado neste plano contiver uma referência a um símbolo não exportado ou um tipo inexistente, THEN THE Compilador_TypeScript SHALL reportar erro e o critério 1 SHALL falhar.

### Requirement 10 — Inicialização do App Sem Erros

**User Story:** Como desenvolvedor, quero iniciar o App e ver a tela de login renderizada, para que eu confirme que a fundação está navegável antes de seguir para o Plano 02.

#### Acceptance Criteria

1. WHEN o App é iniciado a partir do bundler do Expo, THE App SHALL renderizar a Tela_Skeleton de `src/app/(auth)/login.tsx` como tela inicial.
2. WHILE o App está em execução, THE App SHALL permitir navegar entre as três abas da Tab_Bar sem lançar exceções no console.
3. WHEN o App navega para a rota `arena/<qualquer-string>`, THE Expo_Router SHALL renderizar a Tela_Skeleton de `src/app/arena/[matchId].tsx` recebendo o parâmetro `matchId` como string.
4. IF o App lançar um erro não tratado durante a inicialização ou durante a navegação entre rotas declaradas neste plano, THEN o critério 1 ou 2 SHALL falhar.
