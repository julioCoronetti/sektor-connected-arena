/**
 * simulateMatch Lambda
 *
 * Invocada de forma assíncrona pelo wsConnect quando a primeira conexão
 * chega para uma matchId. Lê os dados do S3 e emite eventos no Kinesis
 * simulando a partida em tempo real com speedFactor configurável.
 *
 * Env vars:
 *   KINESIS_STREAM_NAME  (default: sektor-match-events)
 *   SPEED_FACTOR         (default: 120 → partida ~45s)
 *   AWS_REGION           (default: us-east-1)
 */

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { KinesisClient, PutRecordCommand } = require("@aws-sdk/client-kinesis");
const { XMLParser } = require("fast-xml-parser");

const BUCKET = "hackathon-data-482712210181";
const BASE_KEY =
  "Challenge 4 \u2013 Connected Arena - A Real-Time Multiplayer Fan Engagement Ecosystem/data/Match-Events";

const FILES = {
  matchInfo: `${BASE_KEY}/MatchInformations_Anonym.xml`,
  events: `${BASE_KEY}/Events_Anonym.xml`,
  kpi: `${BASE_KEY}/kpi_data_Bayern_Hamburg.xml`,
};

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const kinesis = new KinesisClient({ region: process.env.AWS_REGION ?? "us-east-1" });

const STREAM_NAME = process.env.KINESIS_STREAM_NAME ?? "sektor-match-events";
const DEFAULT_SPEED_FACTOR = parseFloat(process.env.SPEED_FACTOR ?? "120");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchS3Text(key) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const res = await s3.send(cmd);
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function emit(matchId, message) {
  await kinesis.send(
    new PutRecordCommand({
      StreamName: STREAM_NAME,
      Data: Buffer.from(JSON.stringify(message)),
      PartitionKey: matchId,
    }),
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// XML Parsers
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    ["Player", "Trainer", "Team", "Event", "Frame", "FrameSet"].includes(name),
});

function parseMatchInfo(xml) {
  const doc = xmlParser.parse(xml);
  const teams = new Map();
  const teamsArr = doc?.PutDataRequest?.MatchInformation?.Teams?.Team ?? [];

  for (const t of teamsArr) {
    const id = t["@_TeamId"];
    const role = t["@_Role"] === "home" ? "home" : "guest";
    const rawColor = t["@_PlayerShirtMainColor"] ?? "";
    const color =
      rawColor && rawColor !== "#00000"
        ? rawColor
        : role === "home"
        ? "#E63946"
        : "#1D3557";

    const players = new Map();
    const playersArr = t.Players?.Player ?? [];
    for (const p of playersArr) {
      const personId = p["@_PersonId"];
      players.set(personId, {
        personId,
        shirtNumber: parseInt(p["@_ShirtNumber"] ?? "0", 10),
        shortName: p["@_Shortname"] ?? "",
      });
    }

    teams.set(id, {
      id,
      name: t["@_TeamName"],
      shortName: t["@_ShortName"],
      color,
      role,
      players,
    });
  }
  return teams;
}

