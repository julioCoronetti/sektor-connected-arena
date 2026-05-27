# Smoke Test — Authentication Flow (V4)

Manual smoke procedure to validate the full flow:
**cold start → `/login` → `/select-team` → `/community`**

Reference spec: `corrigir-fluxo-auth-cognito`

---

## Infrastructure references

| Resource            | Value                          |
|--------------------|--------------------------------|
| Cognito User Pool  | `us-east-1_cHokaMBWW`         |
| App Client ID      | `68i7il8tnlbc92r8hobs5op7t`   |
| Region             | `us-east-1`                   |

---

## Precondition: Clear Cognito session

The device/emulator must not have a valid Cognito session before starting the test.
Choose **one** of the options below:

### Option A — Sign out from the app
1. Open the app (if already logged in).
2. Go to profile or settings.
3. Tap **Sign out**.
4. Confirm the app redirects to `/login`.

### Option B — Clear AsyncStorage via Expo DevTools
1. With the app open and Metro running, open Expo DevTools in your browser.
2. Go to **Storage** → **AsyncStorage**.
3. Delete all keys related to Amplify/Cognito (prefix `CognitoIdentityServiceProvider.*`).
4. Force-close the app and reopen.

### Option C — Reinstall the app (most reliable)
```bash
# Android (emulator or device via ADB)
adb uninstall com.sektor.connectedarena
npx expo run:android

# iOS (simulator)
xcrun simctl uninstall booted com.sektor.connectedarena
npx expo run:ios
```

> **Check:** After clearing the session, opening the app should go directly to
> `/login` without passing through `/community` or `/select-team`.

---

## Smoke Test Steps

### Step 1 — Cold start → `/login` appears in ≤ 10 s

**Action:** Fully close the app (force-close) and reopen from the icon.

**Acceptance criteria:**
- The `/login` screen (email/password form) appears in **no more than 10 seconds**.
- **No eternal spinner** — any loader disappears before 10s.
- Metro console **does not** show `isLoading` stuck on `true`.

**Result:** ☐ Pass &nbsp;&nbsp; ☐ Fail

---

### Step 2 — Login with test credentials → user authenticated

**Action:** On `/login`, enter test credentials and tap **Sign in**.

> Test credentials must belong to a valid Cognito user in User Pool
> `us-east-1_cHokaMBWW` **without** the `custom:teamId` attribute set.

**Acceptance criteria:**
- The loading indicator (`isLoading`) appears briefly and clears after Cognito response.
- The user authenticates successfully (no error shown on screen).
- Metro console **does not** show unexpected auth errors.

**Result:** ☐ Pass &nbsp;&nbsp; ☐ Fail

---

### Step 3 — `/select-team` appears for user without `custom:teamId`

**Action:** After Step 2 login, observe the screen the app navigates to.

**Acceptance criteria:**
- The app navigates to `/select-team` automatically.
- The screen shows available team options (e.g., "Time A", "Time B").
- The app does NOT navigate straight to `/community` (since `custom:teamId` is not set).

**Result:** ☐ Pass &nbsp;&nbsp; ☐ Fail

---

### Step 4 — Select team → no HTTP 400; navigates to `/community`

**Action:** On `/select-team`, tap **"Time A"** (or the available team).

**Acceptance criteria:**
- Metro console does NOT show `HTTP 400` nor the message
  `user.custom:teamId: Attribute does not exist in the schema.`
- The app navigates to `/community` after selection.
- The attribute `custom:teamId` is persisted in Cognito (verifiable via AWS Console or `aws cognito-idp admin-get-user --user-pool-id us-east-1_cHokaMBWW --username <email>`).

**Result:** ☐ Pass &nbsp;&nbsp; ☐ Fail

---

## Evidence section

Fill after executing the smoke test:

| Field              | Value                          |
|--------------------|--------------------------------|
| Execution date     |                                |
| Executor           |                                |
| App version        |                                |
| Platform           | ☐ Android &nbsp; ☐ iOS        |
| Device / Emulator  |                                |
| Branch / Commit    |                                |

### Result per step

| Step | Description                                      | Result              |
|------|--------------------------------------------------|---------------------|
| 1    | Cold start → `/login` in ≤ 10 s                  | ☐ Pass &nbsp; ☐ Fail |
| 2    | Login → `isLoading` clears, user authenticated    | ☐ Pass &nbsp; ☐ Fail |
| 3    | `/select-team` for user without `custom:teamId`   | ☐ Pass &nbsp; ☐ Fail |
| 4    | Tap "Time A" → no HTTP 400, navigates to `/community` | ☐ Pass &nbsp; ☐ Fail |

---

## Done criteria for the spec

This smoke test corresponds to spec **V4** of `corrigir-fluxo-auth-cognito`.
The spec is complete only when **all four steps** are marked **Pass** and the evidence section is filled.

Related validations:
- **V1** — Automated test: `initialize()` clears `isLoading` (Jest)
- **V2** — Automated test: `setTeam()` persists `custom:teamId` (Jest)
- **V3** — Infra script: `scripts/check-cognito-schema.ts` → exit code 0
- **V4** — This manual smoke test
- **V5** — Absence of warning `props.pointerEvents is deprecated` in logs
- **V6** — Preservation tests passing (Jest)
