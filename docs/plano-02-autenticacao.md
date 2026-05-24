# Plano 02 — Autenticação

> **Princípio central:** Usar apenas o mínimo do Amplify. Sem MFA, sem social login, sem tabelas extras. O `authStore` é a única fonte de verdade sobre o usuário autenticado.

---

## Objetivo

Implementar o fluxo completo de autenticação usando Amazon Cognito via AWS Amplify SDK: cadastro, login, escolha de time, persistência de sessão e proteção de rotas.

---

## Dependências

**Plano 01 concluído:**
- Estrutura de pastas criada
- Rotas `(auth)/login.tsx` e `(auth)/register.tsx` existem (mesmo que skeleton)
- Arquivo `src/store/authStore.ts` existe (mesmo que vazio)
- Tipos `User` e `TeamId` definidos em `src/types/index.ts`

---

## Princípios de Simplicidade

- Usar apenas `signIn`, `signUp`, `signOut` e `getCurrentUser` do Amplify — sem MFA, sem social login, sem confirmação por SMS
- `authStore` com Zustand: apenas 6 campos — `user`, `isLoading`, `error`, `signIn`, `signUp`, `signOut`
- A escolha de time é salva como atributo customizado no Cognito (`custom:teamId`) — sem tabela separada no DynamoDB
- Proteção de rotas via um único componente `AuthGuard` no `_layout.tsx` raiz — sem HOCs ou wrappers por tela
- Formulários sem bibliotecas externas (react-hook-form, formik) — `useState` simples é suficiente

---

## Pacotes a Instalar

```bash
npx expo install aws-amplify @aws-amplify/react-native
npx expo install zustand
```

> **Nota:** `zustand` também será usado nos Planos 03 e 05. Instalar uma única vez aqui.

---

## Arquivos a Implementar

### `src/services/auth.ts`

Configuração e funções do Amplify:

```typescript
import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser, updateUserAttributes } from 'aws-amplify/auth';
import { AWS_REGION } from '../constants/config';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID!,
      region: AWS_REGION,
    },
  },
});

export { signIn, signUp, signOut, getCurrentUser, updateUserAttributes };
```

### `src/store/authStore.ts`

```typescript
import { create } from 'zustand';
import { signIn, signUp, signOut, getCurrentUser, updateUserAttributes } from '../services/auth';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  setTeam: (teamId: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    try {
      const cognitoUser = await getCurrentUser();
      // Mapear atributos Cognito → User
      set({ user: { id: cognitoUser.userId, email: cognitoUser.signInDetails?.loginId ?? '', name: '', teamId: '' } });
    } catch {
      set({ user: null });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      await signIn({ username: email, password });
      await get().initialize();
    } catch (e: any) {
      set({ error: e.message ?? 'Erro ao fazer login' });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      await signUp({ username: email, password, options: { userAttributes: { name } } });
      await get().login(email, password);
    } catch (e: any) {
      set({ error: e.message ?? 'Erro ao criar conta' });
    } finally {
      set({ isLoading: false });
    }
  },

  setTeam: async (teamId) => {
    await updateUserAttributes({ userAttributes: { 'custom:teamId': teamId } });
    set((state) => ({ user: state.user ? { ...state.user, teamId } : null }));
  },

  logout: async () => {
    await signOut();
    set({ user: null });
  },
}));
```

### `src/app/_layout.tsx` (atualizar do Plano 01)

```tsx
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const { user, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { initialize(); }, []);

  useEffect(() => {
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(tabs)/community');
  }, [user, segments]);

  return <Slot />;
}
```

### `src/app/(auth)/login.tsx`

```tsx
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-2xl font-bold mb-8">Entrar no Sektor</Text>

      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text className="text-red-500 mb-4">{error}</Text>}

      <TouchableOpacity
        className="bg-black rounded-lg py-4 items-center"
        onPress={() => login(email, password)}
        disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Entrar</Text>}
      </TouchableOpacity>

      <Link href="/(auth)/register" className="text-center mt-4 text-gray-500">
        Criar conta
      </Link>
    </View>
  );
}
```

### `src/app/(auth)/register.tsx`

Mesmo padrão do login, com campos adicionais de nome. Após cadastro, redirecionar para tela de escolha de time.

### `src/app/(auth)/select-team.tsx` (nova rota)

```tsx
import { TouchableOpacity, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { TEAMS } from '../../constants/config';

export default function SelectTeamScreen() {
  const { setTeam } = useAuthStore();
  const router = useRouter();

  const handleSelect = async (teamId: string) => {
    await setTeam(teamId);
    router.replace('/(tabs)/community');
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-2xl font-bold mb-8">Escolha seu time</Text>
      {TEAMS.map((team) => (
        <TouchableOpacity
          key={team.id}
          className="border-2 rounded-xl py-5 px-6 mb-4 items-center"
          style={{ borderColor: team.color }}
          onPress={() => handleSelect(team.id)}
        >
          <Text className="text-lg font-bold" style={{ color: team.color }}>{team.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

---

## Variáveis de Ambiente

Criar arquivo `.env.local` na raiz do projeto `app/`:

```
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
EXPO_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
EXPO_PUBLIC_API_REST_URL=https://PLACEHOLDER.execute-api.us-east-1.amazonaws.com/prod
EXPO_PUBLIC_API_WS_URL=wss://PLACEHOLDER.execute-api.us-east-1.amazonaws.com/prod
```

> Adicionar `.env.local` ao `.gitignore`. Nunca commitar credenciais.

---

## Critérios de Aceitação (Checklist de Done)

- [ ] `aws-amplify` e `zustand` instalados sem conflitos
- [ ] `authStore` com `user`, `isLoading`, `error`, `login`, `register`, `setTeam`, `logout`
- [ ] Tela de login funcional: campos de e-mail e senha, botão desabilitado durante loading
- [ ] Tela de cadastro funcional: campos de nome, e-mail e senha
- [ ] Após cadastro bem-sucedido, redireciona para seleção de time
- [ ] Após seleção de time, redireciona para `(tabs)/community`
- [ ] Login com credenciais inválidas exibe mensagem de erro legível
- [ ] Sessão persistida: reiniciar o app com sessão válida vai direto para community
- [ ] Botão "Sair" no perfil chama `logout` e redireciona para login
- [ ] Rotas protegidas redirecionam para login quando não autenticado
- [ ] `authStore.user.teamId` disponível para os Planos 03 e 05
- [ ] `tsc --noEmit` passa sem erros

---

## O que este plano entrega para os próximos

| Plano | O que usa deste plano |
|-------|----------------------|
| Plano 03 | `useAuthStore().user.teamId` para identificar a torcida do usuário no Arena |
| Plano 05 | `useAuthStore().user` (com token Cognito) para autenticar requisições REST e filtrar feed por time |
| Plano 06 | `useAuthStore().user` para associar o multiplicador GPS ao usuário |
