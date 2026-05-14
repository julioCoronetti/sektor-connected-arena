import { KinesisClient, PutRecordCommand } from "@aws-sdk/client-kinesis";

const client = new KinesisClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const EVENT_TYPES = ["GOAL", "YELLOW_CARD", "CORNER", "FOUL"] as const;
type EventType = (typeof EVENT_TYPES)[number];

interface DFLEvent {
  matchId: string;
  eventType: EventType | "MATCH_START";
  timestamp: string;
  teamId: string;
  minute: number;
}

async function emitEvent(
  matchId: string,
  teamId: string,
  minute: number,
  eventType?: EventType | "MATCH_START",
) {
  const type =
    eventType ?? EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const event: DFLEvent = {
    matchId,
    eventType: type,
    timestamp: new Date().toISOString(),
    teamId,
    minute,
  };

  await client.send(
    new PutRecordCommand({
      StreamName: process.env.KINESIS_STREAM_NAME ?? "sektor-match-events",
      Data: Buffer.from(JSON.stringify(event)),
      PartitionKey: matchId,
    }),
  );

  console.log(`[${minute}'] Evento emitido: ${type} (${teamId})`);
}

async function simulate(matchId: string, durationMinutes: number) {
  const teams = ["team-a", "team-b"];
  let minute = 1;

  console.log(
    `Iniciando simulação: matchId=${matchId}, duração=${durationMinutes}min`,
  );

  // Emite MATCH_START
  await emitEvent(matchId, teams[0], 0, "MATCH_START");

  while (minute <= durationMinutes) {
    const delay = 10_000 + Math.random() * 20_000; // 10–30 segundos
    await new Promise((r) => setTimeout(r, delay));
    const teamId = teams[Math.floor(Math.random() * 2)];
    await emitEvent(matchId, teamId, minute);
    minute++;
  }

  console.log("Simulação encerrada.");
}

// Uso: npx ts-node scripts/simulate-match.ts match-001 10
const [matchId, duration] = process.argv.slice(2);
simulate(matchId ?? "match-001", parseInt(duration ?? "10", 10));