function parseEvents(xml) {
  const doc = xmlParser.parse(xml);
  const rawEvents = doc?.PutDataRequest?.Event ?? [];
  const events = [];

  for (const e of rawEvents) {
    const eventId = String(e["@_EventId"] ?? "");
    const tsStr = String(e["@_EventTime"] ?? "");
    if (!eventId || !tsStr) continue;

    let timestamp;
    try {
      timestamp = new Date(tsStr);
      if (isNaN(timestamp.getTime())) continue;
    } catch {
      continue;
    }

    const x = e["@_X-Position"] != null ? parseFloat(String(e["@_X-Position"])) : undefined;
    const y = e["@_Y-Position"] != null ? parseFloat(String(e["@_Y-Position"])) : undefined;

    let type = "other";
    let teamId;
    let playerId;

    if (e.KickOff) {
      type = "kickOff";
      teamId = e.KickOff["@_TeamLeft"];
    } else if (e.ShotAtGoal) {
      teamId = String(e.ShotAtGoal["@_Team"] ?? "");
      playerId = String(e.ShotAtGoal["@_Player"] ?? "");
      type = e.ShotAtGoal.SuccessfulShot ? "goal" : "shot";
    } else if (e.Foul) {
      type = "foul";
      teamId = e.Foul["@_TeamFouler"];
      playerId = e.Foul["@_Fouler"];
    } else if (e.Caution) {
      type = e.Caution["@_CardColor"] === "red" ? "redCard" : "yellowCard";
      teamId = e.Caution["@_Team"];
      playerId = e.Caution["@_Player"];
    } else if (e.FreeKick) {
      type = "freeKick";
      teamId = e.FreeKick["@_Team"];
    } else if (e.ThrowIn) {
      type = "throwIn";
      teamId = e.ThrowIn["@_Team"];
    } else if (e.Play) {
      type = "other";
      teamId = e.Play["@_Team"];
      playerId = e.Play["@_Player"];
    }

    events.push({ eventId, timestamp, x, y, type, teamId, playerId, raw: e });
  }

  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return events;
}

