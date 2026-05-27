const {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const { evaluateBadges } = require("./badges");

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

const REQUIRED_ENV = [
  "CONNECTIONS_TABLE",
  "ANSWERS_TABLE",
  "SCORES_TABLE",
  "WS_ENDPOINT",
];

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
  const start = Date.now();

  const { matchId, predictionId, correctOption } = event;
  if (!matchId || !predictionId || typeof correctOption !== "number") {
    console.error(
      JSON.stringify({ level: "ERROR", message: "invalid event payload", event }),
    );
    return { statusCode: 400 };
  }

  const api = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_ENDPOINT,
  });

  const connections = await getActiveConnections(matchId);

  let answers = [];
  let answersReadOk = true;
  try {
    answers = await getAnswers(predictionId);
  } catch (e) {
    answersReadOk = false;
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "answers read failed",
        predictionId,
        cause: e.message,
      }),
    );
  }

  // No answers — emit PREDICTION_RESULT only
  if (answersReadOk && answers.length === 0) {
    await broadcast(api, connections, {
      type: "PREDICTION_RESULT",
      predictionId,
      correctOption,
    });
    console.log(
      JSON.stringify({
        level: "INFO",
        message: "resolved with no answers",
        predictionId,
        durationMs: Date.now() - start,
      }),
    );
    return { statusCode: 200 };
  }

  // Update scores per user
  const scoreUpdates = [];
  if (answersReadOk) {
    for (const answer of answers) {
      try {
        const updated = await updateUserScore({
          matchId,
          userId: answer.userId,
          predictionId,
          selectedOption: answer.selectedOption,
          gpsMultiplier: answer.gpsMultiplier,
          correctOption,
        });
        if (updated) scoreUpdates.push(updated);
      } catch (e) {
        console.error(
          JSON.stringify({
            level: "ERROR",
            message: "score update failed",
            matchId,
            userId: answer.userId,
            predictionId,
            cause: e.message,
          }),
        );
      }
    }
  }

  // Always emit PREDICTION_RESULT
  await broadcast(api, connections, {
    type: "PREDICTION_RESULT",
    predictionId,
    correctOption,
  });

  // Emit SCORE_UPDATE per connection (includes streak + badges)
  if (answersReadOk && scoreUpdates.length > 0) {
    await sendScoreUpdates(api, connections, scoreUpdates);
  }

  // Compute and emit PRESSURE_UPDATE
  if (answersReadOk && answers.length > 0) {
    try {
      const pressureBar = await computePressureBar(matchId, answers, correctOption);
      if (pressureBar) {
        await broadcast(api, connections, {
          type: "PRESSURE_UPDATE",
          pressureBar,
        });
      }
    } catch (e) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          message: "pressure update failed",
          matchId,
          cause: e.message,
        }),
      );
    }
  }

  console.log(
    JSON.stringify({
      level: "INFO",
      message: "resolved",
      predictionId,
      answersCount: answers.length,
      scoreUpdatesCount: scoreUpdates.length,
      durationMs: Date.now() - start,
    }),
  );

  return { statusCode: 200 };
};

async function getActiveConnections(matchId) {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      KeyConditionExpression: "matchId = :matchId",
      ExpressionAttributeValues: { ":matchId": { S: matchId } },
    }),
  );
  return (result.Items ?? []).map((item) => ({
    connectionId: item.connectionId.S,
    userId: item.userId?.S,
  }));
}

async function getAnswers(predictionId) {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.ANSWERS_TABLE,
      KeyConditionExpression: "predictionId = :p",
      ExpressionAttributeValues: { ":p": { S: predictionId } },
    }),
  );
  return (result.Items ?? []).map((item) => ({
    userId: item.userId.S,
    selectedOption: Number(item.selectedOption.N),
    gpsMultiplier: Number(item.gpsMultiplier.N),
    teamId: item.teamId?.S ?? null,
  }));
}

