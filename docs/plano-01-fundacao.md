# Plan 01 — Project Foundation

> **Core principle:** Build only what the following plans will use. No generic "for the future" components. Keep code simple and structure predictable.

---

## Objective

Establish the technical foundation of the App: folder structure, navigation system (tabs + auth flow), shared TypeScript types, NativeWind configuration and navigable skeleton screens.

This plan does not deliver any end-user feature — it delivers the **foundation** used by all subsequent plans.

---

## Dependencies

**None.** This is the initial plan.

---

## Simplicity Principles

- Build only what the following plans will use — no generic "for the future" components
- Skeleton screens should be plain `<View>` + `<Text>`, without logic
- TypeScript types should cover only core entities (User, Post, Match, Prediction, PressureBar)
- Configure NativeWind once; do not create custom theming utilities yet
- No global state in this plan — only structure and navigation

---

## Folder Structure to Create

```
src/
├── app/
│   ├── _layout.tsx              ← Root layout with AuthGuard (stub)
│   ├── index.tsx                ← Redirect to (tabs) or (auth)
│   ├── (auth)/
│   │   ├── _layout.tsx          ← Stack layout for auth
│   │   ├── login.tsx            ← Skeleton screen
│   │   └── register.tsx         ← Skeleton screen
│   ├── (tabs)/
│   │   ├── _layout.tsx          ← Bottom tabs layout
│   │   ├── community.tsx        ← Skeleton screen
│   │   ├── arena.tsx            ← Skeleton screen
│   │   └── profile.tsx          ← Skeleton screen
│   └── arena/
│       └── [matchId].tsx        ← Skeleton screen (dynamic route)
│
├── components/
│   ├── arena/                   ← Empty (with .gitkeep)
│   ├── community/               ← Empty (with .gitkeep)
│   └── ui/                      ← Empty (with .gitkeep)
│
├── services/
│   ├── api.ts                   ← Stub: typed empty functions
│   ├── websocket.ts             ← Stub: typed empty functions
│   ├── auth.ts                  ← Stub: typed empty functions
│   └── matchSimulator.ts        ← Stub: typed empty functions
│
├── hooks/
│   ├── useArena.ts              ← Stub: typed empty hook
│   ├── useWebSocket.ts          ← Stub: typed empty hook
│   └── useCommunity.ts          ← Stub: typed empty hook
│
├── store/
│   ├── arenaStore.ts            ← Stub: typed empty store
│   └── authStore.ts             ← Stub: typed empty store
│
├── types/
│   └── index.ts                 ← All TypeScript interfaces
│
└── constants/
    └── config.ts                ← URLs, AWS region, team IDs
```

---

## Files to Implement

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
  latitude: -23.5505,   // Replace with real coordinates in Plan 06
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
// authStore will be implemented in Plan 02
// For now, a stub that always redirects to login

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

### Skeleton Screens (pattern for all)

```tsx
// Example: src/app/(tabs)/community.tsx
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

## NativeWind Configuration

Check if `tailwind.config.js` already points to `src/`. If not, update it:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
};
```

And ensure `src/global.css` contains:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Acceptance Criteria (Done checklist)

- [ ] Folder structure created as specified above
- [ ] Expo Router with `(auth)` and `(tabs)` groups working
- [ ] Tab bar shows three tabs: "Comunidade", "Arena" and "Perfil"
- [ ] Each tab navigates to its skeleton screen without errors
- [ ] `src/types/index.ts` with all 7 interfaces defined
- [ ] `src/constants/config.ts` with URLs, AWS region and teams
- [ ] `tailwind.config.js` points to `src/**`
- [ ] App starts without navigation or TypeScript errors
- [ ] `tsc --noEmit` passes without errors
- [ ] All stub files created (services, hooks, store)

---

## What this plan delivers for the next ones

| Plan | What it provides |
|------|------------------|
| Plan 02 | `(auth)/login`, `(auth)/register`, `authStore.ts` |
| Plan 03 | `arena/[matchId].tsx`, types `Match`, `Prediction`, `PressureBarState` |
| Plan 04 | Types `Match`, `Prediction`; file `matchSimulator.ts` |
| Plan 05 | `(tabs)/community.tsx`, types `Post`, `Comment`; file `useCommunity.ts` |
| Plan 06 | NativeWind setup, `STADIUM_COORDS` in `config.ts` |
