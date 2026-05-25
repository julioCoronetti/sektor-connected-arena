/**
 * simulate-match.ts
 *
 * Lê os dados reais do bucket S3 (hackathon-data-482712210181) e replica
 * a partida em tempo real via Kinesis, emitindo mensagens compatíveis com
 * o protocolo WebSocket do app (ServerMessage).
 *
 * Fluxo:
 *  1. Baixa MatchInformations_Anonym.xml  → metadados dos times/jogadores
 *  2. Baixa Events_Anonym.xml             → eventos da partida (gols, faltas, etc.)
 *  3. Baixa kpi_data_Bayern_Hamburg.xml   → KPIs avançados (posse, xG, passes)
 *  4. Faz streaming do Positions_Bayern_Hamburg.xml em chunks → tracking posicional
 *  5. Emite mensagens ordenadas por timestamp simulando tempo real
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/simulate-match.ts [matchId] [speedFactor]
 *
 *   speedFactor: multiplicador de velocidade (padrão 60 = 1 minuto real = 1 segundo)
 */

import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { KinesisClient, PutRecordCommand } from "@aws-sdk/client-kinesis";
import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const BUCKET = "hackathon-data-482712210181";
const BASE_KEY =
  "Challenge 4 \u2013 Connected Arena - A Real-Time Multiplayer Fan Engagement Ecosystem/data/Match-Events";

const FILES = {
  matchInfo: `${BASE_KEY}/MatchInformations_Anonym.xml`,
  events: `${BASE_KEY}/Events_Anonym.xml`,
  kpi: `${BASE_KEY}/kpi_data_Bayern_Hamburg.xml`,
  positions: `${BASE_KEY}/Positions_Bayern_Hamburg.xml`,
} as const;

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const kinesis = new KinesisClient({ region: process.env.AWS_REGION ?? "us-east-1" });

const STREAM_NAME = process.env.KINESIS_STREAM_NAME ?? "sektor-match-events";

// ---------------------------------------------------------------------------
// Tipos internos do simulador
// ---------------------------------------------------------------------------

interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  role: "home" | "guest";
  players: Map<string, PlayerInfo>;
}

interface PlayerInfo {
  personId: string;
  shirtNumber: number;
  shortName: string;
  playingPosition: string;
}

interface ParsedEvent {
  eventId: string;
  timestamp: Date;
  x?: number;
  y?: number;
  type: string;
  teamId?: string;
  playerId?: string;
  raw: Record<string, unknown>;
}

interface PositionRecord {
  personId: string;
  teamId: string;
  frameN: number;
  timestamp: Date;
  x: number;
  y: number;
  speed: number;
}

// ---------------------------------------------------------------------------
// Helpers S3
// ---------------------------------------------------------------------------

async function fetchS3Text(key: string): Promise<string> {
  console.log(`[S3] Baixando: ${key.split("/").pop()}`);
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const res = await s3.send(cmd);
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// ---------------------------------------------------------------------------
// Parsers XML
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    ["Player", "Trainer", "Team", "Event", "Frame", "FrameSet"].includes(name),
});

function parseMatchInfo(xml: string): Map<string, TeamInfo> {
  const doc = xmlParser.parse(xml);
  const teams = new Map<string, TeamInfo>();

  const teamsArr: unknown[] =
    doc?.PutDataRequest?.MatchInformation?.Teams?.Team ?? [];

  for (const t of teamsArr) {
    const team = t as Record<string, unknown>;
    const attrs = team as Record<string, string>;
    const id: string = attrs["@_TeamId"];
    const role = attrs["@_Role"] === "home" ? "home" : "guest";

    // Cor da camisa principal (fallback por role)
    const rawColor: string = attrs["@_PlayerShirtMainColor"] ?? "";
    const color =
      rawColor && rawColor !== "#00000"
        ? rawColor
        : role === "home"
        ? "#E63946"
        : "#1D3557";

    const players = new Map<string, PlayerInfo>();
    const playersArr: unknown[] =
      (team.Players as Record<string, unknown[]>)?.Player ?? [];

    for (const p of playersArr) {
      const player = p as Record<string, string>;
      const personId = player["@_PersonId"];
      players.set(personId, {
        personId,
        shirtNumber: parseInt(player["@_ShirtNumber"] ?? "0", 10),
        shortName: player["@_Shortname"] ?? "",
        playingPosition: player["@_PlayingPosition"] ?? "",
      });
    }

    teams.set(id, {
      id,
      name: attrs["@_TeamName"],
      shortName: attrs["@_ShortName"],
      color,
      role,
      players,
    });
  }

  return teams;
}

