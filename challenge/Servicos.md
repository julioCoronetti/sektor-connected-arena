# Services

### Frontend (Mobile)

- **React Native with Expo:** Main framework for the native mobile app (iOS and Android).
- **NativeWind (Tailwind for React Native):** Styling the UI.
- **Expo Router:** Navigation across screens (Community feed, Arena mode, Profile).

### Authentication & Users

- **Amazon Cognito:** Login, sign-up and session management, associating each fan with their chosen team.

### Backend & Real-time

- **Amazon API Gateway (REST):** Standard HTTP endpoints for the community area (load posts, like, comment).
- **Amazon API Gateway (WebSocket):** Maintain bidirectional real-time connections during Arena Mode to deliver questions and update the PressureBar.
- **AWS Lambda:** Business logic (process guesses, compute multipliers, update scores).

### Database & Storage

- **Amazon DynamoDB:** NoSQL storage for user profiles, community posts, current pressure bar state and active WebSocket connections.
- **Amazon S3:** Media storage for profile images and community uploads.

### Game Data Pipeline

- **Amazon Kinesis (can be simulated):** Real-time ingestion of DFL Live Match Event Feed data.
- **AWS Lambda / Local script (can be simulated):** Read a match history JSON and sequentially emit events into Kinesis to simulate a live match.
- **Amazon EventBridge:** Route match events to trigger specific Lambdas (e.g., a foul triggers the AI to create a question).

### AI & Personalization

- **Amazon Bedrock (Claude / Llama):**
    - Generate contextual prediction questions based on the most recent match event.
    - Perform sentiment analysis on the crowd chat to create app alerts.

### Geolocation & Spatial Experience (AR)

- **Expo Location (can be simulated):** Collect device GPS coordinates to validate stadium check-in and apply the 2x multiplier to the crowd PressureBar score.
- **Expo Camera / ViroReact (can be simulated):** Access the device camera and render AR elements to project the energy bar and crowd scoreboard over the field image.
