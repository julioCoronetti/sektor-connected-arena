const { DynamoDBClient, QueryCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  // This Lambda is triggered when a prediction timer expires.
  // It calculates pressure deltas and sends PRESSURE_UPDATE to all connections.
  const { matchId, predictionId, correctOption } = event;

  // Get active connections
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      KeyConditionExpression: "matchId = :matchId",
      ExpressionAttributeValues: { ":matchId": { S: matchId } },
    }),
  );
  const connectionIds = result.Items?.map((item) => item.connectionId.S) ?? [];

  // Send PREDICTION_RESULT + PRESSURE_UPDATE
  const api = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_ENDPOINT,
  });

  const resultMessage = {
    type: "PREDICTION_RESULT",
    predictionId,
    correctOption,
  };

  // Simple pressure calculation: random delta for demo
  const pressureUpdate = {
    type: "PRESSURE_UPDATE",
    pressureBar: {
      teamA: 40 + Math.random() * 20,
      teamB: 40 + Math.random() * 20,
    },
  };

  await Promise.allSettled(
    connectionIds.flatMap((connectionId) => [
      api.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(resultMessage)),
        }),
      ),
      api.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(pressureUpdate)),
        }),
      ),
    ]),
  );

  return { statusCode: 200 };
};