function parseKpis(xml, events) {
  const doc = xmlParser.parse(xml);
  const rawEvents = doc?.PutDataRequest?.AdvancedEvents?.Event ?? [];
  const acc = new Map();

  function getOrCreate(teamId) {
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
    return acc.get(teamId);
  }

  for (const e of rawEvents) {
    if (e.Play) {
      const teamId = e.Play["@_TeamId"];
      if (!teamId) continue;
      const kpi = getOrCreate(teamId);
      kpi.totalPasses++;
      if (e.Play["@_Evaluation"] === "successfullyCompleted") kpi.completedPasses++;
    }
    if (e.TeamPossession) {
      const teamId = e.TeamPossession["@_TeamId"];
      if (!teamId) continue;
      const start = e.TeamPossession["@_SyncedEventTime"]
        ? new Date(e.TeamPossession["@_SyncedEventTime"]).getTime()
        : 0;
      const end = e.TeamPossession["@_EndSyncedEventTime"]
        ? new Date(e.TeamPossession["@_EndSyncedEventTime"]).getTime()
        : 0;
      if (start && end && end > start) getOrCreate(teamId).possessionMs += end - start;
    }
  }

  for (const ev of events) {
    if (!ev.teamId) continue;
    const kpi = getOrCreate(ev.teamId);
    if (ev.type === "goal") {
      kpi.shotsOnTarget++;
      kpi.totalShots++;
      const xg = ev.raw.ShotAtGoal?.["@_xG"];
      if (xg) kpi.xG += parseFloat(xg);
    } else if (ev.type === "shot") {
      kpi.totalShots++;
      const xg = ev.raw.ShotAtGoal?.["@_xG"];
      if (xg) kpi.xG += parseFloat(xg);
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
// Main simulate
// ---------------------------------------------------------------------------

async function simulate(matchId, speedFactor) {
  console.log(JSON.stringify({ level: "INFO", message: "simulateMatch start", matchId, speedFactor }));

  const [matchInfoXml, eventsXml, kpiXml] = await Promise.all([
    fetchS3Text(FILES.matchInfo),
    fetchS3Text(FILES.events),
    fetchS3Text(FILES.kpi),
  ]);

  const teams = parseMatchInfo(matchInfoXml);
  const events = parseEvents(eventsXml);
  const kpiAcc = parseKpis(kpiXml, events);

  if (teams.size === 0) throw new Error("No teams found in MatchInformations XML");
  if (events.length === 0) throw new Error("No events found in Events XML");

  const teamsArr = [...teams.values()];
  const homeTeam = teamsArr.find((t) => t.role === "home") ?? teamsArr[0];
  const guestTeam = teamsArr.find((t) => t.role === "guest") ?? teamsArr[1];

  const kickoffTs = events[0].timestamp;
  const score = { home: 0, guest: 0 };

  // MATCH_STATE inicial
  await emit(matchId, {
    type: "MATCH_STATE",
    match: {
      id: matchId,
      teamA: { id: homeTeam.id, name: homeTeam.name, color: homeTeam.color },
      teamB: { id: guestTeam.id, name: guestTeam.name, color: guestTeam.color },
      minute: 0,
      second: 0,
      status: "live",
      gameSection: "firstHalf",
      score: { home: 0, guest: 0 },
    },
    pressureBar: { teamA: 50, teamB: 50 },
  });

  function buildKpiMessage() {
    const totalPoss =
      (kpiAcc.get(homeTeam.id)?.possessionMs ?? 0) +
      (kpiAcc.get(guestTeam.id)?.possessionMs ?? 0);

    function toKpi(teamId) {
      const k = kpiAcc.get(teamId) ?? {
        teamId, totalPasses: 0, completedPasses: 0, xG: 0,
        shotsOnTarget: 0, totalShots: 0, fouls: 0, yellowCards: 0,
        redCards: 0, possessionMs: 0,
      };
      const possession = totalPoss > 0 ? (k.possessionMs / totalPoss) * 100 : 50;
      return { ...k, possession: Math.round(possession * 10) / 10 };
    }

    return {
      type: "TEAM_KPIS",
      home: toKpi(homeTeam.id),
      guest: toKpi(guestTeam.id),
    };
  }

  const RELEVANT_TYPES = ["goal", "shot", "foul", "yellowCard", "redCard", "freeKick", "kickOff"];
  let prevTs = kickoffTs;
  let eventIndex = 0;
  let kpiCounter = 0;

  for (const ev of events) {
    const realDelayMs = ev.timestamp.getTime() - prevTs.getTime();
    const simulatedDelayMs = Math.max(0, realDelayMs / speedFactor);
    if (simulatedDelayMs > 0) await sleep(simulatedDelayMs);

    prevTs = ev.timestamp;
    eventIndex++;

    const minute = Math.floor((ev.timestamp.getTime() - kickoffTs.getTime()) / 60_000);
    const second = Math.floor(((ev.timestamp.getTime() - kickoffTs.getTime()) % 60_000) / 1_000);

    if (ev.type === "goal" && ev.teamId) {
      if (ev.teamId === homeTeam.id) score.home++;
      else score.guest++;
    }

    if (RELEVANT_TYPES.includes(ev.type)) {
      await emit(matchId, {
        type: "MATCH_EVENT",
        event: {
          eventId: ev.eventId,
          matchId,
          type: ev.type,
          minute,
          second,
          teamId: ev.teamId ?? "",
          playerId: ev.playerId,
          playerName: ev.teamId
            ? teams.get(ev.teamId)?.players.get(ev.playerId ?? "")?.shortName
            : undefined,
          x: ev.x,
          y: ev.y,
          xG:
            (ev.type === "goal" || ev.type === "shot") && ev.raw.ShotAtGoal?.["@_xG"]
              ? parseFloat(ev.raw.ShotAtGoal["@_xG"])
              : undefined,
          currentResult: ev.type === "goal" ? `${score.home}:${score.guest}` : undefined,
          gameSection: minute < 45 ? "firstHalf" : "secondHalf",
          timestamp: ev.timestamp.toISOString(),
        },
      });
    }

    // MATCH_STATE a cada minuto (second === 0) ou no primeiro evento
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

    // KPIs a cada 50 eventos
    kpiCounter++;
    if (kpiCounter % 50 === 0) {
      await emit(matchId, buildKpiMessage());
    }
  }

  // KPIs finais + MATCH_STATE encerrado
  await emit(matchId, buildKpiMessage());
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

  console.log(JSON.stringify({ level: "INFO", message: "simulateMatch done", matchId, score }));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  const matchId = event.matchId ?? "match-001";
  const speedFactor = event.speedFactor ?? DEFAULT_SPEED_FACTOR;

  try {
    await simulate(matchId, speedFactor);
    return { statusCode: 200 };
  } catch (e) {
    console.error(JSON.stringify({ level: "ERROR", message: e.message, matchId }));
    return { statusCode: 500 };
  }
};
