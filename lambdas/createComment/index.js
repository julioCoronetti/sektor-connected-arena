const { randomUUID } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);

const REQUIRED_ENV = ["POSTS_TABLE", "COMMENTS_TABLE"];

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
  const item = res.Items?.[0];
  if (!item) return null;
  return { teamId: item.teamId, createdAt: item.createdAt };
}

exports.handler = async (event) => {
  assertEnv();

  const claims = getClaims(event);
  if (!claims) return err(401, "unauthenticated");

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "text required");
  }

  const text = body?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return err(400, "text required");
  }

  const postId = event?.pathParameters?.postId;
  if (typeof postId !== "string" || postId.length === 0) {
    return err(404, "post not found");
  }

  let postKey;
  try {
    postKey = await findPostKey(postId);
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

  if (!postKey) return err(404, "post not found");

  const comment = {
    id: randomUUID(),
    postId,
    authorId: claims.sub,
    authorName: claims.name || claims.email,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: process.env.COMMENTS_TABLE,
        Item: {
          postId: comment.postId,
          createdAt: comment.createdAt,
          id: comment.id,
          authorId: comment.authorId,
          authorName: comment.authorName,
          text: comment.text,
        },
      }),
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "comment persist failed",
        postId,
        commentId: comment.id,
        cause: e.message,
      }),
    );
    return err(500, "internal");
  }

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: process.env.POSTS_TABLE,
        Key: { teamId: postKey.teamId, createdAt: postKey.createdAt },
        UpdateExpression: "ADD commentCount :one",
        ExpressionAttributeValues: { ":one": 1 },
      }),
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "commentCount increment failed",
        postId,
        commentId: comment.id,
        cause: e.message,
      }),
    );
    return err(500, "internal");
  }

  return ok(201, { comment });
};
