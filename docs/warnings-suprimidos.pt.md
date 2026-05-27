# Warnings Suprimidos

Registro de warnings do React Native suprimidos via `LogBox.ignoreLogs`, com origem confirmada e condição de remoção.

---

## Warning: `props.pointerEvents is deprecated. Use style.pointerEvents`

### Descrição

O React Native emite este warning quando um componente recebe `pointerEvents` como prop direta em vez de via `style.pointerEvents`. A API de prop foi depreciada em favor da propriedade de estilo.

### Origem

**Dependência de terceiros** — o warning não é originado por código do app, mas por uma das seguintes dependências candidatas:

| Pacote | Versão no projeto |
|---|---|
| `react-native-reanimated` | `~4.1.1` |
| `@react-navigation/elements` | `^2.6.3` |
| `expo-router` | `~6.0.23` |

O código do app não usa `pointerEvents` como prop direta; portanto, a supressão é segura e não mascara nenhum problema interno.

### Estratégia adotada

Supressão explícita via `LogBox.ignoreLogs` no escopo do módulo de `src/app/_layout.tsx`, logo após os imports:

```tsx
// Suprime warning de prop deprecada originado por dependência de terceiros.
// Candidatos: react-native-reanimated ~4.1.1, @react-navigation/elements ^2.6.3,
// expo-router ~6.0.23. Remover quando a dependência for atualizada.
LogBox.ignoreLogs(["props.pointerEvents is deprecated"]);
```

A supressão fica centralizada em `_layout.tsx` (raiz da navegação) para garantir que seja aplicada antes de qualquer tela ser renderizada.

### Condição de remoção

Remover a linha `LogBox.ignoreLogs(["props.pointerEvents is deprecated"])` de `_layout.tsx` **quando a dependência causadora for atualizada para uma versão que use `style.pointerEvents` internamente**.

Passos para verificar se a remoção é segura:
1. Atualizar a dependência suspeita (ex.: `react-native-reanimated`, `@react-navigation/elements` ou `expo-router`).
2. Remover a linha de supressão.
3. Executar o app e percorrer o fluxo de autenticação (`/login` → `/select-team` → `/community`).
4. Confirmar que o warning não reaparece no console do Metro.

### Referência

- **Spec:** `corrigir-fluxo-auth-cognito`
- **Task:** `5.2 Criar docs/warnings-suprimidos.md documentando a origem e estratégia`
- **Requisito:** `2.4`
