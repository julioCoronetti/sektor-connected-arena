# Plano 06 — GPS, AR e Polimento

> **Princípio central:** GPS é uma comparação de coordenadas. AR é câmera + overlay SVG. Polimento é aplicar classes NativeWind consistentes. Nada disso precisa de bibliotecas complexas.

---

## Objetivo

Adicionar o multiplicador de Pressão/Energia baseado em geolocalização (GPS), o mockup de AR via câmera, ajustes finais de UX e aplicação do tema visual Sektor em todo o App.

Este é o plano de **finalização** — todos os outros planos devem estar concluídos antes de começar.

---

## Dependências

**Todos os planos anteriores concluídos:**
- Plano 01: Estrutura de pastas e NativeWind configurados
- Plano 02: `authStore.user` disponível
- Plano 03: `arenaStore` e `PressureBar` funcionais
- Plano 04: Pipeline AWS enviando `PRESSURE_UPDATE`
- Plano 05: Fórum funcional com todos os componentes

---

## Princípios de Simplicidade

- GPS: comparar coordenadas com raio fixo de 500m hardcoded em `config.ts` — sem geofencing dinâmico, sem SDK de mapas
- Multiplicador GPS aplicado **localmente** no `arenaStore` antes de enviar a resposta — sem validação no servidor
- AR: câmera como fundo + overlay `View` com componentes React Native — sem ViroReact, sem ARKit/ARCore
- Polimento: aplicar paleta de cores via classes NativeWind — sem criar design system, sem tokens customizados
- Transições: usar `react-native-reanimated` apenas nas 2 navegações principais — sem animar tudo

---

## Pacotes a Instalar

```bash
npx expo install expo-location expo-camera
```

---

## Parte 1: GPS e Multiplicador 2x

### `src/hooks/useLocation.ts`

```typescript
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { STADIUM_COORDS } from '../constants/config';

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useLocation() {
  const [isInStadium, setIsInStadium] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return; // Continua com multiplicador 1x — sem erros
      }

      const location = await Location.getCurrentPositionAsync({});
      const distance = getDistanceMeters(
        location.coords.latitude,
        location.coords.longitude,
        STADIUM_COORDS.latitude,
        STADIUM_COORDS.longitude
      );

      setIsInStadium(distance <= STADIUM_COORDS.radiusMeters);
    })();
  }, []);

  return { isInStadium, permissionDenied, multiplier: isInStadium ? 2 : 1 };
}
```

### Integrar no `src/app/arena/[matchId].tsx`

```tsx
// Adicionar ao ArenaScreen:
import { useLocation } from '../../hooks/useLocation';

// Dentro do componente:
const { isInStadium, multiplier } = useLocation();

// Ao enviar resposta, incluir o multiplicador:
const handleAnswer = (optionIndex: number) => {
  send({ type: 'ANSWER', predictionId: activePrediction?.id, selectedOption: optionIndex, gpsMultiplier: multiplier });
  setActivePrediction(null);
};

// Badge "Na Arena" na tela:
{isInStadium && (
  <View className="absolute top-16 right-4 bg-green-500 rounded-full px-3 py-1 flex-row items-center gap-1">
    <Text className="text-white text-xs font-bold">📍 Na Arena  2x</Text>
  </View>
)}
```

---

## Parte 2: Modo AR (Mockup via Câmera)

### `src/components/arena/ARView.tsx`

```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Match, PressureBarState } from '../../types';

interface Props {
  match: Match;
  pressureBar: PressureBarState;
  onClose: () => void;
}

export function ARView({ match, pressureBar, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white text-center mb-4 px-8">
          Permissão de câmera necessária para o Modo AR
        </Text>
        <TouchableOpacity className="bg-white rounded-xl px-6 py-3" onPress={requestPermission}>
          <Text className="font-bold">Permitir câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity className="mt-4" onPress={onClose}>
          <Text className="text-gray-400">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = pressureBar.teamA + pressureBar.teamB;
  const widthA = total > 0 ? (pressureBar.teamA / total) * 100 : 50;

  return (
    <View className="flex-1">
      <CameraView className="flex-1" facing="back">
        {/* Overlay AR — posicionado sobre a câmera */}
        <View className="absolute inset-0">
          {/* Barra de pressão no topo */}
          <View className="absolute top-16 left-4 right-4">
            <View className="flex-row h-4 rounded-full overflow-hidden opacity-90">
              <View style={{ flex: widthA, backgroundColor: match.teamA.color }} />
              <View style={{ flex: 100 - widthA, backgroundColor: match.teamB.color }} />
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-white text-xs font-bold drop-shadow">{match.teamA.name}</Text>
              <Text className="text-white text-xs font-bold drop-shadow">{match.teamB.name}</Text>
            </View>
          </View>

          {/* Escudos dos times nos cantos */}
          <View className="absolute bottom-24 left-4 w-16 h-16 rounded-full items-center justify-center opacity-80"
            style={{ backgroundColor: match.teamA.color }}>
            <Text className="text-white font-bold text-lg">{match.teamA.name[0]}</Text>
          </View>
          <View className="absolute bottom-24 right-4 w-16 h-16 rounded-full items-center justify-center opacity-80"
            style={{ backgroundColor: match.teamB.color }}>
            <Text className="text-white font-bold text-lg">{match.teamB.name[0]}</Text>
          </View>

          {/* Botão fechar */}
          <TouchableOpacity
            className="absolute top-16 right-4 bg-black/50 rounded-full w-10 h-10 items-center justify-center"
            onPress={onClose}
          >
            <Text className="text-white">✕</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}
```