function parseEvents(xml: string): ParsedEvent[] {
  const doc = xmlParser.parse(xml);
  const rawEvents: unknown[] = doc?.PutDataRequest?.Event ?? [];
  const events: ParsedEvent[] = [];

  for (const e of rawEvents) {
    const ev = e as Record<string, unknown>;
    const eventId = String(ev["@_EventId"] ?? "");
    const tsStr = String(ev["@_EventTime"] ?? "");
    if (!eventId || !tsStr) continue;

    let timestamp: Date;
    try {
      timestamp = new Date(tsStr);
      if (isNaN(timestamp.getTime())) continue;
    } catch {
      continue;
    }

    const x = ev["@_X-Position"] != null ? parseFloat(String(ev["@_X-Position"])) : undefined;
    const y = ev["@_Y-Position"] != null ? parseFloat(String(ev["@_Y-Position"])) : undefined;

    // Determina tipo e teamId a partir dos sub-elementos
    let type = "other";
    let teamId: string | undefined;
    let playerId: string | undefined;

    if (ev.KickOff) {
      type = "kickOff";
      const ko = ev.KickOff as Record<string, string>;
      teamId = ko["@_TeamLeft"];
    } else if (ev.ShotAtGoal) {
      const shot = ev.ShotAtGoal as Record<string, unknown>;
      teamId = String(shot["@_Team"] ?? "");
      playerId = String(shot["@_Player"] ?? "");
      type = (shot as Record<string, unknown>).SuccessfulShot ? "goal" : "shot";
    } else if (ev.Foul) {
      const foul = ev.Foul as Record<string, string>;
      type = "foul";
      teamId = foul["@_TeamFouler"];
      playerId = foul["@_Fouler"];
    } else if (ev.Caution) {
      const caution = ev.Caution as Record<string, string>;
      type = caution["@_CardColor"] === "red" ? "redCard" : "yellowCard";
      teamId = caution["@_Team"];
      playerId = caution["@_Player"];
    } else if (ev.FreeKick) {
      const fk = ev.FreeKick as Record<string, string>;
      type = "freeKick";
      teamId = fk["@_Team"];
    } else if (ev.ThrowIn) {
      const ti = ev.ThrowIn as Record<string, string>;
      type = "throwIn";
      teamId = ti["@_Team"];
    } else if (ev.Play) {
      const play = ev.Play as Record<string, string>;
      type = "other";
      teamId = play["@_Team"];
      playerId = play["@_Player"];
    }

    events.push({ eventId, timestamp, x, y, type, teamId, playerId, raw: ev });
  }

  // Ordena por timestamp
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return events;
}

interface KpiAccumulator {
  teamId: string;
  totalPasses: number;
  completedPasses: number;
  xG: number;
  shotsOnTarget: number;
  totalShots: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  possessionMs: number;
}

