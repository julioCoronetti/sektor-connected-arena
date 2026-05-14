import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';

const client = new KinesisClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

const EVENT_TYPES = ['GOAL', 'YELLOW_CARD', 'CORNER', 'FOUL'] as const;
type EventType = (typeof EVENT_TYPES)[number];

interface DFLEvent {
  matchId: string;
  eventType: EventType | 'MATCH_START';
  timestamp: string;
  teamId: string;
  minute: number;
}

async function emitEvent(
  streamName: string,
  matchId: string,
  eventType: DFLEvent['eventType'],
  teamId: string,
  minute: number,
) {
  const event: DFLEvent = {
    matchId,
    eventType,
    timestamp: new Date().toISOString(),
    teamId,
    minute,
  };

  await client.send(
    new PutRecordCommand({
      StreamName: streamName,
      Data: Buffer.from(JSON.stringify(event)),
      PartitionKey: matchId,
    }),
  );

  console.log(`[${minute}'] Evento emitido: ${eventType} (${teamId})`);
}

async function simulate(matchId: string, durationMinutes: number) {
  const streamName = process.env.KINESIS_STREAM_NAME ?? 'sektor-match-events';
  const teams = ['team-a', 'team-b'];

  console.log(`Iniciando simulação: matchId=${matchId}, duração=${durationMinutes}min`);

  // Emite MATCH_START
  await emitEvent(streamName, matchId, 'MATCH_START', teams[0], 0);

  let minute = 1;
  while (minute <= durationMinutes) {
    const delay = 10000 + Math.random() * 20000; // 10–30 segundos
    await new Promise((r) => setTimeout(r, delay));
    const teamId = teams[Math.floor(Math.random() * 2)];
    const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    await emitEvent(streamName, matchId, eventType, teamId, minute);
    minute++;
  }

  console.log('Simulação encerrada.');
}

// Exporta para testes
export { EVENT_TYPES, emitEvent, simulate };
export type { DFLEvent };

// Uso: npx ts-node scripts/simulate-match.ts match-001 10
const [matchId, duration] = process.argv.slice(2);
simulate(matchId ?? 'match-001', parseInt(duration ?? '10', 10));
