const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

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

  let userId = null;
  if (typeof token === "string" && token.length > 0) {
    const claims = decodeJwtPayload(token);
    if (claims && typeof claims.sub === "string") {
      userId = claims.sub;
    }
  }

  // Fallback para `requestContext.authorizer.claims.sub` quando um Cognito
  // Authorizer estiver anexado à rota $connect.
  if (!userId) {
    const authClaims =
      event.requestContext?.authorizer?.claims ??
      event.requestContext?.authorizer?.jwt?.claims ??
      null;
    if (authClaims && typeof authClaims.sub === "string") {
      userId = authClaims.sub;
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

  await dynamo.send(
    new PutItemCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Item: item,
    }),
  );

  return { statusCode: 200, body: "Connected" };
};
