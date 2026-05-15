const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  console.log("EVENT:", JSON.stringify(event));
  const { connectionId } = event.requestContext ?? {};
  const matchId = event.queryStringParameters?.matchId ?? "unknown";

  await dynamo.send(
    new PutItemCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Item: {
        matchId: { S: matchId },
        connectionId: { S: connectionId },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 7200) },
      },
    }),
  );

  return { statusCode: 200, body: "Connected" };
};
