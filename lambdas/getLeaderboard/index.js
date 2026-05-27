const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

const REQUIRED_ENV = ["SCORES_TABLE"];

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

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

exports.handler = async (event) => {
  assertEnv();

  const matchId = event.queryStringParameters?.matchId;
  const limit = Math.min(
    parseInt(event.queryStringParameters?.limit ?? "10", 10),
    100,
  );

  if (!matchId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "matchId required" }),
    };
  }

  let result;
  try {
    result = await dynamo.send(
      new QueryCommand({
        TableName: process.env.SCORES_TABLE,
        IndexName: "score-index",
        KeyConditionExpression: "matchId = :m",
        ExpressionAttributeValues: { ":m": { S: matchId } },
        ScanIndexForward: false, // descending by score
        Limit: limit,
      }),
    );
  } catch (e) {
    console.error(
      JSON.stringify({ level: "ERROR", message: "dynamo query failed", cause: e.message }),
    );
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "internal error" }),
    };
  }

  const leaderboard = (result.Items ?? []).map((item, idx) => ({
    rank: idx + 1,
    userId: item.userId.S,
    userName: item.userName?.S ?? "Anônimo",
    teamId: item.teamId?.S ?? null,
    score: Number(item.score?.N ?? 0),
    correctCount: Number(item.correctCount?.N ?? 0),
    wrongCount: Number(item.wrongCount?.N ?? 0),
    currentStreak: Number(item.currentStreak?.N ?? 0),
    bestStreak: Number(item.bestStreak?.N ?? 0),
    badges: item.badges?.SS ?? [],
  }));

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ leaderboard }),
  };
};
