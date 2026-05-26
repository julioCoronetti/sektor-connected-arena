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
  {
    id: "team-a",
    dflId: "DFL-CLU-000001",
    name: "FC Team",
    shortName: "FCT",
    color: "#E63946",
    description: "Time da casa. Paixão e garra em cada partida.",
  },
  {
    id: "team-b",
    dflId: "DFL-CLU-000002",
    name: "Club",
    shortName: "CLU",
    color: "#1D3557",
    description: "Time visitante. Tradição e estratégia no DNA do clube.",
  },
] as const;

export const DEMO_MATCH_ID = "match-001";
