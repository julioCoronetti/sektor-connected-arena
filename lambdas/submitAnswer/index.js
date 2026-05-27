const {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  GetItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

const REQUIRED_ENV = ["CONNECTIONS_TABLE", "ANSWERS_TABLE", "WS_ENDPOINT"];
const ANSWER_TTL_SECONDS = 86_400;
const MAX_PREDICTION_ID_LENGTH = 64;

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

  const connectionId = event.requestContext?.connectionId;
  const api = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_ENDPOINT,
  });

  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    await reply(api, connectionId, {
      type: "ANSWER_REJECTED",
      reason: "INVALID_OPTION",
    });
    return { statusCode: 200 };
  }

  // R3.1: resolver userId / matchId da conexão.
  const conn = await getConnection(connectionId);
  if (!conn || !conn.userId) {
    await reply(api, connectionId, {
      type: "ANSWER_REJECTED",
      predictionId: body?.predictionId,
      reason: "UNAUTHORIZED",
    });
    return { statusCode: 200 };
  }

  // Spectator connections cannot submit answers
  if (conn.userId.startsWith("spectator-")) {
    await reply(api, connectionId, {
      type: "ANSWER_REJECTED",
      predictionId: body?.predictionId,
      reason: "UNAUTHORIZED",
    });
    return { statusCode: 200 };
  }

  // teamId pode ser null para usuários sem time definido — aceita mesmo assim.
  const teamId = conn.teamId ?? null;

  // Validações de payload.
  const predictionId = body?.predictionId;
  const selectedOption = body?.selectedOption;
  const gpsMultiplier = body?.gpsMultiplier;

  if (
    typeof predictionId !== "string" ||
    predictionId.length === 0 ||
    predictionId.length > MAX_PREDICTION_ID_LENGTH ||
    !Number.isInteger(selectedOption) ||
    selectedOption < 0 ||
    (gpsMultiplier !== 1 && gpsMultiplier !== 2)
  ) {
    await reply(api, connectionId, {
      type: "ANSWER_REJECTED",
      predictionId: typeof predictionId === "string" ? predictionId : undefined,
      reason: "INVALID_OPTION",
    });
    return { statusCode: 200 };
  }

  const submittedAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + ANSWER_TTL_SECONDS;

  try {
    await dynamo.send(
      new PutItemCommand({
        TableName: process.env.ANSWERS_TABLE,
        Item: {
          predictionId: { S: predictionId },
          userId: { S: conn.userId },
          matchId: { S: conn.matchId },
          selectedOption: { N: String(selectedOption) },
          gpsMultiplier: { N: String(gpsMultiplier) },
          submittedAt: { S: submittedAt },
          ttl: { N: String(ttl) },
          ...(teamId ? { teamId: { S: teamId } } : {}),
        },
        ConditionExpression:
          "attribute_not_exists(predictionId) AND attribute_not_exists(userId)",
      }),
    );
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") {
      await reply(api, connectionId, {
        type: "ANSWER_REJECTED",
        predictionId,
        reason: "DUPLICATE",
      });
      return { statusCode: 200 };
    }
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "answer persist failed",
        predictionId,
        userId: conn.userId,
        cause: e.message,
      }),
    );
    return { statusCode: 500 };
  }

  await reply(api, connectionId, {
    type: "ANSWER_ACCEPTED",
    predictionId,
  });
  return { statusCode: 200 };
};

async function getConnection(connectionId) {
  if (!connectionId) return null;
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      IndexName: "connectionId-index",
      KeyConditionExpression: "connectionId = :c",
      ExpressionAttributeValues: { ":c": { S: connectionId } },
      Limit: 1,
    }),
  );
  const item = result.Items?.[0];
  if (!item) return null;
  return {
    matchId: item.matchId.S,
    connectionId: item.connectionId.S,
    userId: item.userId?.S,
    teamId: item.teamId?.S ?? null,
  };
}

// Mantida para futuras validações de pertinência (predictionId ↔ matchId).
// eslint-disable-next-line no-unused-vars
async function _getConnectionItem(matchId, connectionId) {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Key: {
        matchId: { S: matchId },
        connectionId: { S: connectionId },
      },
    }),
  );
  return result.Item ?? null;
}

async function reply(api, connectionId, payload) {
  if (!connectionId) return;
  try {
    await api.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(payload)),
      }),
    );
  } catch (e) {
    if (e.name === "GoneException") return;
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "ws reply failed",
        connectionId,
        cause: e.message,
      }),
    );
  }
}
