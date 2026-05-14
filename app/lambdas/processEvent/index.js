const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

const RELEVANT_EVENTS = ["GOAL", "CORNER", "FOUL", "YELLOW_CARD"];

exports.handler = async (event) => {
  for (const record of event.Records) {
    const payload = JSON.parse(
      Buffer.from(record.kinesis.data, "base64").toString(),
    );

    if (!RELEVANT_EVENTS.includes(payload.eventType)) continue;

    const prompt = buildPrompt(payload);
    let prediction;
    try {
      prediction = await generatePrediction(prompt, payload);
    } catch (e) {
      console.error("[Bedrock] Falha ao gerar predição:", e);
      continue;
    }

    const connections = await getActiveConnections(payload.matchId);
    await distributeToConnections(connections, prediction);
  }
};

function buildPrompt(event) {
  return `Você é um assistente de futebol. Ocorreu um evento: ${event.eventType} no minuto ${event.minute}.
Gere uma pergunta de predição rápida em português com 4 opções de resposta.
Responda APENAS com JSON válido no formato:
{"question": "...", "options": ["...", "...", "...", "..."], "correctOption": 0}
A pergunta deve ser sobre o que vai acontecer nos próximos 30 segundos.`;
}

async function generatePrediction(prompt, event) {
  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
      contentType: "application/json",
      accept: "application/json",
    }),
  );

  const body = JSON.parse(Buffer.from(response.body).toString());
  const parsed = JSON.parse(body.content[0].text);

  return {
    type: "PREDICTION",
    prediction: {
      id: `pred-${Date.now()}`,
      matchId: event.matchId,
      question: parsed.question,
      options: parsed.options,
      correctOption: parsed.correctOption,
      expiresAt: new Date(Date.now() + 15000).toISOString(),
    },
  };
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

  await Promise.allSettled(
    connectionIds.map((connectionId) =>
      api.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(message)),
        }),
      ),
    ),
  );
}
