const { DynamoDBClient, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const lambda = new LambdaClient({ region: process.env.AWS_REGION });

const REQUIRED_ENV = ["CONNECTIONS_TABLE"];

function assertEnv() {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      console.error(JSON.stringify({ level: "ERROR", message: "missing env", env: key }));
      throw new Error(`Missing env var: ${key}`);
    }
  }
}

/**
 * Decodifica o payload de um JWT sem validar a assinatura.
 *
 * A assinatura já é validada pelo Cognito Authorizer da rota $connect — esta
 * função apenas extrai `sub` (userId) do token recebido na query string.
 */
function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const padded =
      parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
    const json = Buffer.from(
      padded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  assertEnv();

  const { connectionId } = event.requestContext ?? {};
  const matchId = event.queryStringParameters?.matchId ?? "unknown";
  const token = event.queryStringParameters?.token;
  const mode = event.queryStringParameters?.mode ?? "player";
  const isSpectator = mode === "spectator";

  let userId = null;
  let teamId = null;

  if (isSpectator) {
    // Spectator connections are anonymous — no auth required
    userId = `spectator-${connectionId}`;
    teamId = null;
  } else {
    if (typeof token === "string" && token.length > 0) {
      const claims = decodeJwtPayload(token);
      if (claims && typeof claims.sub === "string") {
        userId = claims.sub;
      }
      if (claims && typeof claims["custom:teamId"] === "string") {
        teamId = claims["custom:teamId"];
      }
    }

    // Fallback for Cognito Authorizer on $connect route
    if (!userId) {
      const authClaims =
        event.requestContext?.authorizer?.claims ??
        event.requestContext?.authorizer?.jwt?.claims ??
        null;
      if (authClaims && typeof authClaims.sub === "string") {
        userId = authClaims.sub;
      }
      if (authClaims && typeof authClaims["custom:teamId"] === "string") {
        teamId = authClaims["custom:teamId"];
      }
    }
  }

  const item = {
    matchId: { S: matchId },
    connectionId: { S: connectionId },
    ttl: { N: String(Math.floor(Date.now() / 1000) + 7200) },
  };
  if (userId) {
    item.userId = { S: userId };
  }
  if (teamId) {
    item.teamId = { S: teamId };
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Item: item,
    }),
  );

  // Verifica se é a primeira conexão para esta matchId.
  // Se sim, dispara o simulador de forma assíncrona (fire-and-forget).
  try {
    const existing = await dynamo.send(
      new QueryCommand({
        TableName: process.env.CONNECTIONS_TABLE,
        KeyConditionExpression: "matchId = :m",
        ExpressionAttributeValues: { ":m": { S: matchId } },
        Select: "COUNT",
      }),
    );

    // Count === 1 significa que a conexão que acabamos de inserir é a única —
    // primeira conexão para esta partida. Dispara o simulador.
    if ((existing.Count ?? 0) <= 1) {
      const simulateFunctionName =
        process.env.SIMULATE_MATCH_FUNCTION ?? "simulateMatch";

      await lambda.send(
        new InvokeCommand({
          FunctionName: simulateFunctionName,
          InvocationType: "Event", // assíncrono — não bloqueia wsConnect
          Payload: Buffer.from(
            JSON.stringify({
              matchId,
              speedFactor: parseFloat(process.env.SPEED_FACTOR ?? "120"),
            }),
          ),
        }),
      );

      console.log(
        JSON.stringify({
          level: "INFO",
          message: "simulateMatch invoked",
          matchId,
        }),
      );
    }
  } catch (e) {
    // Falha não-crítica: log e segue. Conexão WS já foi registrada.
    console.error(
      JSON.stringify({
        level: "WARN",
        message: "simulateMatch invoke failed",
        matchId,
        cause: e.message,
      }),
    );
  }

  return { statusCode: 200, body: "Connected" };
};
