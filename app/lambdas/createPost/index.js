const { randomUUID } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);

const REQUIRED_ENV = ["POSTS_TABLE"];
const IMAGE_URL_PREFIX = "https://sektor-media-bucket.s3.";

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

  const teamId = claims["custom:teamId"];
  if (!teamId) return err(400, "teamId claim missing");

  const hasImageUrl = body.imageUrl !== undefined && body.imageUrl !== null;
  if (hasImageUrl) {
    if (
      typeof body.imageUrl !== "string" ||
      !body.imageUrl.startsWith(IMAGE_URL_PREFIX)
    ) {
      return err(400, "invalid imageUrl");
    }
  }

  const post = {
    id: randomUUID(),
    authorId: claims.sub,
    authorName: claims.name || claims.email,
    teamId,
    text: text.trim(),
    ...(hasImageUrl && { imageUrl: body.imageUrl }),
    likes: 0,
    commentCount: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: process.env.POSTS_TABLE,
        Item: post,
      }),
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "post persist failed",
        postId: post.id,
        teamId,
        cause: e.message,
      }),
    );
    return err(500, "internal");
  }

  return ok(201, { post });
};
