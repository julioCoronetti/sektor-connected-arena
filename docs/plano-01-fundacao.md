# Plano 01 — Fundação do Projeto

> **Princípio central:** Criar apenas o que os planos seguintes vão usar. Sem componentes genéricos "para o futuro". Código simples, estrutura previsível.

---

## Objetivo

Estabelecer a base técnica do App: estrutura de pastas, sistema de navegação (tabs + fluxo de autenticação), tipos TypeScript compartilhados, configuração do NativeWind e telas skeleton navegáveis.

Este plano não entrega nenhuma funcionalidade de usuário final — ele entrega a **fundação** que todos os outros planos vão usar.

---

## Dependências

**Nenhuma.** Este é o plano inicial.

---

## Princípios de Simplicidade

- Criar apenas o que os planos seguintes vão usar — sem componentes genéricos "para o futuro"
- Telas skeleton devem ser `<View>` + `<Text>` simples, sem lógica
- Tipos TypeScript devem cobrir apenas as entidades centrais (User, Post, Match, Prediction, PressureBar)
- NativeWind configurado uma única vez; não criar utilitários de tema customizados ainda
- Nenhum estado global neste plano — apenas estrutura e navegação

---

## Estrutura de Pastas a Criar

```
src/
├── app/
│   ├── _layout.tsx              ← Root layout com AuthGuard (stub)
│   ├── index.tsx                ← Redirect para (tabs) ou (auth)
│   ├── (auth)/
│   │   ├── _layout.tsx          ← Stack layout para auth
│   │   ├── login.tsx            ← Tela skeleton
│   │   └── register.tsx         ← Tela skeleton
│   ├── (tabs)/
│   │   ├── _layout.tsx          ← Bottom tabs layout
│   │   ├── community.tsx        ← Tela skeleton
│   │   ├── arena.tsx            ← Tela skeleton
│   │   └── profile.tsx          ← Tela skeleton
│   └── arena/
│       └── [matchId].tsx        ← Tela skeleton (rota dinâmica)
│
├── components/
│   ├── arena/                   ← Vazio (com .gitkeep)
│   ├── community/               ← Vazio (com .gitkeep)
│   └── ui/                      ← Vazio (com .gitkeep)
│
├── services/
│   ├── api.ts                   ← Stub: funções vazias tipadas
│   ├── websocket.ts             ← Stub: funções vazias tipadas
│   ├── auth.ts                  ← Stub: funções vazias tipadas
│   └── matchSimulator.ts        ← Stub: funções vazias tipadas
│
├── hooks/
│   ├── useArena.ts              ← Stub: hook vazio tipado
│   ├── useWebSocket.ts          ← Stub: hook vazio tipado
│   └── useCommunity.ts          ← Stub: hook vazio tipado
│
├── store/
│   ├── arenaStore.ts            ← Stub: store vazio tipado
│   └── authStore.ts             ← Stub: store vazio tipado
│
├── types/
│   └── index.ts                 ← Todas as interfaces TypeScript
│
└── constants/
    └── config.ts                ← URLs, região AWS, IDs de times
```

---

## Arquivos a Implementar

### `src/types/index.ts`

```typescript
export type TeamId = string;

export interface User {
  id: string;
  email: string;
  name: string;
  teamId: TeamId;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  teamId: TeamId;
  text: string;
  imageUrl?: string;
  likes: number;
  commentCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Match {
  id: string;
  teamA: { id: TeamId; name: string; color: string };
  teamB: { id: TeamId; name: string; color: string };
  minute: number;
  status: 'upcoming' | 'live' | 'finished';
}

export interface Prediction {
  id: string;
  matchId: string;
  question: string;
  options: string[];
  correctOption?: number;
  expiresAt: string;
}

export interface PressureBarState {
  teamA: number; // 0–100
  teamB: number; // 0–100
}
```

### `src/constants/config.ts`

```typescript
export const AWS_REGION = 'us-east-1';

export const API_REST_URL = process.env.EXPO_PUBLIC_API_REST_URL ?? 'https://PLACEHOLDER.execute-api.us-east-1.amazonaws.com/prod';
export const API_WS_URL = process.env.EXPO_PUBLIC_API_WS_URL ?? 'wss://PLACEHOLDER.execute-api.us-east-1.amazonaws.com/prod';

export const STADIUM_COORDS = {
  latitude: -23.5505,   // Substituir pelas coordenadas reais no Plano 06
  longitude: -46.6333,
  radiusMeters: 500,
};

export const TEAMS = [
  { id: 'team-a', name: 'Time A', color: '#E63946' },
  { id: 'team-b', name: 'Time B', color: '#1D3557' },
] as const;
```

### `src/app/_layout.tsx`

```tsx
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
// authStore será implementado no Plano 02
// Por ora, stub que sempre redireciona para login

export default function RootLayout() {
  return <Slot />;
}
```

### `src/app/(tabs)/_layout.tsx`

```tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="community" options={{ title: 'Comunidade' }} />
      <Tabs.Screen name="arena" options={{ title: 'Arena' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
```

### Telas Skeleton (padrão para todas)

```tsx
// Exemplo: src/app/(tabs)/community.tsx
import { Text, View } from 'react-native';

export default function CommunityScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg font-bold">Comunidade</Text>
      <Text className="text-gray-500">Plano 05</Text>
    </View>
  );
}
```

---

## Configuração NativeWind

Verificar se `tailwind.config.js` já aponta para `src/`. Se não, atualizar:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
};
```

E garantir que `src/global.css` contém:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Critérios de Aceitação (Checklist de Done)

- [ ] Estrutura de pastas criada conforme especificado acima
- [ ] Expo Router com grupos `(auth)` e `(tabs)` funcionando
- [ ] Tab bar exibe três abas: "Comunidade", "Arena" e "Perfil"
- [ ] Cada aba navega para sua tela skeleton sem erros
- [ ] `src/types/index.ts` com todas as 7 interfaces definidas
- [ ] `src/constants/config.ts` com URLs, região AWS e times
- [ ] `tailwind.config.js` apontando para `src/**`
- [ ] App inicia sem erros de navegação ou TypeScript
- [ ] `tsc --noEmit` passa sem erros
- [ ] Todos os arquivos stub criados (services, hooks, store)

---

## O que este plano entrega para os próximos

| Plano | O que usa deste plano |
|-------|----------------------|
| Plano 02 | Rotas `(auth)/login`, `(auth)/register`, arquivo `authStore.ts` |
| Plano 03 | Rota `arena/[matchId].tsx`, tipos `Match`, `Prediction`, `PressureBarState` |
| Plano 04 | Tipos `Match`, `Prediction`; arquivo `matchSimulator.ts` |
| Plano 05 | Rota `(tabs)/community.tsx`, tipos `Post`, `Comment`; arquivo `useCommunity.ts` |
| Plano 06 | Configuração NativeWind, `STADIUM_COORDS` em `config.ts` |