async function updateUserScore({
  matchId,
  userId,
  predictionId,
  selectedOption,
  gpsMultiplier,
  correctOption,
}) {
  let mult = gpsMultiplier;
  if (mult !== 1 && mult !== 2) {
    console.warn(
      JSON.stringify({
        level: "WARN",
        message: "invalid gpsMultiplier",
        predictionId,
        userId,
        received: gpsMultiplier,
      }),
    );
    mult = 1;
  }

  const correct = selectedOption === correctOption;
  const now = new Date().toISOString();
  const scoreInc = correct ? 10 * mult : 0;

  // Build UpdateExpression depending on correct/wrong (streak logic differs)
  let updateExpr;
  let exprValues;

  if (correct) {
    updateExpr =
      "ADD score :scoreInc, correctCount :one, multiplierAppliedCount :mInc, processedPredictions :pidSet " +
      "SET lastUpdatedAt = :now, " +
      "    currentStreak = if_not_exists(currentStreak, :zero) + :one";
    exprValues = {
      ":scoreInc": { N: String(scoreInc) },
      ":one": { N: "1" },
      ":mInc": { N: mult === 2 ? "1" : "0" },
      ":pidSet": { SS: [predictionId] },
      ":pid": { S: predictionId },
      ":now": { S: now },
      ":zero": { N: "0" },
    };
  } else {
    updateExpr =
      "ADD score :scoreInc, wrongCount :one, processedPredictions :pidSet " +
      "SET lastUpdatedAt = :now, currentStreak = :zero";
    exprValues = {
      ":scoreInc": { N: "0" },
      ":one": { N: "1" },
      ":pidSet": { SS: [predictionId] },
      ":pid": { S: predictionId },
      ":now": { S: now },
      ":zero": { N: "0" },
    };
  }

  let res;
  try {
    res = await dynamo.send(
      new UpdateItemCommand({
        TableName: process.env.SCORES_TABLE,
        Key: {
          matchId: { S: matchId },
          userId: { S: userId },
        },
        UpdateExpression: updateExpr,
        ConditionExpression:
          "attribute_not_exists(processedPredictions) OR NOT contains(processedPredictions, :pid)",
        ExpressionAttributeValues: exprValues,
        ReturnValues: "ALL_NEW",
      }),
    );
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") {
      return null; // idempotency — already processed
    }
    throw e;
  }

  const attrs = res.Attributes ?? {};
  const currentStreak = Number(attrs.currentStreak?.N ?? 0);
  const bestStreak = Number(attrs.bestStreak?.N ?? 0);

  // Update bestStreak if currentStreak surpassed it
  if (correct && currentStreak > bestStreak) {
    try {
      await dynamo.send(
        new UpdateItemCommand({
          TableName: process.env.SCORES_TABLE,
          Key: {
            matchId: { S: matchId },
            userId: { S: userId },
          },
          UpdateExpression: "SET bestStreak = :cs",
          ExpressionAttributeValues: { ":cs": { N: String(currentStreak) } },
        }),
      );
    } catch (e) {
      // Non-critical — log and continue
      console.warn(
        JSON.stringify({
          level: "WARN",
          message: "bestStreak update failed",
          userId,
          cause: e.message,
        }),
      );
    }
  }

  // Evaluate and persist badges
  const scoreState = {
    score: Number(attrs.score?.N ?? 0),
    correctCount: Number(attrs.correctCount?.N ?? 0),
    wrongCount: Number(attrs.wrongCount?.N ?? 0),
    currentStreak,
    multiplierAppliedCount: Number(attrs.multiplierAppliedCount?.N ?? 0),
  };

  const { newlyUnlocked } = evaluateBadges(attrs.badges?.SS ?? [], scoreState);

  if (newlyUnlocked.length > 0) {
    try {
      await dynamo.send(
        new UpdateItemCommand({
          TableName: process.env.SCORES_TABLE,
          Key: {
            matchId: { S: matchId },
            userId: { S: userId },
          },
          UpdateExpression: "ADD badges :newBadges",
          ExpressionAttributeValues: { ":newBadges": { SS: newlyUnlocked } },
        }),
      );
    } catch (e) {
      console.warn(
        JSON.stringify({
          level: "WARN",
          message: "badges update failed",
          userId,
          cause: e.message,
        }),
      );
    }
  }

  return {
    userId,
    score: scoreState.score,
    correctCount: scoreState.correctCount,
    wrongCount: scoreState.wrongCount,
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
    badgesUnlocked: newlyUnlocked.length > 0 ? newlyUnlocked : undefined,
  };
}

async function broadcast(api, connections, message) {
  const data = Buffer.from(JSON.stringify(message));
  await Promise.allSettled(
    connections.map((c) => sendOne(api, c.connectionId, data)),
  );
}

async function sendScoreUpdates(api, connections, scoreUpdates) {
  const byUser = new Map();
  for (const s of scoreUpdates) byUser.set(s.userId, s);

  await Promise.allSettled(
    connections
      .filter((c) => c.userId && byUser.has(c.userId))
      .map((c) => {
        const s = byUser.get(c.userId);
        const message = {
          type: "SCORE_UPDATE",
          userId: s.userId,
          score: s.score,
          correctCount: s.correctCount,
          wrongCount: s.wrongCount,
          currentStreak: s.currentStreak,
          bestStreak: s.bestStreak,
          badgesUnlocked: s.badgesUnlocked,
        };
        return sendOne(api, c.connectionId, Buffer.from(JSON.stringify(message)));
      }),
  );
}

async function sendOne(api, connectionId, data) {
  try {
    await api.send(
      new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }),
    );
  } catch (e) {
    if (e.name === "GoneException") return;
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "ws send failed",
        connectionId,
        cause: e.message,
      }),
    );
  }
}

async function computePressureBar(matchId, answers, correctOption) {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.SCORES_TABLE,
      KeyConditionExpression: "matchId = :m",
      ExpressionAttributeValues: { ":m": { S: matchId } },
    }),
  );

  const totalByTeam = {};
  for (const item of result.Items ?? []) {
    const userId = item.userId?.S;
    const score = Number(item.score?.N ?? 0);
    if (!userId || score === 0) continue;

    const answerForUser = answers.find((a) => a.userId === userId);
    const tid = answerForUser?.teamId ?? null;
    if (!tid) continue;
    totalByTeam[tid] = (totalByTeam[tid] ?? 0) + score;
  }

  const scoreA = totalByTeam["team-a"] ?? 0;
  const scoreB = totalByTeam["team-b"] ?? 0;
  const total = scoreA + scoreB;

  if (total === 0) return null;

  return {
    teamA: Math.round((scoreA / total) * 100),
    teamB: Math.round((scoreB / total) * 100),
  };
}
