const {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const { connectionId } = event.requestContext;

  // Query GSI to find the matchId for this connectionId
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      IndexName: "connectionId-index",
      KeyConditionExpression: "connectionId = :cid",
      ExpressionAttributeValues: { ":cid": { S: connectionId } },
    }),
  );

  // Delete all items for this connectionId
  if (result.Items && result.Items.length > 0) {
    await Promise.allSettled(
      result.Items.map((item) =>
        dynamo.send(
          new DeleteItemCommand({
            TableName: process.env.CONNECTIONS_TABLE,
            Key: {
              matchId: item.matchId,
              connectionId: item.connectionId,
            },
          }),
        ),
      ),
    );
  }

  return { statusCode: 200, body: "Disconnected" };
};
