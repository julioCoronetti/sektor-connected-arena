export const AWS_REGION = "us-east-1";

export const API_REST_URL =
  process.env.EXPO_PUBLIC_API_REST_URL ??
  "https://PLACEHOLDER.execute-api.us-east-1.amazonaws.com/prod";

export const API_WS_URL =
  process.env.EXPO_PUBLIC_API_WS_URL ??
  "wss://PLACEHOLDER.execute-api.us-east-1.amazonaws.com/prod";

export const STADIUM_COORDS = {
  latitude: -23.5505, // Substituir pelas coordenadas reais no Plano 06
  longitude: -46.6333,
  radiusMeters: 500,
};

export const TEAMS = [
  { id: "team-a", name: "Time A", color: "#E63946" },
  { id: "team-b", name: "Time B", color: "#1D3557" },
] as const;
