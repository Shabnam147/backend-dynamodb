const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { ddb, TABLES } = require('../config/dynamo');

// Table schema:
//   Partition key: userId (String)  -> one cart item per user, matches the
//   "unique: true" constraint the Mongoose schema used to enforce.

const getTotal = (items = []) => items.reduce((sum, i) => sum + i.price * i.quantity, 0);

const findByUserId = async (userId) => {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.CARTS, Key: { userId } }));
  return Item || { userId, items: [] };
};

const save = async (userId, items) => {
  const cart = { userId, items, updatedAt: new Date().toISOString() };
  await ddb.send(new PutCommand({ TableName: TABLES.CARTS, Item: cart }));
  return { ...cart, totalAmount: getTotal(items) };
};

const clear = async (userId) => save(userId, []);

module.exports = { findByUserId, save, clear, getTotal };