function parseKpis(
  xml: string,
  events: ParsedEvent[],
): Map<string, KpiAccumulator> {
  const doc = xmlParser.parse(xml);
  const rawEvents: unknown[] = doc?.PutDataRequest?.AdvancedEvents?.Event ?? [];
  const acc = new Map<string, KpiAccumulator>();

  function getOrCreate(teamId: string): KpiAccumulator {
    if (!acc.has(teamId)) {
      acc.set(teamId, {
        teamId,
        totalPasses: 0,
        completedPasses: 0,
        xG: 0,
        shotsOnTarget: 0,
        totalShots: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        possessionMs: 0,
      });
    }
    return acc.get(teamId)!;
  }

  for (const e of rawEvents) {
    const ev = e as Record<string, unknown>;

    if (ev.Play) {
      const play = ev.Play as Record<string, string>;
      const teamId = play["@_TeamId"];
      if (!teamId) continue;
      const kpi = getOrCreate(teamId);
      kpi.totalPasses++;
      if (play["@_Evaluation"] === "successfullyCompleted") {
        kpi.completedPasses++;
      }
    }

    if (ev.TeamPossession) {
      const poss = ev.TeamPossession as Record<string, string>;
      const teamId = poss["@_TeamId"];
      if (!teamId) continue;
      const start = poss["@_SyncedEventTime"]
        ? new Date(poss["@_SyncedEventTime"]).getTime()
        : 0;
      const end = poss["@_EndSyncedEventTime"]
        ? new Date(poss["@_EndSyncedEventTime"]).getTime()
        : 0;
      if (start && end && end > start) {
        getOrCreate(teamId).possessionMs += end - start;
      }
    }
  }

  // Agrega gols, chutes, faltas e cartões dos eventos brutos
  for (const ev of events) {
    if (!ev.teamId) continue;
    const kpi = getOrCreate(ev.teamId);
    if (ev.type === "goal") {
      kpi.shotsOnTarget++;
      kpi.totalShots++;
      const shot = ev.raw.ShotAtGoal as Record<string, string> | undefined;
      if (shot?.["@_xG"]) kpi.xG += parseFloat(shot["@_xG"]);
    } else if (ev.type === "shot") {
      kpi.totalShots++;
      const shot = ev.raw.ShotAtGoal as Record<string, string> | undefined;
      if (shot?.["@_xG"]) kpi.xG += parseFloat(shot["@_xG"]);
    } else if (ev.type === "foul") {
      kpi.fouls++;
    } else if (ev.type === "yellowCard") {
      kpi.yellowCards++;
    } else if (ev.type === "redCard") {
      kpi.redCards++;
    }
  }

  return acc;
}

// ---------------------------------------------------------------------------
// Kinesis emit
// ---------------------------------------------------------------------------

async function emit(matchId: string, message: Record<string, unknown>): Promise<void> {
  await kinesis.send(
    new PutRecordCommand({
      StreamName: STREAM_NAME,
      Data: Buffer.from(JSON.stringify(message)),
      PartitionKey: matchId,
    }),
  );
}

// ---------------------------------------------------------------------------
// Conversão de evento DFL → ServerMessage
// ---------------------------------------------------------------------------

function eventToMinute(ts: Date, kickoffTs: Date): number {
  return Math.floor((ts.getTime() - kickoffTs.getTime()) / 60_000);
}

function eventToSecond(ts: Date, kickoffTs: Date): number {
  return Math.floor(((ts.getTime() - kickoffTs.getTime()) % 60_000) / 1_000);
}

