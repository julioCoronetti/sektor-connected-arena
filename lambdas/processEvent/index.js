const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const {
  SchedulerClient,
  CreateScheduleCommand,
} = require("@aws-sdk/client-scheduler");
const { getTeamPreferences } = require("./preferences");

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const scheduler = new SchedulerClient({ region: process.env.AWS_REGION });

const RELEVANT_EVENTS = ["GOAL", "CORNER", "FOUL", "YELLOW_CARD", "RED_CARD"];
const PREDICTION_TTL_MS = 15_000;

const REQUIRED_ENV = [
  "CONNECTIONS_TABLE",
  "WS_ENDPOINT",
  "RESOLVE_ANSWER_FUNCTION_ARN",
  "SCHEDULER_TARGET_ROLE_ARN",
  "SCHEDULER_GROUP_NAME",
];

function assertEnv() {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      console.error(
        JSON.stringify({ level: "ERROR", message: "missing env", env: key }),
      );
      throw new Error(`Missing env var: ${key}`);
    }
  }
}

exports.handler = async (event) => {
  assertEnv();

  for (const record of event.Records) {
    const payload = JSON.parse(
      Buffer.from(record.kinesis.data, "base64").toString(),
    );

    if (!RELEVANT_EVENTS.includes(payload.eventType)) continue;

    // Get active connections grouped by teamId
    const connections = await getActiveConnectionsWithTeam(payload.matchId);
    const byTeam = groupByTeam(connections);
    const teamIds = Object.keys(byTeam);

    if (teamIds.length === 0) {
      console.log(
        JSON.stringify({
          level: "INFO",
          message: "no active connections, skipping prediction",
          matchId: payload.matchId,
        }),
      );
      continue;
    }

    // Generate one personalized prediction per team present
    const predictionsByTeam = {};
    for (const teamId of teamIds) {
      let prediction;
      try {
        prediction = await generatePrediction(payload, teamId);
      } catch (e) {
        console.error(
          JSON.stringify({
            level: "ERROR",
            message: "bedrock failure",
            matchId: payload.matchId,
            teamId,
            cause: e.message,
          }),
        );
        continue;
      }

      try {
        await schedulePredictionResolution(prediction.prediction);
      } catch (e) {
        console.error(
          JSON.stringify({
            level: "ERROR",
            message: "scheduler create failed",
            matchId: prediction.prediction.matchId,
            predictionId: prediction.prediction.id,
            cause: e.message,
          }),
        );
        continue;
      }

      predictionsByTeam[teamId] = prediction;
    }

    // Distribute to each team's connections
    const api = new ApiGatewayManagementApiClient({
      endpoint: process.env.WS_ENDPOINT,
    });

    for (const [teamId, prediction] of Object.entries(predictionsByTeam)) {
      const teamConnections = byTeam[teamId] ?? [];
      await distributeToConnections(
        api,
        teamConnections.map((c) => c.connectionId),
        prediction,
      );
    }

    // Spectator connections (no teamId) get team-a prediction if available
    const spectatorConnections = (byTeam["spectator"] ?? []).concat(byTeam["null"] ?? []);
    const fallbackPrediction =
      predictionsByTeam["team-a"] ?? Object.values(predictionsByTeam)[0];
    if (spectatorConnections.length > 0 && fallbackPrediction) {
      await distributeToConnections(
        api,
        spectatorConnections.map((c) => c.connectionId),
        fallbackPrediction,
      );
    }
  }
};

async function generatePrediction(event, audienceTeamId) {
  const prefs = getTeamPreferences(audienceTeamId);

  const prompt = `Você é um assistente de futebol para a torcida do ${prefs.teamName}.
Ocorreu um evento: ${event.eventType} no minuto ${event.minute ?? "?"}.
Gere uma pergunta de predição rápida em português, tom ${prefs.tone}, com 4 opções de resposta.
A pergunta deve ser sobre o que vai acontecer nos próximos 30 segundos.
Responda APENAS com JSON válido no formato:
{"question": "...", "options": ["...", "...", "...", "..."], "correctOption": 0}`;

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: "amazon.nova-lite-v1:0",
      body: JSON.stringify({
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 256, temperature: 0.7 },
      }),
      contentType: "application/json",
      accept: "application/json",
    }),
  );

  const body = JSON.parse(Buffer.from(response.body).toString());
  const rawText = body.output.message.content[0].text;

  // Tolerant JSON extraction — handles cases where Bedrock wraps JSON in markdown
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Bedrock returned non-JSON: " + rawText.slice(0, 200));
    parsed = JSON.parse(match[0]);
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + PREDICTION_TTL_MS);

  return {
    type: "PREDICTION",
    prediction: {
      id: `pred-${audienceTeamId}-${createdAt.getTime()}`,
      matchId: event.matchId,
      question: parsed.question,
      options: parsed.options,
      correctOption: parsed.correctOption,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

async function schedulePredictionResolution(prediction) {
  const at = new Date(prediction.expiresAt).toISOString().split(".")[0];
  const scheduleName = `resolve-${prediction.id}`;

  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: process.env.SCHEDULER_GROUP_NAME,
      ScheduleExpression: `at(${at})`,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      ActionAfterCompletion: "DELETE",
      Target: {
        Arn: process.env.RESOLVE_ANSWER_FUNCTION_ARN,
        RoleArn: process.env.SCHEDULER_TARGET_ROLE_ARN,
        Input: JSON.stringify({
          matchId: prediction.matchId,
          predictionId: prediction.id,
          correctOption: prediction.correctOption,
          expiresAt: prediction.expiresAt,
        }),
      },
    }),
  );
}

async function getActiveConnectionsWithTeam(matchId) {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      KeyConditionExpression: "matchId = :matchId",
      ExpressionAttributeValues: { ":matchId": { S: matchId } },
    }),
  );
  return (result.Items ?? []).map((item) => ({
    connectionId: item.connectionId.S,
    userId: item.userId?.S ?? null,
    teamId: item.teamId?.S ?? null,
  }));
}

function groupByTeam(connections) {
  const groups = {};
  for (const conn of connections) {
    const key = conn.teamId ?? "null";
    if (!groups[key]) groups[key] = [];
    groups[key].push(conn);
  }
  return groups;
}

async function distributeToConnections(api, connectionIds, message) {
  // Client receives prediction without correctOption (anti-cheat)
  const safeMessage = {
    type: "PREDICTION",
    prediction: { ...message.prediction },
  };
  delete safeMessage.prediction.correctOption;
  const data = Buffer.from(JSON.stringify(safeMessage));

  await Promise.allSettled(
    connectionIds.map((connectionId) =>
      api.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: data,
        }),
      ),
    ),
  );
}