### Integrar no `src/app/arena/[matchId].tsx`

```tsx
import { ARView } from '../../components/arena/ARView';

// Estado local:
const [arMode, setArMode] = useState(false);

// Renderização condicional:
if (arMode) {
  return <ARView match={match} pressureBar={pressureBar} onClose={() => setArMode(false)} />;
}

// Botão AR na tela da Arena:
<TouchableOpacity
  className="absolute bottom-8 right-6 bg-white/20 rounded-full px-4 py-2"
  onPress={() => setArMode(true)}
>
  <Text className="text-white font-bold">📷 Modo AR</Text>
</TouchableOpacity>
```

---

## Parte 3: Tema Visual Sektor

### Paleta de Cores

Definir em `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      sektor: {
        bg: '#0A0A0F',        // Fundo escuro principal
        surface: '#13131A',   // Cards e superfícies
        border: '#1E1E2E',    // Bordas sutis
        accent: '#6C63FF',    // Roxo/violeta — cor de destaque
        'accent-light': '#8B85FF',
        text: '#F0F0F5',      // Texto principal
        muted: '#6B6B80',     // Texto secundário
      },
    },
  },
},
```

### Aplicação por Tela

**Login / Register / Select Team:**
```tsx
// Fundo escuro, inputs com borda sutil, botão com accent
<View className="flex-1 bg-sektor-bg px-6 justify-center">
  <TextInput className="bg-sektor-surface border border-sektor-border text-sektor-text rounded-xl px-4 py-4 mb-4" />
  <TouchableOpacity className="bg-sektor-accent rounded-xl py-4 items-center">
    <Text className="text-white font-bold">Entrar</Text>
  </TouchableOpacity>
</View>
```

**Arena:**
```tsx
// Fundo muito escuro, PressureBar com cores dos times, texto branco
<View className="flex-1 bg-sektor-bg">
  <Text className="text-sektor-text text-xl font-bold">...</Text>
</View>
```

**Comunidade:**
```tsx
// Fundo levemente escuro, cards com surface, separadores com border
<View className="flex-1 bg-sektor-bg">
  <View className="bg-sektor-surface border-b border-sektor-border px-4 py-4">
    ...
  </View>
</View>
```

### Transições com Reanimated

Aplicar apenas nas 2 navegações principais:

```tsx
// src/app/(auth)/login.tsx — fade in ao montar
import Animated, { FadeIn } from 'react-native-reanimated';

export default function LoginScreen() {
  return (
    <Animated.View entering={FadeIn.duration(300)} className="flex-1 bg-sektor-bg px-6 justify-center">
      {/* conteúdo */}
    </Animated.View>
  );
}
```

---

## Critérios de Aceitação (Checklist de Done)

- [ ] App solicita permissão de localização ao entrar no Modo Arena
- [ ] Usuário dentro do raio de 500m do estádio recebe multiplicador 2x
- [ ] Badge "📍 Na Arena  2x" visível na tela da Arena quando GPS ativo
- [ ] Permissão de localização negada não causa erros — multiplicador 1x aplicado
- [ ] Botão "Modo AR" visível na tela da Arena
- [ ] Modo AR exibe câmera com overlay da PressureBar e escudos dos times
- [ ] Permissão de câmera negada exibe mensagem informativa e botão de voltar
- [ ] Paleta de cores Sektor aplicada em todas as telas (bg, surface, accent, text)
- [ ] Transição fade-in na tela de login
- [ ] Transição na navegação login → tabs
- [ ] App compila sem erros TypeScript após todas as alterações
- [ ] Fluxo completo demonstrável: login → arena → predição → pressão → AR

---

## Checklist Final do Projeto Completo

Antes de submeter, verificar:

- [ ] Plano 01: Estrutura e navegação ✓
- [ ] Plano 02: Login, cadastro, escolha de time ✓
- [ ] Plano 03: Arena com WebSocket, PressureBar, PredictionCard ✓
- [ ] Plano 04: Simulador DFL + Pipeline AWS + Bedrock ✓
- [ ] Plano 05: Feed, posts, curtidas, comentários ✓
- [ ] Plano 06: GPS 2x, AR mockup, tema Sektor ✓
- [ ] `tsc --noEmit` sem erros
- [ ] App roda em iOS ou Android sem crashes
- [ ] Fluxo multijogador demonstrável com 2+ usuários simultâneos
- [ ] README com instruções de execução do simulador
