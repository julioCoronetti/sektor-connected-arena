# Suppressed Warnings

Record of React Native warnings suppressed via `LogBox.ignoreLogs`, with confirmed origin and removal condition.

---

## Warning: `props.pointerEvents is deprecated. Use style.pointerEvents`

### Description

React Native emits this warning when a component receives `pointerEvents` as a direct prop instead of via `style.pointerEvents`. The prop API was deprecated in favor of the style property.

### Origin

**Third-party dependency** — the warning is not caused by app code, but by one of the following candidate dependencies:

| Package | Version in project |
|---|---|
| `react-native-reanimated` | `~4.1.1` |
| `@react-navigation/elements` | `^2.6.3` |
| `expo-router` | `~6.0.23` |

The app does not use `pointerEvents` as a direct prop; therefore suppressing this warning is considered safe and does not mask an internal issue.

### Adopted strategy

Explicit suppression via `LogBox.ignoreLogs` in the root layout module `src/app/_layout.tsx`, right after imports:

```tsx
// Suppress deprecated prop warning coming from a third-party dependency.
// Candidates: react-native-reanimated ~4.1.1, @react-navigation/elements ^2.6.3,
// expo-router ~6.0.23. Remove when the dependency is updated.
LogBox.ignoreLogs(["props.pointerEvents is deprecated"]);
```

Suppression is centralized in `_layout.tsx` (navigation root) to ensure it is applied before any screen renders.

### Removal condition

Remove `LogBox.ignoreLogs(["props.pointerEvents is deprecated"])` from `_layout.tsx` **when the causing dependency is updated to a version that uses `style.pointerEvents` internally**.

Steps to verify it is safe to remove:
1. Upgrade the suspected dependency (e.g., `react-native-reanimated`, `@react-navigation/elements` or `expo-router`).
2. Remove the suppression line.
3. Run the app and navigate the auth flow (`/login` → `/select-team` → `/community`).
4. Confirm the warning does not reappear in the Metro console.

### Reference

- **Spec:** `corrigir-fluxo-auth-cognito`
- **Task:** `5.2 Create docs/warnings-suprimidos.md documenting origin and strategy`
- **Requirement:** `2.4`
