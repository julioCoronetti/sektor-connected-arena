const {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

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
      JSON.stringify({
        level: "ERROR",
        message: "invalid event payload",
        event,
      }),
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

  // R5 AC6: nenhuma resposta → emitir somente PREDICTION_RESULT.
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

  // Atualiza scores por usuário.
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
        // Continua processando os demais users.
      }
    }
  }

  // Sempre emite PREDICTION_RESULT.
  await broadcast(api, connections, {
    type: "PREDICTION_RESULT",
    predictionId,
    correctOption,
  });

  // Emite SCORE_UPDATE individual por conexão pertencente ao userId.
  if (answersReadOk && scoreUpdates.length > 0) {
    await sendScoreUpdates(api, connections, scoreUpdates);
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

  // Idempotência: registramos `lastPredictionId` em um set; se o predictionId
  // já estiver, não aplica incrementos de novo.
  const params = {
    TableName: process.env.SCORES_TABLE,
    Key: {
      matchId: { S: matchId },
      userId: { S: userId },
    },
    UpdateExpression:
      "ADD score :scoreInc, correctCount :cInc, wrongCount :wInc, multiplierAppliedCount :mInc, processedPredictions :pidSet " +
      "SET lastUpdatedAt = :now",
    ConditionExpression:
      "attribute_not_exists(processedPredictions) OR NOT contains(processedPredictions, :pid)",
    ExpressionAttributeValues: {
      ":scoreInc": { N: String(correct ? 10 * mult : 0) },
      ":cInc": { N: correct ? "1" : "0" },
      ":wInc": { N: correct ? "0" : "1" },
      ":mInc": { N: correct && mult === 2 ? "1" : "0" },
      ":pidSet": { SS: [predictionId] },
      ":pid": { S: predictionId },
      ":now": { S: now },
    },
    ReturnValues: "ALL_NEW",
  };

  let res;
  try {
    res = await dynamo.send(new UpdateItemCommand(params));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") {
      // Já processado anteriormente (idempotência).
      return null;
    }
    throw e;
  }

  const attrs = res.Attributes ?? {};
  return {
    userId,
    score: Number(attrs.score?.N ?? 0),
    correctCount: Number(attrs.correctCount?.N ?? 0),
    wrongCount: Number(attrs.wrongCount?.N ?? 0),
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
    if (e.name === "GoneException") return; // conexão expirada — segue.
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