function buildMatchEventMessage(
  ev: ParsedEvent,
  matchId: string,
  kickoffTs: Date,
  teams: Map<string, TeamInfo>,
  score: { home: number; guest: number },
): Record<string, unknown> {
  const minute = eventToMinute(ev.timestamp, kickoffTs);
  const second = eventToSecond(ev.timestamp, kickoffTs);
  const team = ev.teamId ? teams.get(ev.teamId) : undefined;
  const player = team && ev.playerId ? team.players.get(ev.playerId) : undefined;

  return {
    type: "MATCH_EVENT",
    event: {
      eventId: ev.eventId,
      matchId,
      type: ev.type,
      minute,
      second,
      teamId: ev.teamId ?? "",
      playerId: ev.playerId,
      playerName: player?.shortName,
      x: ev.x,
      y: ev.y,
      xG:
        ev.type === "goal" || ev.type === "shot"
          ? (ev.raw.ShotAtGoal as Record<string, string> | undefined)?.["@_xG"]
            ? parseFloat(
                (ev.raw.ShotAtGoal as Record<string, string>)["@_xG"],
              )
            : undefined
          : undefined,
      currentResult:
        ev.type === "goal"
          ? `${score.home}:${score.guest}`
          : undefined,
      gameSection: minute < 45 ? "firstHalf" : "secondHalf",
      timestamp: ev.timestamp.toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Simulação principal
// ---------------------------------------------------------------------------

async function simulate(matchId: string, speedFactor: number): Promise<void> {
  console.log(`\n🏟️  Sektor Connected Arena — Simulador de Partida`);
  console.log(`   matchId=${matchId}  speedFactor=${speedFactor}x\n`);

  // 1. Baixa e parseia os arquivos menores
  const [matchInfoXml, eventsXml, kpiXml] = await Promise.all([
    fetchS3Text(FILES.matchInfo),
    fetchS3Text(FILES.events),
    fetchS3Text(FILES.kpi),
  ]);

  const teams = parseMatchInfo(matchInfoXml);
  const events = parseEvents(eventsXml);
  const kpiAcc = parseKpis(kpiXml, events);

  if (teams.size === 0) {
    throw new Error("Nenhum time encontrado no MatchInformations XML.");
  }
  if (events.length === 0) {
    throw new Error("Nenhum evento encontrado no Events XML.");
  }

  const teamsArr = [...teams.values()];
  const homeTeam = teamsArr.find((t) => t.role === "home") ?? teamsArr[0];
  const guestTeam = teamsArr.find((t) => t.role === "guest") ?? teamsArr[1];

  console.log(`✅ Times: ${homeTeam.name} (casa) vs ${guestTeam.name} (visitante)`);
  console.log(`✅ Eventos carregados: ${events.length}`);

  const kickoffTs = events[0].timestamp;
  const score = { home: 0, guest: 0 };

  // 2. Emite MATCH_STATE inicial
  await emit(matchId, {
    type: "MATCH_STATE",
    match: {
      id: matchId,
      teamA: {
        id: homeTeam.id,
        name: homeTeam.name,
        color: homeTeam.color,
      },
      teamB: {
        id: guestTeam.id,
        name: guestTeam.name,
        color: guestTeam.color,
      },
      minute: 0,
      second: 0,
      status: "live",
      gameSection: "firstHalf",
      score: { home: 0, guest: 0 },
    },
    pressureBar: { teamA: 50, teamB: 50 },
  });
  console.log(`📡 MATCH_STATE emitido`);

  // 3. Emite KPIs iniciais (zerados)
  function buildKpiMessage(
    acc: Map<string, KpiAccumulator>,
    totalPossMs: number,
  ): Record<string, unknown> {
    function toKpi(teamId: string, role: "home" | "guest") {
      const k = acc.get(teamId) ?? {
        teamId,
        totalPasses: 0,
        completedPasses: 0,
        xG: 0,
        shotsOnTarget: 0,
        totalShots: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        possessionMs: 0,
      };
      const possession =
        totalPossMs > 0 ? (k.possessionMs / totalPossMs) * 100 : 50;
      return { ...k, possession: Math.round(possession * 10) / 10 };
    }

    const totalPoss =
      (acc.get(homeTeam.id)?.possessionMs ?? 0) +
      (acc.get(guestTeam.id)?.possessionMs ?? 0);

    return {
      type: "TEAM_KPIS",
      home: toKpi(homeTeam.id, "home"),
      guest: toKpi(guestTeam.id, "guest"),
    };
  }

  // 4. Itera sobre os eventos em ordem cronológica
  let prevTs = kickoffTs;
  let eventIndex = 0;
  let kpiEmitCounter = 0;

  for (const ev of events) {
    // Calcula delay real entre eventos, dividido pelo speedFactor
    const realDelayMs = ev.timestamp.getTime() - prevTs.getTime();
    const simulatedDelayMs = Math.max(0, realDelayMs / speedFactor);

    if (simulatedDelayMs > 0) {
      await new Promise((r) => setTimeout(r, simulatedDelayMs));
    }

    prevTs = ev.timestamp;
    eventIndex++;

    const minute = eventToMinute(ev.timestamp, kickoffTs);
    const second = eventToSecond(ev.timestamp, kickoffTs);

    // Atualiza placar se for gol
    if (ev.type === "goal" && ev.teamId) {
      if (ev.teamId === homeTeam.id) score.home++;
      else score.guest++;
    }

    // Emite o evento de partida (apenas tipos relevantes para a UI)
    const relevantTypes = [
      "goal", "shot", "foul", "yellowCard", "redCard",
      "corner", "freeKick", "kickOff",
    ];
    if (relevantTypes.includes(ev.type)) {
      const msg = buildMatchEventMessage(ev, matchId, kickoffTs, teams, score);
      await emit(matchId, msg);
      console.log(
        `[${minute}'${second.toString().padStart(2, "0")}] ${ev.type.toUpperCase()}` +
          (ev.teamId === homeTeam.id ? ` · ${homeTeam.shortName}` : ` · ${guestTeam.shortName}`) +
          (ev.type === "goal" ? ` ⚽ ${score.home}:${score.guest}` : ""),
      );
    }

    // Emite MATCH_STATE a cada minuto
    if (second === 0 || eventIndex === 1) {
      await emit(matchId, {
        type: "MATCH_STATE",
        match: {
          id: matchId,
          teamA: { id: homeTeam.id, name: homeTeam.name, color: homeTeam.color },
          teamB: { id: guestTeam.id, name: guestTeam.name, color: guestTeam.color },
          minute,
          second,
          status: "live",
          gameSection: minute < 45 ? "firstHalf" : "secondHalf",
          score,
        },
        pressureBar: { teamA: 50, teamB: 50 },
      });
    }

    // Emite KPIs a cada 50 eventos
    kpiEmitCounter++;
    if (kpiEmitCounter % 50 === 0) {
      const totalPoss =
        (kpiAcc.get(homeTeam.id)?.possessionMs ?? 0) +
        (kpiAcc.get(guestTeam.id)?.possessionMs ?? 0);
      await emit(matchId, buildKpiMessage(kpiAcc, totalPoss));
    }
  }

  // 5. KPIs finais
  const totalPoss =
    (kpiAcc.get(homeTeam.id)?.possessionMs ?? 0) +
    (kpiAcc.get(guestTeam.id)?.possessionMs ?? 0);
  await emit(matchId, buildKpiMessage(kpiAcc, totalPoss));

  // 6. MATCH_STATE final
  await emit(matchId, {
    type: "MATCH_STATE",
    match: {
      id: matchId,
      teamA: { id: homeTeam.id, name: homeTeam.name, color: homeTeam.color },
      teamB: { id: guestTeam.id, name: guestTeam.name, color: guestTeam.color },
      minute: 90,
      status: "finished",
      gameSection: "secondHalf",
      score,
    },
    pressureBar: { teamA: 50, teamB: 50 },
  });

  console.log(`\n🏁 Partida encerrada. Placar final: ${score.home}:${score.guest}`);
}

// ---------------------------------------------------------------------------
// Simulador de posições (streaming separado, paralelo)
// ---------------------------------------------------------------------------

/**
 * Faz streaming do arquivo de posições (421MB) em chunks e emite
 * PLAYER_POSITIONS a cada N frames para não sobrecarregar o Kinesis.
 *
 * Emite apenas 1 frame a cada POSITION_EMIT_EVERY frames (reduz volume).
 */
async function simulatePositions(
  matchId: string,
  speedFactor: number,
  teams: Map<string, TeamInfo>,
): Promise<void> {
  const POSITION_EMIT_EVERY = 25; // 1 frame/segundo (dados a 25fps)

  console.log(`\n📍 Iniciando streaming de posições...`);

  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: FILES.positions });
  const res = await s3.send(cmd);

  let buffer = "";
  let frameCount = 0;
  let currentTeamId = "";
  let currentPersonId = "";
  let gameSection: "firstHalf" | "secondHalf" = "firstHalf";

  // Acumula posições do frame atual
  const framePositions = new Map<string, PositionRecord>();

  // Parser de streaming linha a linha
  for await (const chunk of res.Body as AsyncIterable<Buffer>) {
    buffer += chunk.toString("utf-8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      // Detecta FrameSet (novo jogador/time)
      const fsMatch = trimmed.match(
        /GameSection="(\w+)"[^>]*TeamId="([^"]+)"[^>]*PersonId="([^"]+)"/,
      );
      if (fsMatch) {
        gameSection = fsMatch[1] === "secondHalf" ? "secondHalf" : "firstHalf";
        currentTeamId = fsMatch[2];
        currentPersonId = fsMatch[3];
        continue;
      }

      // Detecta Frame
      const frameMatch = trimmed.match(
        /N="(\d+)"\s+T="([^"]+)"\s+X="([^"]+)"\s+Y="([^"]+)"[^>]*S="([^"]+)"/,
      );
      if (frameMatch && currentPersonId && currentTeamId) {
        const frameN = parseInt(frameMatch[1], 10);
        const timestamp = frameMatch[2];
        const x = parseFloat(frameMatch[3]);
        const y = parseFloat(frameMatch[4]);
        const speed = parseFloat(frameMatch[5]);

        framePositions.set(currentPersonId, {
          personId: currentPersonId,
          teamId: currentTeamId,
          frameN,
          timestamp: new Date(timestamp),
          x,
          y,
          speed,
        });

        frameCount++;

        // Emite a cada POSITION_EMIT_EVERY frames
        if (frameCount % POSITION_EMIT_EVERY === 0 && framePositions.size > 0) {
          const players = [...framePositions.values()].map((p) => {
            const team = teams.get(p.teamId);
            const player = team?.players.get(p.personId);
            return {
              personId: p.personId,
              teamId: p.teamId,
              shirtNumber: player?.shirtNumber,
              x: p.x,
              y: p.y,
              speed: p.speed,
              frameN: p.frameN,
              timestamp: p.timestamp.toISOString(),
            };
          });

          await emit(matchId, {
            type: "PLAYER_POSITIONS",
            frame: {
              frameN: frameCount,
              timestamp: new Date().toISOString(),
              gameSection,
              players,
            },
          });

          // Delay proporcional ao speedFactor (40ms por frame a 25fps)
          await new Promise((r) =>
            setTimeout(r, (40 * POSITION_EMIT_EVERY) / speedFactor),
          );
        }
      }
    }
  }

  console.log(`📍 Streaming de posições concluído. ${frameCount} frames processados.`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const [matchId, speedFactorArg] = process.argv.slice(2);
const speedFactor = parseFloat(speedFactorArg ?? "60");

// Roda simulação de eventos e posições em paralelo
Promise.all([
  simulate(matchId ?? "match-001", speedFactor),
  // Posições são opcionais — falha silenciosa para não bloquear os eventos
  (async () => {
    try {
      // Aguarda 2s para o MATCH_STATE ser processado antes de iniciar posições
      await new Promise((r) => setTimeout(r, 2000));
      const matchInfoXml = await fetchS3Text(FILES.matchInfo);
      const teams = parseMatchInfo(matchInfoXml);
      await simulatePositions(matchId ?? "match-001", speedFactor, teams);
    } catch (err) {
      console.warn(`⚠️  Streaming de posições falhou: ${(err as Error).message}`);
    }
  })(),
]).catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
