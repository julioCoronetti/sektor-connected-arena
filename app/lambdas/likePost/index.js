const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);

const REQUIRED_ENV = ["POSTS_TABLE", "LIKES_TABLE"];

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

function ok(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function err(statusCode, message) {
  return ok(statusCode, { error: message });
}

function getClaims(event) {
  const claims = event?.requestContext?.authorizer?.claims;
  if (!claims || !claims.sub) return null;
  return claims;
}

async function findPostKey(postId) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: process.env.POSTS_TABLE,
      IndexName: "id-index",
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: { ":id": postId },
      Limit: 1,
    }),
  );
  const item = res.Items && res.Items[0];
  if (!item) return null;
  return { teamId: item.teamId, createdAt: item.createdAt };
}

exports.handler = async (event) => {
  assertEnv();

  const claims = getClaims(event);
  if (!claims) return err(401, "unauthenticated");

  const postId = event?.pathParameters?.postId;
  if (typeof postId !== "string" || postId.length === 0) {
    return err(404, "post not found");
  }

  const userId = claims.sub;

  let key;
  try {
    key = await findPostKey(postId);
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "findPostKey failed",
        postId,
        cause: e.message,
      }),
    );
    return err(500, "internal");
  }

  if (!key) return err(404, "post not found");

  const nowISO = new Date().toISOString();

  try {
    await ddb.send(
      new PutCommand({
        TableName: process.env.LIKES_TABLE,
        Item: { postId, userId, createdAt: nowISO },
        ConditionExpression: "attribute_not_exists(userId)",
      }),
    );
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") {
      try {
        const current = await ddb.send(
          new GetCommand({
            TableName: process.env.POSTS_TABLE,
            Key: key,
            ProjectionExpression: "likes",
          }),
        );
        const likes =
          typeof current.Item?.likes === "number" ? current.Item.likes : 0;
        return ok(200, { likes });
      } catch (e2) {
        console.error(
          JSON.stringify({
            level: "ERROR",
            message: "likePost get current likes failed",
            postId,
            userId,
            cause: e2.message,
          }),
        );
        return err(500, "internal");
      }
    }
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "likePost persist failed",
        postId,
        userId,
        cause: e.message,
      }),
    );
    return err(500, "internal");
  }

  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: process.env.POSTS_TABLE,
        Key: key,
        UpdateExpression: "ADD likes :one",
        ExpressionAttributeValues: { ":one": 1 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    const likes =
      typeof res.Attributes?.likes === "number" ? res.Attributes.likes : 0;
    return ok(200, { likes });
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "likePost increment failed",
        postId,
        userId,
        cause: e.message,
      }),
    );
    return err(500, "internal");
  }
};
