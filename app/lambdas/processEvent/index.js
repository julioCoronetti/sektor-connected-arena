const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const {
  SchedulerClient,
  CreateScheduleCommand,
} = require("@aws-sdk/client-scheduler");

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const scheduler = new SchedulerClient({ region: process.env.AWS_REGION });

const RELEVANT_EVENTS = ["GOAL", "CORNER", "FOUL", "YELLOW_CARD"];
const PREDICTION_TTL_MS = 15_000;

const REQUIRED_ENV = [
  "CONNECTIONS_TABLE",
  "WS_ENDPOINT",
  "RESOLVE_ANSWER_FUNCTION_ARN",
  "SCHEDULER_TARGET_ROLE_ARN",
  "SCHEDULER_GROUP_NAME",
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

  for (const record of event.Records) {
    const payload = JSON.parse(
      Buffer.from(record.kinesis.data, "base64").toString(),
    );

    if (!RELEVANT_EVENTS.includes(payload.eventType)) continue;

    let prediction;
    try {
      prediction = await generatePrediction(payload);
    } catch (e) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          message: "bedrock failure",
          matchId: payload.matchId,
          cause: e.message,
        }),
      );
      continue;
    }

    try {
      await schedulePredictionResolution(prediction.prediction);
    } catch (e) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          message: "scheduler create failed",
          matchId: prediction.prediction.matchId,
          predictionId: prediction.prediction.id,
          cause: e.message,
        }),
      );
      // R1 AC4: descartar a predição e ack no Kinesis sem propagar exceção.
      continue;
    }

    const connections = await getActiveConnections(prediction.prediction.matchId);
    await distributeToConnections(connections, prediction);
  }
};

async function generatePrediction(event) {
  const prompt = `Você é um assistente de futebol. Ocorreu um evento: ${event.eventType} no minuto ${event.minute}.
Gere uma pergunta de predição rápida em português com 4 opções de resposta.
Responda APENAS com JSON válido no formato:
{"question": "...", "options": ["...", "...", "...", "..."], "correctOption": 0}
A pergunta deve ser sobre o que vai acontecer nos próximos 30 segundos.`;

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: "amazon.nova-lite-v1:0",
      body: JSON.stringify({
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 256, temperature: 0.7 },
      }),
      contentType: "application/json",
      accept: "application/json",
    }),
  );

  const body = JSON.parse(Buffer.from(response.body).toString());
  const parsed = JSON.parse(body.output.message.content[0].text);

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + PREDICTION_TTL_MS);

  return {
    type: "PREDICTION",
    prediction: {
      id: `pred-${createdAt.getTime()}`,
      matchId: event.matchId,
      question: parsed.question,
      options: parsed.options,
      correctOption: parsed.correctOption,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

async function schedulePredictionResolution(prediction) {
  // EventBridge Scheduler exige `at(yyyy-mm-ddTHH:MM:SS)` sem timezone nem ms.
  const at = new Date(prediction.expiresAt)
    .toISOString()
    .split(".")[0];

  const scheduleName = `resolve-${prediction.id}`;

  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: process.env.SCHEDULER_GROUP_NAME,
      ScheduleExpression: `at(${at})`,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      ActionAfterCompletion: "DELETE",
      Target: {
        Arn: process.env.RESOLVE_ANSWER_FUNCTION_ARN,
        RoleArn: process.env.SCHEDULER_TARGET_ROLE_ARN,
        Input: JSON.stringify({
          matchId: prediction.matchId,
          predictionId: prediction.id,
          correctOption: prediction.correctOption,
          expiresAt: prediction.expiresAt,
        }),
      },
    }),
  );
}

async function getActiveConnections(matchId) {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      KeyConditionExpression: "matchId = :matchId",
      ExpressionAttributeValues: { ":matchId": { S: matchId } },
    }),
  );
  return result.Items?.map((item) => item.connectionId.S) ?? [];
}

async function distributeToConnections(connectionIds, message) {
  const api = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_ENDPOINT,
  });

  // Cliente recebe predição sem `correctOption` (anti-cheat).
  const safeMessage = {
    type: "PREDICTION",
    prediction: { ...message.prediction },
  };
  delete safeMessage.prediction.correctOption;
  const data = Buffer.from(JSON.stringify(safeMessage));

  await Promise.allSettled(
    connectionIds.map((connectionId) =>
      api.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: data,
        }),
      ),
    ),
  );
}
