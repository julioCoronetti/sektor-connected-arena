/**
 * analyzeSentiment Lambda
 *
 * Triggered by EventBridge Scheduler rate(2 minutes) during live matches.
 * Reads recent forum posts per team, calls Bedrock Nova Lite for sentiment,
 * persists to sektor-sentiment table, and broadcasts SENTIMENT_ALERT via WS.
 *
 * Env vars:
 *   POSTS_TABLE          DynamoDB table for community posts
 *   SENTIMENT_TABLE      DynamoDB table for sentiment results
 *   CONNECTIONS_TABLE    DynamoDB table for active WS connections
 *   WS_ENDPOINT          API Gateway WS management endpoint
 *   MATCH_ID             Active match ID (set by scheduler or event payload)
 *   AWS_REGION
 */

const {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

const REQUIRED_ENV = [
  "POSTS_TABLE",
  "SENTIMENT_TABLE",
  "CONNECTIONS_TABLE",
  "WS_ENDPOINT",
];

const TEAM_NAMES = {
  "team-a": "FC Bayern München",
  "team-b": "Hamburger SV",
};

const VALID_SENTIMENTS = ["confiante", "ansiosa", "eufórica", "decepcionada", "neutra"];

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

  // matchId can come from event payload or env var
  const matchId = event.matchId ?? process.env.MATCH_ID;
  if (!matchId) {
    console.error(JSON.stringify({ level: "ERROR", message: "matchId missing" }));
    return { statusCode: 400 };
  }

  const api = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_ENDPOINT,
  });

  const connections = await getActiveConnections(matchId);
  if (connections.length === 0) {
    console.log(JSON.stringify({ level: "INFO", message: "no active connections, skip sentiment", matchId }));
    return { statusCode: 200 };
  }

  const teamIds = ["team-a", "team-b"];

  for (const teamId of teamIds) {
    try {
      const posts = await getRecentPosts(teamId, 50);
      if (posts.length === 0) continue;

      const sentiment = await analyzeSentiment(teamId, posts);
      if (!sentiment) continue;

      await persistSentiment(matchId, teamId, sentiment);

      if (sentiment.intensity >= 60) {
        await broadcastSentiment(api, connections, teamId, sentiment);
      }
    } catch (e) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          message: "sentiment analysis failed",
          teamId,
          cause: e.message,
        }),
      );
    }
  }

  return { statusCode: 200 };
};

async function getRecentPosts(teamId, limit) {
  try {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: process.env.POSTS_TABLE,
        IndexName: "teamId-createdAt-index",
        KeyConditionExpression: "teamId = :t",
        ExpressionAttributeValues: { ":t": { S: teamId } },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (result.Items ?? []).map((item) => item.text?.S ?? "").filter(Boolean);
  } catch (e) {
    console.warn(
      JSON.stringify({
        level: "WARN",
        message: "posts query failed, GSI may not exist yet",
        teamId,
        cause: e.message,
      }),
    );
    return [];
  }
}

async function analyzeSentiment(teamId, posts) {
  const teamName = TEAM_NAMES[teamId] ?? teamId;
  const combined = posts.join("\n").slice(0, 4000);

  const prompt = `Analise o sentimento dominante destes posts da torcida do ${teamName}.
Categorias possíveis: confiante, ansiosa, eufórica, decepcionada, neutra.
Responda APENAS com JSON válido no formato:
{"sentiment": "...", "intensity": 0-100, "summary": "frase curta em português"}

Posts:
${combined}`;

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: "amazon.nova-lite-v1:0",
      body: JSON.stringify({
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 128, temperature: 0.3 },
      }),
      contentType: "application/json",
      accept: "application/json",
    }),
  );

  const body = JSON.parse(Buffer.from(response.body).toString());
  const rawText = body.output.message.content[0].text;

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(JSON.stringify({ level: "WARN", message: "bedrock non-JSON sentiment", rawText: rawText.slice(0, 200) }));
      return null;
    }
    parsed = JSON.parse(match[0]);
  }

  if (!VALID_SENTIMENTS.includes(parsed.sentiment)) {
    parsed.sentiment = "neutra";
  }

  return {
    sentiment: parsed.sentiment,
    intensity: Math.min(100, Math.max(0, Number(parsed.intensity ?? 50))),
    summary: String(parsed.summary ?? "").slice(0, 120),
  };
}

async function persistSentiment(matchId, teamId, sentiment) {
  const ttl = Math.floor(Date.now() / 1000) + 7200; // 2h TTL
  await dynamo.send(
    new PutItemCommand({
      TableName: process.env.SENTIMENT_TABLE,
      Item: {
        matchId: { S: matchId },
        teamId: { S: teamId },
        sentiment: { S: sentiment.sentiment },
        intensity: { N: String(sentiment.intensity) },
        summary: { S: sentiment.summary },
        updatedAt: { S: new Date().toISOString() },
        ttl: { N: String(ttl) },
      },
    }),
  );
}

async function broadcastSentiment(api, connections, teamId, sentiment) {
  const message = {
    type: "SENTIMENT_ALERT",
    teamId,
    sentiment: sentiment.sentiment,
    intensity: sentiment.intensity,
    summary: sentiment.summary,
  };
  const data = Buffer.from(JSON.stringify(message));

  await Promise.allSettled(
    connections.map((connectionId) =>
      api
        .send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }))
        .catch((e) => {
          if (e.name !== "GoneException") {
            console.error(
              JSON.stringify({ level: "ERROR", message: "ws send failed", connectionId, cause: e.message }),
            );
          }
        }),
    ),
  );
}

async function getActiveConnections(matchId) {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      KeyConditionExpression: "matchId = :m",
      ExpressionAttributeValues: { ":m": { S: matchId } },
    }),
  );
  return (result.Items ?? []).map((item) => item.connectionId.S);
}
