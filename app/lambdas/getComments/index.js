const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);

const REQUIRED_ENV = ["COMMENTS_TABLE"];

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

function toCommentShape(item) {
  return {
    id: item.id,
    postId: item.postId,
    authorId: item.authorId,
    authorName: item.authorName,
    text: item.text,
    createdAt: item.createdAt,
  };
}

exports.handler = async (event) => {
  assertEnv();
  const start = Date.now();

  const claims = getClaims(event);
  if (!claims) {
    return err(401, "unauthenticated");
  }

  const postId = event?.pathParameters?.postId;
  if (typeof postId !== "string" || postId.length === 0) {
    return err(400, "postId required");
  }

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: process.env.COMMENTS_TABLE,
        KeyConditionExpression: "postId = :p",
        ExpressionAttributeValues: { ":p": postId },
        ScanIndexForward: true,
      }),
    );

    const comments = (result.Items ?? []).map(toCommentShape);

    console.log(
      JSON.stringify({
        level: "INFO",
        message: "getComments ok",
        postId,
        count: comments.length,
        durationMs: Date.now() - start,
      }),
    );

    return ok(200, { comments });
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "getComments failed",
        postId,
        cause: e.message,
      }),
    );
    return err(500, "internal");
  }
};
