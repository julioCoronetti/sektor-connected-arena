# Plano 03 — Modo Arena (Core)

> **Princípio central:** O Arena é o coração do app. Mas complexidade mata hackathon. WebSocket simples, store enxuto, componentes diretos. Funcionar com mock primeiro, integrar depois.

---

## Objetivo

Implementar o núcleo do Modo Arena: conexão WebSocket, exibição da PressureBar, pop-up de predição (`PredictionCard`), lógica de resposta e atualização do `arenaStore`.

O fluxo deve funcionar **de ponta a ponta com dados mockados** antes da integração com o Plano 04 (Pipeline AWS real).

---

## Dependências

**Plano 01 concluído:**
- Rota `src/app/arena/[matchId].tsx` existe
- Tipos `Match`, `Prediction`, `PressureBarState` definidos em `src/types/index.ts`
- Arquivo `src/services/matchSimulator.ts` existe (stub)
- Arquivo `src/store/arenaStore.ts` existe (stub)
- Arquivo `src/hooks/useWebSocket.ts` existe (stub)

**Plano 02 concluído:**
- `useAuthStore().user.teamId` disponível para identificar a torcida do usuário

---

## Princípios de Simplicidade

- `useWebSocket` é um hook com `connect`, `disconnect` e `onMessage` — sem reconexão automática complexa (apenas uma tentativa após 3 segundos)
- `arenaStore` com Zustand: apenas 5 campos — `match`, `pressureBar`, `activePrediction`, `submitAnswer`, `updatePressure`
- `PredictionCard` é um modal simples com pergunta, opções e timer de 15 segundos — sem animações complexas
- `PressureBar` é uma barra horizontal com dois lados coloridos — sem física ou animações avançadas
- Dados mockados em `matchSimulator.ts` para testar sem o Plano 04
- **Não usar bibliotecas de WebSocket externas** — a API nativa `WebSocket` do React Native é suficiente

---

## Protocolo de Mensagens WebSocket

Definir o contrato de mensagens antes de implementar. Todas as mensagens são JSON:

```typescript
// Mensagens recebidas do servidor
type ServerMessage =
  | { type: 'MATCH_STATE'; match: Match; pressureBar: PressureBarState }
  | { type: 'PREDICTION'; prediction: Prediction }
  | { type: 'PRESSURE_UPDATE'; pressureBar: PressureBarState }
  | { type: 'PREDICTION_RESULT'; predictionId: string; correctOption: number };

// Mensagens enviadas pelo cliente
type ClientMessage =
  | { type: 'ANSWER'; predictionId: string; selectedOption: number; gpsMultiplier: number };
```

> Este contrato é compartilhado com o Plano 04. O Pipeline AWS deve publicar mensagens neste mesmo formato.

---

## Arquivos a Implementar

### `src/hooks/useWebSocket.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';

type MessageHandler = (data: any) => void;

