const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);

const REQUIRED_ENV = ["POSTS_TABLE"];
const PAGE_SIZE = 20;

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

function ok(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function err(status, message) {
  return ok(status, { error: message });
}

function getClaims(event) {
  const claims = event?.requestContext?.authorizer?.claims;
  if (!claims || !claims.sub) return null;
  return claims;
}

function decodeCursor(lastKey) {
  if (typeof lastKey !== "string" || lastKey.length === 0) return undefined;
  try {
    const json = Buffer.from(lastKey, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function encodeCursor(lastEvaluatedKey) {
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64");
}

function toPostShape(item) {
  const post = {
    id: item.id,
    authorId: item.authorId,
    authorName: item.authorName,
    teamId: item.teamId,
    text: item.text,
    likes: typeof item.likes === "number" ? item.likes : (item.likes ?? 0),
    commentCount:
      typeof item.commentCount === "number"
        ? item.commentCount
        : (item.commentCount ?? 0),
    createdAt: item.createdAt,
  };
  if (item.imageUrl) post.imageUrl = item.imageUrl;
  return post;
}

exports.handler = async (event) => {
  assertEnv();
  const start = Date.now();

  const claims = getClaims(event);
  if (!claims) {
    return err(401, "unauthenticated");
  }

  const qs = event?.queryStringParameters || {};
  const teamId = typeof qs.teamId === "string" ? qs.teamId.trim() : "";
  if (!teamId) {
    return err(400, "teamId required");
  }

  const exclusiveStartKey = decodeCursor(qs.lastKey);

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: process.env.POSTS_TABLE,
        KeyConditionExpression: "teamId = :t",
        ExpressionAttributeValues: { ":t": teamId },
        ScanIndexForward: false,
        Limit: PAGE_SIZE,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    );

    const posts = (result.Items ?? []).map(toPostShape);
    const body = { posts };
    if (result.LastEvaluatedKey) {
      body.lastKey = encodeCursor(result.LastEvaluatedKey);
    }

    console.log(
      JSON.stringify({
        level: "INFO",
        message: "getPosts ok",
        teamId,
        count: posts.length,
        hasMore: Boolean(result.LastEvaluatedKey),
        durationMs: Date.now() - start,
      }),
    );

    return ok(200, body);
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "getPosts failed",
        teamId,
        cause: e.message,
      }),
    );
    return err(500, "internal");
  }
};
