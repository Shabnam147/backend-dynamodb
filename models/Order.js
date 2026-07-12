const { v4: uuidv4 } = require('uuid');
const { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { ddb, TABLES } = require('../config/dynamo');

// Table schema:
//   Partition key: orderId (String)
//   GSI: userId-index -> partition key: userId, sort key: createdAt
//   (lets us fetch "my orders" sorted by newest-first without a full Scan)

const findById = async (orderId) => {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.ORDERS, Key: { orderId } }));
  return Item || null;
};

const findByUser = async (userId) => {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: TABLES.ORDERS,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      ScanIndexForward: false, // newest first
    })
  );
  return Items || [];
};

const findAll = async () => {
  const { Items } = await ddb.send(new ScanCommand({ TableName: TABLES.ORDERS }));
  return (Items || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const create = async ({ userId, items, totalAmount, shippingAddress }) => {
  const now = new Date().toISOString();
  const order = {
    orderId: uuidv4(),
    userId,
    items,
    totalAmount,
    shippingAddress: shippingAddress || {},
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  await ddb.send(new PutCommand({ TableName: TABLES.ORDERS, Item: order }));
  return order;
};

const updateStatus = async (orderId, status) => {
  const { Attributes } = await ddb.send(
    new UpdateCommand({
      TableName: TABLES.ORDERS,
      Key: { orderId },
      UpdateExpression: 'SET #s = :s, updatedAt = :u',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status, ':u': new Date().toISOString() },
      ReturnValues: 'ALL_NEW',
      ConditionExpression: 'attribute_exists(orderId)',
    })
  );
  return Attributes;
};

module.exports = { findById, findByUser, findAll, create, updateStatus };