export function useWebSocket(url: string, onMessage: MessageHandler) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    ws.current = new WebSocket(url);

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        console.warn('[WS] Mensagem inválida:', event.data);
      }
    };

    ws.current.onclose = () => {
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.current.onerror = (e) => {
      console.warn('[WS] Erro:', e);
    };
  }, [url, onMessage]);

  const send = useCallback((data: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    ws.current?.close();
    ws.current = null;
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { send };
}
```

### `src/store/arenaStore.ts`

```typescript
import { create } from 'zustand';
import type { Match, Prediction, PressureBarState } from '../types';

interface ArenaState {
  match: Match | null;
  pressureBar: PressureBarState;
  activePrediction: Prediction | null;
  setMatch: (match: Match) => void;
  setActivePrediction: (prediction: Prediction | null) => void;
  updatePressure: (pressureBar: PressureBarState) => void;
  reset: () => void;
}

const initialPressure: PressureBarState = { teamA: 50, teamB: 50 };

export const useArenaStore = create<ArenaState>((set) => ({
  match: null,
  pressureBar: initialPressure,
  activePrediction: null,

  setMatch: (match) => set({ match }),
  setActivePrediction: (prediction) => set({ activePrediction: prediction }),
  updatePressure: (pressureBar) => set({ pressureBar }),
  reset: () => set({ match: null, pressureBar: initialPressure, activePrediction: null }),
}));
```

### `src/services/matchSimulator.ts`

Usado para testar o Arena sem o Plano 04:

```typescript
import type { Match, Prediction, PressureBarState } from '../types';

export const MOCK_MATCH: Match = {
  id: 'match-001',
  teamA: { id: 'team-a', name: 'Time A', color: '#E63946' },
  teamB: { id: 'team-b', name: 'Time B', color: '#1D3557' },
  minute: 23,
  status: 'live',
};

export const MOCK_PREDICTIONS: Prediction[] = [
  {
    id: 'pred-001',
    matchId: 'match-001',
    question: 'O escanteio vai resultar em gol?',
    options: ['Sim, gol direto', 'Cabeçada na área', 'Defesa do goleiro', 'Para fora'],
    expiresAt: new Date(Date.now() + 15000).toISOString(),
  },
  {
    id: 'pred-002',
    matchId: 'match-001',
    question: 'Quem vai cobrar a falta perigosa?',
    options: ['Jogador #10', 'Jogador #7', 'Jogador #4', 'Ninguém (barreira)'],
    expiresAt: new Date(Date.now() + 15000).toISOString(),
  },
];

// Emite uma predição mock a cada 20 segundos para testar o fluxo
export function startMockSimulator(onPrediction: (p: Prediction) => void, onPressure: (ps: PressureBarState) => void) {
  let index = 0;
  const interval = setInterval(() => {
    const prediction = MOCK_PREDICTIONS[index % MOCK_PREDICTIONS.length];
    onPrediction({ ...prediction, id: `pred-${Date.now()}`, expiresAt: new Date(Date.now() + 15000).toISOString() });
    index++;

    // Simula atualização de pressão 5 segundos depois
    setTimeout(() => {
      onPressure({ teamA: 40 + Math.random() * 20, teamB: 40 + Math.random() * 20 });
    }, 5000);
  }, 20000);

  return () => clearInterval(interval);
}
```

### `src/components/arena/PressureBar.tsx`

```tsx
import { View, Text } from 'react-native';
import type { PressureBarState, Match } from '../../types';

interface Props {
  pressureBar: PressureBarState;
  match: Match;
}

export function PressureBar({ pressureBar, match }: Props) {
  const total = pressureBar.teamA + pressureBar.teamB;
  const widthA = total > 0 ? (pressureBar.teamA / total) * 100 : 50;

  return (
    <View className="px-4 py-3">
      <View className="flex-row justify-between mb-1">
        <Text className="font-bold text-sm" style={{ color: match.teamA.color }}>{match.teamA.name}</Text>
        <Text className="font-bold text-sm" style={{ color: match.teamB.color }}>{match.teamB.name}</Text>
      </View>
      <View className="flex-row h-6 rounded-full overflow-hidden">
        <View style={{ flex: widthA, backgroundColor: match.teamA.color }} />
        <View style={{ flex: 100 - widthA, backgroundColor: match.teamB.color }} />
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-xs text-gray-500">{Math.round(pressureBar.teamA)} pts</Text>
        <Text className="text-xs text-gray-500">{Math.round(pressureBar.teamB)} pts</Text>
      </View>
    </View>
  );
}
```

### `src/components/arena/PredictionCard.tsx`

```tsx
import { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import type { Prediction } from '../../types';

interface Props {
  prediction: Prediction | null;
  onAnswer: (optionIndex: number) => void;
  onExpire: () => void;
}

export function PredictionCard({ prediction, onAnswer, onExpire }: Props) {
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    if (!prediction) return;
    setTimeLeft(15);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); onExpire(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [prediction?.id]);

  if (!prediction) return null;

  return (
    <Modal transparent animationType="slide" visible={!!prediction}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold flex-1 mr-4">{prediction.question}</Text>
            <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
              <Text className="text-red-600 font-bold">{timeLeft}</Text>
            </View>
          </View>
          {prediction.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              className="border border-gray-200 rounded-xl py-4 px-5 mb-3"
              onPress={() => onAnswer(index)}
            >
              <Text className="text-base">{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}
```

### `src/app/arena/[matchId].tsx`

```tsx
import { useEffect, useCallback } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useArenaStore } from '../../store/arenaStore';
import { useAuthStore } from '../../store/authStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { PressureBar } from '../../components/arena/PressureBar';
import { PredictionCard } from '../../components/arena/PredictionCard';
import { API_WS_URL } from '../../constants/config';
import { MOCK_MATCH, startMockSimulator } from '../../services/matchSimulator';

export default function ArenaScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuthStore();
  const { match, pressureBar, activePrediction, setMatch, setActivePrediction, updatePressure, reset } = useArenaStore();

  // Inicializar com mock enquanto Plano 04 não está pronto
  useEffect(() => {
    setMatch(MOCK_MATCH);
    const stop = startMockSimulator(setActivePrediction, updatePressure);
    return () => { stop(); reset(); };
  }, []);

  const handleMessage = useCallback((data: any) => {
    if (data.type === 'MATCH_STATE') { setMatch(data.match); updatePressure(data.pressureBar); }
    if (data.type === 'PREDICTION') setActivePrediction(data.prediction);
    if (data.type === 'PRESSURE_UPDATE') updatePressure(data.pressureBar);
  }, []);

  const { send } = useWebSocket(`${API_WS_URL}?matchId=${matchId}`, handleMessage);

  const handleAnswer = (optionIndex: number) => {
    send({ type: 'ANSWER', predictionId: activePrediction?.id, selectedOption: optionIndex, gpsMultiplier: 1 });
    setActivePrediction(null);
  };

  if (!match) return <View className="flex-1 items-center justify-center"><Text>Carregando partida...</Text></View>;

  return (
    <View className="flex-1 bg-gray-950">
      <Text className="text-white text-center text-xl font-bold pt-12 pb-4">
        {match.teamA.name} vs {match.teamB.name}
      </Text>
      <Text className="text-gray-400 text-center mb-4">{match.minute}'</Text>

      <PressureBar pressureBar={pressureBar} match={match} />

      <PredictionCard
        prediction={activePrediction}
        onAnswer={handleAnswer}
        onExpire={() => setActivePrediction(null)}
      />
    </View>
  );
}
```

---

## Critérios de Aceitação (Checklist de Done)

- [ ] Navegar para `arena/[matchId]` abre a tela da Arena sem erros
- [ ] `PressureBar` renderiza com as cores dos dois times
- [ ] `PredictionCard` aparece como modal após 20 segundos (mock)
- [ ] Timer regressivo de 15 segundos funciona no `PredictionCard`
- [ ] Selecionar uma opção fecha o modal imediatamente
- [ ] Timer chegando a zero fecha o modal automaticamente
- [ ] `PressureBar` atualiza após resposta (mock de pressão)
- [ ] Sair da tela da Arena limpa o `arenaStore`
- [ ] Indicador "Reconectando..." aparece quando WebSocket cai
- [ ] Fluxo completo funciona com dados do `matchSimulator` (sem AWS)
- [ ] `tsc --noEmit` passa sem erros

---

## O que este plano entrega para os próximos

| Plano | O que usa deste plano |
|-------|----------------------|
| Plano 04 | Protocolo de mensagens WebSocket (contrato de tipos); `arenaStore` pronto para receber dados reais |
| Plano 06 | `arenaStore.submitAnswer` para aplicar multiplicador GPS; `PressureBar` para overlay AR |
