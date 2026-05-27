# Script — presentation_video.mp4

**Total duration:** ≤ 3 minutes | **Resolution:** 720p or lower | **Tool:** OBS / Quicktime / Loom

---

## Preparation before recording

1. Open the app on an Android/iOS simulator (or physical device)
2. Open Watch Party in a browser: `https://vzgv26s18d.execute-api.us-east-1.amazonaws.com/prod` → navigate to `/watch-party/match-001` (after web build)
3. Have 2 accounts ready: `fan-a` (team-a) and `fan-b` (team-b)
4. Simulator ready to run: `npm run simulate match-001 3`

---

## Scenes

### 0:00 – 0:20 | Pitch (voice + slide or black screen with text)

> "Football fans don’t just want to watch. They want to participate, compete and feel they make a difference in the match. Sektor turns every match event into a moment of real-time collective engagement."

**Visual:** Sektor logo or opening slide.

---

### 0:20 – 0:45 | Login + Team Selection

**On-screen actions:**
1. Open the app → login screen
2. Sign in as `fan-a@test.com`
3. Show team selection (e.g., FC Team)
4. Arrive at Home (Community)

**Voice:**
> "Each fan chooses their team. From then on, everything is personalized — the forum, the predictions, the PressureBar."

---

### 0:45 – 1:30 | Arena Mode — Live Prediction

**On-screen actions:**
1. Tap "Arena" → "Enter Demo Match"
2. Show Arena screen: scoreboard, pressure bar, status "Live"
3. In another terminal (not recorded): `npm run simulate match-001 3`
4. Wait ~5s → PredictionCard appears with Bedrock-generated question
5. Answer an option
6. Show ANSWER_ACCEPTED + score increasing
7. After 15s: PREDICTION_RESULT + PRESSURE_UPDATE animates the bar

**Voice:**
> "When a goal or foul happens, Bedrock generates an instant personalized prediction for the crowd. Fans answer in 15 seconds. Correct? Points and pressure for the team."

---

### 1:30 – 2:00 | Multiplayer — 2 Crowds Simultaneous

**On-screen actions:**
1. Split screen or quick cut: device A (FC Team) and device B (Club) side-by-side
2. Show that each receives a different question (crowd personalization)
3. Show leaderboard updating with both users

**Voice:**
> "Two fans, two teams, two perspectives. Predictions are personalized by crowd. The live leaderboard shows who’s leading."

---

### 2:00 – 2:20 | Watch Party Web + GPS

**On-screen actions:**
1. Show browser Watch Party: big scoreboard, pressure bar, top 5
2. Show GPS badge "📍 In Stadium 2x" in the app (simulate GPS inside the stadium)
3. Show streak 🔥 and an unlocked badge

**Voice:**
> "The Watch Party runs in the browser — perfect for big screens in bars and stadiums. On-site fans get a 2x multiplier. Consecutive correct answers unlock achievements."

---

### 2:20 – 2:40 | AR + Community

**On-screen actions:**
1. Tap "AR Mode" → camera opens with pressure bar overlay
2. Cut to Community tab: team feed, create post

**Voice:**
> "In AR mode, the PressureBar appears over the camera — ready for the stadium. Between matches, the community keeps engagement alive."

---

### 2:40 – 3:00 | North Star + Closing

**Visual:** Ecosystem slide (mobile + web + AR + wearable + stadium)

**Voice:**
> "Sektor is an ecosystem. Mobile, web, AR, wearables, stadium — all connected, all real-time. Built on AWS: Kinesis, Bedrock, API Gateway WebSocket, DynamoDB. Thank you."

---

## Recording tips

- Record at 1280x720 or 960x540 (below 720p as per challenge rule)
- Use OBS with a "Screen + small Webcam" scene or screen-only
- No complex editing required — continuous recording is accepted
- If it freezes: pause OBS, resume, cut later in editor
- App background is dark (#0F0F0F) — works well on recordings
