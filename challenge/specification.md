# Description

# Specification Document: Sektor

## 1. Overview

Mobile application that acts as the official hub for fan crowds. Outside match time it behaves like a forum (social feed). During matches, the UI switches to "Arena Mode", where fans compete in real time (Crowd A vs Crowd B) solving micro-predictions generated from real match events. Correct answers generate "Pressure/Energy" for the crowd on a global scoreboard.

## 2. Main Features

- **Community (Forum):** Team-filtered feed with posts, comments and likes.
- **Arena Mode (Real-time):** Prediction pop-ups triggered by match progress.
- **Shared PressureBar:** Live visual scoreboard in a "tug-of-war" format that reacts mathematically to each crowd’s correct answers.
- **Geolocation / Multiplier (can be simulated):** Presence validation in the stadium to apply extra weight (e.g., 2x) to Pressure scoring.
- **AR View (can be simulated):** Use device camera to project the PressureBar over the field.

## 3. Tech Stack and Tools

### Interface & Mobile (Frontend)

- **React Native + Expo:** Mobile app (iOS + Android). Native access to camera and GPS.
- **NativeWind:** Styling library for components.
- **AWS Amplify (SDK):** Library used in the React Native code to communicate with AWS infra.

### Authentication

- **Amazon Cognito:** Sign-up, sign-in and storing the base user attribute (chosen team).

### Backend & Real-time

- **Amazon API Gateway (REST):** Async requests for the forum (read posts, upload media, like).
- **Amazon API Gateway (WebSocket):** Bidirectional channel during Arena Mode to deliver questions and update the PressureBar to all connected users.
- **AWS Lambda:** Server-side routines. Processes correct/wrong predictions, computes geolocation multipliers and sends updated match state to WebSocket.

### Database & Storage

- **Amazon DynamoDB:** Stores tables: Users, Posts (Forum), Current Match State (Pressure A x B) and Active WebSocket Connections.
- **Amazon S3:** Stores profile images and attachments posted in the forum.

### Match Data Pipeline (DFL Feed)

- **Local Node/Python script (Simulator):** Reads a JSON file (DFL Live Match Mock) and emits events based on timestamps.
- **Amazon Kinesis (can be simulated):** Receives the continuous event stream.
- **Amazon EventBridge:** Listens to events from Kinesis (e.g., "Dangerous Free Kick", "Card") and triggers the corresponding Lambdas.

### Artificial Intelligence

- **Amazon Bedrock (Claude/Llama):**
    1. Receives event context (via Lambda) and generates a JSON containing an instant multiple-choice question.
    2. Reads recent chat messages to generate a sentiment alert (e.g., "Team A fans are confident").

### Spatial Integration (AR)

- **Expo Location (can be simulated):** Captures device lat/long.
- **Expo Camera / ViroReact (can be simulated):** Renders AR layers on top of the camera feed.

## 4. Arena Mode Execution Flow (Example)

1. User enters "Arena Mode" and opens a persistent connection to **API Gateway (WebSocket)**.
2. The simulator emits an event ("Team A had a corner") into **Kinesis**.
3. **EventBridge** captures the event and invokes a **Lambda**.
4. Lambda calls **Bedrock**: *"Generate a quick multiple-choice question about a corner"* and receives a response.
5. Lambda sends the question via **WebSocket** to all connected users’ screens.
6. A user taps an answer. The frontend sends the choice and GPS coordinates.
7. A Lambda calculates: Correct? Is the user in the stadium? (If yes, apply 2x multiplier).
8. Lambda updates the Score table in **DynamoDB** and returns the new PressureBar value via **WebSocket**.
9. All devices update their screens.

## 5. Challenge Requirements Mapping

- **Multiplayer / Real-time:** Yes (WebSockets via API Gateway).
- **Live DFL data:** Yes (ingestion via Kinesis simulated/EventBridge).
- **Gamification:** Yes (PressureBar, crowd scoring and check-in multiplier).
- **AI/Personalization:** Yes (Bedrock generating event-based predictions and sentiment summaries).
- **Spatial / Cross-platform:** Yes (GPS validation and AR mockup via Camera).
